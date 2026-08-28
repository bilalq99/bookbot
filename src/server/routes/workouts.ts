// PLACEHOLDER — owned by agent S2 (server-workouts). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api/workouts):
//   POST /            create draft        GET /?status=draft   own drafts
//   GET /:id          detail (draft -> owner only, else 404)
//   PATCH /:id        update              DELETE /:id          delete
//   POST /:id/publish publish -> { workout, newPrs }
// Like/comment subroutes live in routes/social.ts, NOT here — do not add
// catch-all /:id/* handlers that would shadow them. See docs/SPEC.md §7.
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function workoutsRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
