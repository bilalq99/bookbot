// Workout domain core: create / update / publish / delete with full validation
// (zod + validateSetForMetric naming exercises[i].sets[j]), denormalized totals,
// est_1rm_kg on write, media attach, PR recompute. See docs/SPEC.md §4-7.
import fs from 'node:fs'
import path from 'node:path'
import type { AppDb } from '../db/client'
import type {
  MetricType,
  NewPr,
  PublishResponse,
  SetIn,
  WorkoutDetail,
  WorkoutExerciseIn,
  WorkoutIn,
} from '../../shared/types'
import { validateSetForMetric, workoutInSchema } from '../../shared/validation'
import { computeTotals, estimate1rm } from '../../shared/formulas'
import { ApiError, notFound, validate } from '../lib/http'
import { config } from '../config'
import { getWorkoutDetail } from './cards'
import { applyPrsOnPublish, recomputePRs } from './prs'
import { notifyPr } from './notify'

interface OwnedWorkoutRow {
  id: number
  user_id: number
  status: 'draft' | 'published'
  published_at: number | null
}

/** Load a workout the caller owns; 404 for missing/others' drafts, 403 otherwise. */
function loadOwned(db: AppDb, userId: number, workoutId: number): OwnedWorkoutRow {
  const row = db
    .prepare<unknown[], OwnedWorkoutRow>(`SELECT id, user_id, status, published_at FROM workouts WHERE id = ?`)
    .get(workoutId)
  if (!row) throw notFound()
  if (row.user_id !== userId) {
    if (row.status === 'draft') throw notFound()
    throw new ApiError(403, 'forbidden', 'Not your workout')
  }
  return row
}

function mustDetail(db: AppDb, workoutId: number, viewerId: number): WorkoutDetail {
  const detail = getWorkoutDetail(db, workoutId, viewerId)
  if (!detail) throw notFound()
  return detail
}

interface ResolvedExercise {
  exerciseId: number
  metricType: MetricType
  notes: string
  sets: SetIn[]
}

/** Resolve exercise ids (global or own custom) and run per-metric set validation. */
function resolveExercises(db: AppDb, userId: number, exercises: WorkoutExerciseIn[]): ResolvedExercise[] {
  const getExercise = db.prepare<unknown[], { id: number; metric_type: MetricType }>(
    `SELECT id, metric_type FROM exercises WHERE id = ? AND (created_by IS NULL OR created_by = ?)`,
  )
  return exercises.map((ex, i) => {
    const row = getExercise.get(ex.exerciseId, userId)
    if (!row) {
      throw new ApiError(400, 'validation_error', `exercises[${i}].exerciseId: exercise ${ex.exerciseId} not found`)
    }
    ex.sets.forEach((set, j) => {
      const err = validateSetForMetric(row.metric_type, set)
      if (err) throw new ApiError(400, 'validation_error', `exercises[${i}].sets[${j}]: ${err}`)
    })
    return { exerciseId: ex.exerciseId, metricType: row.metric_type, notes: ex.notes ?? '', sets: ex.sets }
  })
}

