// PLACEHOLDER — owned by agent S2 (server-workouts). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api/exercises):
//   GET /   ?q=&muscleGroup=&limit=100 — global + own custom rows;
//           q: name_norm prefix matches first, then substring; no q -> alphabetical
//   POST /  create custom exercise (409 on duplicate name for user or global clash)
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function exercisesRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
