// Feed (mounted at /api/feed) — docs/SPEC.md §7:
//   GET / ?scope=following|everyone&cursor=&limit=20
// Newest-first keyset on the partial published index; page query fetches ids only
// (limit+1 to detect more), then batch hydration via getWorkoutCards — no N+1.
import { Router } from 'express'
import type { AppDb } from '../db/client'
import type { FeedResponse, FeedScope } from '../../shared/types'
import { asyncHandler, makeCursor, parseCursor, parseLimit } from '../lib/http'
import { requireAuth } from '../auth/middleware'
import { getWorkoutCards } from '../services/cards'

interface FeedRow {
  id: number
  published_at: number
}

export default function feedRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  // following = self OR an EXISTS probe into follows; everyone = no author filter.
  const followingStmt = db.prepare(`
    SELECT w.id, w.published_at
    FROM workouts w
    WHERE w.status = 'published'
      AND (w.user_id = @viewer
           OR EXISTS (SELECT 1 FROM follows f
                      WHERE f.follower_id = @viewer AND f.followee_id = w.user_id))
      AND (@ts IS NULL OR w.published_at < @ts OR (w.published_at = @ts AND w.id < @id))
    ORDER BY w.published_at DESC, w.id DESC
    LIMIT @limit
  `)

  const everyoneStmt = db.prepare(`
    SELECT w.id, w.published_at
    FROM workouts w
    WHERE w.status = 'published'
      AND (@ts IS NULL OR w.published_at < @ts OR (w.published_at = @ts AND w.id < @id))
    ORDER BY w.published_at DESC, w.id DESC
    LIMIT @limit
  `)

  router.get(
    '/',
    asyncHandler((req, res) => {
      const viewerId = req.user!.id
      const scope: FeedScope = req.query.scope === 'everyone' ? 'everyone' : 'following'
      const limit = parseLimit(req.query.limit, 20, 50)
      const cur = parseCursor(req.query.cursor)

      const stmt = scope === 'everyone' ? everyoneStmt : followingStmt
      const rows = stmt.all({
        viewer: viewerId,
        ts: cur ? cur.ts : null,
        id: cur ? cur.id : null,
        limit: limit + 1,
      }) as FeedRow[]

      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const last = page[page.length - 1]
      const body: FeedResponse = {
        items: getWorkoutCards(db, page.map((r) => r.id), viewerId),
        nextCursor: hasMore && last ? makeCursor(last.published_at, last.id) : null,
      }
      res.json(body)
    }),
  )

  return router
}
