// npm run seed — deterministic demo world (docs/SPEC.md §13).
// 9 users (demo/demo1234 + 8 athletes across the five disciplines, password
// chalk1234), a follow graph, ~90 published sessions over 6 weeks generated
// THROUGH createWorkout/publishWorkout so totals, PRs, and notifications are
// derived by production code, plus likes and comments with correct counters.
// Refuses to run when users exist unless --force (which wipes DB + uploads).
import fs from 'node:fs'
import { config } from '../config'
import { openDb, type AppDb } from './client'
import { migrate } from './migrate'
import { hashPassword } from '../auth/password'
import { createWorkout, publishWorkout } from '../services/workouts'
import { notifyComment, notifyFollow, notifyLike } from '../services/notify'
import type { SetIn, WorkoutExerciseIn } from '../../shared/types'

// Fixed base timestamp (2026-08-28 17:00 UTC) so the world is reproducible.
const BASE = Date.UTC(2026, 7, 28, 17, 0, 0)
const DAY = 24 * 3600 * 1000
const WEEK = 7 * DAY

/** Deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(42)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const chance = (p: number): boolean => rng() < p
/** Round to the nearest 2.5 kg like a human loading a bar. */
const load = (kg: number): number => Math.round(kg / 2.5) * 2.5

interface SeedUser {
  username: string
  displayName: string
  bio: string
  unit: 'kg' | 'lb'
  password: string
  id?: number
}

const USERS: SeedUser[] = [
  { username: 'demo', displayName: 'Demo Lifter', bio: 'Just here to lift and scroll.', unit: 'kg', password: 'demo1234' },
  { username: 'sarah_squats', displayName: 'Sarah Kim', bio: 'Powerlifter. 83kg class. Squat is life.', unit: 'kg', password: 'chalk1234' },
  { username: 'deadlift_dana', displayName: 'Dana Ortiz', bio: 'Sumo apologist. Chasing a 200kg pull.', unit: 'kg', password: 'chalk1234' },
  { username: 'oly_ivan', displayName: 'Ivan Petrov', bio: 'Snatch • Clean & Jerk. Technique first.', unit: 'kg', password: 'chalk1234' },
  { username: 'pump_ana', displayName: 'Ana Silva', bio: 'Bodybuilding. PPL forever. Volume is king.', unit: 'kg', password: 'chalk1234' },
  { username: 'flex_marco', displayName: 'Marco Rossi', bio: 'Classic physique. Chasing the pump since 2019.', unit: 'kg', password: 'chalk1234' },
  { username: 'kettlebrick', displayName: 'Big Tom', bio: 'Strongman. Yoke, stones, and sandwiches.', unit: 'kg', password: 'chalk1234' },
  { username: 'barhop_leo', displayName: 'Leo Zhang', bio: 'Calisthenics. Weighted pull-ups + front lever.', unit: 'kg', password: 'chalk1234' },
  { username: 'grip_gaby', displayName: 'Gaby Torres', bio: 'General strength. Carries and kettlebells.', unit: 'lb', password: 'chalk1234' },
]

const COMMENTS = [
  'chalk up 🤜',
  'absolute unit',
  'bar was bending 😤',
  'light weight!',
  'form looking crisp',
  'PR machine',
  'strong.',
  "let's gooo",
  'that third rep though',
  'this is the way',
]

type Sets = SetIn[]
const wr = (weight: number, reps: number, opts: Partial<SetIn> = {}): SetIn => ({ weightKg: weight, reps, ...opts })
const warm = (weight: number, reps: number): SetIn => wr(weight, reps, { setType: 'warmup' })

