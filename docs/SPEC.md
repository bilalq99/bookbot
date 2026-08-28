# CHALK — Build Specification (v1, authoritative)

> *"Strava for lifting." Log heavy. Lift together.*

This document is normative. It was synthesized from four design specs plus a cross-review;
where it conflicts with anything else, **this file wins**. The frozen contract files
(`src/shared/types.ts`, `src/shared/validation.ts`, `src/shared/formulas.ts`,
`src/client/lib/api.ts`, `src/client/styles/tokens.css`, `src/server/db/migrate.ts`,
`src/server/db/exercises.ts`, `src/server/app.ts`) are the machine-readable half of this
contract — implementers MUST NOT edit frozen files; code against them.

## 1. Product identity

- **Name: Chalk.** Wordmark "CHALK" (letter-spaced, bold). Chalk is the shared ritual of
  powerlifting, weightlifting, bodybuilding, strongman, and calisthenics.
- **Vocabulary used in ALL UI copy:** a posted workout is a **Session**; a like is a
  **fist bump** (verb: "Bump", fist icon 🤜 as inline SVG); a personal record is a **PR**
  (badge: "PR" chip); logging is "Chalk it up".
- **Dark-only theme** (deliberate v1 cut): near-black rubber-floor background, chalk-white
  ink, **plate-red accent `#D0342C`**. The IPF kilo-plate palette (red 25 / blue 20 /
  yellow 15 / green 10 / white 5) is the data palette, used in the barbell graphic.
- Social model: **asymmetric follow** (no requests, no private accounts, no blocking in v1).
  Every published Session is visible to any **logged-in** user. Drafts are owner-only.
  The feed is a filter, not an access boundary.

## 2. Stack (fixed)

Runtime deps: `express@^4.22`, `better-sqlite3@^13`, `bcryptjs@^3`, `multer@^2`,
`cookie-parser@^1.4`, `zod@^4`, `react@^19`, `react-dom@^19`, `react-router-dom@^7`
(library mode only: `BrowserRouter`/`Routes`/`Route`/`Link`/`useNavigate`/`useParams`).
Dev: `typescript@^5.9`, `vite@^7`, `@vitejs/plugin-react@^5`, `tsx@^4`, `vitest@^3`,
`supertest@^7`, `@playwright/test`, `concurrently`, `@types/*`.

- **No ORM.** Hand-written SQL via better-sqlite3 prepared statements.
- **No Tailwind, no icon packages, no fonts downloads.** Hand-written CSS on
  `tokens.css`; ~14 inline SVG icons in `Icons.tsx`; system font stack.
- Server compiles to **CommonJS** via `tsc -p tsconfig.server.json` (module commonjs,
  rootDir `src`, outDir `dist`, includes `src/server` + `src/shared`). Client is ESM
  under Vite. Because the server is CJS, **`src/server/**` and `src/shared/**` must use
  only relative imports with no file extensions** and no `import.meta`.
- Single process in prod: Express serves `/api`, `/uploads`, static `dist/client`, and
  the SPA fallback.
- All timestamps: **INTEGER Unix epoch milliseconds (UTC)**. All weights **kg (REAL)**,
  distances **meters (REAL)**, durations **seconds (INTEGER)**. `users.unit_preference`
  affects display only.

npm scripts (already in package.json — do not change):
`dev` (tsx watch + vite), `build` (vite build && tsc -p tsconfig.server.json),
`start` (node dist/server/index.js), `seed` (tsx src/server/db/seed.ts),
`typecheck` (tsc --noEmit), `test` (vitest run tests/api), `e2e` (playwright test).

Env (read ONLY in `src/server/config.ts`): `PORT` (3000), `DB_PATH` (data/chalk.db),
`UPLOADS_DIR` (uploads). Boot order: ensure dirs → open DB (WAL, foreign_keys ON,
busy_timeout 5000) → migrate (idempotent) → listen; log exactly
`Chalk listening on http://localhost:${PORT}`.

## 3. Database schema

