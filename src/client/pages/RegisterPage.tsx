import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { Unit } from '../../shared/types'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export default function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register({
        username,
        password,
        displayName: displayName.trim() || undefined,
        unitPreference: unit,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">CHALK</div>
        <p className="auth-tagline">Every session tells a story.</p>
        <label className="field">
          <span className="label">Username</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="a-z, 0-9, _"
            minLength={3}
            maxLength={20}
            required
          />
        </label>
        <label className="field">
          <span className="label">Display name</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Optional"
          />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <div className="field">
          <span className="label">Units</span>
          <div className="auth-units" role="radiogroup" aria-label="Units">
            <button
              type="button"
              className={`chip ${unit === 'kg' ? 'chip-active' : ''}`}
              onClick={() => setUnit('kg')}
              aria-pressed={unit === 'kg'}
            >
              kg
            </button>
            <button
              type="button"
              className={`chip ${unit === 'lb' ? 'chip-active' : ''}`}
              onClick={() => setUnit('lb')}
              aria-pressed={unit === 'lb'}
            >
              lb
            </button>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Chalking up…' : 'Create account'}
        </button>
        <p className="auth-alt">
          Already lifting here? <Link to="/login">Log in</Link>
        </p>
        <p className="auth-legal">
          <Link to="/privacy">Privacy</Link> · <Link to="/support">Support</Link>
        </p>
      </form>
    </div>
  )
}
