export class AppError extends Error {
  isOperational = true;

  constructor(
    public code: string,
    public message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AI_PROVIDER_FAILED: 'AI_PROVIDER_FAILED',
  REVISION_MISMATCH: 'REVISION_MISMATCH',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_PERMISSION_DENIED: 'APPROVAL_PERMISSION_DENIED',
  SOURCE_TRACE_REQUIRED: 'SOURCE_TRACE_REQUIRED',
  SAFETY_BLOCKED: 'SAFETY_BLOCKED',
} as const;

export function fromError(e: unknown): { code: string; status: number; message: string } {
  if (e instanceof AppError) {
    return { code: e.code, status: e.status, message: e.message };
  }
  if (e instanceof Error) {
    return { code: errorCodes.INTERNAL_ERROR, status: 500, message: e.message };
  }
  return { code: errorCodes.INTERNAL_ERROR, status: 500, message: String(e ?? 'Unknown error') };
}
