// AI provider abstraction: factory, config selection, JSON parsing, timeout.
// Ponytail: keep this layer thin. Real provider adapters live in their own files.

import { AppError, errorCodes } from '../utils/errors.js';
import type {
  AiConfigRow,
  AiGenerateResult,
  AiProvider,
  AiProviderName,
} from '../types/ai.js';
import { MockProvider } from './mock-provider.js';

export const AI_PROVIDER_NAMES: ReadonlySet<AiProviderName> = new Set([
  'mock',
  'openai',
  'google',
  'anthropic',
  'workersai',
]);

export function createProvider(name: AiProviderName): AiProvider {
  switch (name) {
    case 'mock':
      return new MockProvider();
    // ponytail: real adapters land in their own files; throwing here keeps
    // the abstraction honest until then.
    default:
      throw new AppError(
        errorCodes.AI_PROVIDER_FAILED,
        `Provider not implemented: ${name}`,
        500
      );
  }
}

// Select the lowest fallbackOrder (highest priority) active config.
// Returns null when no active config exists.
export function selectConfig(configs: AiConfigRow[]): AiConfigRow | null {
  let best: AiConfigRow | null = null;
  for (const cfg of configs) {
    if (!cfg.isActive) continue;
    if (best === null || cfg.fallbackOrder < best.fallbackOrder) {
      best = cfg;
    }
  }
  return best;
}

// Run the provider call with a hard timeout. timeoutMs on config overrides default.
export async function generateWithProvider<T>(
  provider: AiProviderName,
  config: AiConfigRow,
  promptText: string
): Promise<AiGenerateResult<T>> {
  const impl = createProvider(provider);
  const timeoutMs = typeof config.timeoutMs === 'number' && config.timeoutMs > 0
    ? config.timeoutMs
    : 30000;

  try {
    return await Promise.race([
      impl.generateJson<T>(config, promptText),
      buildTimeoutPromise<AiGenerateResult<T>>(timeoutMs),
    ]);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      errorCodes.AI_PROVIDER_FAILED,
      e instanceof Error ? e.message : 'AI provider call failed',
      502
    );
  }
}

// Parses JSON from raw AI output. Tries direct parse, then a regex extract of
// the first JSON object/array inside triple-backtick fences, then gives up.
// ponytail: one parse attempt + one fence extract. Multi-stage repair is
// out of scope here; callers can retry via a separate repair helper.
export function parseJson<T>(rawText: string): { data: T; repaired: boolean } {
  if (typeof rawText !== 'string') {
    throw new AppError(
      errorCodes.AI_PROVIDER_FAILED,
      'Invalid JSON from AI provider',
      502
    );
  }
  try {
    return { data: JSON.parse(rawText) as T, repaired: false };
  } catch {
    // try to pull the first {...} or [...] block out of a ``` fence
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return { data: JSON.parse(fenced[1].trim()) as T, repaired: true };
      } catch {
        // fall through
      }
    }
    // last resort: first balanced top-level object/array
    const inline = extractFirstJson(rawText);
    if (inline !== null) {
      try {
        return { data: JSON.parse(inline) as T, repaired: true };
      } catch {
        // fall through
      }
    }
    throw new AppError(
      errorCodes.AI_PROVIDER_FAILED,
      'Invalid JSON from AI provider',
      502
    );
  }
}

function extractFirstJson(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    const close = ch === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === ch) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return text.slice(i, j + 1);
      }
    }
  }
  return null;
}

export function buildTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    setTimeout(() => {
      reject(
        new AppError(errorCodes.AI_PROVIDER_FAILED, 'AI provider timeout', 504)
      );
    }, ms);
  });
}
