import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { errorCodes } from './errors.js';

export function success<T>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
  return c.json({ ok: true, data }, status);
}

export function fail(c: Context, code: string, message: string, status: ContentfulStatusCode = 400): Response {
  return c.json({ ok: false, error: { code, message } }, status);
}

export function notFound(c: Context): Response {
  return fail(c, errorCodes.NOT_FOUND, 'Resource not found', 404);
}

export function unauthorized(c: Context): Response {
  return fail(c, errorCodes.UNAUTHORIZED, 'Unauthorized', 401);
}

export function forbidden(c: Context): Response {
  return fail(c, errorCodes.FORBIDDEN, 'Forbidden', 403);
}
