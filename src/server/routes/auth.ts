// Auth routes (mounted at /api/auth): POST /register, POST /login (public),
// POST /logout, GET /me. See docs/SPEC.md §7-8.
import { Router } from 'express'
import type { CookieOptions } from 'express'
import type { AppDb } from '../db/client'
import type { Unit, UserSelf } from '../../shared/types'
import { loginSchema, registerSchema } from '../../shared/validation'
import { ApiError, asyncHandler, validate } from '../lib/http'
import { config } from '../config'
import { hashPassword, verifyPassword } from '../auth/password'
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, destroySession } from '../auth/session'
import { extractToken, requireAuth } from '../auth/middleware'

// SPEC §8: sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000.
// Secure is added when COOKIE_SECURE=1 (HTTPS deployments).
const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
  secure: config.secureCookies,
}

// Brute-force limiter for the two public endpoints: fixed one-minute windows,
// in-memory (per process; resets on restart — acceptable for this scale).
const RATE_WINDOW_MS = 60_000
const RATE_MAX_ATTEMPTS = 10

// Verified against when the username does not exist, so login latency does not
// reveal which usernames are taken.
const DUMMY_HASH = hashPassword('chalk-timing-equalizer')

interface UserAuthRow {
  id: number
  username: string
  password_hash: string
  display_name: string
  bio: string
  unit_preference: Unit
  follower_count: number
  following_count: number
  workout_count: number
  created_at: number
}

function toUserSelf(row: UserAuthRow): UserSelf {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    unitPreference: row.unit_preference,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    workoutCount: row.workout_count,
    createdAt: row.created_at,
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    ((err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (err as { code: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
  )
}

export default function authRoutes(db: AppDb): Router {
  const router = Router()

  const attempts = new Map<string, { n: number; resetAt: number }>()
  function checkRate(key: string): void {
    const now = Date.now()
    if (attempts.size > 10_000) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k)
    }
    const cur = attempts.get(key)
    if (!cur || cur.resetAt <= now) {
      attempts.set(key, { n: 1, resetAt: now + RATE_WINDOW_MS })
      return
    }
    cur.n += 1
    if (cur.n > RATE_MAX_ATTEMPTS) {
      throw new ApiError(429, 'rate_limited', 'Too many attempts — try again in a minute')
    }
  }

  const selectAuthByUsername = db.prepare('SELECT * FROM users WHERE username = ?')
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, unit_preference, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  router.post(
    '/register',
    asyncHandler((req, res) => {
      checkRate(`reg:${req.ip}`)
      const body = validate(registerSchema, req.body)
      const displayName = body.displayName ?? body.username
      const unitPreference = body.unitPreference ?? 'kg'
      const now = Date.now()
      let userId: number
      try {
        const info = insertUser.run(body.username, hashPassword(body.password), displayName, unitPreference, now)
        userId = Number(info.lastInsertRowid)
      } catch (err) {
        if (isUniqueViolation(err)) throw new ApiError(409, 'conflict', 'Username is already taken')
        throw err
      }
      const { token } = createSession(db, userId)
      res.cookie(SESSION_COOKIE, token, COOKIE_OPTS)
      const user: UserSelf = {
        id: userId,
        username: body.username,
        displayName,
        bio: '',
        unitPreference,
        followerCount: 0,
        followingCount: 0,
        workoutCount: 0,
        createdAt: now,
      }
      // The token is returned for the native app shell (bearer auth);
      // the browser SPA relies on the httpOnly cookie and ignores it.
      res.status(201).json({ user, token })
    }),
  )

  router.post(
    '/login',
    asyncHandler((req, res) => {
      const body = validate(loginSchema, req.body)
      checkRate(`login:${req.ip}:${body.username}`)
      const row = selectAuthByUsername.get(body.username) as UserAuthRow | undefined
      const ok = verifyPassword(body.password, row ? row.password_hash : DUMMY_HASH)
      if (!row || !ok) throw new ApiError(401, 'invalid_credentials', 'Invalid username or password')
      const { token } = createSession(db, row.id)
      res.cookie(SESSION_COOKIE, token, COOKIE_OPTS)
      res.json({ user: toUserSelf(row), token })
    }),
  )

  router.post(
    '/logout',
    requireAuth(db),
    asyncHandler((req, res) => {
      const token = extractToken(req)
      if (token) destroySession(db, token)
      res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
      res.status(204).end()
    }),
  )

  router.get(
    '/me',
    requireAuth(db),
    asyncHandler((req, res) => {
      // SessionUser is structurally a UserSelf.
      res.json({ user: req.user })
    }),
  )

  return router
}
