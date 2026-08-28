// PLACEHOLDER — owned by agent S3 (server-social). Replace the bodies; keep these
// exported signatures EXACTLY (users/workouts services compile against them).
// Rules — docs/SPEC.md §9: same transaction as the trigger; never notify yourself;
// dedup via the partial unique indexes with ON CONFLICT DO NOTHING.
import type { AppDb } from '../db/client'
import type { RecordType } from '../../shared/types'

export interface PrSummaryEntry {
  exerciseName: string
  recordType: RecordType
  value: number
}

/** Notify the workout owner of a like (skip self; dedup user+actor+workout). */
export function notifyLike(_db: AppDb, _actorId: number, _workoutId: number, _ownerId: number, _now: number): void {
  throw new Error('not implemented')
}

/** Unlike removes the like notification row (re-arms dedup; re-like re-notifies). */
export function removeLikeNotification(_db: AppDb, _actorId: number, _workoutId: number): void {
  throw new Error('not implemented')
}

/** Notify the workout owner of a comment (skip self; no dedup; comment_id set). */
export function notifyComment(
  _db: AppDb,
  _actorId: number,
  _workoutId: number,
  _ownerId: number,
  _commentId: number,
  _now: number,
): void {
  throw new Error('not implemented')
}

/** Notify the followee of a new follow (dedup user+actor; unfollow keeps the row). */
export function notifyFollow(_db: AppDb, _actorId: number, _followeeId: number, _now: number): void {
  throw new Error('not implemented')
}

/** Fan out one pr notification per follower of the achiever (dedup user+workout). */
export function notifyPr(
  _db: AppDb,
  _achieverId: number,
  _workoutId: number,
  _prSummary: PrSummaryEntry[],
  _now: number,
): void {
  throw new Error('not implemented')
}
