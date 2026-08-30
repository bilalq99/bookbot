// ★ The auto-generated Session Card — the product's signature visual. A pure
// CSS/SVG, deterministic render of a workout: muscle-group gradient, chalk-dust
// noise, headline lift in giant tabular numerals, a loaded-barbell graphic in
// IPF plate colors, and a stat strip. See docs/SPEC.md §10.
import type { WorkoutCard } from '../../shared/types'
import { dominantGradient, pickHeadline, plateBreakdown, type Plate } from '../../shared/formulas'
import { formatSeconds, formatSessionDuration, formatVolume, formatDate, weightNumber } from '../lib/format'
import { useAuth } from '../lib/auth'

export interface SessionCardProps {
  workout: WorkoutCard
  compact?: boolean
}

/** Disc height (SVG px) per plate kg — 25s read tallest, change plates smallest. */
const PLATE_HEIGHT: Record<string, number> = {
  '25': 46,
  '20': 40,
  '15': 34,
  '10': 27,
  '5': 20,
  '2.5': 15,
  '1.25': 12,
}

function BarbellGraphic({ plates }: { plates: Plate[] }) {
  const shown = plates.slice(0, 6)
  const discW = 7.5
  const gap = 1.5
  const innerL = 96
  const innerR = 204
  return (
    <svg className="card-barbell" viewBox="0 0 300 56" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {/* bar + sleeves */}
      <rect x="4" y="26" width="292" height="4" rx="2" fill="#B9BEC9" />
      <rect x="88" y="21" width="6" height="14" rx="2" fill="#8A8F9B" />
      <rect x="206" y="21" width="6" height="14" rx="2" fill="#8A8F9B" />
      {shown.map((p, i) => {
        const h = PLATE_HEIGHT[String(p.kg)] ?? 14
        const y = 28 - h / 2
        const xL = innerL - (i + 1) * (discW + gap)
        const xR = innerR + i * (discW + gap) + gap
        return (
          <g key={i}>
            <rect x={xL} y={y} width={discW} height={h} rx="2.5" fill={p.color} stroke="rgba(0,0,0,0.35)" />
            <rect x={xR} y={y} width={discW} height={h} rx="2.5" fill={p.color} stroke="rgba(0,0,0,0.35)" />
          </g>
        )
      })}
    </svg>
  )
}

export default function SessionCard({ workout, compact = false }: SessionCardProps) {
  const { user } = useAuth()
  const unit = user?.unitPreference ?? 'kg'
  const headline = pickHeadline(workout.exercises)
  const grad = dominantGradient(workout.exercises)

  let numLine = ''
  let subLine = ''
  if (headline) {
    const s = headline.set
    switch (headline.metricType) {
      case 'weight_reps':
        numLine = `${weightNumber(s.weightKg ?? 0, unit)} × ${s.reps ?? 0}`
        if (s.est1rmKg !== null && (s.reps ?? 0) > 1) subLine = `e1RM ${weightNumber(s.est1rmKg, unit)} ${unit}`
        break
      case 'bodyweight_reps':
        numLine = s.weightKg && s.weightKg > 0 ? `+${weightNumber(s.weightKg, unit)} × ${s.reps ?? 0}` : `× ${s.reps ?? 0}`
        break
      case 'duration':
        numLine = formatSeconds(s.durationS ?? 0)
        break
      case 'distance_duration':
        numLine =
          s.weightKg && s.weightKg > 0
            ? `${weightNumber(s.weightKg, unit)} ${unit} · ${Math.round(s.distanceM ?? 0)} m`
            : `${Math.round(s.distanceM ?? 0)} m`
        break
    }
  }

  const plates =
    headline && headline.metricType === 'weight_reps' && headline.set.weightKg
      ? plateBreakdown(headline.set.weightKg)
      : null

  const kicker = workout.title || 'Training Session'

  return (
    <div className={`card-hero card-grad-${grad}${compact ? ' card-compact' : ''}`}>
      {/* chalk-dust texture */}
      <svg className="card-noise" aria-hidden="true">
        <filter id={`chalk-${workout.id}${compact ? 'c' : ''}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#chalk-${workout.id}${compact ? 'c' : ''})`} />
      </svg>

      <div className="card-kicker">
        <span className="card-kicker-title">{kicker}</span>
        {!compact && <span className="card-kicker-date">{formatDate(workout.startedAt ?? workout.publishedAt)}</span>}
      </div>

      <div className="card-center">
        {headline ? (
          <>
            <div className="card-lift">{headline.exerciseName}</div>
            <div className="card-num num">
              {numLine}
              {workout.prCount > 0 && <span className="card-pr">PR</span>}
            </div>
            {subLine && !compact && <div className="card-sub num">{subLine}</div>}
          </>
        ) : (
          <div className="card-lift">{kicker}</div>
        )}
        {plates && !compact && <BarbellGraphic plates={plates} />}
      </div>

      {!compact && (
        <>
          <div className="card-stats num">
            {workout.totalVolumeKg > 0 && <span>{formatVolume(workout.totalVolumeKg, unit)}</span>}
            <span>{workout.totalSets} sets</span>
            {workout.durationS !== null && <span>{formatSessionDuration(workout.durationS)}</span>}
          </div>
          <div className="card-foot">
            <span className="card-author">● {workout.author.username}</span>
            <span className="card-wordmark">CHALK</span>
          </div>
        </>
      )}
    </div>
  )
}
