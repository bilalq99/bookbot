// PLACEHOLDER — owned by agent S1 (server-auth-users). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api/users):
//   GET /search  GET /suggested  PATCH /me
//   GET /:username  GET /:username/workouts  GET /:username/stats  GET /:username/prs
//   GET /:username/followers  GET /:username/following
//   POST /:username/follow  DELETE /:username/follow
// NOTE: register literal routes (/search, /suggested, /me) BEFORE /:username.
// Profile timelines hydrate via getWorkoutCards (services/cards). See docs/SPEC.md §7.
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function usersRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
