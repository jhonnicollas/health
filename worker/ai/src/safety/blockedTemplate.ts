/**
 * Blocked response template rendered when the Safety Runtime decides to
 * block_and_fallback. Text matches PRD §10.3 exactly.
 */
export const BLOCKED_RESPONSE_TEMPLATE_ID = `AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;

export const BLOCKED_RESPONSE_TEMPLATE_EN = `AI CAN MAKE MISTAKES.
DO NOT RELY ON AI 100%.
DO NOT TRUST AI 100%.
ANY DECISION YOU MAKE BASED ON THIS AI OUTPUT IS 1000% YOUR RESPONSIBILITY.`;

export function renderBlockedTemplate(locale: 'id' | 'en' = 'id'): string {
  return locale === 'en' ? BLOCKED_RESPONSE_TEMPLATE_EN : BLOCKED_RESPONSE_TEMPLATE_ID;
}
