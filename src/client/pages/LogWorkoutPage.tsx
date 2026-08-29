// The /log flow: start (empty / repeat last) -> active editor (exercise blocks,
// set tables, rest timer, localStorage persistence) -> compose (title, notes,
// photos) -> publish -> PR celebration -> session detail. docs/SPEC.md §10.
// Set values are kept in the viewer's unit and converted to kg only at submit.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Exercise, NewPr, SetIn, WorkoutExerciseIn } from '../../shared/types'
import { kgToLb, lbToKg } from '../../shared/formulas'
import { validateSetForMetric } from '../../shared/validation'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatWeight } from '../lib/format'
import ExercisePicker from '../components/ExercisePicker'
import SetEditor, { type EditableSet } from '../components/SetEditor'
import RestTimer from '../components/RestTimer'
import { IconBarbell, IconPlus, IconTrash, IconX } from '../components/Icons'

const STORAGE_KEY = 'chalk.activeSession'

interface DraftExercise {
  exercise: Exercise
  sets: EditableSet[]
}

interface ActiveSession {
  title: string
  startedAt: number
  exercises: DraftExercise[]
  uidCounter: number
}

function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveSession) : null
  } catch {
    return null
  }
}

function saveSession(s: ActiveSession | null): void {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

const GRADIENT_TITLES: Record<string, string> = {
  push: 'Push Day',
  pull: 'Pull Day',
  legs: 'Leg Day',
  core: 'Core Day',
  full: 'Full Body',
}

const MUSCLE_TO_KEY: Record<string, string> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  back: 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  core: 'core', full_body: 'full',
}

function autoTitle(exercises: DraftExercise[]): string {
  const counts = new Map<string, number>()
  for (const ex of exercises) {
    const key = MUSCLE_TO_KEY[ex.exercise.muscleGroup] ?? 'full'
    counts.set(key, (counts.get(key) ?? 0) + ex.sets.length)
  }
  let best = 'full'
  let bestN = 0
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n]
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  return `${GRADIENT_TITLES[best]} — ${day}`
}

