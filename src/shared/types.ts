// FROZEN CONTRACT — do not edit. Every wire type exchanged between client and server.
// All timestamps are Unix epoch milliseconds (UTC). All weights kg, distances meters,
// durations seconds. See docs/SPEC.md.

export type Unit = 'kg' | 'lb'

export type MetricType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'duration'
  | 'distance_duration'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'traps' | 'biceps' | 'triceps' | 'forearms'
  | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'full_body'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'kettlebell' | 'bodyweight' | 'odd_implement'

export type SetType = 'normal' | 'warmup'

export type RecordType =
  | 'max_weight' | 'max_est_1rm' | 'max_reps' | 'max_duration' | 'max_distance'

export type NotificationType = 'like' | 'comment' | 'follow' | 'pr'

export type PlLift = 'S' | 'B' | 'D'

export type Discipline =
  | 'powerlifting' | 'weightlifting' | 'bodybuilding' | 'strongman' | 'calisthenics' | 'general'

// ---------------------------------------------------------------- users

export interface UserPublic {
  id: number
  username: string
  displayName: string
  bio: string
  followerCount: number
  followingCount: number
  workoutCount: number
}

export interface UserSelf extends UserPublic {
  unitPreference: Unit
  createdAt: number
}

export interface UserSearchItem extends UserPublic {
  viewerFollows: boolean
}

// ---------------------------------------------------------------- exercises

export interface Exercise {
  id: number
  slug: string | null // null for custom exercises
  name: string
  metricType: MetricType
  muscleGroup: MuscleGroup
  equipment: Equipment
  plLift: PlLift | null
  tags: Discipline[]
  isCustom: boolean
}

// ---------------------------------------------------------------- workouts

/** Set as sent by the client. Field validity depends on the exercise's metricType —
 * see validateSetForMetric in shared/validation.ts and docs/SPEC.md §4. */
export interface SetIn {
  setType?: SetType // default 'normal'
  weightKg?: number
  reps?: number
  durationS?: number
  distanceM?: number
  rpe?: number
}

export interface WorkoutExerciseIn {
  exerciseId: number
  notes?: string
  sets: SetIn[] // array order = position
}

export interface WorkoutIn {
  title?: string
  notes?: string
  startedAt?: number
  durationS?: number
  exercises?: WorkoutExerciseIn[]
  mediaIds?: number[] // max 4, owner's media
}

export interface SetOut {
  id: number
  position: number
  setType: SetType
  weightKg: number | null
  reps: number | null
  durationS: number | null
  distanceM: number | null
  rpe: number | null
  est1rmKg: number | null
  isPr: boolean
}

export interface WorkoutExerciseOut {
  id: number
  position: number
  notes: string
  exercise: Exercise
  sets: SetOut[]
}

export interface MediaOut {
  id: number
  url: string // "/uploads/<file>"
}

export interface WorkoutCard {
  id: number
  title: string
  notes: string
  startedAt: number | null
  durationS: number | null
  publishedAt: number
  totalSets: number
  totalVolumeKg: number
  prCount: number
  likeCount: number
  commentCount: number
  viewerLiked: boolean
  author: UserPublic
  exercises: WorkoutExerciseOut[]
  media: MediaOut[]
}

export interface WorkoutDetail extends Omit<WorkoutCard, 'publishedAt'> {
  status: 'draft' | 'published'
  publishedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface NewPr {
  exerciseName: string
  recordType: RecordType
  value: number
  previousValue: number | null
}

export interface PublishResponse {
  workout: WorkoutDetail
  newPrs: NewPr[]
}

// ---------------------------------------------------------------- feed & social

export type FeedScope = 'following' | 'everyone'

export interface FeedResponse {
  items: WorkoutCard[]
  nextCursor: string | null
}

export interface CommentOut {
  id: number
  body: string
  createdAt: number
  author: UserPublic
}

export interface CommentsResponse {
  comments: CommentOut[]
  nextCursor: string | null
}

export interface UsersPage {
  users: UserSearchItem[]
  nextCursor: string | null
}

// ---------------------------------------------------------------- profile & records

export interface WeeklyVolume {
  weekStart: number // ms of UTC Monday 00:00
  volumeKg: number
  workouts: number
}

export interface ProfileStats {
  workoutCount: number
  totalVolumeKg: number
  totalSets: number
  prCount: number
  currentStreakWeeks: number
  weeklyVolume: WeeklyVolume[] // last 12 UTC ISO weeks, oldest first
}

export interface PrOut {
  exercise: Exercise
  recordType: RecordType
  value: number
  achievedAt: number
  workoutId: number | null
}

export interface ProfileResponse {
  user: UserPublic
  viewerFollows: boolean
  followsViewer: boolean
  isSelf: boolean
}

// ---------------------------------------------------------------- notifications

export interface NotificationOut {
  id: number
  type: NotificationType
  createdAt: number
  readAt: number | null
  actor: UserPublic
  workout: { id: number; title: string } | null
  comment: { id: number; body: string } | null
  prSummary: { exerciseName: string; recordType: RecordType; value: number }[] | null
}

export interface NotificationsResponse {
  items: NotificationOut[]
  nextCursor: string | null
  unreadCount: number
}

// ---------------------------------------------------------------- errors

export interface ApiErrorBody {
  error: { code: string; message: string }
}
