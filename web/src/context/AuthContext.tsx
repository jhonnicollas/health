import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import type { ReactNode } from 'react'
import {
  AuthContext,
  emptyAuthState
} from './auth'
import type { AuthContextValue, AuthResponse, AuthState } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(emptyAuthState)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      })
      const body = (await response.json()) as AuthResponse

      if (response.ok && body.success && body.data) {
        setState(body.data)
      } else {
        setState(emptyAuthState)
      }
    } catch {
      setState(emptyAuthState)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Auth bootstrap synchronizes React state with the external HTTP-only session cookie.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  useEffect(() => {
    document.documentElement.dataset.theme = state.profile?.theme ?? 'light'
    document.documentElement.dataset.accessibility =
      state.profile?.accessibilityMode ?? 'normal'
  }, [state.profile])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      loading,
      refresh,
      setAuthenticated: setState
    }),
    [loading, refresh, state]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
