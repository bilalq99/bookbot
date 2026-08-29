// Workout CRUD + publish + drafts list, mounted at /api/workouts. Like/comment
// subroutes live in routes/social.ts — nothing here shadows /:id/like(s) or
// /:id/comments. See docs/SPEC.md §7.
import { Router } from 'express'
import type { AppDb } from '../db/client'
import type { WorkoutIn } from '../../shared/types'
import { requireAuth } from '../auth/middleware'
import { ApiError, asyncHandler, notFound, parseId } from '../lib/http'
import { getWorkoutDetail, getWorkoutDetails } from '../services/cards'
import { createWorkout, deleteWorkout, publishWorkout, updateWorkout } from '../services/workouts'

export default function workoutsRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  router.post(
    '/',
    asyncHandler((req, res) => {
      const workout = createWorkout(db, req.user!.id, req.body as WorkoutIn, Date.now())
      res.status(201).json({ workout })
    }),
  )

  router.get(
    '/',
    asyncHandler((req, res) => {
      if (req.query.status !== 'draft') {
        throw new ApiError(400, 'validation_error', "status must be 'draft'")
      }
      const viewerId = req.user!.id
      const ids = db
        .prepare<unknown[], { id: number }>(
          `SELECT id FROM workouts WHERE user_id = ? AND status = 'draft' ORDER BY updated_at DESC, id DESC`,
        )
        .all(viewerId)
        .map((r) => r.id)
      res.json({ items: getWorkoutDetails(db, ids, viewerId) })
    }),
  )

  router.get(
    '/:id',
    asyncHandler((req, res) => {
      const id = parseId(req.params.id)
      const viewerId = req.user!.id
      const workout = getWorkoutDetail(db, id, viewerId)
      if (!workout || (workout.status === 'draft' && workout.author.id !== viewerId)) throw notFound()
      res.json({ workout })
    }),
  )

  router.patch(
    '/:id',
    asyncHandler((req, res) => {
      const id = parseId(req.params.id)
      const workout = updateWorkout(db, req.user!.id, id, req.body as WorkoutIn, Date.now())
      res.json({ workout })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler((req, res) => {
      const id = parseId(req.params.id)
      deleteWorkout(db, req.user!.id, id)
      res.status(204).end()
    }),
  )

  router.post(
    '/:id/publish',
    asyncHandler((req, res) => {
      const id = parseId(req.params.id)
      res.json(publishWorkout(db, req.user!.id, id, Date.now()))
    }),
  )

  return router
}
