// Display formatting — docs/SPEC.md §5. Storage is canonical kg/m/s; everything
// here converts at the edge for the viewer's unit preference.
import type { MetricType, SetOut, Unit } from '../../shared/types'
import { kgToLb } from '../../shared/formulas'

/** Round to 1 decimal and drop a trailing .0 — "180", "102.5". */
function trim1(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** Bare number in the viewer's unit, no suffix — for big numerals. */
export function weightNumber(kg: number, unit: Unit): string {
  return trim1(unit === 'lb' ? kgToLb(kg) : kg)
}

/** "180 kg" / "396.8 lb". */
export function formatWeight(kg: number, unit: Unit): string {
  return `${weightNumber(kg, unit)} ${unit}`
}

/** Tonnage: "14,320 kg" — nearest integer, thousands separators. */
export function formatVolume(kg: number, unit: Unit): string {
  const v = unit === 'lb' ? kgToLb(kg) : kg
  return `${Math.round(v).toLocaleString('en-US')} ${unit}`
}

/** Hold/carry time: 45 -> "45s", 95 -> "1:35". */
export function formatSeconds(s: number): string {
  if (s <= 90) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Session duration: 4320 -> "1 h 12 m", 2700 -> "45 m". */
export function formatSessionDuration(s: number): string {
  const totalMin = Math.round(s / 60)
  if (totalMin < 60) return `${totalMin} m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "now" / "5m" / "2h" / "3d", then "21 Aug" (with year once it is old). */
export function formatRelativeTime(ms: number, nowMs: number = Date.now()): string {
  const diff = nowMs - ms
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`
  const d = new Date(ms)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return diff < 365 * 86_400_000 ? base : `${base} ${d.getFullYear()}`
}

/** "Thu 21 Aug". */
export function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** One set line: "80 × 8 @9" · "+20 × 5" · "× 41" · "0:45" · "120 kg · 30 m". */
export function formatSetLine(set: SetOut, metric: MetricType, unit: Unit): string {
  const rpe = set.rpe !== null ? ` @${set.rpe}` : ''
  switch (metric) {
    case 'weight_reps':
      return `${weightNumber(set.weightKg ?? 0, unit)} × ${set.reps ?? 0}${rpe}`
    case 'bodyweight_reps':
      return set.weightKg !== null && set.weightKg > 0
        ? `+${weightNumber(set.weightKg, unit)} × ${set.reps ?? 0}${rpe}`
        : `× ${set.reps ?? 0}${rpe}`
    case 'duration':
      return set.weightKg !== null && set.weightKg > 0
        ? `+${weightNumber(set.weightKg, unit)} · ${formatSeconds(set.durationS ?? 0)}`
        : formatSeconds(set.durationS ?? 0)
    case 'distance_duration': {
      const parts: string[] = []
      if (set.weightKg !== null && set.weightKg > 0) parts.push(formatWeight(set.weightKg, unit))
      parts.push(`${Math.round(set.distanceM ?? 0)} m`)
      if (set.durationS !== null) parts.push(formatSeconds(set.durationS))
      return parts.join(' · ')
    }
  }
}
