// PLACEHOLDER — owned by agent S3 (server-social). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api/notifications):
//   GET  /            ?cursor=&limit=30 — id DESC; { items, nextCursor, unreadCount }
//   POST /read-all    204
// NotificationOut hydrates actor + workout {id,title} + comment {id,body} + prSummary.
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function notificationsRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
