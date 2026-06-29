import type { SupportedLocale } from './locale.js'

export const AI_DISCLAIMER: Record<SupportedLocale, string> = {
  'id-ID': '⚠️ Disclaimer: AI bukan pengganti dokter. Selalu konsultasi profesional kesehatan untuk keputusan medis.',
  'en-US': '⚠️ Disclaimer: AI is not a substitute for doctors. Always consult a healthcare professional for medical decisions.',
}

export function getAiDisclaimer(locale: SupportedLocale): string {
  return AI_DISCLAIMER[locale] ?? AI_DISCLAIMER['id-ID']
}
