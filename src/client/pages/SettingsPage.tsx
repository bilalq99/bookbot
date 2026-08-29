import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
    </div>
  )
}
