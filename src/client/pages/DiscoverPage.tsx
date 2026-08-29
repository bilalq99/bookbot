// Discover: debounced user search plus suggested lifters with follow buttons.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { UserSearchItem } from '../../shared/types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import Avatar from '../components/Avatar'
import { IconSearch } from '../components/Icons'

function UserRow({ u, self }: { u: UserSearchItem; self: boolean }) {
  const [following, setFollowing] = useState(u.viewerFollows)
  const toggle = () => {
    setFollowing(!following)
    const call = following ? api.unfollow(u.username) : api.follow(u.username)
    call.catch(() => setFollowing(following))
  }
  return (
    <li className="dis-row">
      <Link to={`/@${u.username}`} className="feed-author">
        <Avatar username={u.username} displayName={u.displayName} size={44} />
        <span className="feed-author-names">
          <span className="feed-author-name">{u.displayName}</span>
          <span className="feed-author-user">
            @{u.username}
            {u.workoutCount > 0 && ` · ${u.workoutCount} sessions`}
          </span>
        </span>
      </Link>
      {!self && (
        <button className={`btn btn-sm ${following ? '' : 'btn-primary'}`} onClick={toggle}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </li>
  )
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const me = user!
  const [q, setQ] = useState('')
  const [results, setResults] = useState<UserSearchItem[] | null>(null)
  const [suggested, setSuggested] = useState<UserSearchItem[]>([])

  useEffect(() => {
    api
      .suggestedUsers()
      .then((r) => setSuggested(r.users))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (q.trim() === '') {
      setResults(null)
      return
    }
    const t = setTimeout(() => {
      api
        .searchUsers(q.trim())
        .then((r) => setResults(r.users))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="page dis-page">
      <h1 className="page-title">Discover</h1>
      <div className="dis-search">
        <IconSearch size={18} className="dis-search-icon" />
        <input
          className="input dis-search-input"
          placeholder="Search lifters…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {results !== null ? (
        results.length === 0 ? (
          <p className="muted dis-empty">No lifters match “{q.trim()}”.</p>
        ) : (
          <ul className="dis-list">
            {results.map((u) => (
              <UserRow key={u.id} u={u} self={u.username === me.username} />
            ))}
          </ul>
        )
      ) : (
        suggested.length > 0 && (
          <>
            <h2 className="dis-section">Suggested lifters</h2>
            <ul className="dis-list">
              {suggested.map((u) => (
                <UserRow key={u.id} u={u} self={false} />
              ))}
            </ul>
          </>
        )
      )}
    </div>
  )
}
