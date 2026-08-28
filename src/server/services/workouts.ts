// PLACEHOLDER — owned by agent S2 (server-workouts). Replace the bodies; keep these
// exported signatures EXACTLY (routes + seed compile against them). All validation
// (zod + validateSetForMetric, naming exercises[i].sets[j]) and totals/est_1rm
// computation happens here. Throw ApiError from lib/http. See docs/SPEC.md §4-7.
import type { AppDb } from '../db/client'
import type { PublishResponse, WorkoutDetail, WorkoutIn } from '../../shared/types'

/** Create a draft workout (with nested exercises/sets/media). */
export function createWorkout(_db: AppDb, _userId: number, _input: WorkoutIn, _now: number): WorkoutDetail {
  throw new Error('not implemented')
}

/**
 * Owner-only update. If input.exercises is present it fully replaces children.
 * If the workout is published: recompute totals + recomputePRs over (old ∪ new)
 * exercise ids. published_at never changes.
 */
export function updateWorkout(
  _db: AppDb,
  _userId: number,
  _workoutId: number,
  _input: WorkoutIn,
  _now: number,
): WorkoutDetail {
  throw new Error('not implemented')
}

/**
 * Owner-only publish (idempotent). First transition: sets status/published_at,
 * bumps users.workout_count, applies PRs, fans out pr notifications via notifyPr.
 * Republishing recomputes and returns current state with newPrs: [].
 */
export function publishWorkout(_db: AppDb, _userId: number, _workoutId: number, _now: number): PublishResponse {
  throw new Error('not implemented')
}

/** Owner-only delete; unlinks media files best-effort; recomputes PRs after. */
export function deleteWorkout(_db: AppDb, _userId: number, _workoutId: number): void {
  throw new Error('not implemented')
}
