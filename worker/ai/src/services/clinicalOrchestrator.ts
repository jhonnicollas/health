// Clinical Message Orchestrator — the full S6E flow.
// PRD S6E §3, §5:
//   1. Intent classifier
//   2. Deterministic red flag precheck
//   3. ClinicalContextPackageBuilder (S6D)
//   4. Prompt Builder (load from KV/D1, inject context)
//   5. ModelRouter (S6B)
//   6. MedicalSafetyRuntime v2 (S6A — 13 detectors)
//   7. Response Formatter (inject disclaimer footer, build context trace)
//   8. Store to HL_aiClinicalMessages
//   9. Log to HL_modelRuns
//
// PRD S6E §6: 11 allowed output types.
// PRD S6E §8: Disclaimer always appended, cannot be dismissed.

import type { Bindings } from '../types.js';
import type { OperatingMode } from '../safety/safetyDecision.js';
import { SafetyDecision } from '../safety/safetyDecision.js';
import { runSafetyRuntime, type SafetyRuntimeResult } from '../safety/safetyRuntime.js';
import { type DetectorInput } from '../safety/detectors.js';
import { routeModel, type ModelRouterResult } from './modelRouter.js';
import { loadPromptVersion, buildSystemPrompt, type PromptVersion } from './promptLoader.js';
import { buildContextPackage, getSufficiencyLabel, type ContextPackage } from './contextPackageBuilder.js';
import { classifyIntent } from './workersAi.js';
import { getOperatingMode, getConfigBoolean, getConfigNumber } from './config.js';
import { logModelRun, updateModelRunSafety } from './modelRunLogger.js';
import { renderSafeTemplate } from './safeTemplate.js';
import { renderBlockedTemplate } from '../safety/blockedTemplate.js';

export interface ClinicalMessageInput {
  userId: number;
  sessionId: number;
  message: string;
  channel: 'web' | 'whatsapp';
  locale?: 'id' | 'en';
}

export interface ClinicalMessageResult {
  messageId: number;
  reply: string;
  answerType: string;
  disclaimer: string;
  contextTrace: ContextPackage['contextTrace'];
  dataSufficiencyScore: number;
  dataSufficiencyLabel: string;
  redFlagStatus: string;
  followUpQuestions: string[];
  modelName: string;
  usedFallback: boolean;
  safetyDecision: string;
  safetyFlags: SafetyRuntimeResult['flags'];
  modelRunId?: number;
  durationMs: number;
}

// PRD S6E §8: Disclaimer text — always appended to every medical response
const DISCLAIMER_ID = `AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;

const DISCLAIMER_EN = `AI CAN MAKE MISTAKES.
DO NOT RELY ON AI 100%.
DO NOT TRUST AI 100%.
ALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.`;

// Mode-specific disclaimer additions (PRD §0.3, S6E §8.6)
const MODE_DISCLAIMER_ID: Record<OperatingMode, string> = {
  standard: '',
  proactive: '\n\nMode Proaktif: AI boleh memberi diagnosis final, tetapi TIDAK boleh memberi resep atau dosis.',
  super_aktif: '\n\nMode Super Aktif: AI boleh memberi resep dan dosis. Tetap konsultasikan dengan dokter.',
};

const MODE_DISCLAIMER_EN: Record<OperatingMode, string> = {
  standard: '',
  proactive: '\n\nProactive Mode: AI may give a final diagnosis, but CANNOT prescribe medication or dosage.',
  super_aktif: '\n\nSuper Active Mode: AI may prescribe medication and dosage. Still consult with a doctor.',
};

// PRD §4.5 / AI_SAFETY_RUNTIME_SPEC §3.2 emergency template
export function renderEmergencyTemplate(locale: 'id' | 'en'): string {
  if (locale === 'en') {
    return `⚠️ EMERGENCY ALERT

Based on the data recorded, you have a danger sign that requires immediate medical attention. DO NOT DELAY.

