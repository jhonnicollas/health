import type { SourceReferenceRow } from '../types/source-reference.js';

const COLUMNS =
  'id, draftId, revisionNumber, title, url, sourceType, sourceReliability, confidence, note, fetchedAt, createdAt';

export class SourceReferenceRepository {
  constructor(private db: D1Database) {}

  async findByDraftAndRevision(
    draftId: string,
    revisionNumber: number
  ): Promise<SourceReferenceRow[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conSourceReferences WHERE draftId = ? AND revisionNumber = ? ORDER BY createdAt ASC`
      )
      .bind(draftId, revisionNumber)
      .all<SourceReferenceRow>();
    return result.results ?? [];
  }

  async countByDraftAndRevision(
    draftId: string,
    revisionNumber: number
  ): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM conSourceReferences WHERE draftId = ? AND revisionNumber = ?`
      )
      .bind(draftId, revisionNumber)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async create(row: SourceReferenceRow): Promise<SourceReferenceRow> {
    await this.db
      .prepare(
        `INSERT INTO conSourceReferences (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.draftId,
        row.revisionNumber,
        row.title,
        row.url,
        row.sourceType,
        row.sourceReliability,
        row.confidence,
        row.note,
        row.fetchedAt,
        row.createdAt
      )
      .run();
    return row;
  }
}
