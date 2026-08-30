// FROZEN CONTRACT — do not edit. Idempotent schema + global exercise library upsert.
// Applied when PRAGMA user_version = 0; exercises upserted (by slug) on every boot.
import type { AppDb } from './client'
import { EXERCISE_LIBRARY } from './exercises'

const DDL = `
CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT    NOT NULL COLLATE NOCASE UNIQUE
                          CHECK (length(username) BETWEEN 3 AND 20),
  password_hash   TEXT    NOT NULL,
  display_name    TEXT    NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  bio             TEXT    NOT NULL DEFAULT '' CHECK (length(bio) <= 160),
  unit_preference TEXT    NOT NULL DEFAULT 'kg' CHECK (unit_preference IN ('kg','lb')),
  follower_count  INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  workout_count   INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE auth_sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX auth_sessions_user_idx    ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_idx ON auth_sessions(expires_at);

CREATE TABLE follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
) WITHOUT ROWID;
CREATE INDEX follows_followee_idx ON follows(followee_id, created_at DESC);

CREATE TABLE exercises (
  id           INTEGER PRIMARY KEY,
  slug         TEXT    UNIQUE,
  name         TEXT    NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  name_norm    TEXT    NOT NULL,
  metric_type  TEXT    NOT NULL CHECK (metric_type IN
                 ('weight_reps','bodyweight_reps','duration','distance_duration')),
  muscle_group TEXT    NOT NULL CHECK (muscle_group IN
                 ('chest','back','shoulders','traps','biceps','triceps','forearms',
                  'core','quads','hamstrings','glutes','calves','full_body')),
  equipment    TEXT    NOT NULL CHECK (equipment IN
                 ('barbell','dumbbell','machine','cable','kettlebell','bodyweight','odd_implement')),
  pl_lift      TEXT    CHECK (pl_lift IN ('S','B','D')),
  tags         TEXT    NOT NULL DEFAULT '[]',
  created_by   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX exercises_global_name_uq ON exercises(name_norm)             WHERE created_by IS NULL;
CREATE UNIQUE INDEX exercises_custom_name_uq ON exercises(created_by, name_norm) WHERE created_by IS NOT NULL;
CREATE INDEX exercises_norm_idx ON exercises(name_norm);

CREATE TABLE workouts (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL DEFAULT '' CHECK (length(title) <= 100),
  notes         TEXT    NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  started_at    INTEGER,
  duration_s    INTEGER CHECK (duration_s IS NULL OR duration_s BETWEEN 1 AND 86400),
  published_at  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  like_count      INTEGER NOT NULL DEFAULT 0,
  comment_count   INTEGER NOT NULL DEFAULT 0,
  total_sets      INTEGER NOT NULL DEFAULT 0,
  total_volume_kg REAL    NOT NULL DEFAULT 0,
  pr_count        INTEGER NOT NULL DEFAULT 0,
  CHECK (status = 'draft' OR published_at IS NOT NULL)
);
CREATE INDEX workouts_published_idx  ON workouts(published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX workouts_user_pub_idx   ON workouts(user_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX workouts_user_draft_idx ON workouts(user_id, updated_at DESC) WHERE status = 'draft';

CREATE TABLE workout_exercises (
  id          INTEGER PRIMARY KEY,
  workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position    INTEGER NOT NULL CHECK (position >= 0),
  notes       TEXT    NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  UNIQUE (workout_id, position)
);
CREATE INDEX workout_exercises_exercise_idx ON workout_exercises(exercise_id);

CREATE TABLE sets (
  id                  INTEGER PRIMARY KEY,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position            INTEGER NOT NULL CHECK (position >= 0),
  set_type            TEXT    NOT NULL DEFAULT 'normal' CHECK (set_type IN ('normal','warmup')),
  weight_kg   REAL    CHECK (weight_kg  IS NULL OR (weight_kg  >= 0 AND weight_kg  <= 2000)),
  reps        INTEGER CHECK (reps       IS NULL OR (reps       >= 1 AND reps       <= 500)),
  duration_s  INTEGER CHECK (duration_s IS NULL OR (duration_s >= 1 AND duration_s <= 3600)),
  distance_m  REAL    CHECK (distance_m IS NULL OR (distance_m >= 1 AND distance_m <= 1000)),
  rpe         REAL    CHECK (rpe IS NULL OR (rpe >= 6 AND rpe <= 10)),
  est_1rm_kg  REAL,
  is_pr       INTEGER NOT NULL DEFAULT 0 CHECK (is_pr IN (0,1)),
  UNIQUE (workout_exercise_id, position)
);

CREATE TABLE likes (
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, workout_id)
) WITHOUT ROWID;
CREATE INDEX likes_workout_idx ON likes(workout_id, created_at DESC);

CREATE TABLE comments (
  id         INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  body       TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_workout_idx ON comments(workout_id, id);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('like','comment','follow','pr')),
  workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  pr_summary TEXT,
  read_at    INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (actor_id <> user_id)
);
CREATE INDEX notifications_user_idx   ON notifications(user_id, id DESC);
CREATE INDEX notifications_unread_idx ON notifications(user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notif_like_dedup   ON notifications(user_id, actor_id, workout_id) WHERE type = 'like';
CREATE UNIQUE INDEX notif_follow_dedup ON notifications(user_id, actor_id)             WHERE type = 'follow';
CREATE UNIQUE INDEX notif_pr_dedup     ON notifications(user_id, workout_id)           WHERE type = 'pr';

CREATE TABLE media (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  file_path  TEXT    NOT NULL UNIQUE,
  mime_type  TEXT    NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX media_workout_idx ON media(workout_id, position);

CREATE TABLE personal_records (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  record_type TEXT    NOT NULL CHECK (record_type IN
                ('max_weight','max_est_1rm','max_reps','max_duration','max_distance')),
  value       REAL    NOT NULL,
  set_id      INTEGER REFERENCES sets(id)     ON DELETE CASCADE,
  workout_id  INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
  achieved_at INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, exercise_id, record_type)
);
CREATE INDEX prs_user_idx ON personal_records(user_id, achieved_at DESC);
`

export function migrate(db: AppDb): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version === 0) {
    db.exec('BEGIN')
    try {
      db.exec(DDL)
      db.exec('PRAGMA user_version = 1')
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  seedExerciseLibrary(db)
}

/** Idempotent upsert of the 77 global library exercises, keyed by slug. */
export function seedExerciseLibrary(db: AppDb): void {
  const insert = db.prepare(`
    INSERT INTO exercises (slug, name, name_norm, metric_type, muscle_group, equipment, pl_lift, tags, created_by, created_at)
    VALUES (@slug, @name, @nameNorm, @metricType, @muscleGroup, @equipment, @plLift, @tags, NULL, 0)
    ON CONFLICT(slug) DO NOTHING
  `)
  const run = db.transaction(() => {
    for (const ex of EXERCISE_LIBRARY) {
      insert.run({
        slug: ex.slug,
        name: ex.name,
        nameNorm: ex.name.trim().toLowerCase(),
        metricType: ex.metricType,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        plLift: ex.plLift ?? null,
        tags: JSON.stringify(ex.tags),
      })
    }
  })
  run()
}
