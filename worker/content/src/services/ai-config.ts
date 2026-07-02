import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, validateEnum } from '../utils/validation.js';
import type { AuditActor } from './audit.js';
import { IntegrityService } from './integrity.js';
import {
  AiConfigRepository,
  toAiConfigRow,
  type AiConfigListOptions,
} from '../repositories/ai-config.js';
import type {
  AiConfigCreateInput,
  AiConfigRow,
  AiConfigUpdateInput,
  AiProviderName,
  AiPurpose,
} from '../types/ai.js';
import type { Paginated } from '../types/domain.js';

export const AI_PROVIDERS = [
  'mock',
  'openai',
  'google',
  'anthropic',
  'workersai',
] as const;

export const AI_PURPOSES = [
  'idea_generation',
  'draft_generation',
  'safety_check',
  'health_classifier',
] as const;

export const AI_LOCAL_DEFAULT_PROVIDER: AiProviderName = 'mock';

export interface AiConfigServiceDeps {
  repo: AiConfigRepository;
  integrity: IntegrityService;
  audit: { log(input: unknown): Promise<void> };
  envName?: string;
}

export type AiConfigDto = Omit<AiConfigRow, 'isActive'> & { isActive: boolean };

function toDto(row: AiConfigRow): AiConfigDto {
  return { ...row, isActive: row.isActive === 1 };
}

function randomSuffix(len = 8): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function generateId(purpose: AiPurpose): string {
  return `aiconfig_${purpose}_${randomSuffix(8)}`;
}

function validateProvider(provider: unknown): AiProviderName {
  return validateEnum(provider, AI_PROVIDERS);
}

function validatePurpose(purpose: unknown): AiPurpose {
  return validateEnum(purpose, AI_PURPOSES);
}

function validateNumberRange(
  value: unknown,
  field: string,
  min: number,
  max?: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `${field} must be a number`,
      400
    );
  }
  if (value < min) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `${field} must be >= ${min}`,
      400
    );
  }
  if (max !== undefined && value > max) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `${field} must be <= ${max}`,
      400
    );
  }
  return value;
}

function validatePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `${field} must be a positive integer`,
      400
    );
  }
  return value;
}

export class AiConfigService {
  constructor(private deps: AiConfigServiceDeps) {}

  async getById(id: string): Promise<AiConfigDto> {
    const row = await this.deps.repo.findById(id);
    if (!row) throw new AppError(errorCodes.NOT_FOUND, 'AI config not found', 404);
    return toDto(row);
  }

