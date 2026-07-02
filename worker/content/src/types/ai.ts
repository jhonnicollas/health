// AI domain types for conAiConfigs, conAiPromptVersions, conAiGenerationJobs,
// conAiUsageLogs, and conAiQuotas. JSON columns are stored as strings in D1.

export type AiPurpose = 'idea_generation' | 'draft_generation' | 'safety_check' | 'health_classifier';
export type AiProviderName = 'mock' | 'openai' | 'google' | 'anthropic' | 'workersai';
export type AiJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AiJobType = AiPurpose;
export type QuotaPeriod = 'daily' | 'monthly';

export interface AiConfigRow {
  id: string;
  brandId: string;
  provider: AiProviderName;
  model: string;
  purpose: AiPurpose;
  temperature: number | null;
  maxTokens: number | null;
  timeoutMs: number | null;
  fallbackOrder: number;
  isActive: number; // 0 or 1
  secretRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfigCreateInput {
  brandId: string;
  provider: AiProviderName;
  model: string;
  purpose: AiPurpose;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  fallbackOrder?: number;
  isActive?: boolean;
  secretRef?: string | null;
}

export type AiConfigUpdateInput = Partial<
  Omit<AiConfigCreateInput, 'brandId' | 'purpose'>
>;

export interface AiPromptVersionRow {
  id: string;
  promptKey: string;
  version: number;
  promptText: string;
  modelRole: string | null;
  isActive: number; // 0 or 1
  createdBy: string | null;
  createdAt: string;
}

export interface AiPromptVersionCreateInput {
  promptKey: string;
  version: number;
  promptText: string;
  modelRole?: string | null;
  createdBy?: string | null;
}

export interface AiGenerationJobRow {
  id: string;
  brandId: string;
  jobType: AiJobType;
  status: AiJobStatus;
  idempotencyKey: string;
  inputJson: string;
  outputJson: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  modelUsed: string | null;
  promptVersionId: string | null;
  tokenUsageJson: string | null;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface AiUsageRow {
  id: string;
  brandId: string;
  jobId: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface AiQuotaRow {
  id: string;
  brandId: string;
  period: QuotaPeriod;
  maxJobs: number | null;
  maxTokens: number | null;
  maxCostUsd: number | null;
  usedJobs: number;
  usedTokens: number;
  usedCostUsd: number;
  resetsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AiGenerateResult<T> {
  data: T;
  rawText: string;
  modelUsed: string;
  tokenUsage: TokenUsage;
  promptVersionId: string | null;
}

export interface AiProvider {
  name: AiProviderName;
  generateJson<T>(config: AiConfigRow, promptText: string): Promise<AiGenerateResult<T>>;
}
