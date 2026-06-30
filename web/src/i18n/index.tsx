import { useState, useCallback, useEffect } from 'react'
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  translations,
} from './registry'
import { I18nContext } from './context'
import './loadLocales'

const LOCALE_STORAGE_KEY = 'hl_locale'

function detectLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) return stored as SupportedLocale
  } catch { /* ignore */ }
  const browser = navigator.language
  if (browser?.startsWith('en')) return 'en-US'
  return DEFAULT_LOCALE
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => detectLocale())

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next)
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch { /* ignore */ }
    document.documentElement.lang = next
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    // Inject Accept-Language header into all fetch calls so the backend can localize
    const origFetch = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      // Only inject Accept-Language for same-origin API calls
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input instanceof Request ? input.url : ''))
      if (url && !url.startsWith('/') && !url.startsWith(window.location.origin)) return origFetch(input, init)
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      if (!headers.has('Accept-Language')) headers.set('Accept-Language', locale)
      return origFetch(input, { ...init, headers })
    }
    return () => { window.fetch = origFetch }
  }, [locale])

  const t = useCallback((key: string, fallback?: string) => {
    const parts = key.split('.')
    const namespace = parts[0]
    const translationKey = parts.slice(1).join('.')
    const ns = translations[namespace]
    if (!ns) return fallback ?? key
    const entry = ns[translationKey]
    if (!entry) return fallback ?? key
    return entry[locale] ?? entry[FALLBACK_LOCALE] ?? fallback ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

