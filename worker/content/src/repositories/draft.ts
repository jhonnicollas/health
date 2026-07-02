import type {
  DraftListOptions,
  DraftRow,
  DraftUpdateInput,
} from '../types/domain.js';

const COLUMNS =
  'id, ideaId, brandId, campaignId, platform, contentFormat, language, currentRevision, primaryHook, hookAlternativesJson, mainContent, carouselSlidesJson, scriptJson, caption, cta, hashtagsJson, visualBriefJson, thumbnailText, altText, disclaimer, healthContentStatus, safetyStatus, approvalStatus, status, publishReadinessScore, createdAt, updatedAt';

export class DraftRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<DraftRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conDrafts WHERE id = ?`)
      .bind(id)
      .first<DraftRow>();
  }

  async findByBrand(
    brandId: string,
    options: DraftListOptions = {}
  ): Promise<{ items: DraftRow[]; total: number }> {
    const conds: string[] = ['brandId = ?'];
    const params: unknown[] = [brandId];
    if (options.campaignId) {
      conds.push('campaignId = ?');
      params.push(options.campaignId);
    }
    if (options.ideaId) {
      conds.push('ideaId = ?');
      params.push(options.ideaId);
    }
    if (options.platform) {
      conds.push('platform = ?');
      params.push(options.platform);
    }
    if (options.contentFormat) {
      conds.push('contentFormat = ?');
      params.push(options.contentFormat);
    }
    if (options.status) {
      conds.push('status = ?');
      params.push(options.status);
    }
    if (options.safetyStatus) {
      conds.push('safetyStatus = ?');
      params.push(options.safetyStatus);
    }
    if (options.approvalStatus) {
      conds.push('approvalStatus = ?');
      params.push(options.approvalStatus);
    }
    if (options.healthContentStatus) {
      conds.push('healthContentStatus = ?');
      params.push(options.healthContentStatus);
    }
    const where = conds.join(' AND ');
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const itemsResult = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conDrafts WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<DraftRow>();
    const totalResult = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conDrafts WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>();

    return {
      items: itemsResult.results ?? [],
      total: totalResult?.n ?? 0,
    };
  }

  async create(row: DraftRow): Promise<DraftRow> {
    await this.db
      .prepare(
        `INSERT INTO conDrafts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.ideaId,
        row.brandId,
        row.campaignId,
        row.platform,
        row.contentFormat,
        row.language,
        row.currentRevision,
        row.primaryHook,
        row.hookAlternativesJson,
        row.mainContent,
        row.carouselSlidesJson,
        row.scriptJson,
        row.caption,
        row.cta,
        row.hashtagsJson,
        row.visualBriefJson,
        row.thumbnailText,
        row.altText,
        row.disclaimer,
        row.healthContentStatus,
        row.safetyStatus,
        row.approvalStatus,
        row.status,
        row.publishReadinessScore,
        row.createdAt,
        row.updatedAt
      )
      .run();
    return row;
  }

  async update(
    id: string,
    input: DraftUpdateInput,
    updatedAt: string
  ): Promise<DraftRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (key === 'changeReason') continue;
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return this.findById(id);
    sets.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(id);
    await this.db
      .prepare(`UPDATE conDrafts SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.findById(id);
  }
}
