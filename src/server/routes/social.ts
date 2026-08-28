// PLACEHOLDER — owned by agent S3 (server-social). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api — use FULL paths):
//   POST   /workouts/:id/like      DELETE /workouts/:id/like
//   GET    /workouts/:id/likes     (likers page, newest first)
//   GET    /workouts/:id/comments  (oldest first, cursor = last id)
//   POST   /workouts/:id/comments  DELETE /comments/:id
// Counters maintained transactionally on actual insert/delete; notifications via
// services/notify. Likes/comments only on published workouts (else 404).
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function socialRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
