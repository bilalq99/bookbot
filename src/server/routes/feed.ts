// PLACEHOLDER — owned by agent S3 (server-social). Replace entirely; keep the
// default-export factory signature. Route (mounted at /api/feed):
//   GET / ?scope=following|everyone&cursor=&limit=20
// Keyset pagination on (published_at DESC, id DESC); hydrate via getWorkoutCards.
// See docs/SPEC.md §7 and the feed query in the data spec.
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function feedRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
