import type { DraftRevisionRow } from '../types/domain.js';

const COLUMNS =
  'id, draftId, revisionNumber, snapshotJson, contentHash, changeReason, changedBy, createdAt';

export class RevisionRepository {
  constructor(private db: D1Database) {}

  async findByDraft(draftId: string): Promise<DraftRevisionRow[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conDraftRevisions WHERE draftId = ? ORDER BY revisionNumber ASC`
      )
      .bind(draftId)
      .all<DraftRevisionRow>();
    return result.results ?? [];
  }

  async findByDraftAndNumber(
    draftId: string,
    revisionNumber: number
  ): Promise<DraftRevisionRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conDraftRevisions WHERE draftId = ? AND revisionNumber = ?`
      )
      .bind(draftId, revisionNumber)
      .first<DraftRevisionRow>();
  }

  async create(row: DraftRevisionRow): Promise<DraftRevisionRow> {
    await this.db
      .prepare(
        `INSERT INTO conDraftRevisions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.draftId,
        row.revisionNumber,
        row.snapshotJson,
        row.contentHash,
        row.changeReason,
        row.changedBy,
        row.createdAt
      )
      .run();
    return row;
  }
}
