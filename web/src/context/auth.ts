import { createContext, useContext } from 'react'

export type User = {
  id: string
  email: string
  displayName: string
  telegramEnabled: boolean
  browserPushEnabled: boolean
}

export type Profile = {
  id: string
  sex: string
  birthDate: string
  heightCm: number
  timezone: string
  accessibilityMode: string
  theme: string
} | null

export type AuthState = {
  user: User | null
  profile: Profile
  requiresOnboarding: boolean
}

export type AuthContextValue = AuthState & {
  loading: boolean
  refresh: () => Promise<void>
  setAuthenticated: (state: AuthState) => void
}

export type AuthResponse = {
  success: boolean
  data?: AuthState
}

export const emptyAuthState: AuthState = {
  user: null,
  profile: null,
  requiresOnboarding: false
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
