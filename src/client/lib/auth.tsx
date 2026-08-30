// Auth context: session state via api.me() on mount; login/register/logout.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Unit, UserSelf } from '../../shared/types'
import { api } from './api'

export interface AuthState {
  user: UserSelf | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (input: { username: string; password: string; displayName?: string; unitPreference?: Unit }) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: UserSelf | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSelf | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password)
    setUser(r.user)
  }, [])

  const register = useCallback(
    async (input: { username: string; password: string; displayName?: string; unitPreference?: Unit }) => {
      const r = await api.register(input)
      setUser(r.user)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