The full DDL lives in frozen `src/server/db/migrate.ts` and is applied when
`PRAGMA user_version = 0`, then sets `user_version = 1`. Summary (see the file for the
exact DDL — column names below are the truth):

- `users(id, username UNIQUE COLLATE NOCASE, password_hash, display_name, bio DEFAULT '',
  unit_preference 'kg'|'lb' DEFAULT 'kg', follower_count, following_count, workout_count,
  created_at)` — counters denormalized, maintained transactionally.
- `auth_sessions(token_hash PK, user_id FK CASCADE, created_at, expires_at)` +
  index on `expires_at`. Stores `sha256(token)` hex, never the raw token.
- `follows(follower_id, followee_id, created_at, PK(follower_id,followee_id),
  CHECK follower<>followee)` + index `(followee_id, created_at DESC)`.
- `exercises(id, slug UNIQUE, name, name_norm, metric_type, muscle_group, equipment,
  pl_lift 'S'|'B'|'D'|NULL, tags JSON, created_by NULL=global, created_at)`.
  `metric_type ∈ ('weight_reps','bodyweight_reps','duration','distance_duration')`.
  `muscle_group ∈ ('chest','back','shoulders','traps','biceps','triceps','forearms',
  'core','quads','hamstrings','glutes','calves','full_body')`.
  `equipment ∈ ('barbell','dumbbell','machine','cable','kettlebell','bodyweight','odd_implement')`.
- `workouts(id, user_id FK, title DEFAULT '', notes DEFAULT '', status 'draft'|'published',
  started_at NULL, duration_s NULL, published_at NULL, created_at, updated_at,
  like_count, comment_count, total_sets, total_volume_kg, pr_count)`.
  Partial indexes: `(published_at DESC, id DESC) WHERE status='published'` (THE feed
  index), `(user_id, published_at DESC, id DESC) WHERE status='published'`,
  `(user_id, updated_at DESC) WHERE status='draft'`.
- `workout_exercises(id, workout_id FK CASCADE, exercise_id FK, position,
  notes DEFAULT '', UNIQUE(workout_id, position))` + index on `exercise_id`.
- `sets(id, workout_exercise_id FK CASCADE, position, set_type 'normal'|'warmup',
  weight_kg NULL, reps NULL, duration_s NULL, distance_m NULL, rpe NULL,
  est_1rm_kg NULL, is_pr 0|1, UNIQUE(workout_exercise_id, position))`.
- `likes(user_id, workout_id, created_at, PK(user_id,workout_id))` + index
  `(workout_id, created_at DESC)`.
- `comments(id, workout_id FK CASCADE, user_id FK CASCADE, body, created_at)` + index
  `(workout_id, id)`.
- `notifications(id, user_id recipient, actor_id, type 'like'|'comment'|'follow'|'pr',
  workout_id NULL FK CASCADE, comment_id NULL FK CASCADE, pr_summary TEXT NULL,
  read_at NULL, created_at, CHECK(actor_id<>user_id))` + indexes `(user_id, id DESC)`,
  partial unread `(user_id) WHERE read_at IS NULL`, and dedup partial UNIQUEs:
  like `(user_id,actor_id,workout_id)`, follow `(user_id,actor_id)`,
  pr `(user_id,workout_id)`.
- `media(id, user_id FK CASCADE, workout_id NULL FK SET NULL, file_path UNIQUE,
  mime_type, size_bytes, position DEFAULT 0, created_at)` + index `(workout_id, position)`.
- `personal_records(id, user_id, exercise_id, record_type, value REAL, set_id NULL FK
  CASCADE, workout_id NULL FK CASCADE, achieved_at, updated_at,
  UNIQUE(user_id, exercise_id, record_type))` + index `(user_id, achieved_at DESC)`.
  `record_type ∈ ('max_weight','max_est_1rm','max_reps','max_duration','max_distance')`.

## 4. Set validation (app layer, in frozen `src/shared/validation.ts`)

