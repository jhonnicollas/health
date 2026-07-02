import type { BrandRow, BrandUpdateInput } from '../types/domain.js';

const COLUMNS =
  'id, name, positioning, productValueJson, targetAudienceJson, tone, languageDefault, disclaimerTemplate, forbiddenClaimsJson, allowedClaimsJson, createdAt, updatedAt';

export class BrandRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<BrandRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conBrands WHERE id = ?`)
      .bind(id)
      .first<BrandRow>();
  }

  async update(id: string, input: BrandUpdateInput, updatedAt: string): Promise<BrandRow | null> {
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
      .prepare(`UPDATE conBrands SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }
}
