import type { CampaignCreateInput, CampaignRow, CampaignUpdateInput } from '../types/domain.js';

const COLUMNS =
  'id, brandId, name, objective, targetPlatformsJson, pillarIdsJson, targetAudience, language, startDate, endDate, status, createdAt, updatedAt';

export interface CampaignListOptions {
  status?: string;
  language?: string;
  page?: number;
  pageSize?: number;
}

export class CampaignRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<CampaignRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conCampaigns WHERE id = ?`)
      .bind(id)
      .first<CampaignRow>();
  }

  async findByBrand(brandId: string, options: CampaignListOptions = {}): Promise<{
    items: CampaignRow[];
    total: number;
  }> {
    const conds: string[] = ['brandId = ?'];
    const params: unknown[] = [brandId];
    if (options.status) {
      conds.push('status = ?');
      params.push(options.status);
    }
    if (options.language) {
      conds.push('language = ?');
      params.push(options.language);
    }
    const where = conds.join(' AND ');
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const itemsResult = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conCampaigns WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<CampaignRow>();
    const totalResult = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conCampaigns WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>();

    return {
      items: itemsResult.results ?? [],
      total: totalResult?.n ?? 0,
    };
  }

  async create(row: CampaignRow): Promise<CampaignRow> {
    await this.db
      .prepare(
        `INSERT INTO conCampaigns (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.brandId,
        row.name,
        row.objective,
        row.targetPlatformsJson,
        row.pillarIdsJson,
        row.targetAudience,
        row.language,
        row.startDate,
        row.endDate,
        row.status,
        row.createdAt,
        row.updatedAt
      )
      .run();
    return row;
  }

  async update(id: string, input: CampaignUpdateInput, updatedAt: string): Promise<CampaignRow | null> {
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
      .prepare(`UPDATE conCampaigns SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }
}
