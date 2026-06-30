export type TabId = 'overview' | 'users' | 'roles' | 'plans' | 'plan-features' | 'subscriptions' | 'ai-config' | 'ai-memory' | 'configs' | 'feature-flags' | 'education' | 'audit-logs' | 'safety-events' | 'metric-catalog' | 'metric-rules' | 'knowledge'

export interface TabProps {
  onTab?: (id: TabId) => void
}

export const TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users', permission: 'admin.users.read' },
  { id: 'roles', label: 'Roles', permission: 'admin.roles.read' },
  { id: 'plans', label: 'Plans', permission: 'admin.billing.read' },
  { id: 'plan-features', label: 'Plan Features', permission: 'admin.billing.manage' },
  { id: 'subscriptions', label: 'Subscriptions', permission: 'admin.billing.read' },
  { id: 'ai-config', label: 'AI Config', permission: 'admin.aiConfig.update' },
  { id: 'ai-memory', label: 'AI Memory', permission: 'admin.aiMemory.read' },
  { id: 'configs', label: 'Configs', permission: 'admin.config.read' },
  { id: 'feature-flags', label: 'Feature Flags', permission: 'admin.featureFlags.manage' },
  { id: 'education', label: 'Education', permission: 'admin.education.manage' },
  { id: 'audit-logs', label: 'Audit Logs', permission: 'admin.audit.read' },
  { id: 'safety-events', label: 'Safety Events', permission: 'admin.security.read' },
  { id: 'metric-catalog', label: 'Metric Catalog', permission: 'admin.metricCatalog.manage' },
  { id: 'metric-rules', label: 'Metric Rules', permission: 'admin.metricRules.manage' },
  { id: 'knowledge', label: 'Knowledge Base', permission: 'admin.education.manage' },
]
