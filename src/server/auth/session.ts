// Session tokens — docs/SPEC.md §8. The raw token lives only in the cookie;
// the database stores sha256(token) hex, so a leaked DB cannot mint sessions.
import crypto from 'node:crypto'
import type { AppDb } from '../db/client'

export const SESSION_COOKIE = 'sid'
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000

/** sha256 hex of a raw cookie token — the only form ever stored or looked up. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Create a session row; returns the raw cookie token. */
export function createSession(db: AppDb, userId: number): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  db.prepare(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), userId, now, expiresAt)
  return { token, expiresAt }
}

/** Delete the session row for a raw cookie token (logout). No-op when absent. */
export function destroySession(db: AppDb, token: string): void {
  db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token))
}

/** Delete all expired session rows (called hourly from index.ts). */
export function sweepExpiredSessions(db: AppDb): void {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now())
}
