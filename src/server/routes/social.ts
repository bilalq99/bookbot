// Likes and comments, mounted at /api (full paths) — docs/SPEC.md §7:
//   POST/DELETE /workouts/:id/like   GET /workouts/:id/likes
//   GET/POST    /workouts/:id/comments   DELETE /comments/:id
// Social actions apply to PUBLISHED workouts only (404 otherwise); counters are
// maintained in the same transaction as the change; notifications via services/notify.
import { Router } from 'express'
import type { AppDb } from '../db/client'
import type { CommentOut, CommentsResponse, UserSearchItem } from '../../shared/types'
import { commentSchema } from '../../shared/validation'
import { ApiError, asyncHandler, makeCursor, notFound, parseCursor, parseId, parseLimit, validate } from '../lib/http'
import { requireAuth } from '../auth/middleware'
import { notifyComment, notifyLike, removeLikeNotification } from '../services/notify'

interface PublishedWorkoutRow {
  id: number
  user_id: number
}

interface LikerRow {
  id: number
  username: string
  display_name: string
  bio: string
  follower_count: number
  following_count: number
  workout_count: number
  liked_at: number
  viewer_follows: number
}

interface CommentRow {
  id: number
  body: string
  created_at: number
  user_id: number
  username: string
  display_name: string
  bio: string
  follower_count: number
  following_count: number
  workout_count: number
}

function toCommentOut(row: CommentRow): CommentOut {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      followerCount: row.follower_count,
      followingCount: row.following_count,
      workoutCount: row.workout_count,
    },
  }
}

