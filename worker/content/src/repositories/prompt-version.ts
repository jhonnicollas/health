import type {
  AiPromptVersionCreateInput,
  AiPromptVersionRow,
} from '../types/ai.js';

const COLUMNS =
  'id, promptKey, version, promptText, modelRole, isActive, createdBy, createdAt';

export class PromptVersionRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<AiPromptVersionRow | null> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM conAiPromptVersions WHERE id = ?`)
      .bind(id)
      .first<AiPromptVersionRow>();
  }

  async findByKey(promptKey: string): Promise<AiPromptVersionRow[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiPromptVersions WHERE promptKey = ? ORDER BY version DESC`
      )
      .bind(promptKey)
      .all<AiPromptVersionRow>();
    return result.results ?? [];
  }

  async findActiveByKey(promptKey: string): Promise<AiPromptVersionRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiPromptVersions WHERE promptKey = ? AND isActive = 1`
      )
      .bind(promptKey)
      .first<AiPromptVersionRow>();
  }

  async loadActive(promptKey: string): Promise<AiPromptVersionRow | null> {
    return this.findActiveByKey(promptKey);
  }

  async findByKeyAndVersion(
    promptKey: string,
    version: number
  ): Promise<AiPromptVersionRow | null> {
    return this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiPromptVersions WHERE promptKey = ? AND version = ?`
      )
      .bind(promptKey, version)
      .first<AiPromptVersionRow>();
  }

  async countByKey(promptKey: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM conAiPromptVersions WHERE promptKey = ?')
      .bind(promptKey)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async create(row: AiPromptVersionRow): Promise<AiPromptVersionRow> {
    await this.db
      .prepare(
        `INSERT INTO conAiPromptVersions (id, promptKey, version, promptText, modelRole, isActive, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.promptKey,
        row.version,
        row.promptText,
        row.modelRole,
        row.isActive,
        row.createdBy,
        row.createdAt
      )
      .run();
    return row;
  }

  // ponytail: explicit two-step so existing active row is always deactivated
  // before the new one is flipped. Two statements; D1 has no transactions
  // exposed here, but the unique index `idxPromptsOneActive` enforces the
  // invariant if a concurrent writer slips in.
  async activate(id: string): Promise<AiPromptVersionRow | null> {
    const target = await this.findById(id);
    if (!target) return null;
    await this.db
      .prepare('UPDATE conAiPromptVersions SET isActive = 0 WHERE promptKey = ?')
      .bind(target.promptKey)
      .run();
    await this.db
      .prepare('UPDATE conAiPromptVersions SET isActive = 1 WHERE id = ?')
      .bind(id)
      .run();
    return this.findById(id);
  }
}
