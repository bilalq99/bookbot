// PLACEHOLDER — owned by agent C2 (client-feed). Replace entirely; keep the
// default export and props EXACTLY (C3's profile grid also renders this).
// ★ THE hero visual — docs/SPEC.md §10: 4:3 card, gradient from
// dominantGradient(), chalk-noise SVG filter, kicker (title · date), headline via
// pickHeadline() in giant tabular numerals + PR chip, loaded-barbell SVG from
// plateBreakdown() (IPF plate colors, proportional discs), stat strip
// (VOLUME · SETS · duration), footer "● username" + CHALK wordmark.
// compact mode: grid thumbnail — hide stat strip + footer. Pure CSS/SVG.
import type { WorkoutCard } from '../../shared/types'

export interface SessionCardProps {
  workout: WorkoutCard
  compact?: boolean
}

export default function SessionCard(_props: SessionCardProps) {
  return null
}
