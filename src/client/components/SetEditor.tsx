// The set table for one exercise block. Columns adapt to the metric type.
// Values in `sets` are numbers in the VIEWER'S unit — the page converts to kg
// at submit time. PREV shows last session's matching set as ghost text.
import { useRef, useState } from 'react'
import type { MetricType, SetIn } from '../../shared/types'
import { useAuth } from '../lib/auth'
import { IconCheck, IconX } from './Icons'

export interface EditableSet extends SetIn {
  completed?: boolean
  /** Client-only stable row key (assigned by the page). */
  uid?: number
}

export interface SetEditorProps {
  metricType: MetricType
  sets: EditableSet[]
  prev: SetIn[] | null
  onChange: (sets: EditableSet[]) => void
  onSetCompleted: () => void
}

type Field = 'weightKg' | 'reps' | 'durationS' | 'distanceM' | 'rpe'

interface Col {
  field: Field
  label: string
  step?: string
}

function columns(metric: MetricType, unit: string): Col[] {
  switch (metric) {
    case 'weight_reps':
      return [
        { field: 'weightKg', label: unit.toUpperCase() },
        { field: 'reps', label: 'REPS' },
        { field: 'rpe', label: 'RPE' },
      ]
    case 'bodyweight_reps':
      return [
        { field: 'weightKg', label: `+${unit.toUpperCase()}` },
        { field: 'reps', label: 'REPS' },
        { field: 'rpe', label: 'RPE' },
      ]
    case 'duration':
      return [
        { field: 'durationS', label: 'SEC' },
        { field: 'weightKg', label: `+${unit.toUpperCase()}` },
      ]
    case 'distance_duration':
      return [
        { field: 'weightKg', label: unit.toUpperCase() },
        { field: 'distanceM', label: 'METERS' },
        { field: 'durationS', label: 'SEC' },
      ]
  }
}

function ghost(prev: SetIn | undefined, metric: MetricType): string {
  if (!prev) return ''
  switch (metric) {
    case 'weight_reps':
      return `${prev.weightKg ?? ''}×${prev.reps ?? ''}${prev.rpe ? ` @${prev.rpe}` : ''}`
    case 'bodyweight_reps':
      return prev.weightKg ? `+${prev.weightKg}×${prev.reps ?? ''}` : `×${prev.reps ?? ''}`
    case 'duration':
      return `${prev.durationS ?? ''}s`
    case 'distance_duration':
      return `${prev.weightKg ?? ''}kg·${prev.distanceM ?? ''}m`
  }
}

export default function SetEditor({ metricType, sets, prev, onChange, onSetCompleted }: SetEditorProps) {
  const { user } = useAuth()
  const unit = user?.unitPreference ?? 'kg'
  const cols = columns(metricType, unit)
  // Raw text per (row uid, field) so partially-typed decimals ("102.") survive renders.
  const [raw, setRaw] = useState<Record<string, string>>({})
  const nextUid = useRef(-1)

  const setField = (i: number, field: Field, text: string) => {
    const uid = sets[i].uid ?? i
    setRaw((r) => ({ ...r, [`${uid}:${field}`]: text }))
    const n = text.trim() === '' ? undefined : Number(text)
    const next = sets.map((s, j) => (j === i ? { ...s, [field]: n !== undefined && Number.isFinite(n) ? n : undefined } : s))
    onChange(next)
  }

  const cellValue = (s: EditableSet, i: number, field: Field): string => {
    const key = `${s.uid ?? i}:${field}`
    if (key in raw) return raw[key]
    const v = s[field]
    return v === undefined ? '' : String(v)
  }

  const toggleWarmup = (i: number) => {
    onChange(sets.map((s, j) => (j === i ? { ...s, setType: s.setType === 'warmup' ? 'normal' : 'warmup' } : s)))
  }

  const complete = (i: number) => {
    const was = sets[i].completed
    onChange(sets.map((s, j) => (j === i ? { ...s, completed: !was } : s)))
    if (!was) onSetCompleted()
  }

  const removeRow = (i: number) => {
    onChange(sets.filter((_, j) => j !== i))
  }

  const addRow = () => {
    const last = sets[sets.length - 1]
    // Copy the previous row's numbers but always start as a working set.
    const copy: EditableSet = last
      ? { ...last, setType: 'normal', completed: false, uid: nextUid.current-- }
      : { setType: 'normal', uid: nextUid.current-- }
    onChange([...sets, copy])
  }

  let workingIndex = 0
  return (
    <div className="log-settable num">
      <div className="log-setrow log-setrow-head">
        <span className="log-set-n">SET</span>
        <span className="log-set-prev">PREV</span>
        {cols.map((c) => (
          <span key={c.field} className="log-set-col">
            {c.label}
          </span>
        ))}
        <span className="log-set-actions" />
      </div>
      {sets.map((s, i) => {
        const isWarmup = s.setType === 'warmup'
        const label = isWarmup ? 'W' : String(++workingIndex)
        return (
          <div key={s.uid ?? i} className={`log-setrow${s.completed ? ' log-setrow-done' : ''}`}>
            <button
              className={`log-set-n log-set-w${isWarmup ? ' log-set-w-on' : ''}`}
              onClick={() => toggleWarmup(i)}
              title="Toggle warm-up"
            >
              {label}
            </button>
            <span className="log-set-prev">{ghost(prev?.[i], metricType)}</span>
            {cols.map((c) => (
              <input
                key={c.field}
                className="log-set-input"
                inputMode="decimal"
                value={cellValue(s, i, c.field)}
                onChange={(e) => setField(i, c.field, e.target.value.replace(/[^0-9.]/g, ''))}
                aria-label={c.label}
              />
            ))}
            <span className="log-set-actions">
              <button
                className={`log-set-check${s.completed ? ' log-set-check-on' : ''}`}
                onClick={() => complete(i)}
                aria-label="Complete set"
              >
                <IconCheck size={16} />
              </button>
              <button className="log-set-del" onClick={() => removeRow(i)} aria-label="Remove set">
                <IconX size={14} />
              </button>
            </span>
          </div>
        )
      })}
      <button className="btn btn-ghost btn-sm log-addset" onClick={addRow}>
        + Add set
      </button>
    </div>
  )
}
