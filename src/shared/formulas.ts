// FROZEN CONTRACT — do not edit. Domain math shared by server, client, and seed.
// Canonical units everywhere: kg, meters, seconds, epoch-ms. See docs/SPEC.md §5.
import type { MetricType, SetIn, SetOut, WorkoutExerciseOut } from './types'

export const KG_PER_LB = 0.45359237
export const M_PER_FT = 0.3048

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

/** Epley with the reps=1 identity. Only meaningful for weight_reps, 1..12 reps. */
export function epley(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

/** est_1rm_kg as stored on a set: weight_reps with 1<=reps<=12 and weight>0, else null. */
export function estimate1rm(metric: MetricType, set: SetIn): number | null {
  if (metric !== 'weight_reps') return null
  const w = set.weightKg
  const r = set.reps
  if (w === undefined || r === undefined || w <= 0 || r < 1 || r > 12) return null
  return epley(w, r)
}

/** Tonnage contribution of one set: weight*reps when both present and not a warmup. */
export function setVolumeKg(set: SetIn): number {
  if ((set.setType ?? 'normal') === 'warmup') return 0
  if (set.weightKg === undefined || set.reps === undefined) return 0
  return set.weightKg * set.reps
}

export interface WorkoutTotals {
  totalVolumeKg: number
  totalSets: number // non-warmup sets
}

export function computeTotals(exercises: { sets: SetIn[] }[]): WorkoutTotals {
  let totalVolumeKg = 0
  let totalSets = 0
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if ((s.setType ?? 'normal') !== 'warmup') totalSets += 1
      totalVolumeKg += setVolumeKg(s)
    }
  }
  return { totalVolumeKg, totalSets }
}

// ---------------------------------------------------------------- ISO weeks (UTC)

/** Epoch ms of the UTC Monday 00:00 that starts the ISO week containing t. */
export function isoWeekStartUtc(t: number): number {
  const d = new Date(t)
  const day = (d.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
  return monday
}

const WEEK_MS = 7 * 24 * 3600 * 1000

/**
 * Consecutive ISO weeks (UTC) with >= 1 published workout, anchored at the current
 * week if it has one, else the previous week; otherwise 0.
 */
export function computeStreakWeeks(publishedAtMs: number[], nowMs: number): number {
  if (publishedAtMs.length === 0) return 0
  const weeks = new Set(publishedAtMs.map(isoWeekStartUtc))
  const cur = isoWeekStartUtc(nowMs)
  let anchor: number
  if (weeks.has(cur)) anchor = cur
  else if (weeks.has(cur - WEEK_MS)) anchor = cur - WEEK_MS
  else return 0
  let n = 0
  while (weeks.has(anchor - n * WEEK_MS)) n++
  return n
}

// ---------------------------------------------------------------- card helpers

export type GradientKey = 'push' | 'pull' | 'legs' | 'core' | 'full'

const MUSCLE_TO_GRADIENT: Record<string, GradientKey> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  back: 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  core: 'core', full_body: 'full',
}

/** Dominant muscle group (by non-warmup set count) -> card gradient key. */
export function dominantGradient(exercises: WorkoutExerciseOut[]): GradientKey {
  const counts = new Map<GradientKey, number>()
  for (const ex of exercises) {
    const key = MUSCLE_TO_GRADIENT[ex.exercise.muscleGroup] ?? 'full'
    const n = ex.sets.filter((s) => s.setType !== 'warmup').length
    counts.set(key, (counts.get(key) ?? 0) + n)
  }
  let best: GradientKey = 'full'
  let bestN = 0
  let tied = false
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
      tied = false
    } else if (n === bestN && bestN > 0 && k !== best) {
      tied = true
    }
  }
  return tied ? 'full' : best
}

export interface Headline {
  exerciseName: string
  metricType: MetricType
  set: SetOut
  isPr: boolean
}

/**
 * Pick the set a lifter would brag about — docs/SPEC.md §5. First match wins:
 * 1) biggest PR set  2) highest est1rm  3) heaviest  4) longest hold
 * 5) farthest carry  6) most reps  7) null (title-only card).
 * Warmup sets never headline.
 */
export function pickHeadline(exercises: WorkoutExerciseOut[]): Headline | null {
  type Cand = Headline & { score: number }
  const all: Cand[] = []
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.setType === 'warmup') continue
      all.push({
        exerciseName: ex.exercise.name,
        metricType: ex.exercise.metricType,
        set: s,
        isPr: s.isPr,
        score: 0,
      })
    }
  }
  if (all.length === 0) return null
  const by = (f: (c: Cand) => number): Cand | null => {
    let best: Cand | null = null
    let bestV = 0
    for (const c of all) {
      const v = f(c)
      if (v > bestV) { best = c; bestV = v }
    }
    return best
  }
  const prMagnitude = (c: Cand) =>
    c.isPr
      ? (c.set.weightKg ?? c.set.est1rmKg ?? c.set.durationS ?? c.set.distanceM ?? c.set.reps ?? 0.001)
      : 0
  return (
    by(prMagnitude) ??
    by((c) => c.set.est1rmKg ?? 0) ??
    by((c) => c.set.weightKg ?? 0) ??
    by((c) => c.set.durationS ?? 0) ??
    by((c) => c.set.distanceM ?? 0) ??
    by((c) => c.set.reps ?? 0)
  )
}

// ---------------------------------------------------------------- plate math

export interface Plate {
  kg: number
  color: string
}

export const PLATE_COLORS: Record<string, string> = {
  '25': '#D0342C',
  '20': '#2B5DD7',
  '15': '#E8B33A',
  '10': '#3F9C5A',
  '5': '#EFEFEA',
  '2.5': '#7A8194',
  '1.25': '#7A8194',
}

export const BAR_KG = 20
const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25]

/**
 * Greedy per-side breakdown for the card's loaded-barbell graphic.
 * Returns null when no sensible loading exists (weight < bar + smallest pair).
 */
export function plateBreakdown(weightKg: number): Plate[] | null {
  if (weightKg < BAR_KG + 2 * PLATE_SIZES[PLATE_SIZES.length - 1]) return null
  let perSide = (weightKg - BAR_KG) / 2
  const out: Plate[] = []
  for (const p of PLATE_SIZES) {
    while (perSide >= p - 1e-9) {
      out.push({ kg: p, color: PLATE_COLORS[String(p)] })
      perSide -= p
    }
    if (out.length > 12) break // absurd loads: cap the graphic
  }
  return out.length > 0 ? out : null
}
