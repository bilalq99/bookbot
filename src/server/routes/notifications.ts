// Notifications inbox, mounted at /api/notifications — docs/SPEC.md §7/§9:
//   GET /          id DESC, cursor = last id; { items, nextCursor, unreadCount }
//   POST /read-all 204
import { Router } from 'express'
import type { AppDb } from '../db/client'
import type { NotificationOut, NotificationsResponse, NotificationType, RecordType } from '../../shared/types'
import { asyncHandler, parseLimit } from '../lib/http'
import { requireAuth } from '../auth/middleware'

interface NotificationRow {
  id: number
  type: NotificationType
  created_at: number
  read_at: number | null
  pr_summary: string | null
  actor_id: number
  actor_username: string
  actor_display_name: string
  actor_bio: string
  actor_follower_count: number
  actor_following_count: number
  actor_workout_count: number
  workout_id: number | null
  workout_title: string | null
  comment_id: number | null
  comment_body: string | null
}

function toNotificationOut(row: NotificationRow): NotificationOut {
  let prSummary: NotificationOut['prSummary'] = null
  if (row.pr_summary) {
    try {
      prSummary = JSON.parse(row.pr_summary) as { exerciseName: string; recordType: RecordType; value: number }[]
    } catch {
      prSummary = null
    }
  }
  return {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: {
      id: row.actor_id,
      username: row.actor_username,
      displayName: row.actor_display_name,
      bio: row.actor_bio,
      followerCount: row.actor_follower_count,
      followingCount: row.actor_following_count,
      workoutCount: row.actor_workout_count,
    },
    workout: row.workout_id !== null ? { id: row.workout_id, title: row.workout_title ?? '' } : null,
    comment: row.comment_id !== null ? { id: row.comment_id, body: row.comment_body ?? '' } : null,
    prSummary,
  }
}

export default function notificationsRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  const listStmt = db.prepare(`
    SELECT n.id, n.type, n.created_at, n.read_at, n.pr_summary,
           a.id AS actor_id, a.username AS actor_username, a.display_name AS actor_display_name,
           a.bio AS actor_bio, a.follower_count AS actor_follower_count,
           a.following_count AS actor_following_count, a.workout_count AS actor_workout_count,
           w.id AS workout_id, w.title AS workout_title,
           c.id AS comment_id, c.body AS comment_body
    FROM notifications n
    JOIN users a ON a.id = n.actor_id
    LEFT JOIN workouts w ON w.id = n.workout_id
    LEFT JOIN comments c ON c.id = n.comment_id
    WHERE n.user_id = @viewer AND (@before IS NULL OR n.id < @before)
    ORDER BY n.id DESC
    LIMIT @limit
  `)

  const unreadStmt = db.prepare<unknown[], { n: number }>(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`,
  )

  router.get(
    '/',
    asyncHandler((req, res) => {
      const viewerId = req.user!.id
      const limit = parseLimit(req.query.limit, 30, 100)
      const before = typeof req.query.cursor === 'string' && /^\d+$/.test(req.query.cursor)
        ? Number(req.query.cursor)
        : null
      const rows = listStmt.all({ viewer: viewerId, before, limit: limit + 1 }) as NotificationRow[]
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const last = page[page.length - 1]
      const body: NotificationsResponse = {
        items: page.map(toNotificationOut),
        nextCursor: hasMore && last ? String(last.id) : null,
        unreadCount: unreadStmt.get(viewerId)!.n,
      }
      res.json(body)
    }),
  )

  router.post(
    '/read-all',
    asyncHandler((req, res) => {
      db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(
        Date.now(),
        req.user!.id,
      )
      res.status(204).end()
    }),
  )

  return router
}