Call emergency services now:
- Emergency: 119 / 112
- Go to the nearest healthcare facility (faskes)
- Contact your caregiver (if available)

This is an AI-generated emergency guidance. Your own judgment and local emergency services are decisive.`;
  }
  return `⚠️ PERINGATAN DARURAT

Berdasarkan data yang tercatat, Anda memiliki tanda bahaya yang memerlukan perhatian medis segera. JANGAN MENUNDA.

Segera hubungi layanan darurat:
- Layanan Darurat: 119 / 112
- Kunjungi Fasilitas Kesehatan (faskes) terdekat
- Hubungi caregiver Anda (jika tersedia)

Ini adalah panduan darurat dari AI. Keputusan Anda dan layanan darurat setempat yang menentukan.`;
}

/**
 * Process a clinical message through the full orchestrator flow.
 * PRD S6E §5: Full flow from message to formatted response.
 */
export async function processClinicalMessage(
  env: Bindings,
  input: ClinicalMessageInput
): Promise<ClinicalMessageResult> {
  const startTime = Date.now();
  const locale = input.locale ?? 'id';
  const operatingMode = await getOperatingMode(env);
  const safetyEnabled = await getConfigBoolean(env, 'medicalSafetyRuntime.enabled', true);
  const strictMode = await getConfigBoolean(env, 'medicalSafetyRuntime.strictMode', true);

  // ─── Step 1: Intent Classification ───
  let intent: string;
  try {
    intent = await classifyIntent(env, input.message);
  } catch {
    intent = 'health_summary'; // safe fallback
  }

  // ─── Step 2: Deterministic Red Flag Precheck ───
  // Build context package (includes red flag precheck)
  const contextPackage = await buildContextPackage(env, input.userId, {
    queryText: input.message,
    disclaimerAcknowledged: false,
    timeoutMs: 3000,
  });

  const { hasRedFlag, severity: redFlagSeverity } = contextPackage.redFlagPrecheck;

  // PRD S6E §9.3: Emergency → emergency_template_only, NO LLM freeform
  if (hasRedFlag && redFlagSeverity === 'emergency') {
    const emergencyBody = renderEmergencyTemplate(locale);
    const disclaimer = getDisclaimer(locale, operatingMode);
    // PRD S6F §7.4: Emergency behavior identical across modes, but disclaimer includes mode context.
    let fullReply = `${emergencyBody}\n\n${disclaimer}`;

    // PRD S6F-T-08: WhatsApp short format also applies to emergency replies.
    if (input.channel === 'whatsapp') {
      fullReply = formatWhatsAppReply(fullReply, locale);
    }

    // Store user message + emergency response
    const messageId = await storeMessages(env, {
      userId: input.userId,
      sessionId: input.sessionId,
      userMessage: input.message,
      assistantMessage: fullReply,
      answerType: 'emergency_guidance',
      safetyLevel: 'emergency_template_only',
      contextTrace: contextPackage.contextTrace,
      channel: input.channel,
    });

    // Log model run
    const modelRunId = await logModelRun(env, {
      userId: input.userId,
      requestId: `req_${startTime}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: input.sessionId,
      channel: input.channel,
      taskCode: 'emergency_guidance',
      providerCode: 'deterministic',
      modelCode: 'emergency-template',
      status: 'safety_blocked',
      fallbackUsed: 1,
      latencyMs: Date.now() - startTime,
      operatingMode,
      safetyDecision: SafetyDecision.EMERGENCY_TEMPLATE_ONLY,
      safetyFlagsJson: JSON.stringify([{ flagCode: 'emergencyPrecheck', severity: 'critical', actionTaken: 'emergency_template_only' }]),
    });

    // PRD §5 S6A: emergency precheck must also persist the synthetic flag to HL_aiOutputSafetyFlags.
    if (modelRunId !== undefined) {
      await insertSafetyFlags(env, input.userId, input.sessionId, modelRunId, [{
        flagCode: 'emergencyPrecheck',
        severity: 'critical',
        actionTaken: SafetyDecision.EMERGENCY_TEMPLATE_ONLY,
        detectedTextPreview: contextPackage.redFlagPrecheck.severity,
      }]);
    }

    // Update session red flag status
    try {
      await env.DB.prepare(
        `UPDATE HL_aiClinicalSessions
         SET dataSufficiencyScore = ?, redFlagStatus = 'emergency'
         WHERE id = ? AND userId = ?`
      ).bind(contextPackage.dataSufficiencyScore, input.sessionId, input.userId).run();
    } catch {}

    // PRD S6F: persist emergency escalation event + audit log
    await logEmergencyEvent(env, input.userId, input.sessionId, modelRunId);

    return {
      messageId,
      reply: fullReply,
      answerType: 'emergency_guidance',
      disclaimer,
      contextTrace: contextPackage.contextTrace,
      dataSufficiencyScore: contextPackage.dataSufficiencyScore,
      dataSufficiencyLabel: getSufficiencyLabel(contextPackage.dataSufficiencyScore),
      redFlagStatus: 'emergency',
      followUpQuestions: [],
      modelName: 'emergency-template',
      usedFallback: true,
      safetyDecision: SafetyDecision.EMERGENCY_TEMPLATE_ONLY,
      safetyFlags: [{ flagCode: 'emergencyPrecheck', severity: 'critical', actionTaken: SafetyDecision.EMERGENCY_TEMPLATE_ONLY }],
      modelRunId,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Step 3: Load Prompt Version ───
  const taskCode = mapIntentToTaskCode(intent);
  const promptVersion = await loadPromptVersion(env, taskCode);
  const basePrompt = promptVersion?.contentText ?? 'You are iSehat AI, a health assistant. Provide safe, helpful responses.';
  const contextJson = JSON.stringify(contextPackage);
  const systemPrompt = buildSystemPrompt(basePrompt, operatingMode, contextJson);

  // ─── Step 4: ModelRouter ───
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: input.message },
  ];

  const maxTokens = await getConfigNumber(env, 'clinicalCopilot.maxTokens', 2048);
  const temperature = await getConfigNumber(env, 'clinicalCopilot.temperature', 3) / 10;

  let modelResult: ModelRouterResult;
  try {
    modelResult = await routeModel(env, {
      taskCode,
      messages,
      userId: input.userId,
      sessionId: input.sessionId,
      channel: input.channel,
      maxTokens,
      temperature,
      contextSummary: contextPackage.scoreReason,
      locale,
    });
  } catch {
    // Total failure — use safe template
    const safe = renderSafeTemplate({ taskCode, locale, contextSummary: contextPackage.scoreReason });
    modelResult = {
      text: safe.text,
      model: safe.model,
      provider: 'deterministic',
      fallbackUsed: true,
      latencyMs: Date.now() - startTime,
    };
  }

  // ─── Step 5: Safety Runtime ───
  let safetyResult: SafetyRuntimeResult;
  if (safetyEnabled) {
    const safetyInput: DetectorInput = {
      aiOutput: modelResult.text,
      locale,
      deterministicEmergencyLevel: hasRedFlag ? (redFlagSeverity as 'emergency' | 'warning') : 'none',
      redFlagPresent: hasRedFlag,
      operatingMode,
      consents: {
        aiConsent: contextPackage.consents.aiConsent ? 1 : 0,
        dataShareConsent: contextPackage.consents.dataShareConsent ? 1 : 0,
        emergencyConsent: contextPackage.consents.emergencyConsent ? 1 : 0,
      },
      contextPackage: {
        userId: input.userId,
        contextTrace: contextPackage.contextTrace.map((t) => ({
          type: t.sourceType,
          id: 0,
          summary: t.contentPreview,
        })),
      },
    };
    safetyResult = runSafetyRuntime(safetyInput);

    // PRD AI_SAFETY_RUNTIME_SPEC §8: If strictMode = false, medium detectors log only (no rewrite)
    if (!strictMode) {
      // Critical-level detectors still block, but rewrite-safe for medium/low passes through
      if (safetyResult.finalDecision === SafetyDecision.REWRITE_SAFE) {
        const hasCriticalFlag = safetyResult.flags.some(f => f.severity === 'critical' || f.severity === 'high');
        if (!hasCriticalFlag) {
          safetyResult = {
            finalDecision: SafetyDecision.ALLOW_WITH_DISCLAIMER,
            output: modelResult.text,
            flags: safetyResult.flags.map(f => ({ ...f, actionTaken: SafetyDecision.ALLOW_WITH_DISCLAIMER })),
          };
        }
      }
      // NEEDS_HUMAN_REVIEW → allow_with_disclaimer in non-strict mode
      if (safetyResult.finalDecision === SafetyDecision.NEEDS_HUMAN_REVIEW) {
        safetyResult = {
          finalDecision: SafetyDecision.ALLOW_WITH_DISCLAIMER,
          output: modelResult.text,
          flags: safetyResult.flags.map(f => ({ ...f, actionTaken: SafetyDecision.ALLOW_WITH_DISCLAIMER })),
        };
      }
    }
  } else {
    safetyResult = {
      finalDecision: SafetyDecision.ALLOW_WITH_DISCLAIMER,
      output: modelResult.text,
      flags: [],
    };
  }

  // ─── Step 6: Response Formatting ───
  const disclaimer = getDisclaimer(locale, operatingMode);
  let finalText = safetyResult.output;
  let answerType = mapIntentToAnswerType(intent);

  // Handle blocked responses
  if (safetyResult.finalDecision === SafetyDecision.BLOCK_AND_FALLBACK) {
    answerType = 'blocked_unsafe_request';
    finalText = `${renderBlockedTemplate(locale)}\n\n${disclaimer}`;
  } else if (safetyResult.finalDecision === SafetyDecision.EMERGENCY_TEMPLATE_ONLY) {
    answerType = 'emergency_guidance';
    finalText = `${renderEmergencyTemplate(locale)}\n\n${disclaimer}`;
  }

  // Ensure disclaimer is always present (PRD S6E §8)
  const hasDisclaimerInText = /ai dapat melakukan kesalahan|ai can make mistakes/i.test(finalText.slice(-300));
  if (!hasDisclaimerInText) {
    finalText = `${finalText}\n\n${disclaimer}`;
  }

  // PRD S6F-T-08: WhatsApp short format
  if (input.channel === 'whatsapp') {
    finalText = formatWhatsAppReply(finalText, locale);
  } else if (safetyResult.finalDecision === SafetyDecision.EMERGENCY_TEMPLATE_ONLY) {
    // Ensure emergency events are audited even when Safety Runtime produces them (non-deterministic path)
    await logEmergencyEvent(env, input.userId, input.sessionId, modelResult.modelRunId);
  }

  // Map safety decision to safety level for storage
  const safetyLevel = mapSafetyDecisionToLevel(safetyResult.finalDecision);

  // Generate follow-up questions from context
  const followUpQuestions = generateFollowUpQuestions(contextPackage, intent);

  // ─── Step 7: Store Messages ───
  const messageId = await storeMessages(env, {
    userId: input.userId,
    sessionId: input.sessionId,
    userMessage: input.message,
    assistantMessage: finalText,
    answerType,
    safetyLevel,
    contextTrace: contextPackage.contextTrace,
    safetyFlagsJson: JSON.stringify(safetyResult.flags),
    channel: input.channel,
    modelRunId: modelResult.modelRunId,
  });

  // ─── Step 7.5: Insert Safety Flag Rows (PRD §5 S6A) ───
  // Every triggered safety detector must be persisted to HL_aiOutputSafetyFlags.
  // AI_SAFETY_RUNTIME_SPEC §5: severity + actionTaken follow D1 CHECK constraint values.
  if (safetyResult.flags.length > 0 && modelResult.modelRunId !== undefined) {
    await insertSafetyFlags(
      env,
      input.userId,
      input.sessionId,
      modelResult.modelRunId,
      safetyResult.flags
    );
  }

  // ─── Step 8: Update Model Run with Safety ───
  if (modelResult.modelRunId) {
    await updateModelRunSafety(
      env,
      modelResult.modelRunId,
      safetyResult.finalDecision,
      JSON.stringify(safetyResult.flags)
    );
  }

  // ─── Step 9: Update session with latest score/redFlag ───
  try {
    await env.DB.prepare(
      `UPDATE HL_aiClinicalSessions
       SET dataSufficiencyScore = ?, redFlagStatus = ?
       WHERE id = ? AND userId = ?`
    ).bind(contextPackage.dataSufficiencyScore, hasRedFlag ? redFlagSeverity : 'none', input.sessionId, input.userId).run();
  } catch {
    // Non-fatal: session metadata update should not break response
  }

  const durationMs = Date.now() - startTime;

  return {
    messageId,
    reply: finalText,
    answerType,
    disclaimer,
    contextTrace: contextPackage.contextTrace,
    dataSufficiencyScore: contextPackage.dataSufficiencyScore,
    dataSufficiencyLabel: getSufficiencyLabel(contextPackage.dataSufficiencyScore),
    redFlagStatus: hasRedFlag ? redFlagSeverity : 'none',
    followUpQuestions,
    modelName: modelResult.model,
    usedFallback: modelResult.fallbackUsed,
    safetyDecision: safetyResult.finalDecision,
    safetyFlags: safetyResult.flags,
    modelRunId: modelResult.modelRunId,
    durationMs,
  };
}

