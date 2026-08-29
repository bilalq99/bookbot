// One feed post: author header, hero (photos or SessionCard), exercise strip,
// and the actions row. Bumping is optimistic; double-clicking the hero bumps too.
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { WorkoutCard } from '../../shared/types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRelativeTime, formatSetLine } from '../lib/format'
import Avatar from './Avatar'
import SessionCard from './SessionCard'
import { IconComment, IconFist } from './Icons'

export interface FeedItemProps {
  workout: WorkoutCard
  onChange?: (updated: WorkoutCard) => void
}

export default function FeedItem({ workout, onChange }: FeedItemProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const unit = user?.unitPreference ?? 'kg'
  const [burst, setBurst] = useState(0)
  const busy = useRef(false)

  const setLiked = (liked: boolean) => {
    onChange?.({
      ...workout,
      viewerLiked: liked,
      likeCount: workout.likeCount + (liked ? 1 : -1),
    })
  }

  const toggleBump = (forceLike = false) => {
    if (busy.current) return
    if (forceLike && workout.viewerLiked) return
    const liking = forceLike || !workout.viewerLiked
    busy.current = true
    setLiked(liking)
    if (liking) setBurst((b) => b + 1)
    const call = liking ? api.like(workout.id) : api.unlike(workout.id)
    call
      .catch(() => setLiked(!liking))
      .finally(() => {
        busy.current = false
      })
  }

  const strip = workout.exercises.slice(0, 3).map((ex) => {
    const top = ex.sets.filter((s) => s.setType !== 'warmup').at(-1) ?? ex.sets.at(-1)
    return `${ex.exercise.name}${top ? ` ${formatSetLine(top, ex.exercise.metricType, unit)}` : ''}`
  })
  const more = workout.exercises.length - 3

  return (
    <article className="feed-item">
      <header className="feed-head">
        <Link to={`/@${workout.author.username}`} className="feed-author">
          <Avatar username={workout.author.username} displayName={workout.author.displayName} size={38} />
          <span className="feed-author-names">
            <span className="feed-author-name">{workout.author.displayName}</span>
            <span className="feed-author-user">@{workout.author.username}</span>
          </span>
        </Link>
        <time className="feed-time">{formatRelativeTime(workout.publishedAt)}</time>
      </header>

      <div className="feed-hero" onDoubleClick={() => toggleBump(true)} role="presentation">
        {workout.media.length > 0 ? (
          <div className="feed-photos">
            {workout.media.map((m) => (
              <img key={m.id} src={m.url} alt="" loading="lazy" className="feed-photo" />
            ))}
          </div>
        ) : (
          <Link to={`/s/${workout.id}`} className="feed-cardlink">
            <SessionCard workout={workout} />
          </Link>
        )}
      </div>

      {strip.length > 0 && (
        <Link to={`/s/${workout.id}`} className="feed-strip num">
          {strip.join(' · ')}
          {more > 0 && <span className="muted"> +{more} more</span>}
        </Link>
      )}

      <div className="feed-actions">
        <button
          className={`feed-bump${workout.viewerLiked ? ' feed-bump-on' : ''}`}
          onClick={() => toggleBump()}
          aria-pressed={workout.viewerLiked}
          aria-label="Fist bump"
        >
          <span className="feed-bump-icon">
            <IconFist size={22} />
            {burst > 0 && <span key={burst} className="feed-burst" aria-hidden="true" />}
          </span>
          <span className="num">{workout.likeCount > 0 ? workout.likeCount : 'Bump'}</span>
        </button>
        <button className="feed-comment" onClick={() => navigate(`/s/${workout.id}`)} aria-label="Comments">
          <IconComment size={21} />
          <span className="num">{workout.commentCount > 0 ? workout.commentCount : 'Comment'}</span>
        </button>
        {workout.prCount > 0 && (
          <span className="feed-prchip num">
            {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </article>
  )
}
