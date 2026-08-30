// App chrome: mobile top bar + bottom tab bar (<900px), left icon rail (>=900px).
// The Log tab is a raised plate-red FAB. Bell badge polls the notifications
// unread count every 60s while the shell is mounted.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import Avatar from './Avatar'
import { IconBell, IconHome, IconPlus, IconSearch, IconTrophy } from './Icons'

export default function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let live = true
    const poll = () => {
      api
        .notifications()
        .then((r) => {
          if (live) setUnread(r.unreadCount)
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, 60_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [location.pathname])

  const me = user!
  const tab = ({ isActive }: { isActive: boolean }) => `shell-tab${isActive ? ' shell-tab-active' : ''}`

  const bell = (
    <NavLink to="/notifications" className="shell-bell" aria-label="Notifications">
      <IconBell size={24} />
      {unread > 0 && <span className="shell-badge num">{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
  )

  return (
    <div className="shell">
      <header className="shell-topbar">
        <NavLink to="/" className="shell-wordmark">
          CHALK
        </NavLink>
        {bell}
      </header>

      <aside className="shell-rail">
        <NavLink to="/" className="shell-wordmark shell-rail-logo">
          C
        </NavLink>
        <nav className="shell-rail-nav">
          <NavLink to="/" className={tab} aria-label="Feed" end>
            <IconHome size={26} />
          </NavLink>
          <NavLink to="/discover" className={tab} aria-label="Discover">
            <IconSearch size={26} />
          </NavLink>
          <NavLink to="/log" className="shell-fab shell-fab-rail" aria-label="Log a session">
            <IconPlus size={26} />
          </NavLink>
          <NavLink to="/records" className={tab} aria-label="Records">
            <IconTrophy size={26} />
          </NavLink>
          <NavLink to="/notifications" className={tab} aria-label="Notifications">
            <span className="shell-bell-rail">
              <IconBell size={26} />
              {unread > 0 && <span className="shell-badge num">{unread > 99 ? '99+' : unread}</span>}
            </span>
          </NavLink>
        </nav>
        <NavLink to={`/@${me.username}`} className="shell-rail-me" aria-label="Your profile">
          <Avatar username={me.username} displayName={me.displayName} size={34} />
        </NavLink>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>

      <nav className="shell-tabbar">
        <NavLink to="/" className={tab} aria-label="Feed" end>
          <IconHome size={26} />
        </NavLink>
        <NavLink to="/discover" className={tab} aria-label="Discover">
          <IconSearch size={26} />
        </NavLink>
        <NavLink to="/log" className="shell-fab" aria-label="Log a session">
          <IconPlus size={26} />
        </NavLink>
        <NavLink to="/records" className={tab} aria-label="Records">
          <IconTrophy size={26} />
        </NavLink>
        <NavLink to={`/@${me.username}`} className={tab} aria-label="Your profile">
          <Avatar username={me.username} displayName={me.displayName} size={28} />
        </NavLink>
      </nav>
    </div>
  )
}