  async list(
    brandId: string,
    options: AiConfigListOptions = {}
  ): Promise<Paginated<AiConfigDto>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const { items, total } = await this.deps.repo.findByBrand(brandId, options);
    return {
      items: items.map(toDto),
      pagination: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async create(input: unknown, actor: AuditActor): Promise<AiConfigDto> {
    const validated = this.validateCreateInput(input);
    if (!(await this.deps.integrity.brandExists(validated.brandId))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const now = new Date().toISOString();
    const row = toAiConfigRow(validated, now, generateId(validated.purpose));
    await this.deps.repo.create(row);
    await this.deps.audit.log({
      action: 'aiConfig.create',
      targetType: 'aiConfig',
      targetId: row.id,
      after: row,
      actor,
    });
    return toDto(row);
  }

  async update(
    id: string,
    input: unknown,
    actor: AuditActor
  ): Promise<AiConfigDto> {
    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI config not found', 404);
    }
    const validated = this.validateUpdateInput(input);

    const updatedAt = new Date().toISOString();
    const after = await this.deps.repo.update(id, validated, updatedAt);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI config not found', 404);
    }
    await this.deps.audit.log({
      action: 'aiConfig.update',
      targetType: 'aiConfig',
      targetId: id,
      before,
      after,
      actor,
    });
    return toDto(after);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actor: AuditActor
  ): Promise<AiConfigDto> {
    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI config not found', 404);
    }
    if (before.isActive === (isActive ? 1 : 0)) {
      return toDto(before);
    }
    const updatedAt = new Date().toISOString();
    const after = await this.deps.repo.setActive(id, isActive, updatedAt);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI config not found', 404);
    }
    await this.deps.audit.log({
      action: isActive ? 'aiConfig.activate' : 'aiConfig.deactivate',
      targetType: 'aiConfig',
      targetId: id,
      before,
      after,
      actor,
    });
    return toDto(after);
  }

  private isLocalLike(envName?: string): boolean {
    return envName === 'local' || envName === 'test' || envName === undefined;
  }

  private validateCreateInput(input: unknown): AiConfigCreateInput {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Request body must be an object',
        400
      );
    }
    const src = input as Record<string, unknown>;
    if (!isNonEmptyString(src.brandId)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'brandId is required',
        400
      );
    }
    if (!isNonEmptyString(src.model)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'model is required',
        400
      );
    }
    const purpose = validatePurpose(src.purpose);
    let provider: AiProviderName;
    if (src.provider === undefined) {
      provider = this.isLocalLike(this.deps.envName)
        ? AI_LOCAL_DEFAULT_PROVIDER
        : validateProvider(src.provider);
    } else {
      provider = validateProvider(src.provider);
    }

    const out: AiConfigCreateInput = {
      brandId: src.brandId as string,
      provider,
      model: src.model as string,
      purpose,
      fallbackOrder: typeof src.fallbackOrder === 'number' ? src.fallbackOrder : 0,
    };

    if (src.temperature !== undefined && src.temperature !== null) {
      out.temperature = validateNumberRange(src.temperature, 'temperature', 0, 2);
    } else if (src.temperature === null) {
      out.temperature = null;
    }
    if (src.maxTokens !== undefined && src.maxTokens !== null) {
      out.maxTokens = validatePositiveInt(src.maxTokens, 'maxTokens');
    } else if (src.maxTokens === null) {
      out.maxTokens = null;
    }
    if (src.timeoutMs !== undefined && src.timeoutMs !== null) {
      out.timeoutMs = validatePositiveInt(src.timeoutMs, 'timeoutMs');
    } else if (src.timeoutMs === null) {
      out.timeoutMs = null;
    }
    if (typeof src.fallbackOrder === 'number') {
      out.fallbackOrder = src.fallbackOrder;
    }
    if (typeof src.isActive === 'boolean') {
      out.isActive = src.isActive;
    }
    if (src.secretRef !== undefined) {
      out.secretRef = src.secretRef === null ? null : (src.secretRef as string);
    }

    return out;
  }

  private validateUpdateInput(input: unknown): AiConfigUpdateInput {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Request body must be an object',
        400
      );
    }
    const src = input as Record<string, unknown>;
    const out: AiConfigUpdateInput = {};

    if (src.provider !== undefined) out.provider = validateProvider(src.provider);
    if (src.model !== undefined) {
      if (!isNonEmptyString(src.model)) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          'model must be non-empty',
          400
        );
      }
      out.model = src.model as string;
    }
    if (src.temperature !== undefined && src.temperature !== null) {
      out.temperature = validateNumberRange(src.temperature, 'temperature', 0, 2);
    } else if (src.temperature === null) {
      out.temperature = null;
    }
    if (src.maxTokens !== undefined && src.maxTokens !== null) {
      out.maxTokens = validatePositiveInt(src.maxTokens, 'maxTokens');
    } else if (src.maxTokens === null) {
      out.maxTokens = null;
    }
    if (src.timeoutMs !== undefined && src.timeoutMs !== null) {
      out.timeoutMs = validatePositiveInt(src.timeoutMs, 'timeoutMs');
    } else if (src.timeoutMs === null) {
      out.timeoutMs = null;
    }
    if (src.fallbackOrder !== undefined) {
      if (typeof src.fallbackOrder !== 'number') {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          'fallbackOrder must be a number',
          400
        );
      }
      out.fallbackOrder = src.fallbackOrder;
    }
    if (typeof src.isActive === 'boolean') {
      out.isActive = src.isActive;
    }
    if (src.secretRef !== undefined) {
      out.secretRef = src.secretRef === null ? null : (src.secretRef as string);
    }

    return out;
  }
}