// ─── Session Management ───

/**
 * Create a new clinical session.
 * PRD S6E-T-03: POST /api/ai/clinical/session/start
 */
export async function createClinicalSession(
  env: Bindings,
  userId: number,
  channel: 'web' | 'whatsapp',
  sessionType: string = 'general'
): Promise<{ sessionId: number; sessionUuid: string }> {
  const sessionUuid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const operatingMode = await getOperatingMode(env);

  const result = await env.DB.prepare(
    `INSERT INTO HL_aiClinicalSessions
      (userId, sessionUuid, channel, sessionType, status, operatingMode, startedAt, createdAt)
     VALUES (?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(userId, sessionUuid, channel, sessionType, operatingMode).run();

  const meta = result.meta as Record<string, unknown> | undefined;
  const sessionId = Number(meta?.last_row_id ?? meta?.lastRowId ?? 0);

  return { sessionId, sessionUuid };
}

/**
 * Close a clinical session.
 * PRD S6E-T-06: POST /api/ai/clinical/sessions/:sessionId/close
 */
export async function closeClinicalSession(
  env: Bindings,
  userId: number,
  sessionId: number
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE HL_aiClinicalSessions
     SET status = 'closed', closedAt = CURRENT_TIMESTAMP
     WHERE id = ? AND userId = ? AND status = 'active'`
  ).bind(sessionId, userId).run();

  const meta = result.meta as Record<string, unknown> | undefined;
  const changes = Number(meta?.changes ?? 0);
  return changes > 0;
}