export default function socialRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  const getPublished = db.prepare<unknown[], PublishedWorkoutRow>(
    `SELECT id, user_id FROM workouts WHERE id = ? AND status = 'published'`,
  )

  const insertLike = db.prepare(`INSERT OR IGNORE INTO likes (user_id, workout_id, created_at) VALUES (?, ?, ?)`)
  const deleteLike = db.prepare(`DELETE FROM likes WHERE user_id = ? AND workout_id = ?`)
  const bumpLikeCount = db.prepare(`UPDATE workouts SET like_count = like_count + ? WHERE id = ?`)

  const likeTx = db.transaction((viewerId: number, workout: PublishedWorkoutRow, now: number) => {
    const info = insertLike.run(viewerId, workout.id, now)
    if (info.changes > 0) {
      bumpLikeCount.run(1, workout.id)
      notifyLike(db, viewerId, workout.id, workout.user_id, now)
    }
  })

  const unlikeTx = db.transaction((viewerId: number, workoutId: number) => {
    const info = deleteLike.run(viewerId, workoutId)
    if (info.changes > 0) {
      bumpLikeCount.run(-1, workoutId)
      removeLikeNotification(db, viewerId, workoutId)
    }
  })

  const likersStmt = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.bio, u.follower_count, u.following_count, u.workout_count,
           l.created_at AS liked_at,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = u.id) AS viewer_follows
    FROM likes l
    JOIN users u ON u.id = l.user_id
    WHERE l.workout_id = @workout
      AND (@ts IS NULL OR l.created_at < @ts OR (l.created_at = @ts AND u.id < @id))
    ORDER BY l.created_at DESC, u.id DESC
    LIMIT @limit
  `)

  const commentsStmt = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id,
           u.username, u.display_name, u.bio, u.follower_count, u.following_count, u.workout_count
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.workout_id = @workout AND (@after IS NULL OR c.id > @after)
    ORDER BY c.id ASC
    LIMIT @limit
  `)

  const insertComment = db.prepare(`INSERT INTO comments (workout_id, user_id, body, created_at) VALUES (?, ?, ?, ?)`)
  const bumpCommentCount = db.prepare(`UPDATE workouts SET comment_count = comment_count + ? WHERE id = ?`)

  const commentTx = db.transaction((viewerId: number, workout: PublishedWorkoutRow, body: string, now: number) => {
    const commentId = Number(insertComment.run(workout.id, viewerId, body, now).lastInsertRowid)
    bumpCommentCount.run(1, workout.id)
    notifyComment(db, viewerId, workout.id, workout.user_id, commentId, now)
    return commentId
  })

  const deleteCommentTx = db.transaction((commentId: number, workoutId: number) => {
    db.prepare(`DELETE FROM comments WHERE id = ?`).run(commentId)
    bumpCommentCount.run(-1, workoutId)
  })

  function publishedOr404(id: number): PublishedWorkoutRow {
    const workout = getPublished.get(id)
    if (!workout) throw notFound()
    return workout
  }

  router.post(
    '/workouts/:id/like',
    asyncHandler((req, res) => {
      likeTx(req.user!.id, publishedOr404(parseId(req.params.id)), Date.now())
      res.status(204).end()
    }),
  )

  router.delete(
    '/workouts/:id/like',
    asyncHandler((req, res) => {
      unlikeTx(req.user!.id, publishedOr404(parseId(req.params.id)).id)
      res.status(204).end()
    }),
  )

  router.get(
    '/workouts/:id/likes',
    asyncHandler((req, res) => {
      const workout = publishedOr404(parseId(req.params.id))
      const limit = parseLimit(req.query.limit, 30, 100)
      const cur = parseCursor(req.query.cursor)
      const rows = likersStmt.all({
        viewer: req.user!.id,
        workout: workout.id,
        ts: cur ? cur.ts : null,
        id: cur ? cur.id : null,
        limit: limit + 1,
      }) as LikerRow[]
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const last = page[page.length - 1]
      const users: UserSearchItem[] = page.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        bio: r.bio,
        followerCount: r.follower_count,
        followingCount: r.following_count,
        workoutCount: r.workout_count,
        viewerFollows: r.viewer_follows === 1,
      }))
      res.json({ users, nextCursor: hasMore && last ? makeCursor(last.liked_at, last.id) : null })
    }),
  )

  router.get(
    '/workouts/:id/comments',
    asyncHandler((req, res) => {
      const workout = publishedOr404(parseId(req.params.id))
      const limit = parseLimit(req.query.limit, 20, 100)
      // Oldest-first paging; the cursor is the last comment id of the prior page.
      const after = typeof req.query.cursor === 'string' && /^\d+$/.test(req.query.cursor)
        ? Number(req.query.cursor)
        : null
      const rows = commentsStmt.all({ workout: workout.id, after, limit: limit + 1 }) as CommentRow[]
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const last = page[page.length - 1]
      const body: CommentsResponse = {
        comments: page.map(toCommentOut),
        nextCursor: hasMore && last ? String(last.id) : null,
      }
      res.json(body)
    }),
  )

  router.post(
    '/workouts/:id/comments',
    asyncHandler((req, res) => {
      const workout = publishedOr404(parseId(req.params.id))
      const { body } = validate(commentSchema, req.body)
      const commentId = commentTx(req.user!.id, workout, body, Date.now())
      const row = db
        .prepare<unknown[], CommentRow>(
          `SELECT c.id, c.body, c.created_at, c.user_id,
                  u.username, u.display_name, u.bio, u.follower_count, u.following_count, u.workout_count
           FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        )
        .get(commentId)!
      res.status(201).json({ comment: toCommentOut(row) })
    }),
  )

  router.delete(
    '/comments/:id',
    asyncHandler((req, res) => {
      const id = parseId(req.params.id)
      const row = db
        .prepare<unknown[], { id: number; user_id: number; workout_id: number; owner_id: number }>(
          `SELECT c.id, c.user_id, c.workout_id, w.user_id AS owner_id
           FROM comments c JOIN workouts w ON w.id = c.workout_id WHERE c.id = ?`,
        )
        .get(id)
      if (!row) throw notFound()
      const viewerId = req.user!.id
      if (row.user_id !== viewerId && row.owner_id !== viewerId) {
        throw new ApiError(403, 'forbidden', 'Only the comment author or session owner can delete this')
      }
      deleteCommentTx(row.id, row.workout_id)
      res.status(204).end()
    }),
  )

  return router
}