| metric_type | required | optional | must be absent |
|---|---|---|---|
| `weight_reps` | `weightKg` 0.5–2000, `reps` int 1–100 | `rpe` | durationS, distanceM |
| `bodyweight_reps` | `reps` int 1–500 | `weightKg` 0–500 (= ADDED weight; 0/absent = strict bodyweight), `rpe` | durationS, distanceM |
| `duration` | `durationS` int 1–3600 | `weightKg` 0–500 (weighted holds) | reps, distanceM |
| `distance_duration` | `distanceM` 1–1000 | `weightKg` 0–2000 (implement weight), `durationS` int 1–3600 | reps |

`rpe`: 6–10 in 0.5 steps. `setType`: `'normal' | 'warmup'` (default normal).
Validation errors name the exercise index and set index ("exercises[1].sets[2]: …").

## 5. Formulas (frozen in `src/shared/formulas.ts` — shared by server, client, seed)

- **e1RM (Epley, reps=1 identity):** `e1rm(w, r) = r === 1 ? w : w * (1 + r / 30)`.
  Computed (as `est_1rm_kg`, on write) ONLY for `weight_reps` sets with `1 ≤ reps ≤ 12`
  and `weightKg > 0`. Never for other metric types. Reps > 12 → NULL (garbage extrapolation).
- **Tonnage:** `totalVolumeKg = Σ weight_kg * reps` over sets where BOTH are non-null and
  `set_type <> 'warmup'` (this counts weight_reps fully and added-weight bodyweight work
  by its added load; duration/distance sets contribute 0).
- **totalSets** = count of sets with `set_type <> 'warmup'`.
- **Streak:** consecutive UTC ISO-8601 weeks (Monday start) with ≥ 1 published workout,
  anchored at the current week if it has one, else the previous week; 0 otherwise.
- **Powerlifting total (Records page):** best `max_weight` PR per pl_lift group
  (S = squat-slugged, B = bench, D = deadlift+sumo — via `exercises.pl_lift`); shown as
  TOTAL only when all three exist. Separately, "est. total" = sum of best `max_est_1rm`
  per group when all three exist; ALWAYS labeled "est." — never mix the two.
- **Display units:** storage kg; if `unitPreference === 'lb'` convert with
  `1 lb = 0.45359237 kg`, weights to 1 decimal, tonnage to nearest integer with
  thousands separators, distance meters (or feet: `1 ft = 0.3048 m`, nearest 5 ft),
  durations `M:SS` above 90 s else `Ns`; session duration "1 h 12 m".
- **Card headline picker** `pickHeadline(exercises)` — first match wins:
  1. a PR set (is_pr) — choose the one with the largest `prMagnitude` (weight_kg, else
     est_1rm, else reps/duration/distance);
  2. the set with the highest `est_1rm_kg`;
  3. the heaviest `weight_kg` set; 4. longest `duration_s`; 5. farthest `distance_m`;
  6. most `reps`; 7. none → title only.
  Formats: `Squat 180 kg × 3`, `Dip +42.5 kg × 5` (bodyweight_reps with added weight),
  `Push-Up × 41`, `Front Lever 0:18`, `Yoke Walk 280 kg · 20 m`.
- **Plate math (card barbell graphic):** per-side greedy breakdown of
  `(weightKg - 20) / 2` over pairs `[25, 20, 15, 10, 5, 2.5, 1.25]`; IPF colors
  25 → `#D0342C`, 20 → `#2B5DD7`, 15 → `#E8B33A`, 10 → `#3F9C5A`, 5 → `#EFEFEA`,
  2.5/1.25 → `#7A8194`. Only for weight_reps headline sets with weightKg ≥ 25;
  otherwise the card shows no barbell graphic.
- **Dominant muscle → card gradient:** count non-warmup sets per muscle_group; map top
  group: chest/shoulders/triceps → `push`; back/biceps/traps/forearms → `pull`;
  quads/hamstrings/glutes/calves → `legs`; core → `core`; full_body → `full`;
  tie/none → `full`. Gradients are CSS vars `--grad-push` etc. in tokens.css.

## 6. PR engine (server, `src/server/services/prs.ts`)