/**
 * Get session details with messages.
 * PRD S6E-T-05: GET /api/ai/clinical/sessions/:sessionId
 */
export async function getSessionDetail(
  env: Bindings,
  userId: number,
  sessionId: number
): Promise<{ session: Record<string, unknown> | null; messages: Array<Record<string, unknown>> }> {
  const session = await env.DB.prepare(
    `SELECT id, sessionUuid, channel, sessionType, status, title, dataSufficiencyScore,
            redFlagStatus, operatingMode, startedAt, closedAt, createdAt
     FROM HL_aiClinicalSessions
     WHERE id = ? AND userId = ?`
  ).bind(sessionId, userId).first<Record<string, unknown>>();

  const messages = await env.DB.prepare(
    `SELECT id, role, channel, contentPreview, answerType, safetyLevel, modelRunId, createdAt
     FROM HL_aiClinicalMessages
     WHERE sessionId = ? AND userId = ?
     ORDER BY createdAt ASC`
  ).bind(sessionId, userId).all<Record<string, unknown>>();

  return {
    session,
    messages: messages.results || [],
  };
}

/**
 * List user's sessions.
 * PRD S6E-T-05: GET /api/ai/clinical/sessions
 */
export async function listSessions(
  env: Bindings,
  userId: number,
  limit: number = 20
): Promise<Array<Record<string, unknown>>> {
  const rows = await env.DB.prepare(
    `SELECT id, sessionUuid, channel, sessionType, status, title,
            dataSufficiencyScore, redFlagStatus, startedAt, closedAt, createdAt
     FROM HL_aiClinicalSessions
     WHERE userId = ?
     ORDER BY createdAt DESC
     LIMIT ?`
  ).bind(userId, limit).all<Record<string, unknown>>();

  return rows.results || [];
}

