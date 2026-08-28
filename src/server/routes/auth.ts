// PLACEHOLDER — owned by agent S1 (server-auth-users). Replace entirely; keep the
// default-export factory signature. Routes (mounted at /api/auth):
//   POST /register (public)  POST /login (public)  POST /logout  GET /me
// See docs/SPEC.md §7-8.
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function authRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
