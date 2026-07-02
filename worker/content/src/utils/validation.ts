import { AppError, errorCodes } from './errors.js';

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

export function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function isIntegerId(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) > 0;
}

export function validateEnum<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (allowed.includes(value as T)) {
    return value as T;
  }
  throw new AppError(
    errorCodes.VALIDATION_ERROR,
    `Invalid value. Allowed: ${allowed.join(', ')}`,
    400
  );
}

export function sanitizeString(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}