**Computed on write, denormalized, inside the publish transaction.** Only **published**
workouts count; **warmup sets never count**.

Record types per metric_type:
- `weight_reps` → `max_weight` (kg, any non-warmup set with reps ≥ 1), `max_est_1rm` (kg)
- `bodyweight_reps` → `max_reps` (reps), `max_weight` (kg ADDED, only sets with weight_kg > 0)
- `duration` → `max_duration` (s) · `distance_duration` → `max_distance` (m)

**On publish** (one transaction): validate ≥ 1 non-warmup set; set status/published_at
(idempotent — republish keeps original published_at and never re-notifies); recompute
est_1rm_kg, total_volume_kg, total_sets; for each exercise × applicable record_type,
find the best candidate in this workout and upsert with **strictly-greater wins**
(`ON CONFLICT ... DO UPDATE ... WHERE excluded.value > personal_records.value`); mark
achieving sets `is_pr = 1`; `workouts.pr_count` = number of new/updated records; if
pr_count > 0 fan out one `pr` notification per follower (dedup via the partial unique,
`ON CONFLICT DO NOTHING`), `pr_summary` = JSON `[{exerciseName, recordType, value}]`
(≤ 10 entries). First-ever records DO badge (Strava behavior).

**recomputePRs(db, userId, exerciseIds)** MUST run in the same transaction when a
published workout is edited or deleted: zero `is_pr` for the affected (user, exercise)
pairs, delete their `personal_records` rows, rescan remaining published non-warmup
history (earliest published_at wins ties), reinsert, re-mark winners. Never re-send
notifications from recompute; never touch historical `workouts.pr_count`.

## 7. API surface