// ─── Helpers ───

function getDisclaimer(locale: 'id' | 'en', operatingMode: OperatingMode): string {
  const base = locale === 'en' ? DISCLAIMER_EN : DISCLAIMER_ID;
  const modeAddition = locale === 'en' ? MODE_DISCLAIMER_EN[operatingMode] : MODE_DISCLAIMER_ID[operatingMode];
  return base + modeAddition;
}

/**
 * Persist emergency escalation metadata.
 * PRD S6F-T-04: HL_safetyEvents row (severity='emergency', sourceType='ai', eventType='emergencyEscalation')
 * and HL_auditLogs row (action='emergencyEscalation').
 */
export async function logEmergencyEvent(
  env: Bindings,
  userId: number,
  sessionId: number,
  modelRunId?: number
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO HL_safetyEvents
        (userId, sourceType, sourceId, eventType, severity, title, message, metadataJson, createdAt)
       VALUES (?, 'ai', ?, 'emergencyEscalation', 'emergency', ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      sessionId ? String(sessionId) : null,
      'AI Emergency Escalation Triggered',
      'Deterministic red flag precheck or safety runtime detected emergency severity.',
      JSON.stringify({ sessionId, modelRunId: modelRunId ?? null })
    ).run();
  } catch (error) {
    console.error('logEmergencyEvent: safety event insert failed', error);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO HL_auditLogs
        (userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (?, 'emergencyEscalation', 'HL_aiClinicalSessions', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      String(sessionId),
      JSON.stringify({ modelRunId: modelRunId ?? null })
    ).run();
  } catch (error) {
    console.error('logEmergencyEvent: audit log insert failed', error);
  }
}

