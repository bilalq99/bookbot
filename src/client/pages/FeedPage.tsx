// The home feed: Following · Everyone scopes, infinite scroll on the keyset cursor.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FeedScope, WorkoutCard } from '../../shared/types'
import { api } from '../lib/api'
import FeedItem from '../components/FeedItem'

export default function FeedPage() {
  const [scope, setScope] = useState<FeedScope>('following')
  const [items, setItems] = useState<WorkoutCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const fetching = useRef(false)

  const loadFirst = useCallback((s: FeedScope) => {
    setLoading(true)
    setItems([])
    setDone(false)
    setCursor(null)
    api
      .feed(s)
      .then((r) => {
        setItems(r.items)
        setCursor(r.nextCursor)
        setDone(r.nextCursor === null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => loadFirst(scope), [scope, loadFirst])

  useEffect(() => {
    const el = sentinel.current
    if (!el || done) return
    const obs = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || fetching.current || !cursor) return
      fetching.current = true
      api
        .feed(scope, cursor)
        .then((r) => {
          setItems((prev) => [...prev, ...r.items])
          setCursor(r.nextCursor)
          setDone(r.nextCursor === null)
        })
        .finally(() => {
          fetching.current = false
        })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [cursor, scope, done])

  const update = (updated: WorkoutCard) => {
    setItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  return (
    <div className="feed-page">
      <div className="feed-scopes" role="tablist" aria-label="Feed scope">
        <button
          role="tab"
          aria-selected={scope === 'following'}
          className={`feed-scope${scope === 'following' ? ' feed-scope-active' : ''}`}
          onClick={() => setScope('following')}
        >
          Following
        </button>
        <button
          role="tab"
          aria-selected={scope === 'everyone'}
          className={`feed-scope${scope === 'everyone' ? ' feed-scope-active' : ''}`}
          onClick={() => setScope('everyone')}
        >
          Everyone
        </button>
      </div>

      {!loading && items.length === 0 && (
        <div className="empty-state">
          {scope === 'following' ? (
            <>
              <p>Your feed is quiet — the people you follow haven't posted yet.</p>
              <div className="feed-empty-actions">
                <button className="btn" onClick={() => setScope('everyone')}>
                  Browse everyone
                </button>
                <Link to="/discover" className="btn btn-primary">
                  Find lifters
                </Link>
              </div>
            </>
          ) : (
            <>
              <p>Nothing here yet. Be the first to chalk one up.</p>
              <Link to="/log" className="btn btn-primary">
                Log a session
              </Link>
            </>
          )}
        </div>
      )}

      {items.map((w) => (
        <FeedItem key={w.id} workout={w} onChange={update} />
      ))}
      {loading && <p className="feed-loading muted">Loading…</p>}
      <div ref={sentinel} />
    </div>
  )
}
