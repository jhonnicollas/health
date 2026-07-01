// ModelRouter service — orchestrates AI model routing through a fallback chain.
// PRD §3 S6B Provider Chain:
//   Primary  : AI Gateway (9router custom provider, model: deepseek-v4-flash-free)
//   Fallback1: Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
//   Fallback2: Workers AI (@cf/meta/llama-3.1-8b-instruct)
//   Fallback3: Deterministic safe template (no LLM)
// PRD §3 S6B AC1: ModelRouter routes to AI Gateway (9router) as primary path.
// PRD §3 S6B AC2: If 9router fails, falls back to Workers AI.
// PRD §3 S6B AC3: If Workers AI fails, falls back to deterministic safe template.

import type { Bindings } from '../types.js';
import { getConfigBoolean, getOperatingMode } from './config.js';
import { callAiGateway, callDirect9router, get9routerConfig, type ChatMessage } from './aiGateway.js';
import { callWorkersAiText, FALLBACK_MODEL_1, FALLBACK_MODEL_2 } from './workersAi.js';
import { loadPromptVersion, type PromptVersion } from './promptLoader.js';
import { renderSafeTemplate } from './safeTemplate.js';
import { logModelRun } from './modelRunLogger.js';

export interface ModelRouterInput {
  taskCode: string;
  messages: ChatMessage[];
  userId: number | null;
  sessionId?: number;
  channel: 'web' | 'whatsapp' | 'internal';
  maxTokens?: number;
  temperature?: number;
  contextSummary?: string;
  locale?: 'id' | 'en';
}

export interface ModelRouterResult {
  text: string;
  model: string;
  provider: string;
  fallbackUsed: boolean;
  inputTokenCount?: number;
  outputTokenCount?: number;
  latencyMs: number;
  modelRunId?: number;
}

/**
 * Route a model call through the provider chain.
 * PRD §3 S6B: 9router → Workers AI (llama-3.3-70b) → Workers AI (llama-3.1-8b) → safe template
 * Every call is logged to HL_modelRuns (PRD §3 S6B AC4).
 */
export async function routeModel(
  env: Bindings,
  input: ModelRouterInput
): Promise<ModelRouterResult> {
  const startTime = Date.now();
  const maxTokens = input.maxTokens ?? 2048;
  const temperature = input.temperature ?? 0.3;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const fallbackEnabled = await getConfigBoolean(env, 'aiGateway.fallback.enabled', true);
  const operatingMode = await getOperatingMode(env);
  const promptVersionRow = await loadPromptVersion(env, input.taskCode)
    .catch(() => null) as PromptVersion | null;
  const promptVersion = promptVersionRow?.version;

  let status: 'success' | 'timeout' | 'error' | 'fallback' = 'success';
  let fallbackUsed = false;
  let inputTokenCount: number | undefined;
  let outputTokenCount: number | undefined;
  let resultText = '';
  let actualModel = '';
  let actualProvider = '';

  // Tier 1: AI Gateway → 9router
  const router9 = await get9routerConfig(env);
  if (router9.enabled) {
    const gatewayResult = await callAiGateway(env, {
      messages: input.messages,
      maxTokens,
      temperature,
      model: router9.model,
      provider: router9.slug,
    });

    if (gatewayResult) {
      resultText = gatewayResult.text;
      actualModel = gatewayResult.model;
      actualProvider = '9router';
      inputTokenCount = gatewayResult.inputTokenCount;
      outputTokenCount = gatewayResult.outputTokenCount;
    } else {
      // 9router failed — move to fallback
      status = 'fallback';
      fallbackUsed = true;
    }
  } else {
    status = 'fallback';
    fallbackUsed = true;
  }

  // Tier 2: Direct 9router fallback (dev/emergency, bypasses AI Gateway)
  if (!resultText) {
    const directResult = await callDirect9router(env, {
      messages: input.messages,
      maxTokens,
      temperature,
      model: router9.model,
      provider: router9.slug,
    });
    if (directResult) {
      resultText = directResult.text;
      actualModel = directResult.model;
      actualProvider = directResult.provider;
      status = 'fallback';
      fallbackUsed = true;
    }
  }

  // Tier 3: Workers AI llama-3.3-70b
  if (!resultText && fallbackEnabled) {
    const waResult1 = await callWorkersAiText(
      env,
      input.messages,
      FALLBACK_MODEL_1,
      maxTokens,
      temperature
    );

    if (waResult1) {
      resultText = waResult1.text;
      actualModel = waResult1.model;
      actualProvider = waResult1.provider;
    } else {
      // Tier 3: Workers AI llama-3.1-8b
      const waResult2 = await callWorkersAiText(
        env,
        input.messages,
        FALLBACK_MODEL_2,
        maxTokens,
        temperature
      );

      if (waResult2) {
        resultText = waResult2.text;
        actualModel = waResult2.model;
        actualProvider = waResult2.provider;
      } else {
        // Tier 4: Deterministic safe template
        status = 'fallback';
        const safe = renderSafeTemplate({
          taskCode: input.taskCode,
          locale: input.locale,
          contextSummary: input.contextSummary,
        });
        resultText = safe.text;
        actualModel = safe.model;
        actualProvider = 'deterministic';
      }
    }
  }

  // Tier 4 (no fallback enabled): safe template
  if (!resultText) {
    status = 'fallback';
    const safe = renderSafeTemplate({
      taskCode: input.taskCode,
      locale: input.locale,
      contextSummary: input.contextSummary,
    });
    resultText = safe.text;
    actualModel = safe.model;
    actualProvider = 'deterministic';
  }

  const latencyMs = Date.now() - startTime;

  // Log to HL_modelRuns (PRD §3 S6B AC4: every call logged)
  const modelRunId = await logModelRun(env, {
    userId: input.userId,
    requestId,
    sessionId: input.sessionId,
    channel: input.channel,
    taskCode: input.taskCode,
    providerCode: actualProvider,
    modelCode: actualModel,
    promptVersion: promptVersion ?? undefined,
    status,
    fallbackUsed: fallbackUsed ? 1 : 0,
    inputTokenCount,
    outputTokenCount,
    latencyMs,
    operatingMode,
  });

  return {
    text: resultText,
    model: actualModel,
    provider: actualProvider,
    fallbackUsed,
    inputTokenCount,
    outputTokenCount,
    latencyMs,
    modelRunId,
  };
}
