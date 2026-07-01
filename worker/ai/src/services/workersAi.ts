// Workers AI provider — embedding generation + fallback text generation.
// PRD §8.15: Workers AI is used for embedding, vision, safety classifier, and fallback text.
// All Workers AI calls are free-tier eligible.
// The AI binding is available via env.AI (configured in wrangler.toml [ai] binding).

import type { ChatMessage } from './aiGateway.js';

export interface WorkersAiBindings {
  AI: Ai;
}

// PRD §8.15: Embedding model @cf/baai/bge-base-en-v1.5 (768-dim)
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// PRD §3 S6B: Fallback text models
export const FALLBACK_MODEL_1 = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const FALLBACK_MODEL_2 = '@cf/meta/llama-3.1-8b-instruct';

export interface EmbeddingResult {
  values: number[];
  model: string;
  dimensions: number;
}

// Response type for Workers AI text generation (instruct models)
interface WorkersAiTextResponse {
  response?: string;
  result?: { response?: string };
}

// Response type for Workers AI embedding
interface WorkersAiEmbeddingResponse {
  data?: number[][];
  shape?: number[];
}

/**
 * Generate embedding using Workers AI @cf/baai/bge-base-en-v1.5 (768-dim).
 * PRD §8.15 AC1: Embedding model version must be fixed per index.
 */
export async function generateEmbedding(
  env: WorkersAiBindings,
  text: string
): Promise<EmbeddingResult> {
  const response = await env.AI.run(EMBEDDING_MODEL, {
    text: [text],
  }) as unknown as WorkersAiEmbeddingResponse;

  const values = response.data?.[0] ?? [];
  return {
    values: Array.isArray(values) ? values : [],
    model: EMBEDDING_MODEL,
    dimensions: Array.isArray(values) ? values.length : 0,
  };
}

/**
 * Generate text using Workers AI fallback model (llama-3.3-70b or llama-3.1-8b).
 * PRD §3 S6B: Fallback1 = llama-3.3-70b, Fallback2 = llama-3.1-8b
 */
export async function callWorkersAiText(
  env: WorkersAiBindings,
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<{ text: string; model: string; provider: string; latencyMs: number } | null> {
  const startTime = Date.now();

  try {
    const response = await env.AI.run(model as Parameters<typeof env.AI.run>[0], {
      messages,
      max_tokens: maxTokens,
      temperature,
    }) as unknown as WorkersAiTextResponse;

    const text = response.response?.trim()
      || response.result?.response?.trim()
      || '';

    if (!text) return null;

    return {
      text,
      model,
      provider: 'workers-ai',
      latencyMs: Date.now() - startTime,
    };
  } catch {
    return null;
  }
}

/**
 * Call Workers AI for intent classification.
 * PRD §9.2: Intent types — health_summary, symptom_interview, possible_explanations, etc.
 */
export async function classifyIntent(
  env: WorkersAiBindings,
  userMessage: string
): Promise<string> {
  const validIntents = [
    'health_summary',
    'symptom_interview',
    'possible_explanations',
    'first_aid_guidance',
    'emergency_guidance',
    'medication_adherence',
    'knowledge_question',
    'doctor_handoff',
    'caregiver_summary',
  ];

  try {
    const response = await env.AI.run(FALLBACK_MODEL_2 as Parameters<typeof env.AI.run>[0], {
      messages: [
        {
          role: 'system',
          content: `Classify the user's health message into exactly one of these intents: ${validIntents.join(', ')}. Respond with ONLY the intent name, nothing else.`,
        },
        { role: 'user', content: userMessage.slice(0, 500) },
      ],
      max_tokens: 20,
      temperature: 0,
    }) as unknown as WorkersAiTextResponse;

    const text = response.response?.trim().toLowerCase() || '';
    if (validIntents.includes(text)) return text;
  } catch {
    // Fallback: keyword-based classification
  }

  // Deterministic fallback classification
  const lower = userMessage.toLowerCase();
  if (/darurat|emergency|nyeri dada|sesak napas|pingsan|kelemahan satu sisi|perdarahan hebat/.test(lower)) {
    return 'emergency_guidance';
  }
  if (/luka|p3k|pertolongan pertama|first aid|luka bakar|mimisan|tersedak/.test(lower)) {
    return 'first_aid_guidance';
  }
  if (/obat|medication|adherence|minum obat|dosis/.test(lower)) {
    return 'medication_adherence';
  }
  if (/dokter|doctor|handoff|konsultasi|spesialis/.test(lower)) {
    return 'doctor_handoff';
  }
  if (/caregiver|keluarga|family/.test(lower)) {
    return 'caregiver_summary';
  }
  if (/gejala|symptom|sakit|nyeri|pusing|demam/.test(lower)) {
    return 'symptom_interview';
  }
  if (/kenapa|mengapa|penyebab|why|cause/.test(lower)) {
    return 'possible_explanations';
  }
  return 'health_summary';
}
