// PLACEHOLDER — owned by agent S1 (server-auth-users). Replace the bodies;
// keep these exported signatures EXACTLY. Token = crypto.randomBytes(32) base64url;
// stored as sha256(token) hex in auth_sessions; 30-day expiry. See docs/SPEC.md §8.
import type { AppDb } from '../db/client'

export const SESSION_COOKIE = 'sid'
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000

/** Create a session row; returns the raw cookie token. */
export function createSession(_db: AppDb, _userId: number): { token: string; expiresAt: number } {
  throw new Error('not implemented')
}

/** Delete the session row for a raw cookie token (logout). No-op when absent. */
export function destroySession(_db: AppDb, _token: string): void {
  throw new Error('not implemented')
}

/** Delete all expired session rows (called hourly from index.ts). */
export function sweepExpiredSessions(_db: AppDb): void {
  throw new Error('not implemented')
}