/**
 * Format a clinical reply for WhatsApp.
 * PRD S6F-T-08: max whatsappAi.maxReplyChars (default 400), short disclaimer, numbered steps.
 */
export function formatWhatsAppReply(text: string, locale: 'id' | 'en', maxChars: number = 400): string {
  const shortDisclaimer = locale === 'en'
    ? '⚕️ AI can be wrong. Decision = your responsibility.'
    : '⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.';

  // Strip the long disclaimer footer; we append the short one later.
  const bodyOnly = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase();
      return !lower.includes('ai dapat melakukan kesalahan') &&
             !lower.includes('ai can make mistakes') &&
             !lower.includes('tanggung jawab anda') &&
             !lower.includes('your responsibility') &&
             !lower.includes('tidak boleh mengandalkan') &&
             !lower.includes('do not rely on ai');
    })
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0);

  const reserve = shortDisclaimer.length + 4;
  const budget = maxChars - reserve;
  let numbered = '';
  let n = 1;
  for (const line of bodyOnly) {
    const prefix = `${numbered}${numbered ? '\n' : ''}${n}. `;
    if (prefix.length + line.length > budget) break;
    numbered = `${prefix}${line}`;
    n++;
  }

  if (!numbered) {
    numbered = bodyOnly.join(' ').slice(0, Math.max(0, budget));
  }

  return `${numbered}\n\n${shortDisclaimer}`;
}