function insertChildren(db: AppDb, workoutId: number, resolved: ResolvedExercise[]): void {
  const insertWe = db.prepare(
    `INSERT INTO workout_exercises (workout_id, exercise_id, position, notes) VALUES (?, ?, ?, ?)`,
  )
  const insertSet = db.prepare(
    `INSERT INTO sets (workout_exercise_id, position, set_type, weight_kg, reps, duration_s, distance_m, rpe, est_1rm_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  resolved.forEach((ex, i) => {
    const weId = Number(insertWe.run(workoutId, ex.exerciseId, i, ex.notes).lastInsertRowid)
    ex.sets.forEach((set, j) => {
      insertSet.run(
        weId,
        j,
        set.setType ?? 'normal',
        set.weightKg ?? null,
        set.reps ?? null,
        set.durationS ?? null,
        set.distanceM ?? null,
        set.rpe ?? null,
        estimate1rm(ex.metricType, set),
      )
    })
  })
}

/** Full media sync: each id must be the owner's and unattached-or-this-workout;
 * array order = position; previously attached ids not in the list are detached. */
function syncMedia(db: AppDb, userId: number, workoutId: number, mediaIds: number[]): void {
  if (new Set(mediaIds).size !== mediaIds.length) {
    throw new ApiError(400, 'validation_error', 'mediaIds: duplicate media id')
  }
  const getMedia = db.prepare<unknown[], { id: number; user_id: number; workout_id: number | null }>(
    `SELECT id, user_id, workout_id FROM media WHERE id = ?`,
  )
  for (const id of mediaIds) {
    const m = getMedia.get(id)
    if (!m || m.user_id !== userId || (m.workout_id !== null && m.workout_id !== workoutId)) {
      throw new ApiError(400, 'validation_error', `mediaIds: media ${id} is not attachable`)
    }
  }
  if (mediaIds.length === 0) {
    db.prepare(`UPDATE media SET workout_id = NULL, position = 0 WHERE workout_id = ?`).run(workoutId)
    return
  }
  const ph = mediaIds.map(() => '?').join(',')
  db.prepare(`UPDATE media SET workout_id = NULL, position = 0 WHERE workout_id = ? AND id NOT IN (${ph})`).run(
    workoutId,
    ...mediaIds,
  )
  const attach = db.prepare(`UPDATE media SET workout_id = ?, position = ? WHERE id = ?`)
  mediaIds.forEach((id, i) => attach.run(workoutId, i, id))
}

/** Recompute est_1rm_kg per set plus the denormalized totals from stored rows. */
function recomputeStored(db: AppDb, workoutId: number): void {
  const rows = db
    .prepare<unknown[], { id: number; set_type: string; weight_kg: number | null; reps: number | null; metric_type: MetricType }>(
      `SELECT s.id, s.set_type, s.weight_kg, s.reps, e.metric_type
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE we.workout_id = ?`,
    )
    .all(workoutId)
  const setEst = db.prepare(`UPDATE sets SET est_1rm_kg = ? WHERE id = ?`)
  let totalSets = 0
  let totalVolumeKg = 0
  for (const r of rows) {
    setEst.run(estimate1rm(r.metric_type, { weightKg: r.weight_kg ?? undefined, reps: r.reps ?? undefined }), r.id)
    if (r.set_type !== 'warmup') {
      totalSets += 1
      if (r.weight_kg !== null && r.reps !== null) totalVolumeKg += r.weight_kg * r.reps
    }
  }
  db.prepare(`UPDATE workouts SET total_sets = ?, total_volume_kg = ? WHERE id = ?`).run(
    totalSets,
    totalVolumeKg,
    workoutId,
  )
}

/** Create a draft workout (with nested exercises/sets/media). */
export function createWorkout(db: AppDb, userId: number, input: WorkoutIn, now: number): WorkoutDetail {
  const data = validate(workoutInSchema, input)
  const resolved = resolveExercises(db, userId, data.exercises ?? [])
  const totals = computeTotals(data.exercises ?? [])
  const workoutId = db.transaction(() => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO workouts
             (user_id, title, notes, status, started_at, duration_s, created_at, updated_at, total_sets, total_volume_kg)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          data.title ?? '',
          data.notes ?? '',
          data.startedAt ?? null,
          data.durationS ?? null,
          now,
          now,
          totals.totalSets,
          totals.totalVolumeKg,
        ).lastInsertRowid,
    )
    insertChildren(db, id, resolved)
    if (data.mediaIds !== undefined) syncMedia(db, userId, id, data.mediaIds)
    return id
  })()
  return mustDetail(db, workoutId, userId)
}

/**
 * Owner-only update. If input.exercises is present it fully replaces children.
 * If the workout is published: recompute totals + recomputePRs over (old ∪ new)
 * exercise ids. published_at never changes.
 */
export function updateWorkout(
  db: AppDb,
  userId: number,
  workoutId: number,
  input: WorkoutIn,
  now: number,
): WorkoutDetail {
  const data = validate(workoutInSchema, input)
  const workout = loadOwned(db, userId, workoutId)
  const resolved = data.exercises !== undefined ? resolveExercises(db, userId, data.exercises) : null
  db.transaction(() => {
    db.prepare(
      `UPDATE workouts SET
         title = COALESCE(?, title), notes = COALESCE(?, notes),
         started_at = COALESCE(?, started_at), duration_s = COALESCE(?, duration_s),
         updated_at = ?
       WHERE id = ?`,
    ).run(data.title ?? null, data.notes ?? null, data.startedAt ?? null, data.durationS ?? null, now, workoutId)
    if (resolved) {
      const oldExerciseIds = db
        .prepare<unknown[], { exercise_id: number }>(
          `SELECT DISTINCT exercise_id FROM workout_exercises WHERE workout_id = ?`,
        )
        .all(workoutId)
        .map((r) => r.exercise_id)
      db.prepare(`DELETE FROM workout_exercises WHERE workout_id = ?`).run(workoutId)
      insertChildren(db, workoutId, resolved)
      const totals = computeTotals(data.exercises ?? [])
      db.prepare(`UPDATE workouts SET total_sets = ?, total_volume_kg = ? WHERE id = ?`).run(
        totals.totalSets,
        totals.totalVolumeKg,
        workoutId,
      )
      if (workout.status === 'published') {
        recomputePRs(db, userId, [...oldExerciseIds, ...resolved.map((r) => r.exerciseId)])
      }
    }
    if (data.mediaIds !== undefined) syncMedia(db, userId, workoutId, data.mediaIds)
  })()
  return mustDetail(db, workoutId, userId)
}

/**
 * Owner-only publish (idempotent). First transition: sets status/published_at,
 * bumps users.workout_count, applies PRs, fans out pr notifications via notifyPr.
 * Republishing recomputes and returns current state with newPrs: [].
 */
export function publishWorkout(db: AppDb, userId: number, workoutId: number, now: number): PublishResponse {
  const workout = loadOwned(db, userId, workoutId)
  let newPrs: NewPr[] = []
  db.transaction(() => {
    recomputeStored(db, workoutId)
    if (workout.status === 'published') return
    const nonWarmup = db
      .prepare<unknown[], { n: number }>(
        `SELECT COUNT(*) AS n FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = ? AND s.set_type <> 'warmup'`,
      )
      .get(workoutId)!.n
    if (nonWarmup === 0) {
      throw new ApiError(400, 'validation_error', 'Cannot publish a session with no working sets')
    }
    db.prepare(`UPDATE workouts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`).run(
      now,
      now,
      workoutId,
    )
    newPrs = applyPrsOnPublish(db, userId, workoutId, now)
    db.prepare(`UPDATE users SET workout_count = workout_count + 1 WHERE id = ?`).run(userId)
    if (newPrs.length > 0) {
      notifyPr(
        db,
        userId,
        workoutId,
        newPrs.slice(0, 10).map((p) => ({ exerciseName: p.exerciseName, recordType: p.recordType, value: p.value })),
        now,
      )
    }
  })()
  return { workout: mustDetail(db, workoutId, userId), newPrs }
}

/** Owner-only delete; unlinks media files best-effort; recomputes PRs after. */
export function deleteWorkout(db: AppDb, userId: number, workoutId: number): void {
  const workout = loadOwned(db, userId, workoutId)
  const filePaths: string[] = []
  db.transaction(() => {
    const exerciseIds = db
      .prepare<unknown[], { exercise_id: number }>(
        `SELECT DISTINCT exercise_id FROM workout_exercises WHERE workout_id = ?`,
      )
      .all(workoutId)
      .map((r) => r.exercise_id)
    const media = db
      .prepare<unknown[], { file_path: string }>(`SELECT file_path FROM media WHERE workout_id = ?`)
      .all(workoutId)
    for (const m of media) filePaths.push(m.file_path)
    db.prepare(`DELETE FROM media WHERE workout_id = ?`).run(workoutId)
    db.prepare(`DELETE FROM workouts WHERE id = ?`).run(workoutId)
    if (workout.status === 'published') {
      db.prepare(`UPDATE users SET workout_count = workout_count - 1 WHERE id = ?`).run(userId)
    }
    recomputePRs(db, userId, exerciseIds)
  })()
  for (const filePath of filePaths) {
    try {
      fs.unlinkSync(path.join(config.uploadsDir, filePath))
    } catch {
      /* best-effort */
    }
  }
}
