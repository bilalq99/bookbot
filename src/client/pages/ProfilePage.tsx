// Profile (/@:username): header + stats, streak, 12-week volume bars, and an
// Instagram-style 3-column grid of session thumbnails (photo else compact card).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ProfileResponse, ProfileStats, UserSearchItem, WorkoutCard } from '../../shared/types'
import { api, ApiError, assetUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatVolume } from '../lib/format'
import Avatar from '../components/Avatar'
import SessionCard from '../components/SessionCard'
import { IconFlame, IconX } from '../components/Icons'

type ListKind = 'followers' | 'following'

export default function ProfilePage() {
  const { handle = '' } = useParams()
  const username = handle.startsWith('@') ? handle.slice(1) : handle
  const navigate = useNavigate()
  const { user } = useAuth()
  const me = user!
  const unit = me.unitPreference

  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [items, setItems] = useState<WorkoutCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [sheet, setSheet] = useState<ListKind | null>(null)
  const [sheetUsers, setSheetUsers] = useState<UserSearchItem[]>([])

  useEffect(() => {
    let live = true
    setProfile(null)
    setStats(null)
    setItems([])
    setMissing(false)
    api
      .profile(username)
      .then((r) => {
        if (!live) return
        setProfile(r)
        api.userStats(username).then((s) => live && setStats(s)).catch(() => {})
        api
          .userWorkouts(username)
          .then((w) => {
            if (!live) return
            setItems(w.items)
            setCursor(w.nextCursor)
          })
          .catch(() => {})
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true)
      })
    return () => {
      live = false
    }
  }, [username])

  useEffect(() => {
    if (!sheet) return
    const call = sheet === 'followers' ? api.followers(username) : api.following(username)
    call.then((r) => setSheetUsers(r.users)).catch(() => {})
  }, [sheet, username])

  if (missing) {
    return (
      <div className="empty-state">
        <p>No lifter named @{username}.</p>
        <Link to="/discover" className="btn">
          Find lifters
        </Link>
      </div>
    )
  }
  if (!profile) return <p className="feed-loading muted">Loading…</p>

  const u = profile.user

  const toggleFollow = () => {
    const following = profile.viewerFollows
    setProfile({
      ...profile,
      viewerFollows: !following,
      user: { ...u, followerCount: u.followerCount + (following ? -1 : 1) },
    })
    const call = following ? api.unfollow(u.username) : api.follow(u.username)
    call.catch(() =>
      setProfile((p) => p && { ...p, viewerFollows: following, user: { ...p.user, followerCount: u.followerCount } }),
    )
  }

  const loadMore = () => {
    if (!cursor) return
    api.userWorkouts(username, cursor).then((r) => {
      setItems((prev) => [...prev, ...r.items])
      setCursor(r.nextCursor)
    })
  }

  const maxWeek = stats ? Math.max(1, ...stats.weeklyVolume.map((w) => w.volumeKg)) : 1

  return (
    <div className="pf-page">
      <header className="pf-head">
        <Avatar username={u.username} displayName={u.displayName} size={84} />
        <div className="pf-head-info">
          <h1 className="pf-name">{u.displayName}</h1>
          <p className="pf-username">@{u.username}</p>
          {u.bio && <p className="pf-bio">{u.bio}</p>}
        </div>
      </header>

      <div className="pf-statsrow num">
        <span className="pf-stat">
          <strong>{u.workoutCount}</strong> Sessions
        </span>
        <button className="pf-stat" onClick={() => setSheet('followers')}>
          <strong>{u.followerCount}</strong> Followers
        </button>
        <button className="pf-stat" onClick={() => setSheet('following')}>
          <strong>{u.followingCount}</strong> Following
        </button>
      </div>

      <div className="pf-actions">
        {profile.isSelf ? (
          <button className="btn" onClick={() => navigate('/settings')}>
            Edit profile
          </button>
        ) : (
          <button className={`btn ${profile.viewerFollows ? '' : 'btn-primary'}`} onClick={toggleFollow}>
            {profile.viewerFollows ? 'Following' : profile.followsViewer ? 'Follow back' : 'Follow'}
          </button>
        )}
        {stats && stats.currentStreakWeeks > 0 && (
          <span className="pf-streak">
            <IconFlame size={16} />
            {stats.currentStreakWeeks}-week streak
          </span>
        )}
      </div>

      {stats && stats.weeklyVolume.some((w) => w.volumeKg > 0) && (
        <div className="pf-weeks card">
          <p className="label">Last 12 weeks · {formatVolume(stats.totalVolumeKg, unit)} lifetime</p>
          <div className="pf-bars">
            {stats.weeklyVolume.map((w) => (
              <span
                key={w.weekStart}
                className="pf-bar"
                style={{ height: `${Math.max(4, Math.round((w.volumeKg / maxWeek) * 100))}%` }}
                title={formatVolume(w.volumeKg, unit)}
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>{profile.isSelf ? 'Your grid is waiting for its first session.' : 'No sessions posted yet.'}</p>
          {profile.isSelf && (
            <Link to="/log" className="btn btn-primary">
              Chalk one up
            </Link>
          )}
        </div>
      ) : (
        <div className="pf-grid">
          {items.map((w) => (
            <Link key={w.id} to={`/s/${w.id}`} className="pf-cell">
              {w.media.length > 0 ? <img src={assetUrl(w.media[0].url)} alt="" loading="lazy" /> : <SessionCard workout={w} compact />}
            </Link>
          ))}
        </div>
      )}
      {cursor && (
        <button className="btn btn-ghost pf-more" onClick={loadMore}>
          Load more
        </button>
      )}

      {sheet && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="pf-sheet-head">
              <h2 className="sheet-title">{sheet === 'followers' ? 'Followers' : 'Following'}</h2>
              <button onClick={() => setSheet(null)} aria-label="Close">
                <IconX size={20} />
              </button>
            </div>
            {sheetUsers.length === 0 && <p className="muted">Nobody here yet.</p>}
            <ul className="pf-userlist">
              {sheetUsers.map((su) => (
                <li key={su.id} className="pf-userrow">
                  <Link to={`/@${su.username}`} className="feed-author" onClick={() => setSheet(null)}>
                    <Avatar username={su.username} displayName={su.displayName} size={36} />
                    <span className="feed-author-names">
                      <span className="feed-author-name">{su.displayName}</span>
                      <span className="feed-author-user">@{su.username}</span>
                    </span>
                  </Link>
                  {su.username !== me.username && (
                    <FollowMini username={su.username} initial={su.viewerFollows} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function FollowMini({ username, initial }: { username: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial)
  const toggle = () => {
    setFollowing(!following)
    const call = following ? api.unfollow(username) : api.follow(username)
    call.catch(() => setFollowing(following))
  }
  return (
    <button className={`btn btn-sm ${following ? '' : 'btn-primary'}`} onClick={toggle}>
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