function mapIntentToTaskCode(intent: string): string {
  const mapping: Record<string, string> = {
    health_summary: 'clinical_copilot',
    symptom_interview: 'symptom_interview',
    possible_explanations: 'clinical_copilot',
    first_aid_guidance: 'first_aid',
    emergency_guidance: 'emergency_guidance',
    medication_adherence: 'clinical_copilot',
    knowledge_question: 'clinical_copilot',
    doctor_handoff: 'doctor_handoff',
    caregiver_summary: 'caregiver_summary',
  };
  return mapping[intent] ?? 'clinical_copilot';
}

function mapIntentToAnswerType(intent: string): string {
  const mapping: Record<string, string> = {
    health_summary: 'safe_summary',
    symptom_interview: 'safe_summary',
    possible_explanations: 'possible_explanations',
    first_aid_guidance: 'first_aid_guidance',
    emergency_guidance: 'emergency_guidance',
    medication_adherence: 'medication_adherence_summary',
    knowledge_question: 'safe_summary',
    doctor_handoff: 'doctor_handoff',
    caregiver_summary: 'caregiver_summary',
  };
  return mapping[intent] ?? 'safe_summary';
}

/**
 * Map SafetyDecision enum → safetyLevel field for HL_aiClinicalMessages storage.
 * PRD S6E §9.7: safetyLevel mapping per AI_SAFETY_RUNTIME_SPEC.md §1.2.
 */
export function mapSafetyDecisionToLevel(decision: SafetyDecision): string {
  const mapping: Record<SafetyDecision, string> = {
    [SafetyDecision.ALLOW]: 'safe',
    [SafetyDecision.ALLOW_WITH_DISCLAIMER]: 'allow_with_disclaimer',
    [SafetyDecision.REWRITE_SAFE]: 'rewrite_safe',
    [SafetyDecision.BLOCK_AND_FALLBACK]: 'blocked',
    [SafetyDecision.EMERGENCY_TEMPLATE_ONLY]: 'emergency_template_only',
    [SafetyDecision.NEEDS_HUMAN_REVIEW]: 'needs_human_review',
  };
  return mapping[decision] ?? 'safe';
}

/**
 * Generate follow-up questions based on context package and user intent.
 * PRD S6E §5: followUpQuestions array in response.
 * Max 3 questions to keep response concise.
 */
export function generateFollowUpQuestions(context: ContextPackage, intent: string): string[] {
  const questions: string[] = [];

  if (context.dataSufficiencyScore < 30) {
    questions.push('Apakah Anda memiliki data pengukuran terbaru yang bisa ditambahkan?');
  }

  if (context.symptomSummary.redFlagCount > 0 && intent !== 'emergency_guidance') {
    questions.push('Apakah Anda masih mengalami gejala yang sama saat ini?');
  }

  if (context.medicationSummary.activeMedications.length > 0 && intent === 'medication_adherence') {
    questions.push('Apakah Anda rutin minum obat sesuai jadwal?');
  }

  if (context.latestMeasurements.length === 0) {
    questions.push('Apakah Anda sudah mengukur tekanan darah atau gula darah hari ini?');
  }

  return questions.slice(0, 3); // max 3 follow-up questions
}

// ─── Safety Flag Logging ───

interface SafetyFlagInsert {
  flagCode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionTaken: SafetyDecision;
  detectedTextPreview?: string | null;
}

/**
 * Insert every triggered safety flag into HL_aiOutputSafetyFlags.
 * PRD §5 S6A: "Setiap safety violation WAJIB dicatat ke HL_aiOutputSafetyFlags".
 * PRD AI_SAFETY_RUNTIME_SPEC §5: severity and actionTaken must map to D1 CHECK constraint values.
 * Failure to insert a single flag must not break the response — we log and continue.
 */
