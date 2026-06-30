export const SUPPORTED_LOCALES = ['id-ID', 'en-US'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: SupportedLocale = 'id-ID'
export const FALLBACK_LOCALE: SupportedLocale = 'en-US'

// Translation maps: namespace → key → locale → string
export type TranslationMap = Record<string, Record<string, Record<SupportedLocale, string>>>

export const translations: TranslationMap = {}

export function registerTranslations(
  namespace: string,
  data: Record<string, Record<SupportedLocale, string>>,
) {
  translations[namespace] = data
}
