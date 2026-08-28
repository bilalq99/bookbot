// PLACEHOLDER — owned by agent S2 (server-workouts). Replace the bodies; keep these
// exported signatures EXACTLY. PR engine — docs/SPEC.md §6:
// strictly-greater upsert per (user, exercise, record_type); warmups never count;
// only published workouts count; recompute on edit/delete of published workouts.
import type { AppDb } from '../db/client'
import type { NewPr } from '../../shared/types'

/**
 * Inside the publish transaction: detect + upsert PRs for this workout, mark
 * achieving sets is_pr=1, set workouts.pr_count. Returns the new PRs.
 * Does NOT send notifications (caller does, so republish never re-notifies).
 */
export function applyPrsOnPublish(_db: AppDb, _userId: number, _workoutId: number, _publishedAt: number): NewPr[] {
  throw new Error('not implemented')
}

/**
 * Rebuild personal_records + sets.is_pr for the given (user, exercise) pairs from
 * remaining published non-warmup history. Earliest published_at wins ties.
 * Never sends notifications; never touches historical workouts.pr_count.
 */
export function recomputePRs(_db: AppDb, _userId: number, _exerciseIds: number[]): void {
  throw new Error('not implemented')
}
