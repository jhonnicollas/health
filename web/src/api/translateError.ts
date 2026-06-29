import { type SupportedLocale } from '../i18n'
import { getErrorMessage } from '../i18n/locales/errors'

/**
 * Translate an API error code to a localized message.
 * Falls back to the API-provided message if the code is unknown.
 */
export function translateErrorCode(code: string, locale: SupportedLocale = 'id-ID', fallback?: string): string {
  const entry = getErrorMessage(code, locale)
  if (entry === code && fallback) return fallback
  return entry
}
