import type {
  AiConfigCreateInput,
  AiConfigRow,
  AiConfigUpdateInput,
  AiPurpose,
} from '../types/ai.js';

const COLUMNS =
  'id, brandId, provider, model, purpose, temperature, maxTokens, timeoutMs, fallbackOrder, isActive, secretRef, createdAt, updatedAt';

export interface AiConfigListOptions {
  purpose?: AiPurpose;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export class AiConfigRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<AiConfigRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conAiConfigs WHERE id = ?`)
      .bind(id)
      .first<AiConfigRow>();
  }

  async findByBrand(
    brandId: string,
    options: AiConfigListOptions = {}
  ): Promise<{ items: AiConfigRow[]; total: number }> {
    const conds: string[] = ['brandId = ?'];
    const params: unknown[] = [brandId];
    if (options.purpose) {
      conds.push('purpose = ?');
      params.push(options.purpose);
    }
    if (typeof options.isActive === 'boolean') {
      conds.push('isActive = ?');
      params.push(options.isActive ? 1 : 0);
    }
    const where = conds.join(' AND ');
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const itemsResult = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiConfigs WHERE ${where} ORDER BY fallbackOrder ASC, createdAt ASC LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<AiConfigRow>();
    const totalResult = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conAiConfigs WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>();

    return {
      items: itemsResult.results ?? [],
      total: totalResult?.n ?? 0,
    };
  }

  async findActiveByPurpose(
    brandId: string,
    purpose: AiPurpose
  ): Promise<AiConfigRow[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiConfigs WHERE brandId = ? AND purpose = ? AND isActive = 1 ORDER BY fallbackOrder ASC, createdAt ASC`
      )
      .bind(brandId, purpose)
      .all<AiConfigRow>();
    return result.results ?? [];
  }

  async create(row: AiConfigRow): Promise<AiConfigRow> {
    await this.db
      .prepare(
        `INSERT INTO conAiConfigs (id, brandId, provider, model, purpose, temperature, maxTokens, timeoutMs, fallbackOrder, isActive, secretRef, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.brandId,
        row.provider,
        row.model,
        row.purpose,
        row.temperature,
        row.maxTokens,
        row.timeoutMs,
        row.fallbackOrder,
        row.isActive,
        row.secretRef,
        row.createdAt,
        row.updatedAt
      )
      .run();
    return row;
  }

  async update(
    id: string,
    input: AiConfigUpdateInput,
    updatedAt: string
  ): Promise<AiConfigRow | null> {
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
      .prepare(`UPDATE conAiConfigs SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }

  async setActive(id: string, isActive: boolean, updatedAt: string): Promise<AiConfigRow | null> {
    await this.db
      .prepare('UPDATE conAiConfigs SET isActive = ?, updatedAt = ? WHERE id = ?')
      .bind(isActive ? 1 : 0, updatedAt, id)
      .run();
    return this.findById(id);
  }
}

// ponytail: thin helper so AiConfigCreateInput stays usable without forcing
// callers to hand-build rows.
export function toAiConfigRow(input: AiConfigCreateInput, now: string, id: string): AiConfigRow {
  return {
    id,
    brandId: input.brandId,
    provider: input.provider,
    model: input.model,
    purpose: input.purpose,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    timeoutMs: input.timeoutMs ?? null,
    fallbackOrder: input.fallbackOrder ?? 0,
    isActive: input.isActive === false ? 0 : 1,
    secretRef: input.secretRef ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
