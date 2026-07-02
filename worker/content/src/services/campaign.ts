import type {
  CampaignCreateInput,
  CampaignRow,
  CampaignUpdateInput,
  Paginated,
} from '../types/domain.js';
import { AppError, errorCodes } from '../utils/errors.js';
import { validateEnum } from '../utils/validation.js';
import type { AuditActor } from './audit.js';
import { IntegrityService } from './integrity.js';
import {
  type CampaignListOptions,
  CampaignRepository,
} from '../repositories/campaign.js';

export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_LANGUAGES = ['id', 'en', 'bilingual'] as const;
export type CampaignLanguage = (typeof CAMPAIGN_LANGUAGES)[number];

const ALLOWED_PLATFORMS: ReadonlySet<string> = new Set(['instagram', 'linkedin']);

export interface AuditLogger {
  log(input: {
    action: string;
    targetType: string;
    targetId?: string;
    severity?: 'info' | 'warning' | 'critical';
    before?: unknown;
    after?: unknown;
    actor: AuditActor;
  }): Promise<void>;
}

export interface CampaignServiceDeps {
  repo: CampaignRepository;
  integrity: IntegrityService;
  audit: AuditLogger;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function randomSuffix(len = 8): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function ensureStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `${field} must be an array`,
      400
    );
  }
  for (const v of value) {
    if (typeof v !== 'string') {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `${field} must contain only strings`,
        400
      );
    }
  }
  return value;
}

function ensurePlatforms(value: unknown): string[] {
  const arr = ensureStringArray(value, 'targetPlatformsJson');
  for (const p of arr) {
    if (!ALLOWED_PLATFORMS.has(p)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `targetPlatformsJson contains invalid platform: ${p}. Allowed: instagram, linkedin`,
        400
      );
    }
  }
  return arr;
}

function ensureDateOrder(startDate: string | null | undefined, endDate: string | null | undefined): void {
  if (startDate && endDate && endDate < startDate) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      'endDate must be greater than or equal to startDate',
      400
    );
  }
}

export class CampaignService {
  constructor(private deps: CampaignServiceDeps) {}

  async list(brandId: string, options: CampaignListOptions = {}): Promise<Paginated<CampaignRow>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const { items, total } = await this.deps.repo.findByBrand(brandId, options);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async create(input: CampaignCreateInput, actor: AuditActor): Promise<CampaignRow> {
    if (!input.name || !input.brandId) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'name and brandId are required',
        400
      );
    }
    if (!(await this.deps.integrity.brandExists(input.brandId))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const platforms = ensurePlatforms(input.targetPlatformsJson);
    const pillarIds = ensureStringArray(input.pillarIdsJson, 'pillarIdsJson');
    for (const pid of pillarIds) {
      if (!(await this.deps.integrity.pillarExistsAndActive(input.brandId, pid))) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          `Pillar not found or inactive: ${pid}`,
          400
        );
      }
    }

    const language = input.language
      ? validateEnum(input.language, CAMPAIGN_LANGUAGES)
      : 'id';
    const status = input.status
      ? validateEnum(input.status, CAMPAIGN_STATUSES)
      : 'draft';
    ensureDateOrder(input.startDate ?? null, input.endDate ?? null);

    const now = new Date().toISOString();
    const id = `campaign_${slugify(input.name)}_${randomSuffix(8)}`;
    const row: CampaignRow = {
      id,
      brandId: input.brandId,
      name: input.name,
      objective: input.objective ?? '',
      targetPlatformsJson: JSON.stringify(platforms),
      pillarIdsJson: JSON.stringify(pillarIds),
      targetAudience: input.targetAudience ?? null,
      language,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.repo.create(row);
    await this.deps.audit.log({
      action: 'campaign.create',
      targetType: 'campaign',
      targetId: row.id,
      after: row,
      actor,
    });
    return row;
  }

  async update(
    id: string,
    input: CampaignUpdateInput,
    actor: AuditActor
  ): Promise<CampaignRow> {
    const existing = await this.deps.repo.findById(id);
    if (!existing) {
      throw new AppError(errorCodes.NOT_FOUND, 'Campaign not found', 404);
    }
    const patch: CampaignUpdateInput = {};

    if (input.name !== undefined) {
      if (!input.name) {
        throw new AppError(errorCodes.VALIDATION_ERROR, 'name cannot be empty', 400);
      }
      patch.name = input.name;
    }
    if (input.objective !== undefined) patch.objective = input.objective;
    if (input.targetAudience !== undefined) patch.targetAudience = input.targetAudience;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;
    if (input.language !== undefined) {
      patch.language = validateEnum(input.language, CAMPAIGN_LANGUAGES);
    }
    if (input.status !== undefined) {
      patch.status = validateEnum(input.status, CAMPAIGN_STATUSES);
    }
    if (input.targetPlatformsJson !== undefined) {
      const platforms = ensurePlatforms(input.targetPlatformsJson);
      patch.targetPlatformsJson = JSON.stringify(platforms);
    }
    if (input.pillarIdsJson !== undefined) {
      const pillarIds = ensureStringArray(input.pillarIdsJson, 'pillarIdsJson');
      for (const pid of pillarIds) {
        if (!(await this.deps.integrity.pillarExistsAndActive(existing.brandId, pid))) {
          throw new AppError(
            errorCodes.VALIDATION_ERROR,
            `Pillar not found or inactive: ${pid}`,
            400
          );
        }
      }
      patch.pillarIdsJson = JSON.stringify(pillarIds);
    }

    const startDate = patch.startDate !== undefined ? patch.startDate : existing.startDate;
    const endDate = patch.endDate !== undefined ? patch.endDate : existing.endDate;
    ensureDateOrder(startDate ?? null, endDate ?? null);

    const updatedAt = new Date().toISOString();
    const updated = await this.deps.repo.update(id, patch, updatedAt);
    if (!updated) {
      throw new AppError(errorCodes.NOT_FOUND, 'Campaign not found', 404);
    }
    await this.deps.audit.log({
      action: 'campaign.update',
      targetType: 'campaign',
      targetId: id,
      before: existing,
      after: updated,
      actor,
    });
    return updated;
  }
}
