import type { ApprovalRow } from '../types/source-reference.js';

const COLUMNS =
  'id, draftId, revisionNumber, status, reviewerId, reviewerRole, reviewerNote, warningOverrideReason, approvedAt, createdAt';

export class ApprovalRepository {
  constructor(private db: D1Database) {}

  async findByDraftAndRevision(
    draftId: string,
    revisionNumber: number
  ): Promise<ApprovalRow[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conApprovals WHERE draftId = ? AND revisionNumber = ? ORDER BY createdAt DESC`
      )
      .bind(draftId, revisionNumber)
      .all<ApprovalRow>();
    return result.results ?? [];
  }

  async findLatestByDraft(draftId: string): Promise<ApprovalRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conApprovals WHERE draftId = ? ORDER BY createdAt DESC LIMIT 1`
      )
      .bind(draftId)
      .first<ApprovalRow>();
  }

  async create(row: ApprovalRow): Promise<ApprovalRow> {
    await this.db
      .prepare(
        `INSERT INTO conApprovals (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.draftId,
        row.revisionNumber,
        row.status,
        row.reviewerId,
        row.reviewerRole,
        row.reviewerNote,
        row.warningOverrideReason,
        row.approvedAt,
        row.createdAt
      )
      .run();
    return row;
  }
}