export default function LogWorkoutPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const me = user!
  const unit = me.unitPreference
  const toUnit = (kg: number) => (unit === 'lb' ? Math.round(kgToLb(kg) * 10) / 10 : kg)
  const toKg = (v: number) => (unit === 'lb' ? Math.round(lbToKg(v) * 1000) / 1000 : v)

  const [session, setSession] = useState<ActiveSession | null>(loadSession)
  const [step, setStep] = useState<'start' | 'active' | 'compose' | 'celebrate'>(session ? 'active' : 'start')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [restRun, setRestRun] = useState(0)
  const [showRest, setShowRest] = useState(false)
  const [, setTick] = useState(0)
  // prev sets (in viewer's unit) per exercise id, from the latest published session
  const [prevByExercise, setPrevByExercise] = useState<Map<number, SetIn[]>>(new Map())
  const [notes, setNotes] = useState('')
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [celebration, setCelebration] = useState<{ id: number; prs: NewPr[] } | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => saveSession(session), [session])

  useEffect(() => {
    if (step !== 'active') return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [step])

  // Fetch own recent history once for PREV ghosts and "repeat last".
  const [lastWorkout, setLastWorkout] = useState<Awaited<ReturnType<typeof api.userWorkouts>>['items'][number] | null>(null)
  useEffect(() => {
    api
      .userWorkouts(me.username)
      .then((r) => {
        setLastWorkout(r.items[0] ?? null)
        const map = new Map<number, SetIn[]>()
        for (const w of r.items) {
          for (const ex of w.exercises) {
            if (!map.has(ex.exercise.id)) {
              map.set(
                ex.exercise.id,
                ex.sets.map((s) => ({
                  setType: s.setType,
                  weightKg: s.weightKg !== null ? toUnit(s.weightKg) : undefined,
                  reps: s.reps ?? undefined,
                  durationS: s.durationS ?? undefined,
                  distanceM: s.distanceM ?? undefined,
                  rpe: s.rpe ?? undefined,
                })),
              )
            }
          }
        }
        setPrevByExercise(map)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.username])

  const startEmpty = () => {
    setSession({ title: '', startedAt: Date.now(), exercises: [], uidCounter: 1 })
    setStep('active')
    setPickerOpen(true)
  }

  const repeatLast = () => {
    if (!lastWorkout) return
    let uid = 1
    const exercises: DraftExercise[] = lastWorkout.exercises.map((ex) => ({
      exercise: ex.exercise,
      sets: ex.sets.map((s) => ({
        setType: s.setType,
        weightKg: s.weightKg !== null ? toUnit(s.weightKg) : undefined,
        reps: s.reps ?? undefined,
        durationS: s.durationS ?? undefined,
        distanceM: s.distanceM ?? undefined,
        rpe: s.rpe ?? undefined,
        completed: false,
        uid: uid++,
      })),
    }))
    setSession({ title: lastWorkout.title, startedAt: Date.now(), exercises, uidCounter: uid })
    setStep('active')
  }

  const addExercise = (exercise: Exercise) => {
    setPickerOpen(false)
    setSession((s) => {
      if (!s) return s
      return {
        ...s,
        uidCounter: s.uidCounter + 1,
        exercises: [...s.exercises, { exercise, sets: [{ setType: 'normal', completed: false, uid: s.uidCounter }] }],
      }
    })
  }

  const updateSets = (i: number, sets: EditableSet[]) => {
    setSession((s) => {
      if (!s) return s
      // Assign uids to any new rows the editor appended.
      let counter = s.uidCounter
      const withUids = sets.map((set) => (set.uid === undefined || set.uid < 0 ? { ...set, uid: counter++ } : set))
      return {
        ...s,
        uidCounter: counter,
        exercises: s.exercises.map((ex, j) => (j === i ? { ...ex, sets: withUids } : ex)),
      }
    })
  }

  const removeExercise = (i: number) => {
    setSession((s) => s && { ...s, exercises: s.exercises.filter((_, j) => j !== i) })
  }

  const discard = () => {
    if (!window.confirm('Discard this session? All logged sets will be lost.')) return
    setSession(null)
    saveSession(null)
    setStep('start')
  }

  /** Convert a draft set (viewer units) to a kg-canonical SetIn, or null if empty. */
  const toSetIn = (metric: Exercise['metricType'], s: EditableSet): SetIn | null => {
    const out: SetIn = { setType: s.setType === 'warmup' ? 'warmup' : 'normal' }
    if (s.weightKg !== undefined) out.weightKg = toKg(s.weightKg)
    if (s.reps !== undefined) out.reps = Math.round(s.reps)
    if (s.durationS !== undefined) out.durationS = Math.round(s.durationS)
    if (s.distanceM !== undefined) out.distanceM = s.distanceM
    if (s.rpe !== undefined) out.rpe = s.rpe
    const required: Record<string, (keyof SetIn)[]> = {
      weight_reps: ['weightKg', 'reps'],
      bodyweight_reps: ['reps'],
      duration: ['durationS'],
      distance_duration: ['distanceM'],
    }
    if (required[metric].some((f) => out[f] === undefined)) return null
    return out
  }

  const finish = () => {
    if (!session) return
    setTitle(session.title || autoTitle(session.exercises))
    setStep('compose')
  }

  const publish = async () => {
    if (!session) return
    setError('')
    const exercises: WorkoutExerciseIn[] = []
    for (const [i, ex] of session.exercises.entries()) {
      const sets = ex.sets.map((s) => toSetIn(ex.exercise.metricType, s)).filter((s): s is SetIn => s !== null)
      for (const [j, s] of sets.entries()) {
        const err = validateSetForMetric(ex.exercise.metricType, s)
        if (err) {
          setError(`${ex.exercise.name}, set ${j + 1}: ${err}`)
          return
        }
      }
      if (sets.length > 0) exercises.push({ exerciseId: ex.exercise.id, sets })
      else if (ex.sets.length > 0) {
        setError(`${session.exercises[i].exercise.name}: fill in or remove its empty sets`)
        return
      }
    }
    if (exercises.length === 0) {
      setError('Log at least one set before posting')
      return
    }
    setBusy(true)
    try {
      const mediaIds: number[] = []
      for (const file of photos.slice(0, 4)) {
        const m = await api.uploadMedia(file)
        mediaIds.push(m.id)
      }
      const durationS = Math.max(60, Math.round((Date.now() - session.startedAt) / 1000))
      const created = await api.createWorkout({
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        startedAt: session.startedAt,
        durationS,
        exercises,
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      })
      const published = await api.publishWorkout(created.workout.id)
      setSession(null)
      saveSession(null)
      if (published.newPrs.length > 0) {
        setCelebration({ id: created.workout.id, prs: published.newPrs })
        setStep('celebrate')
      } else {
        navigate(`/s/${created.workout.id}`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post the session — try again')
    } finally {
      setBusy(false)
    }
  }

  const elapsed = useMemo(() => {
    if (!session) return '0:00'
    const s = Math.floor((Date.now() - session.startedAt) / 1000)
    const m = Math.floor(s / 60)
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, step, restRun, Date.now() % 1000_000_0])

  // ---------------------------------------------------------------- start
  if (step === 'start') {
    return (
      <div className="page log-start">
        <h1 className="page-title">Chalk it up</h1>
        <button className="log-start-option" onClick={startEmpty}>
          <span className="log-start-icon">
            <IconPlus size={22} />
          </span>
          <span>
            <span className="log-start-label">Start empty</span>
            <span className="log-start-sub">Build the session as you go</span>
          </span>
        </button>
        <button className="log-start-option" onClick={repeatLast} disabled={!lastWorkout}>
          <span className="log-start-icon">
            <IconBarbell size={22} />
          </span>
          <span>
            <span className="log-start-label">Repeat last session</span>
            <span className="log-start-sub">
              {lastWorkout
                ? `${lastWorkout.title || 'Training Session'} · ${lastWorkout.exercises.length} exercises`
                : 'No sessions yet'}
            </span>
          </span>
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------- celebrate
  if (step === 'celebrate' && celebration) {
    return (
      <div className="page log-celebrate">
        <div className="log-celebrate-bell">PR</div>
        <h1 className="page-title">
          {celebration.prs.length} new record{celebration.prs.length > 1 ? 's' : ''}
        </h1>
        <ul className="log-celebrate-list">
          {celebration.prs.map((pr, i) => (
            <li key={i} className="card log-celebrate-item num">
              <span className="log-celebrate-ex">{pr.exerciseName}</span>
              <span className="log-celebrate-val">
                {pr.recordType === 'max_reps'
                  ? `${pr.value} reps`
                  : pr.recordType === 'max_duration'
                    ? `${pr.value}s`
                    : pr.recordType === 'max_distance'
                      ? `${pr.value} m`
                      : formatWeight(pr.value, unit)}
                {pr.recordType === 'max_est_1rm' && <span className="muted"> e1RM</span>}
              </span>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary" onClick={() => navigate(`/s/${celebration.id}`)}>
          View session
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------- compose
  if (step === 'compose' && session) {
    return (
      <div className="page log-compose">
        <h1 className="page-title">Post session</h1>
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </label>
        <label className="field">
          <span className="label">Caption</span>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="How did it go?"
          />
        </label>
        <div className="field">
          <span className="label">Photos ({photos.length}/4)</span>
          <div className="log-photos">
            {photos.map((f, i) => (
              <span key={i} className="log-photo">
                <img src={URL.createObjectURL(f)} alt="" />
                <button
                  className="log-photo-x"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                >
                  <IconX size={12} />
                </button>
              </span>
            ))}
            {photos.length < 4 && (
              <button className="log-photo-add" onClick={() => photoInput.current?.click()} aria-label="Add photo">
                <IconPlus size={20} />
              </button>
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              setPhotos((p) => [...p, ...files].slice(0, 4))
              e.target.value = ''
            }}
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="log-compose-actions">
          <button className="btn btn-ghost" onClick={() => setStep('active')} disabled={busy}>
            Back
          </button>
          <button className="btn btn-primary log-post" onClick={() => void publish()} disabled={busy}>
            {busy ? 'Posting…' : 'Post session'}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- active
  if (!session) return null
  return (
    <div className="log-active">
      <header className="log-header">
        <input
          className="log-title-input"
          value={session.title}
          placeholder="Session title"
          maxLength={100}
          onChange={(e) => setSession((s) => s && { ...s, title: e.target.value })}
        />
        <span className="log-elapsed num">{elapsed}</span>
        <button className="btn btn-primary btn-sm" onClick={finish} disabled={session.exercises.length === 0}>
          Finish
        </button>
      </header>

      {session.exercises.length === 0 && (
        <div className="empty-state">
          <p>Add your first exercise to get under the bar.</p>
        </div>
      )}

      {session.exercises.map((ex, i) => (
        <section key={`${ex.exercise.id}-${i}`} className="log-block card">
          <div className="log-block-head">
            <h2 className="log-block-name">{ex.exercise.name}</h2>
            <button className="log-block-remove" onClick={() => removeExercise(i)} aria-label="Remove exercise">
              <IconTrash size={16} />
            </button>
          </div>
          <SetEditor
            metricType={ex.exercise.metricType}
            sets={ex.sets}
            prev={prevByExercise.get(ex.exercise.id) ?? null}
            onChange={(sets) => updateSets(i, sets)}
            onSetCompleted={() => {
              setShowRest(true)
              setRestRun((r) => r + 1)
            }}
          />
        </section>
      ))}

      <div className="log-actions">
        <button className="btn" onClick={() => setPickerOpen(true)}>
          + Add exercise
        </button>
        <button className="btn btn-ghost log-discard" onClick={discard}>
          Discard
        </button>
      </div>

      {showRest && <RestTimer runId={restRun} onDone={() => setShowRest(false)} />}
      {pickerOpen && <ExercisePicker onPick={addExercise} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
