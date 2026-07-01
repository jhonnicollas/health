// KV cache helper — manages all 6 cache key patterns per PRD §8.11.
// PRD §8.11 KV cache key patterns:
//   prompt:{taskCode}:active    TTL 300s
//   routing:policy               TTL 600s
//   config:{configKey}           TTL 300s
//   education:{locale}:{slug}    TTL 3600s
//   search:{hash}                 TTL 600s
//   disclaimer:{locale}           TTL 86400s

import type { Bindings } from '../types.js';

export const KV_TTL = {
  PROMPT: 300,
  ROUTING: 600,
  CONFIG: 300,
  EDUCATION: 3600,
  SEARCH: 600,
  DISCLAIMER: 86400,
} as const;

export class KvCache {
  constructor(private kv: KVNamespace) {}

  // Prompt cache
  async getPrompt(taskCode: string): Promise<string | null> {
    return this.kv.get(`prompt:${taskCode}:active`);
  }

  async setPrompt(taskCode: string, value: string): Promise<void> {
    await this.kv.put(`prompt:${taskCode}:active`, value, { expirationTtl: KV_TTL.PROMPT });
  }

  async deletePrompt(taskCode: string): Promise<void> {
    await this.kv.delete(`prompt:${taskCode}:active`);
  }

  // Routing policy cache
  async getRoutingPolicy(): Promise<string | null> {
    return this.kv.get('routing:policy');
  }

  async setRoutingPolicy(value: string): Promise<void> {
    await this.kv.put('routing:policy', value, { expirationTtl: KV_TTL.ROUTING });
  }

  async deleteRoutingPolicy(): Promise<void> {
    await this.kv.delete('routing:policy');
  }

  // Config cache
  async getConfig(configKey: string): Promise<string | null> {
    return this.kv.get(`config:${configKey}`);
  }

  async setConfig(configKey: string, value: string): Promise<void> {
    await this.kv.put(`config:${configKey}`, value, { expirationTtl: KV_TTL.CONFIG });
  }

  async deleteConfig(configKey: string): Promise<void> {
    await this.kv.delete(`config:${configKey}`);
  }

  // Education cache
  async getEducation(locale: string, slug: string): Promise<string | null> {
    return this.kv.get(`education:${locale}:${slug}`);
  }

  async setEducation(locale: string, slug: string, value: string): Promise<void> {
    await this.kv.put(`education:${locale}:${slug}`, value, { expirationTtl: KV_TTL.EDUCATION });
  }

  // Search cache
  async getSearch(hash: string): Promise<string | null> {
    return this.kv.get(`search:${hash}`);
  }

  async setSearch(hash: string, value: string): Promise<void> {
    await this.kv.put(`search:${hash}`, value, { expirationTtl: KV_TTL.SEARCH });
  }

  // Disclaimer cache
  async getDisclaimer(locale: string): Promise<string | null> {
    return this.kv.get(`disclaimer:${locale}`);
  }

  async setDisclaimer(locale: string, value: string): Promise<void> {
    await this.kv.put(`disclaimer:${locale}`, value, { expirationTtl: KV_TTL.DISCLAIMER });
  }
}

/**
 * Get a KV cache instance if the binding is available.
 */
export function getKvCache(env: Bindings): KvCache | null {
  if (!env.AI_KV) return null;
  return new KvCache(env.AI_KV);
}
