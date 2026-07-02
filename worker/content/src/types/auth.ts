import type { Context } from 'hono';

export type InternalUserRole =
  | 'owner'
  | 'marketingAdmin'
  | 'medicalReviewer'
  | 'designer'
  | 'aiConfigAdmin'
  | 'viewer';

export interface InternalUser {
  id: string;
  roles: InternalUserRole[];
  permissions?: string[];
}

export type Permission =
  | 'content.dashboard.read'
  | 'content.brand.read'
  | 'content.brand.update'
  | 'content.pillar.read'
  | 'content.pillar.manage'
  | 'content.campaign.read'
  | 'content.campaign.create'
  | 'content.campaign.update'
  | 'content.idea.read'
  | 'content.idea.generate'
  | 'content.idea.approve'
  | 'content.draft.read'
  | 'content.draft.generate'
  | 'content.draft.update'
  | 'content.draft.export'
  | 'content.revision.read'
  | 'content.safety.run'
  | 'content.safety.review'
  | 'content.source_reference.manage'
  | 'content.approve'
  | 'content.reject'
  | 'content.audit.read'
  | 'content.aiConfig.manage'
  | 'content.aiJob.read'
  | 'content.aiJob.retry'
  | 'content.aiUsage.read'
  | 'content.quota.manage';

export type AuthResolver = (c: Context) => Promise<InternalUser | null>;

// ponytail: global module augmentation so c.get('user') / c.set('user', user)
// is typed across the worker. Only InternalUser is added; nothing else.
declare module 'hono' {
  interface ContextVariableMap {
    user: InternalUser;
  }
}
