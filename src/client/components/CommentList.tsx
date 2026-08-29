// Comment thread: oldest first with cursor "load more", composer pinned below.
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { CommentOut } from '../../shared/types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRelativeTime } from '../lib/format'
import Avatar from './Avatar'
import { IconTrash } from './Icons'

export interface CommentListProps {
  workoutId: number
  workoutOwnerId: number
  onCountChange?: (delta: number) => void
}

export default function CommentList({ workoutId, workoutOwnerId, onCountChange }: CommentListProps) {
  const { user } = useAuth()
  const me = user!
  const [comments, setComments] = useState<CommentOut[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    api
      .comments(workoutId)
      .then((r) => {
        if (!live) return
        setComments(r.comments)
        setCursor(r.nextCursor)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      live = false
    }
  }, [workoutId])

  const loadMore = () => {
    if (!cursor) return
    api.comments(workoutId, cursor).then((r) => {
      setComments((c) => [...c, ...r.comments])
      setCursor(r.nextCursor)
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    api
      .addComment(workoutId, body)
      .then((r) => {
        setComments((c) => [...c, r.comment])
        setDraft('')
        onCountChange?.(1)
      })
      .finally(() => setBusy(false))
  }

  const remove = (comment: CommentOut) => {
    api.deleteComment(comment.id).then(() => {
      setComments((c) => c.filter((x) => x.id !== comment.id))
      onCountChange?.(-1)
    })
  }

  return (
    <section className="wk-comments">
      <h2 className="wk-section-title">Comments</h2>
      {loaded && comments.length === 0 && <p className="muted wk-comments-empty">Be the first to say something.</p>}
      <ul className="wk-comment-list">
        {comments.map((c) => (
          <li key={c.id} className="wk-comment">
            <Link to={`/@${c.author.username}`}>
              <Avatar username={c.author.username} displayName={c.author.displayName} size={32} />
            </Link>
            <div className="wk-comment-body">
              <p>
                <Link to={`/@${c.author.username}`} className="wk-comment-author">
                  {c.author.username}
                </Link>{' '}
                {c.body}
              </p>
              <span className="wk-comment-time">{formatRelativeTime(c.createdAt)}</span>
            </div>
            {(c.author.id === me.id || workoutOwnerId === me.id) && (
              <button className="wk-comment-del" onClick={() => remove(c)} aria-label="Delete comment">
                <IconTrash size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {cursor && (
        <button className="btn btn-ghost btn-sm" onClick={loadMore}>
          Load more
        </button>
      )}
      <form className="wk-composer" onSubmit={submit}>
        <Avatar username={me.username} displayName={me.displayName} size={32} />
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Leave a comment…"
          maxLength={500}
        />
        <button className="btn btn-primary btn-sm" disabled={!draft.trim() || busy}>
          Post
        </button>
      </form>
    </section>
  )
}
