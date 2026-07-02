export interface LogUsageInput {
  brandId: string;
  jobId: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export class UsageService {
  constructor(private db: D1Database) {}

  async logUsage(input: LogUsageInput): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO conAiUsageLogs
          (id, brandId, jobId, provider, model, inputTokens, outputTokens, estimatedCostUsd, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.brandId,
        input.jobId,
        input.provider,
        input.model,
        input.inputTokens,
        input.outputTokens,
        input.estimatedCostUsd,
        now
      )
      .run();
  }
}
