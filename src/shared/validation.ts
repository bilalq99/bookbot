// FROZEN CONTRACT — do not edit. Zod schemas for every request body plus the
// per-metric set validation used by both the server routes and the client editor.
import { z } from 'zod'
import type { MetricType, SetIn } from './types'

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export const registerSchema = z.object({
  username: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().regex(USERNAME_RE, 'Username must be 3-20 characters: a-z, 0-9, _')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  displayName: z.string().trim().min(1).max(50).optional(),
  unitPreference: z.enum(['kg', 'lb']).optional(),
})

export const loginSchema = z.object({
  username: z.string().transform((s) => s.trim().toLowerCase()),
  password: z.string(),
})

export const patchMeSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(160).optional(),
  unitPreference: z.enum(['kg', 'lb']).optional(),
})

export const metricTypeSchema = z.enum([
  'weight_reps',
  'bodyweight_reps',
  'duration',
  'distance_duration',
])

export const muscleGroupSchema = z.enum([
  'chest', 'back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
  'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body',
])

export const equipmentSchema = z.enum([
  'barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'odd_implement',
])

export const createExerciseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  metricType: metricTypeSchema,
  muscleGroup: muscleGroupSchema,
  equipment: equipmentSchema,
})

export const setInSchema = z.object({
  setType: z.enum(['normal', 'warmup']).optional(),
  weightKg: z.number().min(0).max(2000).optional(),
  reps: z.number().int().min(1).max(500).optional(),
  durationS: z.number().int().min(1).max(3600).optional(),
  distanceM: z.number().min(1).max(1000).optional(),
  rpe: z
    .number()
    .min(6)
    .max(10)
    .refine((v) => Number.isInteger(v * 2), 'RPE must be in 0.5 steps')
    .optional(),
})

export const workoutExerciseInSchema = z.object({
  exerciseId: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
  sets: z.array(setInSchema).min(1).max(50),
})

export const workoutInSchema = z.object({
  title: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  startedAt: z.number().int().positive().optional(),
  durationS: z.number().int().min(1).max(86400).optional(),
  exercises: z.array(workoutExerciseInSchema).max(30).optional(),
  mediaIds: z.array(z.number().int().positive()).max(4).optional(),
})

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(500),
})

/**
 * Metric-specific validation (the zod schema above only bounds ranges).
 * Returns an error message, or null when the set is valid for the metric type.
 * Rules — docs/SPEC.md §4:
 *  - weight_reps:        weightKg (>0) + reps required; no durationS/distanceM
 *  - bodyweight_reps:    reps required; weightKg optional = ADDED weight; no durationS/distanceM
 *  - duration:           durationS required; weightKg optional; no reps/distanceM
 *  - distance_duration:  distanceM required; weightKg/durationS optional; no reps
 *  - rpe only where reps exist (weight_reps / bodyweight_reps)
 */
export function validateSetForMetric(metric: MetricType, set: SetIn): string | null {
  const has = {
    weight: set.weightKg !== undefined,
    reps: set.reps !== undefined,
    duration: set.durationS !== undefined,
    distance: set.distanceM !== undefined,
    rpe: set.rpe !== undefined,
  }
  switch (metric) {
    case 'weight_reps':
      if (!has.weight || (set.weightKg as number) <= 0) return 'weightKg (> 0) is required'
      if (!has.reps) return 'reps is required'
      if ((set.reps as number) > 100) return 'reps must be at most 100'
      if (has.duration || has.distance) return 'durationS/distanceM not allowed for weight_reps'
      return null
    case 'bodyweight_reps':
      if (!has.reps) return 'reps is required'
      if (has.weight && (set.weightKg as number) > 500) return 'added weightKg must be at most 500'
      if (has.duration || has.distance) return 'durationS/distanceM not allowed for bodyweight_reps'
      return null
    case 'duration':
      if (!has.duration) return 'durationS is required'
      if (has.weight && (set.weightKg as number) > 500) return 'weightKg must be at most 500'
      if (has.reps || has.distance) return 'reps/distanceM not allowed for duration'
      if (has.rpe) return 'rpe not allowed for duration sets'
      return null
    case 'distance_duration':
      if (!has.distance) return 'distanceM is required'
      if (has.reps) return 'reps not allowed for distance_duration'
      if (has.rpe) return 'rpe not allowed for distance_duration sets'
      return null
  }
}
