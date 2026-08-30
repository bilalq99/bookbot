// Full-screen exercise picker: debounced search, muscle filter chips, a Recent
// section (localStorage), and an inline "create custom exercise" form.
import { useEffect, useMemo, useState } from 'react'
import type { Equipment, Exercise, MetricType, MuscleGroup } from '../../shared/types'
import { api } from '../lib/api'
import { IconX } from './Icons'

export interface ExercisePickerProps {
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

const RECENT_KEY = 'chalk.recentExercises'

export function rememberRecent(ex: Exercise): void {
  try {
    const cur = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Exercise[]
    const next = [ex, ...cur.filter((e) => e.id !== ex.id)].slice(0, 8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

function readRecent(): Exercise[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Exercise[]
  } catch {
    return []
  }
}

const MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings',
  'glutes', 'core', 'traps', 'forearms', 'calves', 'full_body',
]

const METRIC_LABELS: Record<MetricType, string> = {
  weight_reps: 'Weight × reps',
  bodyweight_reps: 'Bodyweight reps (+ weight)',
  duration: 'Time / hold',
  distance_duration: 'Carry / distance',
}

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'odd_implement']

export default function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('')
  const [results, setResults] = useState<Exercise[]>([])
  const [creating, setCreating] = useState(false)
  const [newMetric, setNewMetric] = useState<MetricType>('weight_reps')
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest')
  const [newEquipment, setNewEquipment] = useState<Equipment>('barbell')
  const [error, setError] = useState('')
  const recent = useMemo(readRecent, [])

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .exercises(q || undefined, muscle || undefined)
        .then((r) => setResults(r.exercises))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [q, muscle])

  const pick = (ex: Exercise) => {
    rememberRecent(ex)
    onPick(ex)
  }

  const createCustom = () => {
    setError('')
    api
      .createExercise({ name: q.trim(), metricType: newMetric, muscleGroup: newMuscle, equipment: newEquipment })
      .then((r) => pick(r.exercise))
      .catch((e: Error) => setError(e.message))
  }

  return (
    <div className="log-picker" role="dialog" aria-label="Add exercise">
      <header className="log-picker-head">
        <input
          className="input"
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCreating(false)
          }}
          autoFocus
        />
        <button className="log-picker-close" onClick={onClose} aria-label="Close">
          <IconX size={22} />
        </button>
      </header>

      <div className="log-picker-chips">
        <button className={`chip ${muscle === '' ? 'chip-active' : ''}`} onClick={() => setMuscle('')}>
          All
        </button>
        {MUSCLES.map((m) => (
          <button
            key={m}
            className={`chip ${muscle === m ? 'chip-active' : ''}`}
            onClick={() => setMuscle(muscle === m ? '' : m)}
          >
            {m.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="log-picker-list">
        {q === '' && muscle === '' && recent.length > 0 && (
          <>
            <p className="log-picker-section">Recent</p>
            {recent.map((ex) => (
              <button key={`r${ex.id}`} className="log-picker-row" onClick={() => pick(ex)}>
                <span className="log-picker-name">{ex.name}</span>
                <span className="log-picker-meta">
                  {ex.muscleGroup.replace('_', ' ')} · {ex.equipment.replace('_', ' ')}
                </span>
              </button>
            ))}
            <p className="log-picker-section">All exercises</p>
          </>
        )}
        {results.map((ex) => (
          <button key={ex.id} className="log-picker-row" onClick={() => pick(ex)}>
            <span className="log-picker-name">
              {ex.name}
              {ex.isCustom && <span className="log-picker-custom"> · yours</span>}
            </span>
            <span className="log-picker-meta">
              {ex.muscleGroup.replace('_', ' ')} · {ex.equipment.replace('_', ' ')}
            </span>
          </button>
        ))}

        {q.trim().length >= 2 &&
          (creating ? (
            <div className="log-picker-create card">
              <p className="log-picker-create-title">Create “{q.trim()}”</p>
              <label className="field">
                <span className="label">Logged as</span>
                <select className="input" value={newMetric} onChange={(e) => setNewMetric(e.target.value as MetricType)}>
                  {(Object.keys(METRIC_LABELS) as MetricType[]).map((m) => (
                    <option key={m} value={m}>
                      {METRIC_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Muscle group</span>
                <select className="input" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}>
                  {MUSCLES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Equipment</span>
                <select
                  className="input"
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value as Equipment)}
                >
                  {EQUIPMENT.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="btn btn-primary" onClick={createCustom}>
                Create exercise
              </button>
            </div>
          ) : (
            <button className="log-picker-row log-picker-createrow" onClick={() => setCreating(true)}>
              + Create “{q.trim()}”
            </button>
          ))}
      </div>
    </div>
  )
}
