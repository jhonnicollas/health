import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, validateEnum } from '../utils/validation.js';
import { BrandRepository } from '../repositories/brand.js';
import { AuditService, AuditRepository } from './audit.js';
import { IntegrityService } from './integrity.js';
import type { BrandRow, BrandUpdateInput } from '../types/domain.js';
import type { InternalUser } from '../types/auth.js';

const LANGUAGE_DEFAULTS = ['id', 'en', 'bilingual'] as const;

function normalizeJsonArray(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'JSON field must be valid JSON',
        400
      );
    }
    if (!Array.isArray(parsed)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'JSON field must encode an array',
        400
      );
    }
    return value;
  }
  throw new AppError(
    errorCodes.VALIDATION_ERROR,
    'JSON field must be a string or array',
    400
  );
}

export class BrandService {
  private repo: BrandRepository;
  private audit: AuditService;
  private integrity: IntegrityService;

  constructor(private db: D1Database) {
    this.repo = new BrandRepository(db);
    this.audit = new AuditService(new AuditRepository(db));
    this.integrity = new IntegrityService(db);
  }

  async getById(id: string): Promise<BrandRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }
    return row;
  }

  async update(id: string, input: unknown, actor: InternalUser): Promise<BrandRow> {
    const validated = this.validateInput(input);

    if (!(await this.integrity.brandExists(id))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const before = await this.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const updatedAt = new Date().toISOString();
    const after = await this.repo.update(id, validated, updatedAt);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    await this.audit.log({
      action: 'brandMemory.update',
      targetType: 'brand',
      targetId: id,
      before,
      after,
      actor: {
        id: actor.id,
        role: actor.roles.join(','),
      },
    });

    return after;
  }

  private validateInput(input: unknown): BrandUpdateInput {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Request body must be an object',
        400
      );
    }
    const src = input as Record<string, unknown>;
    const out: BrandUpdateInput = {};

    if (src.positioning !== undefined) {
      if (!isNonEmptyString(src.positioning)) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          'positioning must be a non-empty string',
          400
        );
      }
      out.positioning = src.positioning as string;
    }

    if (src.languageDefault !== undefined) {
      out.languageDefault = validateEnum(src.languageDefault, LANGUAGE_DEFAULTS);
    }

    if (src.tone !== undefined) {
      out.tone = src.tone as string;
    }

    if (src.disclaimerTemplate !== undefined) {
      out.disclaimerTemplate = src.disclaimerTemplate as string | null;
    }

    if (src.productValueJson !== undefined) {
      out.productValueJson = normalizeJsonArray(src.productValueJson);
    }
    if (src.targetAudienceJson !== undefined) {
      out.targetAudienceJson = normalizeJsonArray(src.targetAudienceJson);
    }
    if (src.forbiddenClaimsJson !== undefined) {
      out.forbiddenClaimsJson = normalizeJsonArray(src.forbiddenClaimsJson);
    }
    if (src.allowedClaimsJson !== undefined) {
      out.allowedClaimsJson = normalizeJsonArray(src.allowedClaimsJson);
    }

    return out;
  }
}
