# Chalk 🏋️

*"Strava for lifting." Log heavy. Lift together.*

Chalk is a social workout tracker for strength sports — powerlifting, Olympic
weightlifting, bodybuilding, strongman, and calisthenics. Log sessions set-by-set
(weight×reps, bodyweight+added, timed holds, loaded carries), and every finished
session becomes a shareable **Session Card** in an Instagram-style feed: follow
lifters, **fist-bump** their sessions, comment, and get notified when someone you
follow rings the **PR bell**.

## Quick start

```bash
npm install
npm run build
npm run seed     # demo world: 9 lifters, 6 weeks of sessions, PRs, comments
npm start        # -> http://localhost:3000
```

Demo login: **demo / demo1234** (other seeded lifters use password `chalk1234`).

## Development

```bash
npm run dev        # Express API on :3000 + Vite dev server on :5173
npm run typecheck  # strict tsc over server + client + shared + tests
npm test           # API integration tests (vitest + supertest, in-memory SQLite)
npm run e2e        # Playwright smoke test against the built app
```

## Stack

Single Node 22 process: Express 4 + better-sqlite3 (WAL, one file under `data/`),
cookie sessions (bcryptjs), local `uploads/` for photos; React 19 SPA built with
Vite, hand-written CSS on a design-token system (dark, plate-red). No ORM, no CSS
framework, no external services. See `docs/SPEC.md` for the full product and
technical specification.

### Highlights

- **Session Cards** — every zero-photo workout renders as a designed visual:
  muscle-group gradient, headline lift in giant numerals, a loaded-barbell graphic
  with IPF plate colors, volume/sets/duration stat strip.
- **PR engine** — max weight, estimated 1RM (Epley), rep, hold, and carry records
  computed at publish; PR chips on feed cards; followers get notified.
- **77-exercise library** across barbell/dumbbell/machine/cable/kettlebell/
  bodyweight/strongman implements, plus per-user custom exercises.
- **Records page** — best squat/bench/deadlift, powerlifting total, and every PR.
- Feed scopes (Following / Everyone), profiles with streaks and 12-week volume,
  user search and suggestions, notifications inbox.
