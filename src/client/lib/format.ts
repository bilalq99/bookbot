// PLACEHOLDER — owned by agent C1 (client-shell). Replace the bodies; keep these
// exported signatures EXACTLY (C2/C3 components compile against them).
// Conversions per docs/SPEC.md §5: kg canonical; lb = kg / 0.45359237 shown to
// 1 decimal; tonnage nearest integer with thousands separators; durations M:SS
// above 90s else "Ns"; session duration "1 h 12 m"; relative time "2h"/"3d"/date.
import type { MetricType, SetOut, Unit } from '../../shared/types'

/** "180 kg" / "396.8 lb" — one set's weight. */
export function formatWeight(_kg: number, _unit: Unit): string {
  throw new Error('not implemented')
}

/** "14,320 kg" tonnage in the user's unit, nearest integer, thousands separators. */
export function formatVolume(_kg: number, _unit: Unit): string {
  throw new Error('not implemented')
}

/** Hold/carry time: 45 -> "45s", 95 -> "1:35". */
export function formatSeconds(_s: number): string {
  throw new Error('not implemented')
}

/** Session duration: 4320 -> "1 h 12 m", 2700 -> "45 m". */
export function formatSessionDuration(_s: number): string {
  throw new Error('not implemented')
}

/** "now"/"5m"/"2h"/"3d", then "21 Aug" (or "21 Aug 2025" if older than a year). */
export function formatRelativeTime(_ms: number, _nowMs?: number): string {
  throw new Error('not implemented')
}

/** "Thu 21 Aug" style absolute date. */
export function formatDate(_ms: number): string {
  throw new Error('not implemented')
}

/** One set line per metric type: "80 × 8 @9" · "+20 × 5" · "× 41" · "0:45" · "120 kg · 30 m". */
export function formatSetLine(_set: SetOut, _metric: MetricType, _unit: Unit): string {
  throw new Error('not implemented')
}
