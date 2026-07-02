import type { MiddlewareHandler } from 'hono';
import type { InternalUser, InternalUserRole, Permission } from '../types/auth.js';
import { forbidden, unauthorized } from '../utils/responses.js';

export const ROLE_PERMISSIONS: Record<InternalUserRole, readonly Permission[]> = {
  owner: [
    'content.dashboard.read',
    'content.brand.read',
    'content.brand.update',
    'content.pillar.read',
    'content.pillar.manage',
    'content.campaign.read',
    'content.campaign.create',
    'content.campaign.update',
    'content.idea.read',
    'content.idea.generate',
    'content.idea.approve',
    'content.draft.read',
    'content.draft.generate',
    'content.draft.update',
    'content.draft.export',
    'content.revision.read',
    'content.safety.run',
    'content.safety.review',
    'content.source_reference.manage',
    'content.approve',
    'content.reject',
    'content.audit.read',
    'content.aiConfig.manage',
    'content.aiJob.read',
    'content.aiJob.retry',
    'content.aiUsage.read',
    'content.quota.manage',
  ] as const satisfies readonly Permission[],
  marketingAdmin: [
    'content.dashboard.read',
    'content.brand.read',
    'content.pillar.read',
    'content.pillar.manage',
    'content.campaign.read',
    'content.campaign.create',
    'content.campaign.update',
    'content.idea.read',
    'content.idea.generate',
    'content.idea.approve',
    'content.draft.read',
    'content.draft.generate',
    'content.draft.update',
    'content.draft.export',
    'content.revision.read',
    'content.safety.run',
    'content.source_reference.manage',
    'content.approve',
    'content.reject',
  ] as const satisfies readonly Permission[],
  medicalReviewer: [
    'content.dashboard.read',
    'content.brand.read',
    'content.pillar.read',
    'content.campaign.read',
    'content.idea.read',
    'content.draft.read',
    'content.revision.read',
    'content.safety.run',
    'content.safety.review',
    'content.source_reference.manage',
    'content.approve',
    'content.reject',
    'content.draft.export',
  ] as const satisfies readonly Permission[],
  designer: [
    'content.dashboard.read',
    'content.brand.read',
    'content.pillar.read',
    'content.campaign.read',
    'content.idea.read',
    'content.draft.read',
    'content.revision.read',
  ] as const satisfies readonly Permission[],
  aiConfigAdmin: [
    'content.dashboard.read',
    'content.brand.read',
    'content.pillar.read',
    'content.campaign.read',
    'content.idea.read',
    'content.draft.read',
    'content.revision.read',
    'content.aiConfig.manage',
    'content.aiJob.read',
    'content.aiJob.retry',
    'content.aiUsage.read',
    'content.quota.manage',
  ] as const satisfies readonly Permission[],
  viewer: [
    'content.dashboard.read',
    'content.brand.read',
    'content.pillar.read',
    'content.campaign.read',
    'content.idea.read',
    'content.draft.read',
    'content.revision.read',
  ] as const satisfies readonly Permission[],
};

export function getPermissionsForRoles(roles: InternalUserRole[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role]) out.add(p);
  }
  return out;
}

export function hasPermission(user: InternalUser, permission: Permission): boolean {
  if (user.permissions?.includes(permission)) return true;
  return getPermissionsForRoles(user.roles).has(permission);
}

export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user') as InternalUser | undefined;
    if (!user) return unauthorized(c);
    if (!hasPermission(user, permission)) return forbidden(c);
    await next();
  };
}
