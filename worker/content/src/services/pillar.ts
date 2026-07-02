import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, sanitizeString } from '../utils/validation.js';
import type {
  AuditActor,
} from './audit.js';
import { AuditService } from './audit.js';
import { IntegrityService } from './integrity.js';
import type { ListPillarsOptions } from '../repositories/pillar.js';
import { PillarRepository } from '../repositories/pillar.js';
import type {
  Paginated,
  PillarCreateInput,
  PillarRow,
  PillarUpdateInput,
} from '../types/domain.js';

const SLUG_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;

function toApi(row: PillarRow): Omit<PillarRow, 'isActive'> & { isActive: boolean } {
  return { ...row, isActive: row.isActive === 1 };
}

export class PillarService {
  constructor(
    private repo: PillarRepository,
    private integrity: IntegrityService,
    private audit: AuditService
  ) {}

  async list(brandId: string, options: ListPillarsOptions = {}): Promise<Paginated<Omit<PillarRow, 'isActive'> & { isActive: boolean }>> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const { items, total } = await this.repo.findByBrand(brandId, options);
    return {
      items: items.map(toApi),
      pagination: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async create(input: PillarCreateInput, actor: AuditActor): Promise<Omit<PillarRow, 'isActive'> & { isActive: boolean }> {
    if (!isNonEmptyString(input.brandId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'brandId is required', 400);
    }
    if (!(await this.integrity.brandExists(input.brandId))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }
    if (!isNonEmptyString(input.name)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'name is required', 400);
    }
    if (!isNonEmptyString(input.slug) || !SLUG_PATTERN.test(input.slug)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'slug must match /^[a-z0-9]+(_[a-z0-9]+)*$/',
        400
      );
    }
    if (!isNonEmptyString(input.description)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'description is required', 400);
    }

    const existing = await this.repo.findBySlug(input.brandId, input.slug);
    if (existing) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Pillar slug must be unique within brand',
        400
      );
    }

    const now = new Date().toISOString();
    const row: PillarRow = {
      id: `pillar_${input.slug}`,
      brandId: input.brandId,
      name: sanitizeString(input.name),
      slug: input.slug,
      description: sanitizeString(input.description),
      targetAudience: input.targetAudience ?? null,
      priority: input.priority ?? 0,
      isActive: input.isActive === false ? 0 : 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(row);
    await this.audit.log({
      action: 'pillar.create',
      targetType: 'pillar',
      targetId: row.id,
      after: row,
      actor,
    });
    return toApi(row);
  }

  async update(id: string, input: PillarUpdateInput, actor: AuditActor): Promise<Omit<PillarRow, 'isActive'> & { isActive: boolean }> {
    const before = await this.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Pillar not found', 404);
    }

    // slug is intentionally ignored on update (per spec)
    const { ...rest } = input;
    delete (rest as { slug?: unknown }).slug;

    const after = await this.repo.update(id, rest, new Date().toISOString());
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'Pillar not found', 404);
    }
    await this.audit.log({
      action: 'pillar.update',
      targetType: 'pillar',
      targetId: id,
      before,
      after,
      actor,
    });
    return toApi(after);
  }
}
