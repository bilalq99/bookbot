// PLACEHOLDER — owned by agent S2 (server-workouts). Replace the bodies; keep these
// exported signatures EXACTLY (feed/users/social routes compile against them).
// Batch hydration, no N+1: one query each for workout rows + authors,
// workout_exercises JOIN exercises, sets, media, viewer likes. See docs/SPEC.md §7.
import type { AppDb } from '../db/client'
import type { WorkoutCard, WorkoutDetail } from '../../shared/types'

/** Hydrate published-or-not workout rows into WorkoutCard[], input order preserved. */
export function getWorkoutCards(_db: AppDb, _workoutIds: number[], _viewerId: number): WorkoutCard[] {
  throw new Error('not implemented')
}

/** Full detail for one workout (any status) or null. Caller enforces draft visibility. */
export function getWorkoutDetail(_db: AppDb, _workoutId: number, _viewerId: number): WorkoutDetail | null {
  throw new Error('not implemented')
}