All under `/api`, JSON camelCase. Errors: `{ "error": { "code": string, "message": string } }`,
codes `validation_error` 400, `unauthorized` 401, `invalid_credentials` 401,
`forbidden` 403, `not_found` 404, `conflict` 409, `payload_too_large` 413.
Auth = `sid` cookie (§8); only register/login are public. `:id` non-integer → 404.
Wire types are frozen in `src/shared/types.ts`; the client MUST call through frozen
`src/client/lib/api.ts`. Cursors: `"<publishedAt>.<id>"` keyset, `nextCursor: null` at end;
fetch limit+1 to detect more. Feed/profile hydration: page query + 4 batch queries
(workout_exercises+exercises, sets, media, viewer likes) — no N+1. The hydration helper
`getWorkoutCards(db, workoutIds, viewerId)` lives in `src/server/services/cards.ts` and
is used by feed, profile timeline, and single-workout endpooints.

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register` | `{username, password, displayName?, unitPreference?}`; username `^[a-z0-9_]{3,20}$` (lowercase server-side), password 8–100; 201 `{user: UserSelf}` + cookie; 409 taken |
| `POST /api/auth/login` | `{username, password}`; 200 `{user}` + cookie; 401 `invalid_credentials` (same body whether user exists) |
| `POST /api/auth/logout` | 204; deletes session row, clears cookie |
| `GET /api/auth/me` | `{user: UserSelf}` or 401 |
| `GET /api/exercises?q=&muscleGroup=&limit=100` | global + own custom; `q` prefix-then-substring on name_norm; no q → alphabetical; `{exercises}` |
| `POST /api/exercises` | `{name, metricType, muscleGroup, equipment}` → 201 custom (created_by=viewer); 409 dup |
| `POST /api/workouts` | full nested `{title?, notes?, startedAt?, durationS?, exercises: [{exerciseId, notes?, sets: [SetIn]}], mediaIds?}` → 201 draft `{workout: WorkoutDetail}` |
| `PATCH /api/workouts/:id` | same body; `exercises` present → full replace of children; owner only; if published → recompute totals + PRs over (old ∪ new) exerciseIds; published_at never changes |
| `POST /api/workouts/:id/publish` | 200 `{workout, newPrs: [{exerciseName, recordType, value, previousValue}]}`; 400 if zero non-warmup sets; idempotent |
| `GET /api/workouts/:id` | WorkoutDetail; drafts → owner only else 404 |
| `DELETE /api/workouts/:id` | 204 owner only; capture exerciseIds → delete (cascades; media files unlinked best-effort) → decrement workout_count if published → recomputePRs |
| `GET /api/workouts?status=draft` | own drafts, updated_at DESC, no pagination |
| `GET /api/feed?scope=following\|everyone&cursor=&limit=20` | published; `following` = follows ∪ self (default); `everyone` = all users (cold-start/discover firehose); newest-first keyset on the partial index; `{items: WorkoutCard[], nextCursor}` |
| `POST /api/workouts/:id/like` · `DELETE …/like` | 204 idempotent; count maintained on actual change; notify per §9; unlike deletes the likes notification row |
| `GET /api/workouts/:id/likes?cursor=&limit=30` | `{users: UserPublic[], nextCursor}` newest first |
| `GET /api/workouts/:id/comments?cursor=&limit=20` | oldest-first, cursor = last id; `{comments, nextCursor}` |
| `POST /api/workouts/:id/comments` | `{body}` 1–500 chars → 201 `{comment}`; count += 1; notify |
| `DELETE /api/comments/:id` | comment author or workout owner; 204; count -= 1 |
| `GET /api/users/search?q=&limit=20` | username prefix first then displayName substring, NOCASE; `{users: (UserPublic & {viewerFollows})[]}` |
| `GET /api/users/suggested?limit=8` | most-recently-active users the viewer doesn't follow (by latest published_at), excluding self; same shape as search |
| `GET /api/users/:username` | `{user: UserPublic, viewerFollows, followsViewer, isSelf}` |
| `GET /api/users/:username/workouts?cursor=&limit=20` | published only, profile index, `{items, nextCursor}` |
| `GET /api/users/:username/stats` | `{workoutCount, totalVolumeKg, totalSets, prCount, currentStreakWeeks, weeklyVolume: [{weekStart, volumeKg, workouts}] (last 12 UTC ISO weeks)}` |
| `GET /api/users/:username/prs` | `{prs: [{exercise: Exercise, recordType, value, achievedAt, workoutId}]}` achieved_at DESC |
| `GET /api/users/:username/followers?cursor=&limit=30` · `…/following` | `{users: (UserPublic & {viewerFollows})[], nextCursor}` |
| `POST /api/users/:username/follow` · `DELETE` | 204 idempotent; 400 if self; counters on actual change; notify on actual insert |
| `PATCH /api/users/me` | `{displayName?, bio? (≤160), unitPreference?}` → `{user: UserSelf}` |
| `GET /api/notifications?cursor=&limit=30` | id DESC; `{items: NotificationOut[], nextCursor, unreadCount}` |
| `POST /api/notifications/read-all` | 204 |
| `POST /api/media` | multipart field `file`; ≤ 5 MB (multer limit → 413); jpeg/png/webp by **magic bytes**; store `uploads/<32-hex>.<ext>`, unattached; 201 `{media: MediaOut}` |
| `GET /uploads/*` | public static, `maxAge 7d immutable`, dotfiles deny |

Attach media via `mediaIds` (max 4) on workout create/patch: each must be viewer's,
unattached or on this workout; array order = position; removed ids are detached.

## 8. Auth mechanics

bcryptjs cost 10. Token = `crypto.randomBytes(32).toString('base64url')`; store
`sha256(token)` hex in `auth_sessions`, `expires_at = now + 30d`. Cookie:
`sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` (no Secure — container HTTP).
`requireAuth` middleware: parse cookie → hash → join users → expired rows deleted + 401.
Attach `req.user` (Express Request augmented in `src/server/auth/middleware.ts`).
CSRF: for non-GET `/api` requests with an `Origin` header, its host must equal the
request's `Host` header, else 403. Logout deletes the row. Hourly sweep of expired rows
via `setInterval(...).unref()` set up in index.ts (NOT in createApp, so tests don't leak
timers).

## 9. Notification rules (server `src/server/services/notify.ts`)

Same transaction as the trigger; never notify yourself. **like**: workout owner, dedup
`(user,actor,workout)`, unlike deletes the row (re-like re-notifies). **comment**: workout
owner, no dedup, `comment_id` set, cascades on comment delete. **follow**: followee, dedup
`(user,actor)`, unfollow does NOT delete (re-follow silently no-ops). **pr**: every
follower at publish, one per `(follower, workout)`, `ON CONFLICT DO NOTHING`.

## 10. Client — screens & components

SPA routes (frozen in `App.tsx`): `/login`, `/register` (public); authed shell:
`/` Feed, `/discover`, `/log`, `/records`, `/notifications`, `/@:username` Profile,
`/s/:id` Session detail, `/settings`. Unknown → redirect `/`.

**Shell:** mobile-first. Bottom tab bar < 900px: Feed · Discover · **Log (raised
plate-red circular + FAB)** · Records · You(avatar). ≥ 900px: left icon rail, content
column `max-width: 620px` centered. Bell icon in the Feed header with unread-count badge
(poll `/api/notifications` unreadCount every 60 s from the shell) → `/notifications`.

**Feed:** segmented control **Following · Everyone** (default Following; empty state
nudges to Everyone + Discover). Infinite scroll (IntersectionObserver + cursor). Each
item: ① header (avatar, display name, @username → profile, relative time) ② **hero**:
photo carousel if media, else the **SessionCard** ③ stat row ④ exercise strip (one line,
"+N more") ⑤ actions: Bump (fist, toggles, optimistic, count), Comment (→ detail),
PR bell chip when pr_count > 0. Double-tap/double-click the hero also bumps.

**SessionCard (the product's soul, `components/SessionCard.tsx`):** pure CSS/SVG,
deterministic from workout data via shared formulas. 4:3 rounded card; muscle-gradient
background; faint chalk-noise (SVG turbulence filter, low opacity); kicker row (title ·
date); **headline** (exercise name letter-spaced small caps + giant tabular numerals,
e.g. `180 × 3`) + PR chip; **loaded-barbell SVG** (per-side plates from plate math,
IPF colors, proportional disc sizes, bar + collars) when applicable; stat strip
`VOLUME 8,420 kg · 19 SETS · 1:12` ; footer `● username` + `CHALK` wordmark. Scales
down legibly for profile grid thumbnails (stat strip hidden < 220px via container query
or a `compact` prop).

**Session detail:** hero (carousel/card), title, PR chips, date, duration; stat tiles
(Volume · Sets · Top set · Duration); per-exercise set tables (columns per metric type,
warm-ups dimmed with "W" tag, `est. 1RM` dim right column, PR rows get a red PR chip);
notes; bumps row (avatar stack → likers list); comments (oldest first, composer pinned,
Enter submits); owner ⋯ menu: Edit title/notes, Delete (confirm).

**Log flow (`/log`):** if a draft-in-progress exists in localStorage → resume banner.
Start options: **Start empty** · **Repeat last session** (prefills exercises + set
schemes from your latest published workout, PREV ghosts). Active editor: editable title,
elapsed timer (from startedAt), exercise blocks with per-metric-type set tables (columns:
SET · PREV · KG · REPS · RPE · ✓ etc.), PREV column = last session's matching set as
ghost text, ✓ completes a set (fires the rest timer bar: 90 s countdown, +30 s / skip),
warm-up toggle per set, add/remove sets (add copies previous row), add exercise →
full-screen picker (fuzzy search, muscle & equipment filter chips, Recent section from
your history, "Create <query>" row → inline custom-exercise form). Every edit persists
to localStorage (key `chalk.activeSession`). **Finish** → compose screen: auto title
("Push Day — Thursday PM" from dominant muscles + weekday), notes/caption, up to 4
photos (upload first via `POST /api/media`, then create), then `POST /api/workouts` +
`POST /publish`; show returned `newPrs` as a celebration list; navigate to the new
session detail. Discard with confirm.

**Profile:** header (96px initials-gradient avatar, display name, @username, bio,
Sessions · Followers · Following stats — the latter two open list pages/sheets), Follow /
Following button (own profile: Edit → `/settings`). Streak chip ("6-week streak" 🔥)
and a 12-week mini volume bar chart (plain divs off `weeklyVolume`). Content: 3-column
grid of session thumbnails (photo else compact SessionCard), tap → detail.

**Records (`/records`):** own trophy room. Marquee strip: best Squat/Bench/Deadlift
(max_weight, with est-total row labeled "est."), TOTAL when all three singles exist.
Then PRs grouped by exercise (record chips: `Max 180 kg`, `e1RM 198 kg`, `12 reps`,
`0:45`, `30 m`) with dates, newest first. Empty state: "Chalk up your first session".

**Discover:** search field (users; debounced 250 ms), Suggested lifters cards
(via `/api/users/suggested`: avatar, name, best PR one-liner if any, Follow button).

**Notifications:** reverse-chron, unread = plate-red left rule; copy per type
("**mike** bumped *Heavy Lower*", "**tony** commented: '…'", "**sarah** followed you",
"🔔 **sarah** hit 2 PRs — *Push Day*"); tap → session/profile; "Mark all read" button.

**Settings:** display name, bio, kg/lb toggle (PATCH /users/me), Logout.

**Auth pages:** centered dark card, wordmark, username/password (+ display name, unit
toggle on register), inline errors, links between the two. Redirect authed users away.

**Formatting (client `lib/format.ts`):** `formatWeight(kg, unit)`, `formatVolume`,
`formatDuration`, `formatRelativeTime` ("2h", "3d", then date), `formatSetLine(set,
metricType, unit)` (`80 × 8 @9` · `+20 × 5` · `× 41` · `0:45` · `120 kg · 30 m`).

## 11. Visual system (tokens.css is law — frozen)

Surfaces `--bg #0B0C0E`, `--surface #14161A`, `--surface-2 #1D2026`, `--border #282C34`;
ink `--ink #F4F2ED` (chalk white), `--ink-2 #9AA1AD`, `--ink-3 #5D646F`; accent
`--accent #D0342C` (plate red), `--accent-ink #FFF6F5`, `--like #FF4D6D`, `--pr #E8B33A`
(amber), `--success #3F9C5A`; plate palette vars `--plate-25 … --plate-small`; gradients
`--grad-push/pull/legs/core/full` (muted deep two-stop 135deg pairs); font system stack;
`tabular-nums` for all stats; 4px spacing scale `--sp-1..8`; radii `--r-sm 8 / --r-md 14 /
--r-lg 20 / --r-full`; `--tabbar-h 56px`; `color-scheme: dark`. Component CSS files are
per-feature (`base.css`, `feed.css`, `log.css`, `profile.css`) with class prefixes
(`.shell-`, `.feed-`, `.card-`, `.wk-`, `.log-`, `.pf-`, `.rec-`, `.dis-`, `.ntf-`,
`.auth-`) — no collisions, no CSS modules. Focus-visible outlines on all interactive
elements; `prefers-reduced-motion` disables the bump burst animation.

## 12. Exercise library

77 seed exercises are frozen in `src/server/db/exercises.ts` (slug, name, metricType,
muscleGroup, equipment, plLift, tags). Slugs are stable (`back-squat`,
`clean-and-jerk`, …). Inserted idempotently by slug during migrate/seed. Custom
exercises: `created_by` set, name unique per user (and not clashing with a global
name_norm), metricType/muscleGroup/equipment from the same enums.

## 13. Seed (`npm run seed` → `src/server/db/seed.ts`)

Deterministic (seeded mulberry32 PRNG, no Date.now — base timestamp = a fixed constant
near 2026-08-28, workouts backdated from it). Refuse to run if users exist unless
`--force` (then delete DB file + uploads). Contents: **9 users** — `demo/demo1234`
(generalist, follows everyone) plus 8 athletes across disciplines (e.g. `sarah_squats`
PL, `kettlebrick` SM, `oly_ivan` WL, `pump.ana`→`pump_ana` BB, `barhop_leo` CAL, etc.,
password `chalk1234`); follow graph (everyone follows 3–6 others); **~70 published
workouts over 6 weeks** with realistic progressive overload per discipline (PL: SBD
singles/triples; BB: PPL volume; WL: snatch/C&J doubles; SM: yoke/farmers distance sets;
CAL: weighted pull-ups/dips, holds) so PR badges, streaks, and varied SessionCards
appear naturally; likes and short gym-culture comments sprinkled with recency bias.
Workouts MUST go through the same service code path as the API (create + publish
services) so counters/PRs/notifications are production-derived. Users/follows/likes/
comments may use direct SQL but MUST maintain the denormalized counters and notification
dedup rules (or call the same service helpers). After seeding, print a table of
usernames + the demo login.

## 14. Tests

- **API (vitest + supertest, `tests/api/*.test.ts`):** `createApp(openDb(':memory:'))`
  via `tests/api/helpers.ts` (register/login helper returning an agent with cookie).
  Cover: register/login/me round-trip + duplicate 409 + bad login 401; unauthed 401;
  create+publish workout → totals + est_1rm computed → own feed shows it; PR lifecycle
  (first publish badges, higher weight later badges, lower doesn't; delete recomputes);
  follow/unfollow → feed inclusion/exclusion + follower counts; everyone-scope feed;
  cursor pagination (page 2 no overlap); like toggle idempotency + count + notification
  row (and unlike removes it); comments create/list/delete + count; notifications list +
  read-all; set validation 400 (naming the bad index); unknown `/api/x` → JSON 404 not
  HTML; draft invisible to others (404).
- **E2E (`tests/e2e/smoke.spec.ts`, chromium only, port 3111, fresh DB):** register →
  land on feed → log a session (Bench Press 3 sets: warmup 60×10 + 100×5 + 102.5×3) →
  publish → feed shows the SessionCard with volume + PR chip → open detail → bump it
  (count 1) → comment "chalk up 🤜" appears → profile shows 1 session; logout → login.
  Config uses `webServer` running the **built** app and
  `launchOptions.executablePath: '/opt/pw-browsers/chromium'`. Never `playwright install`.

## 15. File ownership (implementation agents)

Frozen (already written, DO NOT EDIT): package.json, tsconfigs, vite.config.ts,
playwright.config.ts, index.html, docs/SPEC.md, src/shared/*, src/server/config.ts,
src/server/db/{client,migrate,exercises}.ts, src/server/lib/http.ts, src/server/app.ts,
src/server/index.ts, src/client/lib/api.ts, src/client/styles/tokens.css,
src/client/main.tsx, src/client/App.tsx.

| Agent | Owns (replaces placeholder files) |
|---|---|
| S1 server-auth-users | src/server/auth/{password,session,middleware}.ts; src/server/routes/{auth,users}.ts |
| S2 server-workouts | src/server/services/{cards,prs,workouts}.ts; src/server/routes/{workouts,exercises}.ts |
| S3 server-social | src/server/services/notify.ts; src/server/routes/{feed,social,notifications,media}.ts |
| C1 client-shell | src/client/lib/{auth,format}.tsx/ts; src/client/components/{AppShell,Avatar,Icons}.tsx; src/client/pages/{LoginPage,RegisterPage,SettingsPage}.tsx; src/client/styles/base.css |
| C2 client-feed | src/client/components/{SessionCard,FeedItem,CommentList}.tsx; src/client/pages/{FeedPage,WorkoutDetailPage}.tsx; src/client/styles/feed.css |
| C3 client-log-profile | src/client/components/{ExercisePicker,SetEditor,RestTimer}.tsx; src/client/pages/{LogWorkoutPage,ProfilePage,RecordsPage,DiscoverPage,NotificationsPage}.tsx; src/client/styles/{log,profile}.css |
| T1 tests-seed | src/server/db/seed.ts; tests/api/*; tests/e2e/smoke.spec.ts |

Cross-imports allowed ONLY via the signatures fixed in the placeholder files
(each placeholder declares its exact exported signatures). If you believe a frozen file
has a bug, note it in your final report — do not edit it.
