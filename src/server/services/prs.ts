// PR engine — docs/SPEC.md §6. Strictly-greater upsert per (user, exercise,
// record_type); warmups never count; only published workouts count. Both entry
// points expect to run inside the caller's transaction.
import type { AppDb } from '../db/client'
import type { MetricType, NewPr, RecordType } from '../../shared/types'

interface CandidateSetRow {
  set_id: number
  exercise_id: number
  metric_type: MetricType
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  est_1rm_kg: number | null
}

/** Record-type candidates a single non-warmup set produces — docs/SPEC.md §6. */
function setCandidates(row: CandidateSetRow): { recordType: RecordType; value: number }[] {
  const out: { recordType: RecordType; value: number }[] = []
  switch (row.metric_type) {
    case 'weight_reps':
      if (row.weight_kg !== null && row.reps !== null && row.reps >= 1) {
        out.push({ recordType: 'max_weight', value: row.weight_kg })
      }
      if (row.est_1rm_kg !== null) out.push({ recordType: 'max_est_1rm', value: row.est_1rm_kg })
      break
    case 'bodyweight_reps':
      if (row.reps !== null) out.push({ recordType: 'max_reps', value: row.reps })
      if (row.weight_kg !== null && row.weight_kg > 0) {
        out.push({ recordType: 'max_weight', value: row.weight_kg })
      }
      break
    case 'duration':
      if (row.duration_s !== null) out.push({ recordType: 'max_duration', value: row.duration_s })
      break
    case 'distance_duration':
      if (row.distance_m !== null) out.push({ recordType: 'max_distance', value: row.distance_m })
      break
  }
  return out
}

interface BestCandidate {
  exerciseId: number
  recordType: RecordType
  value: number
  setId: number
}

/** Fold rows (already in scan order) into per-(exercise, record_type) winners.
 * Strictly-greater replaces, so the earliest row wins ties. */
function bestCandidates(rows: CandidateSetRow[]): Map<string, BestCandidate> {
  const best = new Map<string, BestCandidate>()
  for (const row of rows) {
    for (const c of setCandidates(row)) {
      const key = `${row.exercise_id}:${c.recordType}`
      const cur = best.get(key)
      if (!cur || c.value > cur.value) {
        best.set(key, {
          exerciseId: row.exercise_id,
          recordType: c.recordType,
          value: c.value,
          setId: row.set_id,
        })
      }
    }
  }
  return best
}

/**
 * Inside the publish transaction: detect + upsert PRs for this workout, mark
 * achieving sets is_pr=1, set workouts.pr_count. Returns the new PRs.
 * Does NOT send notifications (caller does, so republish never re-notifies).
 */
export function applyPrsOnPublish(db: AppDb, userId: number, workoutId: number, publishedAt: number): NewPr[] {
  db.prepare(
    `UPDATE sets SET is_pr = 0
     WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
  ).run(workoutId)

  const rows = db
    .prepare<unknown[], CandidateSetRow & { exercise_name: string }>(
      `SELECT s.id AS set_id, we.exercise_id, e.name AS exercise_name, e.metric_type,
              s.weight_kg, s.reps, s.duration_s, s.distance_m, s.est_1rm_kg
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE we.workout_id = ? AND s.set_type <> 'warmup'
       ORDER BY we.position, s.position`,
    )
    .all(workoutId)
  const nameByExercise = new Map(rows.map((r) => [r.exercise_id, r.exercise_name]))

  const getPrev = db.prepare<unknown[], { value: number }>(
    `SELECT value FROM personal_records WHERE user_id = ? AND exercise_id = ? AND record_type = ?`,
  )
  const upsert = db.prepare(
    `INSERT INTO personal_records
       (user_id, exercise_id, record_type, value, set_id, workout_id, achieved_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, exercise_id, record_type) DO UPDATE SET
       value = excluded.value, set_id = excluded.set_id, workout_id = excluded.workout_id,
       achieved_at = excluded.achieved_at, updated_at = excluded.updated_at
     WHERE excluded.value > personal_records.value`,
  )
  const markPr = db.prepare(`UPDATE sets SET is_pr = 1 WHERE id = ?`)

  const newPrs: NewPr[] = []
  for (const b of bestCandidates(rows).values()) {
    const prev = getPrev.get(userId, b.exerciseId, b.recordType)
    const result = upsert.run(userId, b.exerciseId, b.recordType, b.value, b.setId, workoutId, publishedAt, publishedAt)
    if (result.changes > 0) {
      markPr.run(b.setId)
      newPrs.push({
        exerciseName: nameByExercise.get(b.exerciseId) ?? '',
        recordType: b.recordType,
        value: b.value,
        previousValue: prev ? prev.value : null,
      })
    }
  }

  db.prepare(`UPDATE workouts SET pr_count = ? WHERE id = ?`).run(newPrs.length, workoutId)
  return newPrs
}

/**
 * Rebuild personal_records + sets.is_pr for the given (user, exercise) pairs from
 * remaining published non-warmup history. Earliest published_at wins ties.
 * Never sends notifications; never touches historical workouts.pr_count.
 */
export function recomputePRs(db: AppDb, userId: number, exerciseIds: number[]): void {
  const ids = [...new Set(exerciseIds)]
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')

  db.prepare(
    `UPDATE sets SET is_pr = 0
     WHERE is_pr = 1 AND workout_exercise_id IN (
       SELECT we.id FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.user_id = ? AND we.exercise_id IN (${ph})
     )`,
  ).run(userId, ...ids)

  db.prepare(`DELETE FROM personal_records WHERE user_id = ? AND exercise_id IN (${ph})`).run(userId, ...ids)

  const rows = db
    .prepare<unknown[], CandidateSetRow & { workout_id: number; published_at: number }>(
      `SELECT s.id AS set_id, we.exercise_id, e.metric_type,
              s.weight_kg, s.reps, s.duration_s, s.distance_m, s.est_1rm_kg,
              w.id AS workout_id, w.published_at
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE w.user_id = ? AND w.status = 'published' AND s.set_type <> 'warmup'
         AND we.exercise_id IN (${ph})
       ORDER BY w.published_at ASC, w.id ASC, we.position ASC, s.position ASC`,
    )
    .all(userId, ...ids)
  const setOrigin = new Map(rows.map((r) => [r.set_id, r]))

  const insert = db.prepare(
    `INSERT INTO personal_records
       (user_id, exercise_id, record_type, value, set_id, workout_id, achieved_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const markPr = db.prepare(`UPDATE sets SET is_pr = 1 WHERE id = ?`)

  for (const b of bestCandidates(rows).values()) {
    const origin = setOrigin.get(b.setId)
    if (!origin) continue
    insert.run(userId, b.exerciseId, b.recordType, b.value, b.setId, origin.workout_id, origin.published_at, origin.published_at)
    markPr.run(b.setId)
  }
}
