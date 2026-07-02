export const REDACTED_KEYS = new Set([
  'authorization',
  'access_token',
  'refresh_token',
  'api_key',
  'secret',
  'password',
  'token',
  'client_secret',
  'webhook_secret',
  'cookie',
  'session',
]);

const PLACEHOLDER = '[REDACTED]';

export function redact(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        out[k] = PLACEHOLDER;
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}
