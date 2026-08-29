// Batch hydration of workout rows into WorkoutCard / WorkoutDetail. One query per
// table — workouts+authors, workout_exercises JOIN exercises, sets, media, viewer
// likes — never one per workout. Used by feed, profile timeline, drafts list, and
// the single-workout endpoints. See docs/SPEC.md §7.
import type { AppDb } from '../db/client'
import type {
  Discipline,
  Equipment,
  MediaOut,
  MetricType,
  MuscleGroup,
  PlLift,
  SetOut,
  SetType,
  WorkoutCard,
  WorkoutDetail,
  WorkoutExerciseOut,
} from '../../shared/types'

interface WorkoutRow {
  id: number
  user_id: number
  title: string
  notes: string
  status: 'draft' | 'published'
  started_at: number | null
  duration_s: number | null
  published_at: number | null
  created_at: number
  updated_at: number
  like_count: number
  comment_count: number
  total_sets: number
  total_volume_kg: number
  pr_count: number
  username: string
  display_name: string
  bio: string
  follower_count: number
  following_count: number
  workout_count: number
}

interface WorkoutExerciseRow {
  id: number
  workout_id: number
  position: number
  notes: string
  ex_id: number
  slug: string | null
  name: string
  metric_type: MetricType
  muscle_group: MuscleGroup
  equipment: Equipment
  pl_lift: PlLift | null
  tags: string
  created_by: number | null
}

interface SetRow {
  id: number
  workout_exercise_id: number
  position: number
  set_type: SetType
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  rpe: number | null
  est_1rm_kg: number | null
  is_pr: number
}

interface MediaRow {
  id: number
  workout_id: number
  file_path: string
}

const placeholders = (n: number): string => Array(n).fill('?').join(',')

/** Batch WorkoutDetail hydration, input id order preserved; missing ids skipped. */
export function getWorkoutDetails(db: AppDb, workoutIds: number[], viewerId: number): WorkoutDetail[] {
  if (workoutIds.length === 0) return []
  const ph = placeholders(workoutIds.length)

  const workoutRows = db
    .prepare<unknown[], WorkoutRow>(
      `SELECT w.id, w.user_id, w.title, w.notes, w.status, w.started_at, w.duration_s,
              w.published_at, w.created_at, w.updated_at, w.like_count, w.comment_count,
              w.total_sets, w.total_volume_kg, w.pr_count,
              u.username, u.display_name, u.bio, u.follower_count, u.following_count, u.workout_count
       FROM workouts w
       JOIN users u ON u.id = w.user_id
       WHERE w.id IN (${ph})`,
    )
    .all(...workoutIds)

  const exerciseRows = db
    .prepare<unknown[], WorkoutExerciseRow>(
      `SELECT we.id, we.workout_id, we.position, we.notes,
              e.id AS ex_id, e.slug, e.name, e.metric_type, e.muscle_group, e.equipment,
              e.pl_lift, e.tags, e.created_by
       FROM workout_exercises we
       JOIN exercises e ON e.id = we.exercise_id
       WHERE we.workout_id IN (${ph})
       ORDER BY we.workout_id, we.position`,
    )
    .all(...workoutIds)

  const setRows = db
    .prepare<unknown[], SetRow>(
      `SELECT s.id, s.workout_exercise_id, s.position, s.set_type, s.weight_kg, s.reps,
              s.duration_s, s.distance_m, s.rpe, s.est_1rm_kg, s.is_pr
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       WHERE we.workout_id IN (${ph})
       ORDER BY s.workout_exercise_id, s.position`,
    )
    .all(...workoutIds)

  const mediaRows = db
    .prepare<unknown[], MediaRow>(
      `SELECT id, workout_id, file_path
       FROM media
       WHERE workout_id IN (${ph})
       ORDER BY workout_id, position, id`,
    )
    .all(...workoutIds)

  const likedRows = db
    .prepare<unknown[], { workout_id: number }>(
      `SELECT workout_id FROM likes WHERE user_id = ? AND workout_id IN (${ph})`,
    )
    .all(viewerId, ...workoutIds)

  const setsByWe = new Map<number, SetOut[]>()
  for (const s of setRows) {
    let list = setsByWe.get(s.workout_exercise_id)
    if (!list) setsByWe.set(s.workout_exercise_id, (list = []))
    list.push({
      id: s.id,
      position: s.position,
      setType: s.set_type,
      weightKg: s.weight_kg,
      reps: s.reps,
      durationS: s.duration_s,
      distanceM: s.distance_m,
      rpe: s.rpe,
      est1rmKg: s.est_1rm_kg,
      isPr: s.is_pr === 1,
    })
  }

  const exercisesByWorkout = new Map<number, WorkoutExerciseOut[]>()
  for (const r of exerciseRows) {
    let list = exercisesByWorkout.get(r.workout_id)
    if (!list) exercisesByWorkout.set(r.workout_id, (list = []))
    list.push({
      id: r.id,
      position: r.position,
      notes: r.notes,
      exercise: {
        id: r.ex_id,
        slug: r.slug,
        name: r.name,
        metricType: r.metric_type,
        muscleGroup: r.muscle_group,
        equipment: r.equipment,
        plLift: r.pl_lift,
        tags: JSON.parse(r.tags) as Discipline[],
        isCustom: r.created_by !== null,
      },
      sets: setsByWe.get(r.id) ?? [],
    })
  }

  const mediaByWorkout = new Map<number, MediaOut[]>()
  for (const m of mediaRows) {
    let list = mediaByWorkout.get(m.workout_id)
    if (!list) mediaByWorkout.set(m.workout_id, (list = []))
    list.push({ id: m.id, url: `/uploads/${m.file_path}` })
  }

  const liked = new Set(likedRows.map((r) => r.workout_id))
  const byId = new Map(workoutRows.map((r) => [r.id, r]))

  const out: WorkoutDetail[] = []
  for (const id of workoutIds) {
    const w = byId.get(id)
    if (!w) continue
    out.push({
      id: w.id,
      title: w.title,
      notes: w.notes,
      status: w.status,
      startedAt: w.started_at,
      durationS: w.duration_s,
      publishedAt: w.published_at,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      totalSets: w.total_sets,
      totalVolumeKg: w.total_volume_kg,
      prCount: w.pr_count,
      likeCount: w.like_count,
      commentCount: w.comment_count,
      viewerLiked: liked.has(w.id),
      author: {
        id: w.user_id,
        username: w.username,
        displayName: w.display_name,
        bio: w.bio,
        followerCount: w.follower_count,
        followingCount: w.following_count,
        workoutCount: w.workout_count,
      },
      exercises: exercisesByWorkout.get(w.id) ?? [],
      media: mediaByWorkout.get(w.id) ?? [],
    })
  }
  return out
}

/** Hydrate published-or-not workout rows into WorkoutCard[], input order preserved. */
export function getWorkoutCards(db: AppDb, workoutIds: number[], viewerId: number): WorkoutCard[] {
  return getWorkoutDetails(db, workoutIds, viewerId).map((d) => {
    const { status, createdAt, updatedAt, publishedAt, ...card } = d
    void status
    void createdAt
    void updatedAt
    return { ...card, publishedAt: publishedAt ?? 0 }
  })
}

/** Full detail for one workout (any status) or null. Caller enforces draft visibility. */
export function getWorkoutDetail(db: AppDb, workoutId: number, viewerId: number): WorkoutDetail | null {
  return getWorkoutDetails(db, [workoutId], viewerId)[0] ?? null
}
