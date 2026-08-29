// The trophy room: powerlifting marquee (best S/B/D + TOTAL, est. total from
// e1RM) and every PR grouped by exercise. docs/SPEC.md §10.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PrOut, RecordType } from '../../shared/types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, formatSeconds, weightNumber } from '../lib/format'

const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: 'Max',
  max_est_1rm: 'e1RM',
  max_reps: 'Reps',
  max_duration: 'Hold',
  max_distance: 'Carry',
}

export default function RecordsPage() {
  const { user } = useAuth()
  const me = user!
  const unit = me.unitPreference
  const [prs, setPrs] = useState<PrOut[] | null>(null)

  useEffect(() => {
    api
      .userPrs(me.username)
      .then((r) => setPrs(r.prs))
      .catch(() => setPrs([]))
  }, [me.username])

  const formatValue = (pr: PrOut): string => {
    switch (pr.recordType) {
      case 'max_reps':
        return `${pr.value}`
      case 'max_duration':
        return formatSeconds(pr.value)
      case 'max_distance':
        return `${Math.round(pr.value)} m`
      default:
        return `${weightNumber(pr.value, unit)} ${unit}`
    }
  }

  const marquee = useMemo(() => {
    if (!prs) return null
    const bestBySlug = (slugs: string[], type: RecordType): number | null => {
      const vals = prs
        .filter((p) => p.recordType === type && p.exercise.slug !== null && slugs.includes(p.exercise.slug))
        .map((p) => p.value)
      return vals.length > 0 ? Math.max(...vals) : null
    }
    const squat = bestBySlug(['back-squat'], 'max_weight')
    const bench = bestBySlug(['bench-press'], 'max_weight')
    const dead = bestBySlug(['deadlift', 'sumo-deadlift'], 'max_weight')
    const squatE = bestBySlug(['back-squat'], 'max_est_1rm')
    const benchE = bestBySlug(['bench-press'], 'max_est_1rm')
    const deadE = bestBySlug(['deadlift', 'sumo-deadlift'], 'max_est_1rm')
    return {
      squat,
      bench,
      dead,
      total: squat !== null && bench !== null && dead !== null ? squat + bench + dead : null,
      estTotal: squatE !== null && benchE !== null && deadE !== null ? squatE + benchE + deadE : null,
    }
  }, [prs])

  const groups = useMemo(() => {
    if (!prs) return []
    const byExercise = new Map<number, { name: string; latest: number; records: PrOut[] }>()
    for (const pr of prs) {
      let g = byExercise.get(pr.exercise.id)
      if (!g) byExercise.set(pr.exercise.id, (g = { name: pr.exercise.name, latest: 0, records: [] }))
      g.records.push(pr)
      g.latest = Math.max(g.latest, pr.achievedAt)
    }
    return [...byExercise.values()].sort((a, b) => b.latest - a.latest)
  }, [prs])

  if (!prs) return <p className="feed-loading muted">Loading…</p>

  return (
    <div className="page rec-page">
      <h1 className="page-title">Records</h1>

      {prs.length === 0 ? (
        <div className="empty-state">
          <p>No records yet — every first set is a PR waiting to happen.</p>
          <Link to="/log" className="btn btn-primary">
            Chalk up your first session
          </Link>
        </div>
      ) : (
        <>
          {marquee && (marquee.squat !== null || marquee.bench !== null || marquee.dead !== null) && (
            <div className="rec-marquee card num">
              <div className="rec-lift">
                <span className="rec-lift-label">SQ</span>
                <span className="rec-lift-value">{marquee.squat !== null ? weightNumber(marquee.squat, unit) : '—'}</span>
              </div>
              <div className="rec-lift">
                <span className="rec-lift-label">BP</span>
                <span className="rec-lift-value">{marquee.bench !== null ? weightNumber(marquee.bench, unit) : '—'}</span>
              </div>
              <div className="rec-lift">
                <span className="rec-lift-label">DL</span>
                <span className="rec-lift-value">{marquee.dead !== null ? weightNumber(marquee.dead, unit) : '—'}</span>
              </div>
              <div className="rec-lift rec-total">
                <span className="rec-lift-label">TOTAL</span>
                <span className="rec-lift-value">
                  {marquee.total !== null
                    ? `${weightNumber(marquee.total, unit)} ${unit}`
                    : marquee.estTotal !== null
                      ? `${weightNumber(marquee.estTotal, unit)} ${unit} est.`
                      : '—'}
                </span>
              </div>
            </div>
          )}

          {groups.map((g) => (
            <section key={g.name} className="rec-group">
              <h2 className="rec-group-name">{g.name}</h2>
              <div className="rec-chips">
                {g.records.map((pr) => (
                  <Link
                    key={pr.recordType}
                    to={pr.workoutId !== null ? `/s/${pr.workoutId}` : '#'}
                    className="rec-chip num"
                  >
                    <span className="rec-chip-type">{RECORD_LABELS[pr.recordType]}</span>
                    <span className="rec-chip-value">{formatValue(pr)}</span>
                    <span className="rec-chip-date">{formatDate(pr.achievedAt)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
