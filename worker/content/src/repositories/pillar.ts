import type { PillarCreateInput, PillarRow, PillarUpdateInput } from '../types/domain.js';

const COLUMNS =
  'id, brandId, name, slug, description, targetAudience, priority, isActive, createdAt, updatedAt';

export interface ListPillarsOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export class PillarRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<PillarRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conPillars WHERE id = ?`)
      .bind(id)
      .first<PillarRow>();
  }

  async findBySlug(brandId: string, slug: string): Promise<PillarRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conPillars WHERE brandId = ? AND slug = ?`)
      .bind(brandId, slug)
      .first<PillarRow>();
  }

  async findByBrand(
    brandId: string,
    options: ListPillarsOptions = {}
  ): Promise<{ items: PillarRow[]; total: number }> {
    const where: string[] = ['brandId = ?'];
    const params: unknown[] = [brandId];
    if (typeof options.isActive === 'boolean') {
      where.push('isActive = ?');
      params.push(options.isActive ? 1 : 0);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRow = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conPillars ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const itemsResult = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conPillars ${whereSql} ORDER BY priority DESC, createdAt ASC LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<PillarRow>();

    return { items: itemsResult.results ?? [], total: totalRow?.n ?? 0 };
  }

  async create(row: PillarRow): Promise<PillarRow> {
    await this.db
      .prepare(
        `INSERT INTO conPillars (id, brandId, name, slug, description, targetAudience, priority, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.brandId,
        row.name,
        row.slug,
        row.description,
        row.targetAudience,
        row.priority,
        row.isActive,
        row.createdAt,
        row.updatedAt
      )
      .run();
    return row;
  }

  async update(id: string, input: PillarUpdateInput, updatedAt: string): Promise<PillarRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    if (sets.length === 0) return this.findById(id);
    sets.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(id);
    await this.db
      .prepare(`UPDATE conPillars SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }
}
