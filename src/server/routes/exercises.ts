// Exercise library, mounted at /api/exercises: search over global + own custom
// rows (name_norm prefix matches first, then substring), plus custom-exercise
// creation (409 on duplicate name for user or global clash). See docs/SPEC.md §12.
import { Router } from 'express'
import type { AppDb } from '../db/client'
import type { Discipline, Equipment, Exercise, MetricType, MuscleGroup, PlLift } from '../../shared/types'
import { createExerciseSchema, muscleGroupSchema } from '../../shared/validation'
import { requireAuth } from '../auth/middleware'
import { ApiError, asyncHandler, parseLimit, validate } from '../lib/http'

interface ExerciseRow {
  id: number
  slug: string | null
  name: string
  metric_type: MetricType
  muscle_group: MuscleGroup
  equipment: Equipment
  pl_lift: PlLift | null
  tags: string
  created_by: number | null
}

const EXERCISE_COLUMNS = 'id, slug, name, metric_type, muscle_group, equipment, pl_lift, tags, created_by'

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    metricType: row.metric_type,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    plLift: row.pl_lift,
    tags: JSON.parse(row.tags) as Discipline[],
    isCustom: row.created_by !== null,
  }
}

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export default function exercisesRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  router.get(
    '/',
    asyncHandler((req, res) => {
      const limit = parseLimit(req.query.limit, 100, 200)
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
      const muscleGroup =
        typeof req.query.muscleGroup === 'string' && req.query.muscleGroup !== '' ? req.query.muscleGroup : null
      if (muscleGroup !== null && !muscleGroupSchema.safeParse(muscleGroup).success) {
        throw new ApiError(400, 'validation_error', 'muscleGroup: invalid muscle group')
      }

      const conds = ['(created_by IS NULL OR created_by = @viewer)']
      const params: Record<string, unknown> = { viewer: req.user!.id, limit }
      if (muscleGroup !== null) {
        conds.push('muscle_group = @muscleGroup')
        params.muscleGroup = muscleGroup
      }
      let order = 'name_norm ASC, id ASC'
      if (q !== '') {
        conds.push(`name_norm LIKE @sub ESCAPE '\\'`)
        params.sub = `%${escapeLike(q)}%`
        params.pre = `${escapeLike(q)}%`
        order = `(CASE WHEN name_norm LIKE @pre ESCAPE '\\' THEN 0 ELSE 1 END), name_norm ASC, id ASC`
      }
      const rows = db
        .prepare<Record<string, unknown>, ExerciseRow>(
          `SELECT ${EXERCISE_COLUMNS} FROM exercises WHERE ${conds.join(' AND ')} ORDER BY ${order} LIMIT @limit`,
        )
        .all(params)
      res.json({ exercises: rows.map(mapExercise) })
    }),
  )

  router.post(
    '/',
    asyncHandler((req, res) => {
      const input = validate(createExerciseSchema, req.body)
      const viewerId = req.user!.id
      const nameNorm = input.name.toLowerCase()
      const clash = db
        .prepare<unknown[], { id: number }>(
          `SELECT id FROM exercises WHERE name_norm = ? AND (created_by IS NULL OR created_by = ?) LIMIT 1`,
        )
        .get(nameNorm, viewerId)
      if (clash) throw new ApiError(409, 'conflict', 'An exercise with that name already exists')
      let id: number
      try {
        id = Number(
          db
            .prepare(
              `INSERT INTO exercises (slug, name, name_norm, metric_type, muscle_group, equipment, pl_lift, tags, created_by, created_at)
               VALUES (NULL, ?, ?, ?, ?, ?, NULL, '[]', ?, ?)`,
            )
            .run(input.name, nameNorm, input.metricType, input.muscleGroup, input.equipment, viewerId, Date.now())
            .lastInsertRowid,
        )
      } catch (err) {
        const code = (err as { code?: string }).code
        if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) {
          throw new ApiError(409, 'conflict', 'An exercise with that name already exists')
        }
        throw err
      }
      const row = db
        .prepare<unknown[], ExerciseRow>(`SELECT ${EXERCISE_COLUMNS} FROM exercises WHERE id = ?`)
        .get(id)!
      res.status(201).json({ exercise: mapExercise(row) })
    }),
  )

  return router
}
