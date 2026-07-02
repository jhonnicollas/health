// Forbidden-claim pre-scan. Deterministic + case-insensitive substring match
// over a fixed regex set. Used by IdeaService.generate and DraftService.generate
// before inserting rows so we never persist a claim the platform forbids.
// ponytail: regex list is the spec; no AI judge here. Anything subtle lives
// in the safety_check job later.

export interface PrescanResult {
  blocked: boolean;
  blockedReasons: string[];
}

interface ScanInput {
  title?: string;
  angle?: string;
  primaryHook?: string;
  mainContent?: string;
  caption?: string;
  painPoint?: string;
}

const RULES: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'doctor_replacement', pattern: /doctor\s*replac(e|ement|ing)/i },
  { id: 'ai_doctor', pattern: /\bai\s*doctor\b/i },
  { id: 'final_diagnosis', pattern: /(final\s*diagnosis|guaranteed\s*diagnosis|definitive\s*diagnosis)/i },
  { id: 'prescription', pattern: /prescri(be|ption|bed)/i },
  { id: 'dosage', pattern: /dos(age|ing)\s*(instruction|recommendation|guide)/i },
  { id: 'emergency_authority', pattern: /(emergency\s*authority|act\s*as\s*emergency)/i },
  { id: 'guaranteed_outcome', pattern: /(guaranteed?\s*(cure|outcome|recovery|heal))/i },
  { id: 'accuracy_100', pattern: /100\s*%\s*(medical\s*)?(accuracy|cure|effective)/i },
  { id: 'cure', pattern: /(cure[ds]?|cures)\s+(cancer|diabetes|disease|illness)/i },
  { id: 'prevention', pattern: /(prevents?|preventing)\s+(cancer|diabetes|disease|illness|covid)/i },
];

function flatten(input: ScanInput): string {
  return [
    input.title ?? '',
    input.angle ?? '',
    input.primaryHook ?? '',
    input.mainContent ?? '',
    input.caption ?? '',
    input.painPoint ?? '',
  ].join('\n');
}

function detect(body: string): string[] {
  const reasons: string[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(body)) reasons.push(`forbidden:${rule.id}`);
  }
  return reasons;
}

export function prescanIdea(item: {
  title?: string;
  angle?: string;
  painPoint?: string;
}): PrescanResult {
  const reasons = detect(flatten(item));
  return { blocked: reasons.length > 0, blockedReasons: reasons };
}

export function prescanDraft(draft: {
  title?: string;
  primaryHook?: string;
  mainContent?: string;
  caption?: string;
}): PrescanResult {
  const reasons = detect(flatten(draft));
  return { blocked: reasons.length > 0, blockedReasons: reasons };
}
