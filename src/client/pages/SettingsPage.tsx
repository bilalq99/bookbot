import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Unit } from '../../shared/types'
import { useAuth } from '../lib/auth'
import { api, ApiError } from '../lib/api'

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const me = user!
  const [displayName, setDisplayName] = useState(me.displayName)
  const [bio, setBio] = useState(me.bio)
  const [unit, setUnit] = useState<Unit>(me.unitPreference)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account and every session, PR, and photo? This cannot be undone.')) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await api.deleteAccount(deletePassword)
      setUser(null)
      navigate('/register', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the account — try again')
    } finally {
      setDeleteBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const r = await api.patchMe({ displayName: displayName.trim(), bio: bio.trim(), unitPreference: unit })
      setUser(r.user)
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Could not save')
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <form className="card auth-settings" onSubmit={submit}>
        <label className="field">
          <span className="label">Display name</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            required
          />
        </label>
        <label className="field">
          <span className="label">Bio</span>
          <textarea
            className="input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="What do you train?"
          />
        </label>
        <div className="field">
          <span className="label">Units</span>
          <div className="auth-units">
            <button
              type="button"
              className={`chip ${unit === 'kg' ? 'chip-active' : ''}`}
              onClick={() => setUnit('kg')}
            >
              kg
            </button>
            <button
              type="button"
              className={`chip ${unit === 'lb' ? 'chip-active' : ''}`}
              onClick={() => setUnit('lb')}
            >
              lb
            </button>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn btn-primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
      </form>
      <button
        className="btn btn-ghost auth-logout"
        onClick={() => {
          void logout().then(() => navigate('/login', { replace: true }))
        }}
      >
        Log out
      </button>

      <p className="auth-legal auth-legal-settings">
        <Link to="/privacy">Privacy policy</Link> · <Link to="/support">Support</Link>
      </p>

      <div className="card auth-settings auth-danger">
        <h2 className="auth-danger-title">Danger zone</h2>
        {deleting ? (
          <>
            <p className="muted auth-danger-copy">
              Deleting your account permanently removes your sessions, records, photos, comments, and follows.
            </p>
            <label className="field">
              <span className="label">Confirm password</span>
              <input
                className="input"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {deleteError && <p className="auth-error">{deleteError}</p>}
            <div className="auth-danger-actions">
              <button
                className="btn btn-danger"
                onClick={() => void deleteAccount()}
                disabled={deleteBusy || deletePassword.length === 0}
              >
                {deleteBusy ? 'Deleting…' : 'Delete my account'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleting(false)} disabled={deleteBusy}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn-danger" onClick={() => setDeleting(true)}>
            Delete account…
          </button>
        )}
      </div>
    </div>
  )
}
