import type {
  IdeaCreateInput,
  IdeaListOptions,
  IdeaRow,
  IdeaUpdateInput,
} from '../types/domain.js';

const COLUMNS =
  'id, brandId, campaignId, pillarId, title, angle, targetPlatform, contentFormat, targetAudience, painPoint, score, contentHash, sourceType, confidence, status, createdAt, updatedAt';

export class IdeaRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<IdeaRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conIdeas WHERE id = ?`)
      .bind(id)
      .first<IdeaRow>();
  }

  async findByBrandCampaign(
    brandId: string,
    options: IdeaListOptions = {}
  ): Promise<{ items: IdeaRow[]; total: number }> {
    const conds: string[] = ['brandId = ?'];
    const params: unknown[] = [brandId];
    if (options.campaignId) {
      conds.push('campaignId = ?');
      params.push(options.campaignId);
    }
    if (options.pillarId) {
      conds.push('pillarId = ?');
      params.push(options.pillarId);
    }
    if (options.status) {
      conds.push('status = ?');
      params.push(options.status);
    }
    if (options.targetPlatform) {
      conds.push('targetPlatform = ?');
      params.push(options.targetPlatform);
    }
    if (options.contentFormat) {
      conds.push('contentFormat = ?');
      params.push(options.contentFormat);
    }
    const where = conds.join(' AND ');
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const itemsResult = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conIdeas WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<IdeaRow>();
    const totalResult = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conIdeas WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>();

    return {
      items: itemsResult.results ?? [],
      total: totalResult?.n ?? 0,
    };
  }

  async create(row: IdeaCreateInput & { id: string; createdAt: string; updatedAt: string }): Promise<IdeaRow> {
    const full: IdeaRow = {
      id: row.id,
      brandId: row.brandId,
      campaignId: row.campaignId,
      pillarId: row.pillarId,
      title: row.title,
      angle: row.angle,
      targetPlatform: row.targetPlatform,
      contentFormat: row.contentFormat,
      targetAudience: row.targetAudience ?? null,
      painPoint: row.painPoint ?? null,
      score: row.score ?? 0,
      contentHash: row.contentHash,
      sourceType: row.sourceType ?? 'ai_inferred',
      confidence: row.confidence ?? 'medium',
      status: row.status ?? 'idea',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    await this.db
      .prepare(
        `INSERT INTO conIdeas (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        full.id,
        full.brandId,
        full.campaignId,
        full.pillarId,
        full.title,
        full.angle,
        full.targetPlatform,
        full.contentFormat,
        full.targetAudience,
        full.painPoint,
        full.score,
        full.contentHash,
        full.sourceType,
        full.confidence,
        full.status,
        full.createdAt,
        full.updatedAt
      )
      .run();
    return full;
  }

  async updateStatus(
    id: string,
    input: IdeaUpdateInput,
    updatedAt: string
  ): Promise<IdeaRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return this.findById(id);
    sets.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(id);
    await this.db
      .prepare(`UPDATE conIdeas SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }
}
