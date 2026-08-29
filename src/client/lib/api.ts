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

/** Where the API lives. Empty (default) = same origin, i.e. the web app served
 * by the Express server. The Capacitor iOS shell bakes in a remote server via
 * VITE_API_BASE at build time. */
export const API_BASE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''

/** Absolute URL for a server-relative asset path like "/uploads/x.jpg". */
export function assetUrl(path: string): string {
  return path.startsWith('/') ? `${API_BASE}${path}` : path
}

// Bearer token for the native shell, where cross-origin cookies are unreliable.
// The browser SPA is same-origin and keeps using the httpOnly cookie; storing
// the token as well is harmless there.
const TOKEN_KEY = 'chalk.token'

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...authHeaders(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
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
  register: async (input: { username: string; password: string; displayName?: string; unitPreference?: Unit }) => {
    const r = await request<{ user: UserSelf; token?: string }>('POST', '/api/auth/register', input)
    setToken(r.token ?? null)
    return r
  },
  login: async (username: string, password: string) => {
    const r = await request<{ user: UserSelf; token?: string }>('POST', '/api/auth/login', { username, password })
    setToken(r.token ?? null)
    return r
  },
  logout: async () => {
    try {
      await request<void>('POST', '/api/auth/logout')
    } finally {
      setToken(null)
    }
  },
  me: () => request<{ user: UserSelf }>('GET', '/api/auth/me'),
  patchMe: (input: { displayName?: string; bio?: string; unitPreference?: Unit }) =>
    request<{ user: UserSelf }>('PATCH', '/api/users/me', input),
  deleteAccount: async (password: string) => {
    await request<void>('DELETE', '/api/users/me', { password })
    setToken(null)
  },

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
    const res = await fetch(`${API_BASE}/api/media`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
      body: form,
    })
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
