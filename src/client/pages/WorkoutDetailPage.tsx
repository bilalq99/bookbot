// Session detail (/s/:id): hero, stat tiles, per-exercise set tables (warmups
// dimmed, est.1RM column, PR chips), bumps row, comments, owner edit/delete.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { UserSearchItem, WorkoutDetail } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  formatRelativeTime,
  formatSessionDuration,
  formatSetLine,
  formatVolume,
  formatWeight,
  weightNumber,
} from '../lib/format'
import { pickHeadline } from '../../shared/formulas'
import Avatar from '../components/Avatar'
import SessionCard from '../components/SessionCard'
import CommentList from '../components/CommentList'
import { IconChevronLeft, IconFist, IconTrash } from '../components/Icons'

export default function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const me = user!
  const unit = me.unitPreference
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [likers, setLikers] = useState<UserSearchItem[]>([])
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const workoutId = Number(id)

  useEffect(() => {
    let live = true
    api
      .getWorkout(workoutId)
      .then((r) => {
        if (!live) return
        setWorkout(r.workout)
        if (r.workout.likeCount > 0) {
          api.likers(workoutId).then((l) => live && setLikers(l.users)).catch(() => {})
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true)
      })
    return () => {
      live = false
    }
  }, [workoutId])

  if (missing) {
    return (
      <div className="empty-state">
        <p>This session doesn't exist (or isn't published yet).</p>
        <Link to="/" className="btn">
          Back to feed
        </Link>
      </div>
    )
  }
  if (!workout) return <p className="feed-loading muted">Loading…</p>

  const isOwner = workout.author.id === me.id
  const headline = pickHeadline(workout.exercises)

  const toggleBump = () => {
    const liking = !workout.viewerLiked
    setWorkout({ ...workout, viewerLiked: liking, likeCount: workout.likeCount + (liking ? 1 : -1) })
    const call = liking ? api.like(workout.id) : api.unlike(workout.id)
    call.catch(() =>
      setWorkout((w) => w && { ...w, viewerLiked: !liking, likeCount: w.likeCount + (liking ? -1 : 1) }),
    )
  }

  const saveEdit = () => {
    api.updateWorkout(workout.id, { title: editTitle, notes: editNotes }).then((r) => {
      setWorkout({ ...workout, title: r.workout.title, notes: r.workout.notes })
      setEditing(false)
    })
  }

  const remove = () => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    api.deleteWorkout(workout.id).then(() => navigate('/', { replace: true }))
  }

  const card = { ...workout, publishedAt: workout.publishedAt ?? workout.createdAt }

  return (
    <div className="wk-page">
      <header className="wk-topbar">
        <button className="wk-back" onClick={() => navigate(-1)} aria-label="Back">
          <IconChevronLeft size={22} />
        </button>
        <Link to={`/@${workout.author.username}`} className="feed-author">
          <Avatar username={workout.author.username} displayName={workout.author.displayName} size={32} />
          <span className="feed-author-name">{workout.author.displayName}</span>
        </Link>
        <span className="feed-time">
          {formatRelativeTime(workout.publishedAt ?? workout.createdAt)}
        </span>
      </header>

      <div className="wk-hero">
        {workout.media.length > 0 ? (
          <div className="feed-photos">
            {workout.media.map((m) => (
              <img key={m.id} src={m.url} alt="" className="feed-photo" />
            ))}
          </div>
        ) : (
          <SessionCard workout={card} />
        )}
      </div>

      <div className="wk-headrow">
        {editing ? (
          <div className="wk-edit">
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={100} />
            <textarea
              className="input"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Notes"
            />
            <div className="wk-edit-actions">
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>
                Save
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="wk-title">{workout.title || 'Training Session'}</h1>
            {isOwner && (
              <div className="wk-owner-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditTitle(workout.title)
                    setEditNotes(workout.notes)
                    setEditing(true)
                  }}
                >
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm wk-delete" onClick={remove} aria-label="Delete session">
                  <IconTrash size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {workout.notes && !editing && <p className="wk-notes">{workout.notes}</p>}

      <div className="wk-tiles num">
        <div className="wk-tile">
          <span className="wk-tile-label">Volume</span>
          <span className="wk-tile-value">{formatVolume(workout.totalVolumeKg, unit)}</span>
        </div>
        <div className="wk-tile">
          <span className="wk-tile-label">Sets</span>
          <span className="wk-tile-value">{workout.totalSets}</span>
        </div>
        <div className="wk-tile">
          <span className="wk-tile-label">Top set</span>
          <span className="wk-tile-value wk-tile-small">
            {headline ? formatSetLine(headline.set, headline.metricType, unit) : '—'}
          </span>
        </div>
        <div className="wk-tile">
          <span className="wk-tile-label">Duration</span>
          <span className="wk-tile-value">{workout.durationS ? formatSessionDuration(workout.durationS) : '—'}</span>
        </div>
      </div>

      {workout.exercises.map((ex) => (
        <section key={ex.id} className="wk-exercise">
          <h2 className="wk-exercise-name">
            {ex.exercise.name}
            <span className="wk-exercise-muscle">{ex.exercise.muscleGroup.replace('_', ' ')}</span>
          </h2>
          {ex.notes && <p className="wk-exercise-note">{ex.notes}</p>}
          <table className="wk-table num">
            <tbody>
              {(() => {
                let n = 0
                return ex.sets.map((s) => (
                <tr key={s.id} className={s.setType === 'warmup' ? 'wk-set-warmup' : ''}>
                  <td className="wk-set-n">{s.setType === 'warmup' ? 'W' : ++n}</td>
                  <td className="wk-set-line">{formatSetLine(s, ex.exercise.metricType, unit)}</td>
                  <td className="wk-set-e1rm">
                    {s.est1rmKg !== null && (s.reps ?? 0) > 1 ? `e1RM ${weightNumber(s.est1rmKg, unit)}` : ''}
                  </td>
                  <td className="wk-set-pr">{s.isPr && <span className="feed-prchip">PR</span>}</td>
                </tr>
                ))
              })()}
            </tbody>
          </table>
        </section>
      ))}

      <div className="wk-bumps">
        <button
          className={`feed-bump${workout.viewerLiked ? ' feed-bump-on' : ''}`}
          onClick={toggleBump}
          aria-pressed={workout.viewerLiked}
        >
          <IconFist size={22} />
          <span className="num">{workout.likeCount > 0 ? workout.likeCount : 'Bump'}</span>
        </button>
        {likers.length > 0 && (
          <span className="wk-likers">
            {likers.slice(0, 6).map((u) => (
              <Link key={u.id} to={`/@${u.username}`} className="wk-liker" title={u.displayName}>
                <Avatar username={u.username} displayName={u.displayName} size={26} />
              </Link>
            ))}
          </span>
        )}
      </div>

      <CommentList
        workoutId={workout.id}
        workoutOwnerId={workout.author.id}
        onCountChange={(d) => setWorkout((w) => w && { ...w, commentCount: w.commentCount + d })}
      />

      <p className="wk-liftline muted">
        {workout.prCount > 0 && `${workout.prCount} PR${workout.prCount > 1 ? 's' : ''} · `}
        {formatWeight(workout.totalVolumeKg, unit)} moved
      </p>
    </div>
  )
}
