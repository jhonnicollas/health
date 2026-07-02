import type { SafetyReportRow } from '../types/safety.js';

const COLUMNS =
  'id, draftId, revisionNumber, healthContentStatus, safetyStatus, blockedReasonsJson, warningsJson, rewrittenSuggestion, requiredDisclaimer, sourceTraceRequired, checkerNote, checkedBy, modelUsed, promptVersionId, checkedAt';

export class SafetyReportRepository {
  constructor(private db: D1Database) {}

  async findByDraftAndRevision(
    draftId: string,
    revisionNumber: number
  ): Promise<SafetyReportRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conSafetyReports WHERE draftId = ? AND revisionNumber = ?`
      )
      .bind(draftId, revisionNumber)
      .first<SafetyReportRow>();
  }

  async findLatestByDraft(draftId: string): Promise<SafetyReportRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conSafetyReports WHERE draftId = ? ORDER BY revisionNumber DESC LIMIT 1`
      )
      .bind(draftId)
      .first<SafetyReportRow>();
  }

  async create(row: SafetyReportRow): Promise<SafetyReportRow> {
    await this.db
      .prepare(
        `INSERT INTO conSafetyReports (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.draftId,
        row.revisionNumber,
        row.healthContentStatus,
        row.safetyStatus,
        row.blockedReasonsJson,
        row.warningsJson,
        row.rewrittenSuggestion,
        row.requiredDisclaimer,
        row.sourceTraceRequired,
        row.checkerNote,
        row.checkedBy,
        row.modelUsed,
        row.promptVersionId,
        row.checkedAt
      )
      .run();
    return row;
  }
}
