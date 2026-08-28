// FROZEN CONTRACT — do not edit. The entire client<->server coupling.
// One typed function per endpoint; components never call fetch directly.
import type {
  ApiErrorBody,
  CommentOut,
  CommentsResponse,
  Exercise,
  FeedResponse,
  FeedScope,
  MediaOut,
  MetricType,
  MuscleGroup,
  Equipment,
  NotificationsResponse,
  ProfileResponse,
  ProfileStats,
  PrOut,
  PublishResponse,
  Unit,
  UserSearchItem,
  UserSelf,
  UsersPage,
  WorkoutDetail,
  WorkoutIn,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    let code = 'internal'
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as ApiErrorBody
      code = data.error.code
      message = data.error.message
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ---------------------------------------------------------------- auth

export const api = {
  register: (input: { username: string; password: string; displayName?: string; unitPreference?: Unit }) =>
    request<{ user: UserSelf }>('POST', '/api/auth/register', input),
  login: (username: string, password: string) =>
    request<{ user: UserSelf }>('POST', '/api/auth/login', { username, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  me: () => request<{ user: UserSelf }>('GET', '/api/auth/me'),
  patchMe: (input: { displayName?: string; bio?: string; unitPreference?: Unit }) =>
    request<{ user: UserSelf }>('PATCH', '/api/users/me', input),

  // -------------------------------------------------------------- exercises
  exercises: (q?: string, muscleGroup?: string) =>
    request<{ exercises: Exercise[] }>('GET', `/api/exercises${qs({ q, muscleGroup, limit: 100 })}`),
  createExercise: (input: { name: string; metricType: MetricType; muscleGroup: MuscleGroup; equipment: Equipment }) =>
    request<{ exercise: Exercise }>('POST', '/api/exercises', input),

  // -------------------------------------------------------------- workouts
  createWorkout: (input: WorkoutIn) =>
    request<{ workout: WorkoutDetail }>('POST', '/api/workouts', input),
  updateWorkout: (id: number, input: WorkoutIn) =>
    request<{ workout: WorkoutDetail }>('PATCH', `/api/workouts/${id}`, input),
  publishWorkout: (id: number) => request<PublishResponse>('POST', `/api/workouts/${id}/publish`),
  getWorkout: (id: number) => request<{ workout: WorkoutDetail }>('GET', `/api/workouts/${id}`),
  deleteWorkout: (id: number) => request<void>('DELETE', `/api/workouts/${id}`),
  drafts: () => request<{ items: WorkoutDetail[] }>('GET', '/api/workouts?status=draft'),

  // -------------------------------------------------------------- feed & social
  feed: (scope: FeedScope, cursor?: string) =>
    request<FeedResponse>('GET', `/api/feed${qs({ scope, cursor, limit: 20 })}`),
  like: (workoutId: number) => request<void>('POST', `/api/workouts/${workoutId}/like`),
  unlike: (workoutId: number) => request<void>('DELETE', `/api/workouts/${workoutId}/like`),
  likers: (workoutId: number, cursor?: string) =>
    request<UsersPage>('GET', `/api/workouts/${workoutId}/likes${qs({ cursor, limit: 30 })}`),
  comments: (workoutId: number, cursor?: string) =>
    request<CommentsResponse>('GET', `/api/workouts/${workoutId}/comments${qs({ cursor, limit: 20 })}`),
  addComment: (workoutId: number, body: string) =>
    request<{ comment: CommentOut }>('POST', `/api/workouts/${workoutId}/comments`, { body }),
  deleteComment: (commentId: number) => request<void>('DELETE', `/api/comments/${commentId}`),

  // -------------------------------------------------------------- users
  searchUsers: (q: string) => request<{ users: UserSearchItem[] }>('GET', `/api/users/search${qs({ q, limit: 20 })}`),
  suggestedUsers: () => request<{ users: UserSearchItem[] }>('GET', '/api/users/suggested?limit=8'),
  profile: (username: string) => request<ProfileResponse>('GET', `/api/users/${encodeURIComponent(username)}`),
  userWorkouts: (username: string, cursor?: string) =>
    request<FeedResponse>('GET', `/api/users/${encodeURIComponent(username)}/workouts${qs({ cursor, limit: 20 })}`),
  userStats: (username: string) =>
    request<ProfileStats>('GET', `/api/users/${encodeURIComponent(username)}/stats`),
  userPrs: (username: string) =>
    request<{ prs: PrOut[] }>('GET', `/api/users/${encodeURIComponent(username)}/prs`),
  followers: (username: string, cursor?: string) =>
    request<UsersPage>('GET', `/api/users/${encodeURIComponent(username)}/followers${qs({ cursor, limit: 30 })}`),
  following: (username: string, cursor?: string) =>
    request<UsersPage>('GET', `/api/users/${encodeURIComponent(username)}/following${qs({ cursor, limit: 30 })}`),
  follow: (username: string) => request<void>('POST', `/api/users/${encodeURIComponent(username)}/follow`),
  unfollow: (username: string) => request<void>('DELETE', `/api/users/${encodeURIComponent(username)}/follow`),

  // -------------------------------------------------------------- notifications
  notifications: (cursor?: string) =>
    request<NotificationsResponse>('GET', `/api/notifications${qs({ cursor, limit: 30 })}`),
  markAllRead: () => request<void>('POST', '/api/notifications/read-all'),

  // -------------------------------------------------------------- media
  uploadMedia: async (file: File): Promise<MediaOut> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body: form })
    if (!res.ok) {
      let code = 'internal'
      let message = `Upload failed (${res.status})`
      try {
        const data = (await res.json()) as ApiErrorBody
        code = data.error.code
        message = data.error.message
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, code, message)
    }
    const data = (await res.json()) as { media: MediaOut }
    return data.media
  },
}
