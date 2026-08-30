// Notifications inbox: reverse-chron, unread rows get a plate-red rule,
// copy per type, "Mark all read". docs/SPEC.md §10.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NotificationOut } from '../../shared/types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRelativeTime, weightNumber, formatSeconds } from '../lib/format'
import Avatar from '../components/Avatar'

export default function NotificationsPage() {
  const { user } = useAuth()
  const unit = user!.unitPreference
  const [items, setItems] = useState<NotificationOut[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api
      .notifications()
      .then((r) => {
        setItems(r.items)
        setCursor(r.nextCursor)
        setUnread(r.unreadCount)
      })
      .finally(() => setLoaded(true))
  }, [])

  const markAll = () => {
    api.markAllRead().then(() => {
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? Date.now() })))
    })
  }

  const loadMore = () => {
    if (!cursor) return
    api.notifications(cursor).then((r) => {
      setItems((prev) => [...prev, ...r.items])
      setCursor(r.nextCursor)
    })
  }

  const body = (n: NotificationOut) => {
    const name = <strong>{n.actor.username}</strong>
    switch (n.type) {
      case 'like':
        return (
          <>
            {name} bumped <em>{n.workout?.title || 'your session'}</em>
          </>
        )
      case 'comment':
        return (
          <>
            {name} commented: “{n.comment?.body.slice(0, 80)}
            {(n.comment?.body.length ?? 0) > 80 ? '…' : ''}”
          </>
        )
      case 'follow':
        return <>{name} followed you</>
      case 'pr': {
        const first = n.prSummary?.[0]
        const value = first
          ? first.recordType === 'max_reps'
            ? `${first.value} reps`
            : first.recordType === 'max_duration'
              ? formatSeconds(first.value)
              : first.recordType === 'max_distance'
                ? `${Math.round(first.value)} m`
                : `${weightNumber(first.value, unit)} ${unit}`
          : ''
        const extra = (n.prSummary?.length ?? 0) - 1
        return (
          <>
            🔔 {name} hit a PR{first ? `: ${first.exerciseName} ${value}` : ''}
            {extra > 0 ? ` (+${extra} more)` : ''}
          </>
        )
      }
    }
  }

  const target = (n: NotificationOut) => (n.workout ? `/s/${n.workout.id}` : `/@${n.actor.username}`)

  return (
    <div className="page ntf-page">
      <div className="ntf-head">
        <h1 className="page-title">Notifications</h1>
        {unread > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAll}>
            Mark all read
          </button>
        )}
      </div>

      {loaded && items.length === 0 && (
        <div className="empty-state">
          <p>Nothing yet — post a session and the bumps will come.</p>
        </div>
      )}

      <ul className="ntf-list">
        {items.map((n) => (
          <li key={n.id}>
            <Link to={target(n)} className={`ntf-row${n.readAt === null ? ' ntf-unread' : ''}`}>
              <Avatar username={n.actor.username} displayName={n.actor.displayName} size={38} />
              <span className="ntf-body">
                <span>{body(n)}</span>
                <span className="ntf-time">{formatRelativeTime(n.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <button className="btn btn-ghost" onClick={loadMore}>
          Load more
        </button>
      )}
    </div>
  )
}
