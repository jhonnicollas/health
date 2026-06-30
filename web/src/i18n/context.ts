import { createContext } from 'react'
import { DEFAULT_LOCALE, type SupportedLocale } from './registry'

export type I18nContextType = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: string, fallback?: string) => string
}

export const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
})
