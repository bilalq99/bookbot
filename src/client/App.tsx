// FROZEN CONTRACT — do not edit. Route table + auth gate.
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import FeedPage from './pages/FeedPage'
import DiscoverPage from './pages/DiscoverPage'
import LogWorkoutPage from './pages/LogWorkoutPage'
import RecordsPage from './pages/RecordsPage'
import ProfilePage from './pages/ProfilePage'
import WorkoutDetailPage from './pages/WorkoutDetailPage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'

/** Profiles live at /@username; router segments can't mix a literal prefix with
 * a param, so match /:handle and require the @ ourselves. */
function ProfileRoute() {
  const { handle = '' } = useParams()
  if (!handle.startsWith('@')) return <Navigate to="/" replace />
  return <ProfilePage />
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="shell-splash">CHALK</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<FeedPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/log" element={<LogWorkoutPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/s/:id" element={<WorkoutDetailPage />} />
        <Route path="/:handle" element={<ProfileRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
