import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  const booted = useRef(false)

  const refresh = useCallback(async () => {
    if (!booted.current) setLoading(true)

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
      booted.current = true
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* ignore */ }
    setState(emptyAuthState)
  }, [])

  // ponytail: global 401 interceptor via fetch patch. upgrade to service worker if we need offline support.
  useEffect(() => {
    const origFetch = window.fetch
    window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
      const res = await origFetch.apply(this, args)
      if (res.status === 401) setState(emptyAuthState)
      return res
    }
    return () => { window.fetch = origFetch }
  }, [])

  useEffect(() => {
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
      setAuthenticated: setState,
      logout
    }),
    [loading, refresh, state, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
