// PLACEHOLDER — owned by agent C1 (client-shell). Replace the implementation;
// keep AuthProvider/useAuth and the AuthState shape EXACTLY (App.tsx and every
// page compiles against them). On mount: api.me() -> user or null (loading until
// resolved). login/register set user; logout clears it.
import { createContext, useContext, type ReactNode } from 'react'
import type { Unit, UserSelf } from '../../shared/types'

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
  throw new Error('not implemented')
  // eslint-disable-next-line no-unreachable
  return <AuthContext.Provider value={null as never}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
