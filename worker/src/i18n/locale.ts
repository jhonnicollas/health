export const SUPPORTED_LOCALES = ['id-ID', 'en-US'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: SupportedLocale = 'id-ID'
export const FALLBACK_LOCALE: SupportedLocale = 'en-US'

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  if (!input) return DEFAULT_LOCALE
  const lower = input.toLowerCase().trim()
  if (lower.startsWith('id')) return 'id-ID'
  if (lower.startsWith('en')) return 'en-US'
  return DEFAULT_LOCALE
}

export function parseLocale(headers: Headers): SupportedLocale {
  const xHlLocale = headers.get('X-HL-Locale')
  if (xHlLocale) return normalizeLocale(xHlLocale)
  const acceptLang = headers.get('Accept-Language')
  if (acceptLang) {
    const first = acceptLang.split(',')[0]?.trim()
    if (first) return normalizeLocale(first)
  }
  return DEFAULT_LOCALE
}
