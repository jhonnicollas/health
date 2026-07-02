import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, validateEnum } from '../utils/validation.js';
import type { AuditActor } from './audit.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import type {
  AiPromptVersionCreateInput,
  AiPromptVersionRow,
} from '../types/ai.js';
import type { Paginated } from '../types/domain.js';

export const ALLOWED_PROMPT_KEYS = [
  'idea_generation',
  'draft_generation',
  'safety_check',
  'health_classifier',
] as const;

export type AllowedPromptKey = (typeof ALLOWED_PROMPT_KEYS)[number];

export interface PromptVersionServiceDeps {
  repo: PromptVersionRepository;
  audit: { log(input: unknown): Promise<void> };
}

export type PromptVersionDto = Omit<AiPromptVersionRow, 'isActive'> & {
  isActive: boolean;
};

function toDto(row: AiPromptVersionRow): PromptVersionDto {
  return { ...row, isActive: row.isActive === 1 };
}

function randomSuffix(len = 8): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function generateId(promptKey: string, version: number): string {
  return `prompt_${promptKey}_v${version}_${randomSuffix(8)}`;
}

function validatePromptKey(value: unknown): AllowedPromptKey {
  return validateEnum(value, ALLOWED_PROMPT_KEYS);
}

function validateVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      'version must be an integer >= 1',
      400
    );
  }
  return value;
}

export class PromptVersionService {
  constructor(private deps: PromptVersionServiceDeps) {}

  async listByKey(promptKey: string): Promise<Paginated<PromptVersionDto>> {
    const validatedKey = validatePromptKey(promptKey);
    const items = await this.deps.repo.findByKey(validatedKey);
    const mapped = items.map(toDto);
    return {
      items: mapped,
      pagination: {
        page: 1,
        pageSize: mapped.length,
        total: mapped.length,
        hasNext: false,
      },
    };
  }

  async create(input: unknown, actor: AuditActor): Promise<PromptVersionDto> {
    const validated = this.validateCreateInput(input);
    const existing = await this.deps.repo.findByKeyAndVersion(
      validated.promptKey,
      validated.version
    );
    if (existing) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Prompt version already exists for ${validated.promptKey} v${validated.version}`,
        400
      );
    }

    const now = new Date().toISOString();
    const row: AiPromptVersionRow = {
      id: generateId(validated.promptKey, validated.version),
      promptKey: validated.promptKey,
      version: validated.version,
      promptText: validated.promptText,
      modelRole: validated.modelRole ?? null,
      isActive: 0,
      createdBy: validated.createdBy ?? (actor.id ?? null),
      createdAt: now,
    };
    await this.deps.repo.create(row);
    await this.deps.audit.log({
      action: 'promptVersion.create',
      targetType: 'promptVersion',
      targetId: row.id,
      after: row,
      actor,
    });
    return toDto(row);
  }

  async activate(id: string, actor: AuditActor): Promise<PromptVersionDto> {
    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Prompt version not found', 404);
    }
    if (before.isActive === 1) {
      return toDto(before);
    }
    const after = await this.deps.repo.activate(id);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'Prompt version not found', 404);
    }
    await this.deps.audit.log({
      action: 'promptVersion.activate',
      targetType: 'promptVersion',
      targetId: id,
      before,
      after,
      actor,
    });
    return toDto(after);
  }

  private validateCreateInput(input: unknown): AiPromptVersionCreateInput {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Request body must be an object',
        400
      );
    }
    const src = input as Record<string, unknown>;
    if (!isNonEmptyString(src.promptText)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'promptText is required',
        400
      );
    }
    const promptKey = validatePromptKey(src.promptKey);
    const version = validateVersion(src.version);

    const out: AiPromptVersionCreateInput = {
      promptKey,
      version,
      promptText: src.promptText as string,
    };
    if (src.modelRole !== undefined) {
      out.modelRole = src.modelRole === null ? null : (src.modelRole as string);
    }
    if (src.createdBy !== undefined) {
      out.createdBy = src.createdBy === null ? null : (src.createdBy as string);
    }
    return out;
  }
}
