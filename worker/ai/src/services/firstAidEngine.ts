// First Aid Protocol Engine — S6F-T-06/T-07
// PRD S6F §5: deterministic first-aid guidance from approved HL_firstAidProtocols.

import type { Bindings } from '../types.js';

export interface FirstAidProtocol {
  id: number;
  protocolCode: string;
  locale: 'id' | 'en';
  title: string;
  triggerKeywordsJson: string;
  redFlagsJson: string;
  doStepsJson: string;
  dontStepsJson: string;
  seekHelpNowJson: string;
  reviewerStatus: string;
  contentVersion: string;
}

export interface FirstAidLookupInput {
  keyword: string;
  locale?: 'id' | 'en';
}

export interface FirstAidRenderInput {
  protocol: FirstAidProtocol;
  locale?: 'id' | 'en';
}

const FALLBACK_ID = `Panduan P3K tidak tersedia untuk kata kunci tersebut.

Jika ini keadaan darurat, segera hubungi 119/112 atau kunjungi fasilitas kesehatan terdekat.

⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.`;

const FALLBACK_EN = `First-aid guidance is not available for that keyword.

If this is an emergency, call 119/112 or go to the nearest healthcare facility immediately.

⚕️ AI can be wrong. Decision = your responsibility.`;

/**
 * Lookup an approved first-aid protocol by keyword (case-insensitive).
 * PRD S6F-T-06: queries HL_firstAidProtocols where triggerKeywordsJson contains keyword
 * and reviewerStatus='approved'. Returns best matching protocol.
 */
export async function lookupFirstAidProtocol(
  env: Bindings,
  keyword: string,
  locale: 'id' | 'en' = 'id'
): Promise<FirstAidProtocol | null> {
  if (!keyword || keyword.trim().length === 0) return null;

  try {
    const rows = await env.DB.prepare(
      `SELECT id, protocolCode, locale, title, triggerKeywordsJson, redFlagsJson,
              doStepsJson, dontStepsJson, seekHelpNowJson, reviewerStatus, contentVersion
       FROM HL_firstAidProtocols
       WHERE locale = ? AND reviewerStatus = 'approved'`
    ).bind(locale).all<FirstAidProtocol>();

    const lowerKeyword = keyword.toLowerCase();
    const candidates = (rows.results || []).filter((p) => {
      try {
        const keywords = JSON.parse(p.triggerKeywordsJson || '[]') as string[];
        return keywords.some((k) => lowerKeyword.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerKeyword));
      } catch {
        return false;
      }
    });

    if (candidates.length === 0) return null;

    // Prefer exact keyword match, then shortest keyword (more specific)
    candidates.sort((a, b) => {
      const aKeywords = JSON.parse(a.triggerKeywordsJson || '[]') as string[];
      const bKeywords = JSON.parse(b.triggerKeywordsJson || '[]') as string[];
      const aExact = aKeywords.some((k) => k.toLowerCase() === lowerKeyword) ? 0 : 1;
      const bExact = bKeywords.some((k) => k.toLowerCase() === lowerKeyword) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return aKeywords.join('').length - bKeywords.join('').length;
    });

    return candidates[0];
  } catch (error) {
    console.error('lookupFirstAidProtocol failed:', error);
    return null;
  }
}

function parseJsonArray(value: string): string[] {
  try {
    return JSON.parse(value || '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * Render an approved first-aid protocol as structured text.
 * PRD S6F-T-07: red flags at top, then DO (green), DON'T (red), SEEK HELP NOW (orange).
 * Includes reviewerStatus footer.
 */
export function renderFirstAidProtocol(
  protocol: FirstAidProtocol,
  locale: 'id' | 'en' = 'id'
): string {
  const redFlags = parseJsonArray(protocol.redFlagsJson);
  const doSteps = parseJsonArray(protocol.doStepsJson);
  const dontSteps = parseJsonArray(protocol.dontStepsJson);
  const seekHelp = parseJsonArray(protocol.seekHelpNowJson);

  const labels = locale === 'en'
    ? { redFlags: 'RED FLAGS', do: 'DO', dont: "DON'T", seek: 'SEEK HELP NOW', footer: 'Reviewer status' }
    : { redFlags: 'TANDA BAHAYA', do: 'LAKUKAN', dont: 'JANGAN DILAKUKAN', seek: 'SEGERA CARI BANTUAN', footer: 'Status reviewer' };

  const lines: string[] = [];
  lines.push(protocol.title);
  lines.push('');

  if (redFlags.length > 0) {
    lines.push(`🔴 ${labels.redFlags}`);
    redFlags.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }

  if (doSteps.length > 0) {
    lines.push(`🟢 ${labels.do}`);
    doSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  if (dontSteps.length > 0) {
    lines.push(`🔴 ${labels.dont}`);
    dontSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  if (seekHelp.length > 0) {
    lines.push(`🟠 ${labels.seek}`);
    seekHelp.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  lines.push(`${labels.footer}: ${protocol.reviewerStatus} v${protocol.contentVersion}`);

  return lines.join('\n');
}

/**
 * Render safe fallback text when no approved protocol matches.
 */
export function renderFirstAidFallback(locale: 'id' | 'en' = 'id'): string {
  return locale === 'en' ? FALLBACK_EN : FALLBACK_ID;
}
