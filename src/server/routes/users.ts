// User routes (mounted at /api/users) — docs/SPEC.md §7:
//   GET /search  GET /suggested  PATCH /me
//   GET /:username  GET /:username/workouts  GET /:username/stats  GET /:username/prs
//   GET /:username/followers  GET /:username/following
//   POST /:username/follow  DELETE /:username/follow
// Literal routes are registered BEFORE /:username so "search" is never a username.
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AppDb } from '../db/client'
import type {
  Discipline,
  Exercise,
  MetricType,
  MuscleGroup,
  Equipment,
  PlLift,
  ProfileStats,
  RecordType,
  Unit,
  UserPublic,
  UserSearchItem,
  UserSelf,
  WeeklyVolume,
} from '../../shared/types'
import { computeStreakWeeks, isoWeekStartUtc } from '../../shared/formulas'
import { patchMeSchema } from '../../shared/validation'
import { ApiError, asyncHandler, escapeLike, makeCursor, notFound, parseCursor, parseLimit, validate } from '../lib/http'
import { requireAuth } from '../auth/middleware'
import { verifyPassword } from '../auth/password'
import { config } from '../config'
import { getWorkoutCards } from '../services/cards'
import { notifyFollow } from '../services/notify'

const WEEK_MS = 7 * 24 * 3600 * 1000

interface UserRow {
  id: number
  username: string
  display_name: string
  bio: string
  unit_preference: Unit
  follower_count: number
  following_count: number
  workout_count: number
  created_at: number
}

function toUserPublic(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    workoutCount: row.workout_count,
  }
}

function toUserSelf(row: UserRow): UserSelf {
  return { ...toUserPublic(row), unitPreference: row.unit_preference, createdAt: row.created_at }
}

interface ExerciseRow {
  ex_id: number
  slug: string | null
  name: string
  metric_type: MetricType
  muscle_group: MuscleGroup
  equipment: Equipment
  pl_lift: PlLift | null
  tags: string
  created_by: number | null
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.ex_id,
    slug: row.slug,
    name: row.name,
    metricType: row.metric_type,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    plLift: row.pl_lift,
    tags: JSON.parse(row.tags) as Discipline[],
    isCustom: row.created_by !== null,
  }
}

