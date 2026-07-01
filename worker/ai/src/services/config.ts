// Config service — reads HL_systemConfigs from D1 with optional AI_KV cache.
// PRD §8.11: KV cache key pattern `config:{configKey}` TTL 300s.
// Source of truth: D1 HL_systemConfigs; KV is a cache only.

export interface ConfigBindings {
  DB: D1Database;
  AI_KV?: KVNamespace;
}

/**
 * Read a system config string from D1, with KV cache (300s TTL).
 * Falls back to direct D1 query if KV miss or unavailable.
 */
export async function getConfigString(env: ConfigBindings, configKey: string): Promise<string | null> {
  // KV cache first
  if (env.AI_KV) {
    try {
      const cached = await env.AI_KV.get(`config:${configKey}`);
      if (cached !== null) return cached;
    } catch {
      // KV unavailable — fall through to D1
    }
  }

  // D1 fallback
  try {
    const row = await env.DB.prepare(
      'SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
    ).bind(configKey).first<{ configValue: string }>();

    if (row?.configValue !== undefined) {
      // Populate KV cache (300s TTL per PRD §8.11)
      if (env.AI_KV) {
        try {
          await env.AI_KV.put(`config:${configKey}`, row.configValue, { expirationTtl: 300 });
        } catch {
          // KV write failure is non-fatal
        }
      }
      return row.configValue.trim() || null;
    }
  } catch {
    // D1 error — return null
  }

  return null;
}

export async function getConfigNumber(env: ConfigBindings, configKey: string, fallback = 0): Promise<number> {
  const value = await getConfigString(env, configKey);
  if (value === null) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function getConfigBoolean(env: ConfigBindings, configKey: string, fallback = false): Promise<boolean> {
  const value = await getConfigString(env, configKey);
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.toLowerCase());
}

/**
 * Invalidate a config key from KV cache (e.g. after admin update).
 */
export async function invalidateConfigCache(env: ConfigBindings, configKey: string): Promise<void> {
  if (env.AI_KV) {
    try {
      await env.AI_KV.delete(`config:${configKey}`);
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Get the current operating mode from system config.
 * PRD §0.3: clinicalCopilot.operatingMode = 'standard' | 'proactive' | 'super_aktif'
 */
export async function getOperatingMode(env: ConfigBindings): Promise<'standard' | 'proactive' | 'super_aktif'> {
  const value = await getConfigString(env, 'clinicalCopilot.operatingMode');
  if (value === 'proactive' || value === 'super_aktif') return value;
  return 'standard'; // default
}
