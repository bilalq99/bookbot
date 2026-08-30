// Notification writes — docs/SPEC.md §9. Every function runs inside the caller's
// transaction; none notifies the actor about their own action. Dedup rides the
// partial unique indexes (notif_like_dedup / notif_follow_dedup / notif_pr_dedup)
// via ON CONFLICT DO NOTHING.
import type Database from 'better-sqlite3'
import type { AppDb } from '../db/client'
import type { RecordType } from '../../shared/types'

export interface PrSummaryEntry {
  exerciseName: string
  recordType: RecordType
  value: number
}

interface NotifyStmts {
  insertLike: Database.Statement<unknown[]>
  deleteLike: Database.Statement<unknown[]>
  insertComment: Database.Statement<unknown[]>
  insertFollow: Database.Statement<unknown[]>
  insertPrFanout: Database.Statement<[Record<string, unknown>]>
}

const stmtCache = new WeakMap<AppDb, NotifyStmts>()

function stmts(db: AppDb): NotifyStmts {
  let s = stmtCache.get(db)
  if (!s) {
    s = {
      insertLike: db.prepare(`
        INSERT INTO notifications (user_id, actor_id, type, workout_id, created_at)
        VALUES (?, ?, 'like', ?, ?)
        ON CONFLICT DO NOTHING
      `),
      deleteLike: db.prepare(`
        DELETE FROM notifications WHERE type = 'like' AND actor_id = ? AND workout_id = ?
      `),
      insertComment: db.prepare(`
        INSERT INTO notifications (user_id, actor_id, type, workout_id, comment_id, created_at)
        VALUES (?, ?, 'comment', ?, ?, ?)
      `),
      insertFollow: db.prepare(`
        INSERT INTO notifications (user_id, actor_id, type, created_at)
        VALUES (?, ?, 'follow', ?)
        ON CONFLICT DO NOTHING
      `),
      insertPrFanout: db.prepare(`
        INSERT INTO notifications (user_id, actor_id, type, workout_id, pr_summary, created_at)
        SELECT f.follower_id, @achiever, 'pr', @workout, @summary, @now
        FROM follows f
        WHERE f.followee_id = @achiever
        ON CONFLICT DO NOTHING
      `),
    }
    stmtCache.set(db, s)
  }
  return s
}

/** Notify the workout owner of a like (skip self; dedup user+actor+workout). */
export function notifyLike(db: AppDb, actorId: number, workoutId: number, ownerId: number, now: number): void {
  if (actorId === ownerId) return
  stmts(db).insertLike.run(ownerId, actorId, workoutId, now)
}

/** Unlike removes the like notification row (re-arms dedup; re-like re-notifies). */
export function removeLikeNotification(db: AppDb, actorId: number, workoutId: number): void {
  stmts(db).deleteLike.run(actorId, workoutId)
}

/** Notify the workout owner of a comment (skip self; no dedup; comment_id set). */
export function notifyComment(
  db: AppDb,
  actorId: number,
  workoutId: number,
  ownerId: number,
  commentId: number,
  now: number,
): void {
  if (actorId === ownerId) return
  stmts(db).insertComment.run(ownerId, actorId, workoutId, commentId, now)
}

/** Notify the followee of a new follow (dedup user+actor; unfollow keeps the row). */
export function notifyFollow(db: AppDb, actorId: number, followeeId: number, now: number): void {
  if (actorId === followeeId) return
  stmts(db).insertFollow.run(followeeId, actorId, now)
}

/** Fan out one pr notification per follower of the achiever (dedup user+workout). */
export function notifyPr(
  db: AppDb,
  achieverId: number,
  workoutId: number,
  prSummary: PrSummaryEntry[],
  now: number,
): void {
  if (prSummary.length === 0) return
  stmts(db).insertPrFanout.run({
    achiever: achieverId,
    workout: workoutId,
    summary: JSON.stringify(prSummary.slice(0, 10)),
    now,
  })
}
