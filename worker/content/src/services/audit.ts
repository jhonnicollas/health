import { redact } from '../utils/redact.js';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditActor {
  id: string;
  role?: string;
  roles?: readonly string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditInput {
  action: string;
  targetType: string;
  targetId?: string;
  severity?: AuditSeverity;
  before?: unknown;
  after?: unknown;
  actor: AuditActor;
}

export interface AuditRow {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  severity: AuditSeverity;
  beforeJson?: string;
  afterJson?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export class AuditRepository {
  constructor(private db: D1Database) {}

  async insert(row: AuditRow): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO conAuditLogs (id, actorId, actorRole, action, targetType, targetId, severity, beforeJson, afterJson, ipAddress, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        row.id,
        row.actorId ?? null,
        row.actorRole ?? null,
        row.action,
        row.targetType,
        row.targetId ?? null,
        row.severity,
        row.beforeJson ?? null,
        row.afterJson ?? null,
        row.ipAddress ?? null,
        row.userAgent ?? null,
        row.createdAt
      )
      .run();
  }
}

export class AuditService {
  constructor(private repo: AuditRepository) {}

  async log(input: AuditInput): Promise<void> {
    const row: AuditRow = {
      id: crypto.randomUUID(),
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      severity: input.severity ?? 'info',
      beforeJson:
        input.before !== undefined ? JSON.stringify(redact(input.before)) : undefined,
      afterJson:
        input.after !== undefined ? JSON.stringify(redact(input.after)) : undefined,
      ipAddress: input.actor.ipAddress,
      userAgent: input.actor.userAgent,
      createdAt: new Date().toISOString(),
    };
    try {
      await this.repo.insert(row);
    } catch {
      // ponytail: audit failures must not break the request path
    }
  }
}