function main(): void {
  const force = process.argv.includes('--force')
  const db: AppDb = openDb(config.dbPath)
  migrate(db)

  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  if (userCount > 0) {
    if (!force) {
      console.error('Refusing to seed: users already exist. Re-run with --force to wipe and rebuild.')
      process.exit(1)
    }
    db.close()
    fs.rmSync(config.dbPath, { force: true })
    fs.rmSync(`${config.dbPath}-wal`, { force: true })
    fs.rmSync(`${config.dbPath}-shm`, { force: true })
    fs.rmSync(config.uploadsDir, { recursive: true, force: true })
    return main()
  }

  const exerciseId = (slug: string): number => {
    const row = db.prepare('SELECT id FROM exercises WHERE slug = ?').get(slug) as { id: number } | undefined
    if (!row) throw new Error(`seed: missing exercise ${slug}`)
    return row.id
  }
  const ex = (slug: string, sets: Sets, notes?: string): WorkoutExerciseIn => ({
    exerciseId: exerciseId(slug),
    sets,
    notes,
  })

  // ---------------------------------------------------------------- users
  const athleteHash = hashPassword('chalk1234')
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, bio, unit_preference, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const u of USERS) {
    const hash = u.password === 'chalk1234' ? athleteHash : hashPassword(u.password)
    u.id = Number(insertUser.run(u.username, hash, u.displayName, u.bio, u.unit, BASE - 50 * DAY).lastInsertRowid)
  }
  const byName = new Map(USERS.map((u) => [u.username, u.id!]))

  // ---------------------------------------------------------------- follows
  const insertFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)')
  const bumpFollowing = db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?')
  const bumpFollowers = db.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?')
  const follow = (follower: string, followee: string, at: number): void => {
    const a = byName.get(follower)!
    const b = byName.get(followee)!
    if (a === b) return
    const info = insertFollow.run(a, b, at)
    if (info.changes > 0) {
      bumpFollowing.run(a)
      bumpFollowers.run(b)
      notifyFollow(db, a, b, at)
    }
  }

  const athletes = USERS.filter((u) => u.username !== 'demo')
  db.transaction(() => {
    for (const a of athletes) follow('demo', a.username, BASE - 44 * DAY)
    for (const a of athletes) {
      follow(a.username, 'demo', BASE - 43 * DAY)
      const others = athletes.filter((o) => o.username !== a.username)
      const n = 3 + Math.floor(rng() * 3)
      for (let i = 0; i < n; i++) follow(a.username, pick(others).username, BASE - 42 * DAY + i * 3600_000)
    }
  })()

  // ---------------------------------------------------------------- workouts
  // Per-athlete weekly programs with progressive overload. w = 0..5 (oldest first).
  const programs: Record<string, (w: number) => { title: string; exercises: WorkoutExerciseIn[]; duration: number }[]> = {
    sarah_squats: (w) => {
      const sq = load(100 + w * 2.5)
      const bp = load(62.5 + w * 1.25)
      const dl = load(150 + w * 5)
      return [
        {
          title: 'Squat Day',
          duration: 4400,
          exercises: [
            ex('back-squat', [warm(60, 5), warm(80, 3), wr(sq, 5, { rpe: 8 }), wr(sq, 5, { rpe: 8.5 }), wr(sq, 5, { rpe: 9 })]),
            ex('romanian-deadlift', [wr(90, 8), wr(90, 8), wr(90, 8)]),
            ex('hanging-leg-raise', [{ reps: 12 }, { reps: 12 }]),
          ],
        },
        {
          title: 'Bench Day',
          duration: 3900,
          exercises: [
            ex('bench-press', [warm(40, 8), wr(bp, 5, { rpe: 7.5 }), wr(bp, 5, { rpe: 8 }), wr(bp + 2.5, 3, { rpe: 9 })]),
            ex('barbell-row', [wr(70, 8), wr(70, 8), wr(70, 8)]),
            ex('overhead-press', [wr(42.5, 6), wr(42.5, 6)]),
          ],
        },
        {
          title: 'Deadlift Day',
          duration: 4700,
          exercises: [
            ex('deadlift', [warm(100, 5), warm(130, 3), wr(dl, 1, { rpe: 8 }), wr(load(dl * 0.9), 3, { rpe: 8 })], 'hook grip held'),
            ex('good-morning', [wr(50, 8), wr(50, 8)]),
            ex('plank', [{ durationS: 60 }, { durationS: 60 }]),
          ],
        },
      ]
    },
    deadlift_dana: (w) => {
      const dl = load(160 + w * 5)
      return [
        {
          title: 'Pull Heavy',
          duration: 4600,
          exercises: [
            ex('sumo-deadlift', [warm(100, 5), warm(140, 2), wr(dl, 2, { rpe: 8.5 }), wr(load(dl * 0.92), 3)]),
            ex('barbell-row', [wr(75, 8), wr(75, 8), wr(75, 8)]),
          ],
        },
        {
          title: 'Press + Squat',
          duration: 4100,
          exercises: [
            ex('front-squat', [warm(50, 5), wr(load(85 + w * 2.5), 4, { rpe: 8 }), wr(load(85 + w * 2.5), 4)]),
            ex('close-grip-bench-press', [wr(load(70 + w * 1.25), 5), wr(load(70 + w * 1.25), 5)]),
            ex('face-pull', [wr(25, 15), wr(25, 15)]),
          ],
        },
      ]
    },
    oly_ivan: (w) => {
      const sn = load(70 + w * 2.5)
      const cj = load(92.5 + w * 2.5)
      return [
        {
          title: 'Snatch Session',
          duration: 4900,
          exercises: [
            ex('snatch', [warm(40, 3), warm(55, 2), wr(sn, 2, { rpe: 8 }), wr(sn, 2), wr(load(sn - 5), 2)]),
            ex('overhead-squat', [wr(60, 3), wr(60, 3)]),
            ex('power-snatch', [wr(load(sn * 0.85), 2), wr(load(sn * 0.85), 2)]),
          ],
        },
        {
          title: 'Clean & Jerk',
          duration: 5200,
          exercises: [
            ex('clean-and-jerk', [warm(60, 2), warm(75, 1), wr(cj, 1, { rpe: 8.5 }), wr(cj, 1), wr(load(cj - 7.5), 2)]),
            ex('front-squat', [wr(load(110 + w * 2.5), 3, { rpe: 8 }), wr(load(110 + w * 2.5), 3)]),
          ],
        },
        {
          title: 'Positions + Pulls',
          duration: 3700,
          exercises: [
            ex('power-clean', [wr(load(cj * 0.8), 3), wr(load(cj * 0.8), 3)]),
            ex('push-press', [wr(load(70 + w * 1.25), 4), wr(load(70 + w * 1.25), 4)]),
            ex('back-squat', [wr(load(120 + w * 2.5), 3), wr(load(120 + w * 2.5), 3)]),
          ],
        },
      ]
    },
    pump_ana: (w) => {
      const inc = 1 + Math.floor(w / 2) * 2
      return [
        {
          title: 'Push Day',
          duration: 4300,
          exercises: [
            ex('dumbbell-bench-press', [warm(18, 12), wr(28 + inc, 10, { rpe: 8 }), wr(28 + inc, 10), wr(28 + inc, 9)]),
            ex('incline-dumbbell-press', [wr(22 + inc, 10), wr(22 + inc, 10), wr(22 + inc, 9)]),
            ex('dumbbell-lateral-raise', [wr(10, 15), wr(10, 15), wr(10, 12)]),
            ex('triceps-pushdown', [wr(30, 12), wr(30, 12), wr(30, 12)]),
          ],
        },
        {
          title: 'Pull Day',
          duration: 4200,
          exercises: [
            ex('lat-pulldown', [wr(55 + inc, 10, { rpe: 8 }), wr(55 + inc, 10), wr(55 + inc, 9)]),
            ex('dumbbell-row', [wr(30 + inc, 10), wr(30 + inc, 10), wr(30 + inc, 10)]),
            ex('face-pull', [wr(25, 15), wr(25, 15)]),
            ex('dumbbell-curl', [wr(12, 12), wr(12, 12), wr(12, 10)]),
          ],
        },
        {
          title: 'Leg Day',
          duration: 4600,
          exercises: [
            ex('leg-press', [warm(120, 12), wr(180 + inc * 5, 10, { rpe: 8.5 }), wr(180 + inc * 5, 10), wr(180 + inc * 5, 9)]),
            ex('hack-squat', [wr(90 + inc * 2, 10), wr(90 + inc * 2, 10)]),
            ex('seated-leg-curl', [wr(45, 12), wr(45, 12), wr(45, 12)]),
            ex('standing-calf-raise', [wr(80, 15), wr(80, 15), wr(80, 15)]),
          ],
        },
      ]
    },
    flex_marco: (w) => [
      {
        title: 'Chest & Arms',
        duration: 4000,
        exercises: [
          ex('chest-press-machine', [wr(70 + w * 2, 10, { rpe: 8 }), wr(70 + w * 2, 10), wr(70 + w * 2, 9)]),
          ex('pec-deck-fly', [wr(55, 12), wr(55, 12), wr(55, 12)]),
          ex('ez-bar-skull-crusher', [wr(30, 10), wr(30, 10), wr(30, 10)]),
          ex('hammer-curl', [wr(14, 12), wr(14, 12)]),
        ],
      },
      {
        title: 'Back & Delts',
        duration: 4100,
        exercises: [
          ex('machine-row', [wr(65 + w * 2, 10, { rpe: 8 }), wr(65 + w * 2, 10), wr(65 + w * 2, 10)]),
          ex('lat-pulldown', [wr(60, 10), wr(60, 10), wr(60, 9)]),
          ex('barbell-shrug', [wr(100, 12), wr(100, 12)]),
          ex('cable-curl', [wr(25, 12), wr(25, 12)]),
        ],
      },
    ],
    kettlebrick: (w) => {
      const log = load(80 + w * 2.5)
      return [
        {
          title: 'Event Day',
          duration: 5400,
          exercises: [
            ex('yoke-walk', [{ weightKg: 240 + w * 10, distanceM: 20, durationS: 14 }, { weightKg: 240 + w * 10, distanceM: 20, durationS: 15 }], 'turf runs'),
            ex('farmers-carry', [{ weightKg: 100 + w * 4, distanceM: 30, durationS: 22 }, { weightKg: 100 + w * 4, distanceM: 30 }]),
            ex('atlas-stone-load', [wr(120, 3), wr(120, 3)]),
          ],
        },
        {
          title: 'Overhead + Pulls',
          duration: 4700,
          exercises: [
            ex('log-press', [warm(50, 5), wr(log, 3, { rpe: 8.5 }), wr(log, 3), wr(log, 2)]),
            ex('axle-deadlift', [wr(load(160 + w * 5), 3), wr(load(160 + w * 5), 3)]),
            ex('sled-push', [{ weightKg: 140, distanceM: 20 }, { weightKg: 140, distanceM: 20 }]),
          ],
        },
      ]
    },
    barhop_leo: (w) => [
      {
        title: 'Weighted Pull',
        duration: 3800,
        exercises: [
          ex('pull-up', [{ reps: 8 }, { weightKg: 10 + w * 2.5, reps: 5, rpe: 8 }, { weightKg: 10 + w * 2.5, reps: 5 }, { weightKg: 10 + w * 2.5, reps: 4 }]),
          ex('inverted-row', [{ reps: 12 }, { reps: 12 }]),
          ex('front-lever-hold', [{ durationS: 8 + w * 2 }, { durationS: 7 + w * 2 }], 'straddle'),
          ex('dead-hang', [{ durationS: 60 + w * 5 }]),
        ],
      },
      {
        title: 'Weighted Push',
        duration: 3600,
        exercises: [
          ex('dip', [{ reps: 10 }, { weightKg: 15 + w * 2.5, reps: 6, rpe: 8 }, { weightKg: 15 + w * 2.5, reps: 6 }, { weightKg: 15 + w * 2.5, reps: 5 }]),
          ex('push-up', [{ reps: 25 + w * 3 }, { reps: 20 + w * 2 }]),
          ex('handstand-hold', [{ durationS: 20 + w * 3 }, { durationS: 18 + w * 3 }]),
          ex('l-sit', [{ durationS: 12 + w * 2 }, { durationS: 10 + w * 2 }]),
        ],
      },
    ],
    grip_gaby: (w) => [
      {
        title: 'Bells & Carries',
        duration: 3300,
        exercises: [
          ex('kettlebell-swing', [wr(24, 15), wr(24, 15), wr(24, 15)]),
          ex('goblet-squat', [wr(24, 10), wr(24, 10), wr(28 + Math.floor(w / 2) * 4, 8)]),
          ex('farmers-carry', [{ weightKg: 32 + w * 2, distanceM: 40 }, { weightKg: 32 + w * 2, distanceM: 40 }]),
          ex('plank', [{ durationS: 75 + w * 5 }]),
        ],
      },
      {
        title: 'Press + Grip',
        duration: 3100,
        exercises: [
          ex('kettlebell-clean-and-press', [wr(20, 8), wr(20, 8), wr(24, 6)]),
          ex('turkish-get-up', [wr(16, 3), wr(16, 3)]),
          ex('dead-hang', [{ durationS: 45 + w * 5 }, { durationS: 40 + w * 5 }]),
        ],
      },
    ],
  }

  interface Published {
    workoutId: number
    userId: number
    ownerName: string
    at: number
  }
  const published: Published[] = []

  for (let w = 0; w < 6; w++) {
    const weekStart = BASE - (5 - w) * WEEK
    for (const athlete of athletes) {
      const sessions = programs[athlete.username](w)
      sessions.forEach((session, i) => {
        // Spread sessions across the week (Mon/Wed/Fri pattern), evening hours.
        const at = weekStart - 4 * DAY + i * 2 * DAY + (17 + Math.floor(rng() * 3)) * 3600_000 + Math.floor(rng() * 3000_000)
        const created = createWorkout(
          db,
          athlete.id!,
          {
            title: session.title,
            startedAt: at - session.duration * 1000,
            durationS: session.duration + Math.floor(rng() * 300),
            exercises: session.exercises,
          },
          at,
        )
        publishWorkout(db, athlete.id!, created.id, at)
        published.push({ workoutId: created.id, userId: athlete.id!, ownerName: athlete.username, at })
      })
    }
  }

  // Demo's own recent sessions (this week) so the demo account has a grid + streak.
  const demoId = byName.get('demo')!
  const demoSessions: { title: string; at: number; exercises: WorkoutExerciseIn[] }[] = [
    {
      title: 'Back to Basics',
      at: BASE - 3 * DAY,
      exercises: [
        ex('back-squat', [warm(60, 5), wr(90, 5, { rpe: 8 }), wr(90, 5), wr(90, 5)]),
        ex('bench-press', [wr(70, 5), wr(70, 5), wr(72.5, 3)]),
        ex('pull-up', [{ reps: 8 }, { reps: 7 }, { reps: 6 }]),
      ],
    },
    {
      title: 'Friday Pump',
      at: BASE - 6 * 3600_000,
      exercises: [
        ex('deadlift', [warm(100, 5), wr(130, 3, { rpe: 8 }), wr(140, 1, { rpe: 9 })]),
        ex('lat-pulldown', [wr(55, 10), wr(55, 10)]),
        ex('plank', [{ durationS: 90 }]),
      ],
    },
  ]
  for (const s of demoSessions) {
    const created = createWorkout(
      db,
      demoId,
      { title: s.title, startedAt: s.at - 3600_000, durationS: 3600, exercises: s.exercises },
      s.at,
    )
    publishWorkout(db, demoId, created.id, s.at)
    published.push({ workoutId: created.id, userId: demoId, ownerName: 'demo', at: s.at })
  }

  // ---------------------------------------------------------------- likes & comments
  const insertLike = db.prepare('INSERT OR IGNORE INTO likes (user_id, workout_id, created_at) VALUES (?, ?, ?)')
  const bumpLikes = db.prepare('UPDATE workouts SET like_count = like_count + 1 WHERE id = ?')
  const insertComment = db.prepare('INSERT INTO comments (workout_id, user_id, body, created_at) VALUES (?, ?, ?, ?)')
  const bumpComments = db.prepare('UPDATE workouts SET comment_count = comment_count + 1 WHERE id = ?')

  db.transaction(() => {
    const cutoff = BASE - 3 * WEEK
    for (const p of published) {
      const recency = p.at >= cutoff ? 1 : 0.35 // recent posts get more engagement
      for (const u of USERS) {
        if (u.id === p.userId) continue
        if (chance(0.3 * recency)) {
          const at = p.at + Math.floor(rng() * 8 * 3600_000) + 600_000
          if (insertLike.run(u.id!, p.workoutId, at).changes > 0) {
            bumpLikes.run(p.workoutId)
            notifyLike(db, u.id!, p.workoutId, p.userId, at)
          }
        }
        if (chance(0.09 * recency)) {
          const at = p.at + Math.floor(rng() * 10 * 3600_000) + 900_000
          const commentId = Number(insertComment.run(p.workoutId, u.id!, pick(COMMENTS), at).lastInsertRowid)
          bumpComments.run(p.workoutId)
          notifyComment(db, u.id!, p.workoutId, p.userId, commentId, at)
        }
      }
    }
  })()

  // ---------------------------------------------------------------- report
  const totals = db
    .prepare(
      `SELECT u.username, u.workout_count, u.follower_count,
              (SELECT COUNT(*) FROM personal_records pr WHERE pr.user_id = u.id) AS prs
       FROM users u ORDER BY u.id`,
    )
    .all() as { username: string; workout_count: number; follower_count: number; prs: number }[]

  console.log('\nSeeded Chalk demo world:')
  console.log('  username        sessions  followers  PRs')
  for (const t of totals) {
    console.log(`  ${t.username.padEnd(15)} ${String(t.workout_count).padStart(7)} ${String(t.follower_count).padStart(9)} ${String(t.prs).padStart(5)}`)
  }
  console.log('\nLog in with:  demo / demo1234   (athletes: chalk1234)')
  db.close()
}

main()