export default function usersRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  // ---------------------------------------------------------------- statements

  const selectUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?')
  const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?')

  const searchStmt = db.prepare(`
    SELECT u.*,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = u.id) AS viewer_follows
    FROM users u
    WHERE u.username LIKE @prefix ESCAPE '\\'
       OR u.display_name LIKE @sub ESCAPE '\\'
    ORDER BY CASE WHEN u.username LIKE @prefix ESCAPE '\\' THEN 0 ELSE 1 END, u.username ASC
    LIMIT @limit
  `)

  const suggestedStmt = db.prepare(`
    SELECT u.*, MAX(w.published_at) AS last_pub
    FROM users u
    JOIN workouts w ON w.user_id = u.id AND w.status = 'published'
    WHERE u.id <> @viewer
      AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = u.id)
    GROUP BY u.id
    ORDER BY last_pub DESC, u.id DESC
    LIMIT @limit
  `)

  const followExists = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')

  const timelineStmt = db.prepare(`
    SELECT id, published_at
    FROM workouts
    WHERE user_id = @user AND status = 'published'
      AND (@ts IS NULL OR published_at < @ts OR (published_at = @ts AND id < @id))
    ORDER BY published_at DESC, id DESC
    LIMIT @limit
  `)

  const totalsStmt = db.prepare(`
    SELECT COUNT(*) AS workout_count,
           COALESCE(SUM(total_volume_kg), 0) AS total_volume_kg,
           COALESCE(SUM(total_sets), 0) AS total_sets
    FROM workouts
    WHERE user_id = ? AND status = 'published'
  `)
  const prCountStmt = db.prepare('SELECT COUNT(*) AS n FROM personal_records WHERE user_id = ?')
  const publishedAtStmt = db.prepare(
    "SELECT published_at FROM workouts WHERE user_id = ? AND status = 'published'",
  )
  const weeklyStmt = db.prepare(`
    SELECT published_at, total_volume_kg
    FROM workouts
    WHERE user_id = ? AND status = 'published' AND published_at >= ?
  `)

  const prsStmt = db.prepare(`
    SELECT pr.record_type, pr.value, pr.achieved_at, pr.workout_id,
           e.id AS ex_id, e.slug, e.name, e.metric_type, e.muscle_group, e.equipment,
           e.pl_lift, e.tags, e.created_by
    FROM personal_records pr
    JOIN exercises e ON e.id = pr.exercise_id
    WHERE pr.user_id = ?
    ORDER BY pr.achieved_at DESC, pr.id DESC
  `)

  const followersStmt = db.prepare(`
    SELECT u.*, f.created_at AS f_created_at,
           EXISTS (SELECT 1 FROM follows vf WHERE vf.follower_id = @viewer AND vf.followee_id = u.id) AS viewer_follows
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.followee_id = @target
      AND (@ts IS NULL OR f.created_at < @ts OR (f.created_at = @ts AND u.id < @id))
    ORDER BY f.created_at DESC, u.id DESC
    LIMIT @limit
  `)

  const followingStmt = db.prepare(`
    SELECT u.*, f.created_at AS f_created_at,
           EXISTS (SELECT 1 FROM follows vf WHERE vf.follower_id = @viewer AND vf.followee_id = u.id) AS viewer_follows
    FROM follows f
    JOIN users u ON u.id = f.followee_id
    WHERE f.follower_id = @target
      AND (@ts IS NULL OR f.created_at < @ts OR (f.created_at = @ts AND u.id < @id))
    ORDER BY f.created_at DESC, u.id DESC
    LIMIT @limit
  `)

  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)',
  )
  const deleteFollow = db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?')
  const bumpFollowingCount = db.prepare('UPDATE users SET following_count = following_count + ? WHERE id = ?')
  const bumpFollowerCount = db.prepare('UPDATE users SET follower_count = follower_count + ? WHERE id = ?')

  const followTx = db.transaction((followerId: number, followeeId: number) => {
    const now = Date.now()
    const info = insertFollow.run(followerId, followeeId, now)
    if (info.changes > 0) {
      bumpFollowingCount.run(1, followerId)
      bumpFollowerCount.run(1, followeeId)
      notifyFollow(db, followerId, followeeId, now)
    }
  })

  const unfollowTx = db.transaction((followerId: number, followeeId: number) => {
    const info = deleteFollow.run(followerId, followeeId)
    if (info.changes > 0) {
      bumpFollowingCount.run(-1, followerId)
      bumpFollowerCount.run(-1, followeeId)
      // SPEC §9: unfollow does NOT delete the follow notification.
    }
  })

  // ---------------------------------------------------------------- helpers

  function getUserOr404(usernameParam: string | undefined): UserRow {
    const row = selectUserByUsername.get((usernameParam ?? '').trim().toLowerCase()) as UserRow | undefined
    if (!row) throw notFound()
    return row
  }

  interface SearchRowShape extends UserRow {
    viewer_follows: number
  }

  function toSearchItem(row: SearchRowShape): UserSearchItem {
    return { ...toUserPublic(row), viewerFollows: row.viewer_follows === 1 }
  }

  // ---------------------------------------------------------------- literal routes

  router.get(
    '/search',
    asyncHandler((req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
      const limit = parseLimit(req.query.limit, 20, 50)
      if (q === '') return void res.json({ users: [] })
      const esc = escapeLike(q.toLowerCase())
      const rows = searchStmt.all({
        viewer: req.user!.id,
        prefix: `${esc}%`,
        sub: `%${esc}%`,
        limit,
      }) as SearchRowShape[]
      res.json({ users: rows.map(toSearchItem) })
    }),
  )

  router.get(
    '/suggested',
    asyncHandler((req, res) => {
      const limit = parseLimit(req.query.limit, 8, 50)
      const rows = suggestedStmt.all({ viewer: req.user!.id, limit }) as UserRow[]
      const users: UserSearchItem[] = rows.map((r) => ({ ...toUserPublic(r), viewerFollows: false }))
      res.json({ users })
    }),
  )

  router.patch(
    '/me',
    asyncHandler((req, res) => {
      const body = validate(patchMeSchema, req.body)
      const sets: string[] = []
      const args: (string | number)[] = []
      if (body.displayName !== undefined) {
        sets.push('display_name = ?')
        args.push(body.displayName)
      }
      if (body.bio !== undefined) {
        sets.push('bio = ?')
        args.push(body.bio)
      }
      if (body.unitPreference !== undefined) {
        sets.push('unit_preference = ?')
        args.push(body.unitPreference)
      }
      if (sets.length > 0) {
        db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args, req.user!.id)
      }
      const row = selectUserById.get(req.user!.id) as UserRow
      res.json({ user: toUserSelf(row) })
    }),
  )

  // Account deletion (App Store guideline 5.1.1(v)). Password-confirmed; removes
  // the user row (FKs cascade sessions/workouts/sets/follows/likes/comments/
  // notifications/media rows/PRs/custom exercises), fixes the denormalized
  // counters that cascades cannot maintain, and unlinks uploaded files.
  router.delete(
    '/me',
    asyncHandler((req, res) => {
      const userId = req.user!.id
      const password = typeof (req.body as { password?: unknown })?.password === 'string'
        ? (req.body as { password: string }).password
        : ''
      const row = db
        .prepare<unknown[], { password_hash: string }>('SELECT password_hash FROM users WHERE id = ?')
        .get(userId)
      if (!row || !verifyPassword(password, row.password_hash)) {
        throw new ApiError(401, 'invalid_credentials', 'Password is incorrect')
      }
      const filePaths = (
        db.prepare<unknown[], { file_path: string }>('SELECT file_path FROM media WHERE user_id = ?').all(userId)
      ).map((m) => m.file_path)
      db.transaction(() => {
        // Fix counters on OTHER rows before the cascades remove the join rows.
        db.prepare(
          `UPDATE users SET follower_count = follower_count - 1
           WHERE id IN (SELECT followee_id FROM follows WHERE follower_id = ?)`,
        ).run(userId)
        db.prepare(
          `UPDATE users SET following_count = following_count - 1
           WHERE id IN (SELECT follower_id FROM follows WHERE followee_id = ?)`,
        ).run(userId)
        db.prepare(
          `UPDATE workouts SET like_count = like_count - 1
           WHERE id IN (SELECT workout_id FROM likes WHERE user_id = ?)`,
        ).run(userId)
        db.prepare(
          `UPDATE workouts SET comment_count = comment_count - (
             SELECT COUNT(*) FROM comments c WHERE c.user_id = ? AND c.workout_id = workouts.id
           )
           WHERE id IN (SELECT DISTINCT workout_id FROM comments WHERE user_id = ?)`,
        ).run(userId, userId)
        db.prepare('DELETE FROM users WHERE id = ?').run(userId)
      })()
      for (const filePath of filePaths) {
        try {
          fs.unlinkSync(path.join(config.uploadsDir, filePath))
        } catch {
          /* best-effort */
        }
      }
      res.clearCookie('sid', { httpOnly: true, sameSite: 'lax', path: '/' })
      res.status(204).end()
    }),
  )

  // ---------------------------------------------------------------- profile routes

  router.get(
    '/:username',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      const viewerId = req.user!.id
      res.json({
        user: toUserPublic(target),
        viewerFollows: followExists.get(viewerId, target.id) !== undefined,
        followsViewer: followExists.get(target.id, viewerId) !== undefined,
        isSelf: target.id === viewerId,
      })
    }),
  )

  router.get(
    '/:username/workouts',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      const cursor = parseCursor(req.query.cursor)
      const limit = parseLimit(req.query.limit, 20, 50)
      const rows = timelineStmt.all({
        user: target.id,
        ts: cursor?.ts ?? null,
        id: cursor?.id ?? null,
        limit: limit + 1,
      }) as { id: number; published_at: number }[]
      const page = rows.slice(0, limit)
      const items = getWorkoutCards(
        db,
        page.map((r) => r.id),
        req.user!.id,
      )
      const nextCursor =
        rows.length > limit && page.length > 0
          ? makeCursor(page[page.length - 1].published_at, page[page.length - 1].id)
          : null
      res.json({ items, nextCursor })
    }),
  )

  router.get(
    '/:username/stats',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      const totals = totalsStmt.get(target.id) as {
        workout_count: number
        total_volume_kg: number
        total_sets: number
      }
      const prCount = (prCountStmt.get(target.id) as { n: number }).n
      const now = Date.now()
      const publishedAts = (publishedAtStmt.all(target.id) as { published_at: number }[]).map(
        (r) => r.published_at,
      )
      const currentWeek = isoWeekStartUtc(now)
      const windowStart = currentWeek - 11 * WEEK_MS
      const buckets = new Map<number, { volumeKg: number; workouts: number }>()
      const recent = weeklyStmt.all(target.id, windowStart) as {
        published_at: number
        total_volume_kg: number
      }[]
      for (const w of recent) {
        const weekStart = isoWeekStartUtc(w.published_at)
        const b = buckets.get(weekStart) ?? { volumeKg: 0, workouts: 0 }
        b.volumeKg += w.total_volume_kg
        b.workouts += 1
        buckets.set(weekStart, b)
      }
      const weeklyVolume: WeeklyVolume[] = Array.from({ length: 12 }, (_, i) => {
        const weekStart = windowStart + i * WEEK_MS
        const b = buckets.get(weekStart)
        return { weekStart, volumeKg: b?.volumeKg ?? 0, workouts: b?.workouts ?? 0 }
      })
      const stats: ProfileStats = {
        workoutCount: totals.workout_count,
        totalVolumeKg: totals.total_volume_kg,
        totalSets: totals.total_sets,
        prCount,
        currentStreakWeeks: computeStreakWeeks(publishedAts, now),
        weeklyVolume,
      }
      res.json(stats)
    }),
  )

  router.get(
    '/:username/prs',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      const rows = prsStmt.all(target.id) as (ExerciseRow & {
        record_type: RecordType
        value: number
        achieved_at: number
        workout_id: number | null
      })[]
      const prs = rows.map((r) => ({
        exercise: toExercise(r),
        recordType: r.record_type,
        value: r.value,
        achievedAt: r.achieved_at,
        workoutId: r.workout_id,
      }))
      res.json({ prs })
    }),
  )

  const followListHandler = (stmt: typeof followersStmt) =>
    asyncHandler((req: Request, res: Response) => {
      const target = getUserOr404(req.params.username)
      const cursor = parseCursor(req.query.cursor)
      const limit = parseLimit(req.query.limit, 30, 100)
      const rows = stmt.all({
        viewer: req.user!.id,
        target: target.id,
        ts: cursor?.ts ?? null,
        id: cursor?.id ?? null,
        limit: limit + 1,
      }) as (SearchRowShape & { f_created_at: number })[]
      const page = rows.slice(0, limit)
      const nextCursor =
        rows.length > limit && page.length > 0
          ? makeCursor(page[page.length - 1].f_created_at, page[page.length - 1].id)
          : null
      res.json({ users: page.map(toSearchItem), nextCursor })
    })

  router.get('/:username/followers', followListHandler(followersStmt))
  router.get('/:username/following', followListHandler(followingStmt))

  // ---------------------------------------------------------------- follow / unfollow

  router.post(
    '/:username/follow',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      if (target.id === req.user!.id) {
        throw new ApiError(400, 'validation_error', 'You cannot follow yourself')
      }
      followTx(req.user!.id, target.id)
      res.status(204).end()
    }),
  )

  router.delete(
    '/:username/follow',
    asyncHandler((req, res) => {
      const target = getUserOr404(req.params.username)
      if (target.id === req.user!.id) {
        throw new ApiError(400, 'validation_error', 'You cannot unfollow yourself')
      }
      unfollowTx(req.user!.id, target.id)
      res.status(204).end()
    }),
  )

  return router
}
