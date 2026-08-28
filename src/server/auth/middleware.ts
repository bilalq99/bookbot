// PLACEHOLDER — owned by agent S1 (server-auth-users). Replace the bodies;
// keep these exported signatures EXACTLY (every router compiles against them).
// requireAuth: cookie -> sha256 -> auth_sessions JOIN users -> req.user, else
// JSON 401 { error: { code: 'unauthorized', ... } }. See docs/SPEC.md §8.
import type { RequestHandler } from 'express'
import type { AppDb } from '../db/client'
import type { Unit } from '../../shared/types'

/** The authenticated user attached to req.user by requireAuth. */
export interface SessionUser {
  id: number
  username: string
  displayName: string
  bio: string
  unitPreference: Unit
  followerCount: number
  followingCount: number
  workoutCount: number
  createdAt: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export function requireAuth(_db: AppDb): RequestHandler {
  throw new Error('not implemented')
}