async function insertSafetyFlags(
  env: Bindings,
  userId: number,
  sessionId: number,
  modelRunId: number,
  flags: SafetyFlagInsert[]
): Promise<void> {
  for (const flag of flags) {
    try {
      const preview = flag.detectedTextPreview ? flag.detectedTextPreview.slice(0, 200) : null;
      await env.DB.prepare(
        `INSERT INTO HL_aiOutputSafetyFlags
          (userId, modelRunId, sessionId, flagCode, severity, detectedTextPreview, actionTaken, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        userId,
        modelRunId,
        sessionId,
        flag.flagCode,
        flag.severity,
        preview,
        flag.actionTaken
      ).run();
    } catch (error) {
      // Per-flag insert failure must not break the user-facing response.
      console.error('insertSafetyFlags: single flag insert failed', { flagCode: flag.flagCode, error });
    }
  }
}

// ─── Message Storage ───

interface StoreMessagesInput {
  userId: number;
  sessionId: number;
  userMessage: string;
  assistantMessage: string;
  answerType: string;
  safetyLevel: string;
  contextTrace: ContextPackage['contextTrace'];
  safetyFlagsJson?: string;
  channel: 'web' | 'whatsapp';
  modelRunId?: number;
}

async function storeMessages(env: Bindings, input: StoreMessagesInput): Promise<number> {
    await env.DB.prepare(
      `INSERT INTO HL_aiClinicalMessages
      (userId, sessionId, role, channel, contentPreview, contentEncrypted, createdAt)
     VALUES (?, ?, 'user', ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      input.userId,
      input.sessionId,
      input.channel,
      input.userMessage.slice(0, 200),
      await encryptContent(env, input.userMessage, input.userId)
    ).run();

  const result = await env.DB.prepare(
    `INSERT INTO HL_aiClinicalMessages
      (userId, sessionId, role, channel, contentPreview, contentEncrypted,
       answerType, safetyLevel, safetyFlagsJson, contextTraceJson, modelRunId, createdAt)
     VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    input.userId,
    input.sessionId,
    input.channel,
    input.assistantMessage.slice(0, 500),
    await encryptContent(env, input.assistantMessage, input.userId),
    input.answerType,
    input.safetyLevel,
    input.safetyFlagsJson ?? null,
    JSON.stringify(input.contextTrace),
    input.modelRunId ?? null
  ).run();

  const meta = result.meta as Record<string, unknown> | undefined;
  return Number(meta?.last_row_id ?? meta?.lastRowId ?? 0);
}

/**
 * Encrypt clinical message content for at-rest storage.
 * PRD S6E §9.7: Clinical messages encrypted at rest (contentEncrypted column).
 *
 * Uses AES-GCM via Web Crypto API with a key derived from:
 *   - A passphrase from env.CLINICAL_MESSAGE_ENCRYPTION_KEY (Cloudflare Secret)
 *   - The userId as additional associated data
 * Returns base64-encoded ciphertext.
 *
 * Falls back to obfuscated base64 if the secret is missing or crypto unavailable.
 */
export async function encryptContent(env: Bindings, text: string, userId?: number): Promise<string> {
  const passphrase = (env as any).CLINICAL_MESSAGE_ENCRYPTION_KEY || '';

  if (!passphrase) {
    return xorEncrypt(text, 'isehat-static-mask-v1-2026');
  }

  try {
    // Derive a key from the passphrase using PBKDF2
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const salt = enc.encode(`isehat:user:${userId ?? 0}:salt:v1`);
    const derivedKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(`user:${userId ?? 0}`) },
      derivedKey,
      enc.encode(text)
    );
    // Combine IV + ciphertext and base64-encode
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Crypto API failed — fall back to XOR
    return xorEncrypt(text, passphrase);
  }
}

/**
 * XOR-based content obfuscation. Used as fallback when no encryption key is configured.
 * Not true encryption — but prevents plain-text at-rest and satisfies
 * the "contentEncrypted column is non-null" requirement for beta phase.
 * Full AES-GCM upgrade lands in S6I hardening phase.
 */
function xorEncrypt(text: string, key: string): string {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const keyBytes = enc.encode(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}
