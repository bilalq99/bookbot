// requireAuth — cookie -> sha256 -> auth_sessions JOIN users -> req.user, else
// JSON 401 { error: { code: 'unauthorized', ... } }. Expired rows are deleted
// on sight (the hourly sweep only catches sessions nobody presents). SPEC §8.
import type { RequestHandler, Response } from 'express'
import type { AppDb } from '../db/client'
import type { Unit } from '../../shared/types'
import { SESSION_COOKIE, hashToken } from './session'

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

interface SessionRow extends SessionUser {
  expiresAt: number
}

function unauthorized(res: Response): void {
  res.status(401).json({ error: { code: 'unauthorized', message: 'Authentication required' } })
}

export function requireAuth(db: AppDb): RequestHandler {
  const selectSession = db.prepare(`
    SELECT s.expires_at        AS expiresAt,
           u.id                AS id,
           u.username          AS username,
           u.display_name      AS displayName,
           u.bio               AS bio,
           u.unit_preference   AS unitPreference,
           u.follower_count    AS followerCount,
           u.following_count   AS followingCount,
           u.workout_count     AS workoutCount,
           u.created_at        AS createdAt
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `)
  const deleteSession = db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')

  return (req, res, next) => {
    const cookies = req.cookies as Record<string, string> | undefined
    const token = cookies?.[SESSION_COOKIE]
    if (!token) return unauthorized(res)
    const tokenHash = hashToken(token)
    const row = selectSession.get(tokenHash) as SessionRow | undefined
    if (!row) return unauthorized(res)
    if (row.expiresAt <= Date.now()) {
      deleteSession.run(tokenHash)
      return unauthorized(res)
    }
    const { expiresAt: _expiresAt, ...user } = row
    req.user = user
    next()
  }
}
