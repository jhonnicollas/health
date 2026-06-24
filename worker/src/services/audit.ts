type AuditJson =
  | null
  | string
  | number
  | boolean
  | AuditJson[]
  | { [key: string]: AuditJson }

export type AuditMetadata = AuditJson | Record<string, unknown> | unknown[]

export type AuditWriteParams = {
  userId: number | null
  action: string
  entityType: string
  entityId?: string | number | null
  metadataJson?: AuditMetadata
}

const REDACTED = '[REDACTED]'
const SENSITIVE_KEY_PATTERN = /(secret|token|api[-_]?key|apikey|authorization|password|cookie|session|oauth.*code|webhook.*signature|signature)/i

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeAuditMetadata(value: unknown): AuditJson {
  return sanitizeAuditValue(value, 0)
}

function sanitizeAuditValue(value: unknown, depth: number): AuditJson {
  if (depth > 8) return '[MAX_DEPTH]'
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return null
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, depth + 1))
  }
  if (!isPlainObject(value)) {
    return String(value)
  }

  const clean: { [key: string]: AuditJson } = {}
  for (const [key, item] of Object.entries(value)) {
    clean[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeAuditValue(item, depth + 1)
  }
  return clean
}

export function toSafeAuditMetadataJson(metadata: AuditMetadata | undefined): string | null {
  if (metadata === undefined || metadata === null) return null

  if (typeof metadata === 'string') {
    try {
      return JSON.stringify(sanitizeAuditMetadata(JSON.parse(metadata)))
    } catch {
      return JSON.stringify({ value: metadata })
    }
  }

  return JSON.stringify(sanitizeAuditMetadata(metadata))
}

export const AuditService = {
  async write(db: D1Database, params: AuditWriteParams): Promise<void> {
    await db.prepare(
      'INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(
      params.userId,
      params.action,
      params.entityType,
      params.entityId == null ? null : String(params.entityId),
      toSafeAuditMetadataJson(params.metadataJson)
    ).run()
  }
}
