// AI Gateway REST API caller.
// PRD §8.14: AI Gateway does NOT use Service Binding. Called via REST API.
// POST https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/{provider}/chat/completions
// Headers: Authorization: Bearer {CLOUDFLARE_API_TOKEN}

import type { ConfigBindings } from './config.js';
import { getConfigString, getConfigBoolean, getConfigNumber } from './config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGatewayCallInput {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  model: string;
  provider: string; // e.g. '9router'
}

export interface AiGatewayCallResult {
  text: string;
  model: string;
  provider: string;
  inputTokenCount?: number;
  outputTokenCount?: number;
  latencyMs: number;
}

export interface AiGatewayBindings {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  '9ROUTER_API_KEY'?: string;
}

/**
 * Call AI Gateway REST API.
 * Returns null on failure (caller handles fallback).
 * PRD §8.14 AC6: Gateway logs must minimize medical payload.
 * Cloudflare AI Gateway dashboard handles payload truncation in gateway logs;
 * this code does not truncate the request body (full content is sent to the
 * provider for quality, but gateway-side log settings minimize stored payload).
 */
export async function callAiGateway(
  env: ConfigBindings & AiGatewayBindings,
  input: AiGatewayCallInput
): Promise<AiGatewayCallResult | null> {
  const startTime = Date.now();

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const gatewayId = await getConfigString(env, 'aiGateway.gatewayId');

  if (!accountId || !apiToken || !gatewayId) {
    return null; // Not configured — caller falls back
  }

  const gatewayEnabled = await getConfigBoolean(env, 'aiGateway.enabled', true);
  if (!gatewayEnabled) return null;

  const timeoutMs = await getConfigNumber(env, 'aiGateway.retry.timeoutMs', 10000);
  const maxRetries = await getConfigNumber(env, 'aiGateway.retry.maxRetries', 2);

  const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${input.provider}/chat/completions`;

  const body = JSON.stringify({
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    stream: false,
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Non-retryable errors: 4xx (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return null;
        }
        // Retryable: 429, 5xx
        if (attempt < maxRetries) continue;
        return null;
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = payload.choices?.[0]?.message?.content?.trim()
        || payload.choices?.[0]?.text?.trim()
        || '';

      if (!text) {
        if (attempt < maxRetries) continue;
        return null;
      }

      return {
        text,
        model: input.model,
        provider: input.provider,
        inputTokenCount: payload.usage?.prompt_tokens,
        outputTokenCount: payload.usage?.completion_tokens,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      // Timeout or network error — retry if attempts remain
      if (attempt < maxRetries) continue;
      return null;
    }
  }

  return null;
}

/**
 * Call 9router directly as dev/emergency fallback, bypassing AI Gateway.
 * PRD §8.14 AC4: Direct 9router allowed only if aiGateway.directFallback.enabled = true.
 */
export async function callDirect9router(
  env: ConfigBindings & AiGatewayBindings,
  input: AiGatewayCallInput
): Promise<AiGatewayCallResult | null> {
  const directEnabled = await getConfigBoolean(env, 'aiGateway.directFallback.enabled', false);
  if (!directEnabled) return null;

  const baseUrl = await getConfigString(env, '9router.baseUrl') || 'https://9router.krpmerch.biz.id/v1';
  const apiKey = env['9ROUTER_API_KEY'];
  if (!apiKey) return null;

  const timeoutMs = await getConfigNumber(env, 'aiGateway.retry.timeoutMs', 10000);
  const startTime = Date.now();

  const url = `${baseUrl}/chat/completions`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = payload.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return null;

    return {
      text,
      model: input.model,
      provider: '9router-direct',
      inputTokenCount: payload.usage?.prompt_tokens,
      outputTokenCount: payload.usage?.completion_tokens,
      latencyMs: Date.now() - startTime,
    };
  } catch {
    return null;
  }
}

/**
 * Get the 9router provider configuration.
 * PRD §8.14: 9router is a custom provider registered in AI Gateway dashboard.
 * API key is stored in Cloudflare Secrets (9ROUTER_API_KEY), never in D1.
 */
export async function get9routerConfig(env: ConfigBindings): Promise<{
  slug: string;
  model: string;
  enabled: boolean;
}> {
  const slug = await getConfigString(env, 'aiGateway.customProvider.9router.slug') || '9router';
  const enabled = await getConfigBoolean(env, 'aiGateway.customProvider.9router.enabled', true);
  const model = await getConfigString(env, '9router.defaultModel') || 'oc/deepseek-v4-flash-free';
  return { slug, model, enabled };
}
