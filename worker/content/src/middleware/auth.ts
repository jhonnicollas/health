import type { Context, MiddlewareHandler } from 'hono';
import type { AuthResolver, InternalUser, InternalUserRole } from '../types/auth.js';
import { unauthorized } from '../utils/responses.js';

const KNOWN_ROLES: ReadonlySet<InternalUserRole> = new Set<InternalUserRole>([
  'owner',
  'marketingAdmin',
  'medicalReviewer',
  'designer',
  'aiConfigAdmin',
  'viewer',
]);

export function mockAuthResolver(user?: InternalUser | null): AuthResolver {
  return async () => user ?? null;
}

export function headerMockAuthResolver(c: Context): Promise<InternalUser | null> {
  const env = c.env as { ENVIRONMENT?: string } | undefined;
  const envName = env?.ENVIRONMENT;
  if (envName !== 'local' && envName !== 'test') return Promise.resolve(null);

  const id = c.req.header('x-content-user-id')?.trim();
  if (!id) return Promise.resolve(null);

  const rolesHeader = c.req.header('x-content-user-roles') ?? '';
  // ponytail: drop unknown role strings silently — better than failing the whole
  // request when one role name is mistyped in a local header.
  const roles = rolesHeader
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is InternalUserRole => KNOWN_ROLES.has(r as InternalUserRole));

  return Promise.resolve({ id, roles });
}

export function createAuthMiddleware(resolver: AuthResolver): MiddlewareHandler {
  return async (c, next) => {
    const user = await resolver(c);
    if (!user) return unauthorized(c);
    c.set('user', user);
    await next();
  };
}
