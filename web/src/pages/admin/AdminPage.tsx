import { useState } from 'react'
import { useAuth } from '../../context/auth'
import { AdminSidebar } from '../../components/admin/AdminSidebar'
import { OverviewTab } from '../../components/admin/tabs/OverviewTab'
import { UsersTab } from '../../components/admin/tabs/UsersTab'
import { RolesTab } from '../../components/admin/tabs/RolesTab'
import { PlansTab } from '../../components/admin/tabs/PlansTab'
import { PlanFeaturesTab } from '../../components/admin/tabs/PlanFeaturesTab'
import { SubscriptionsTab } from '../../components/admin/tabs/SubscriptionsTab'
import { AiConfigTab } from '../../components/admin/tabs/AiConfigTab'
import { AiMemoryTab } from '../../components/admin/tabs/AiMemoryTab'
import { ConfigsTab } from '../../components/admin/tabs/ConfigsTab'
import { FeatureFlagsTab } from '../../components/admin/tabs/FeatureFlagsTab'
import { EducationTab } from '../../components/admin/tabs/EducationTab'
import { AuditLogsTab } from '../../components/admin/tabs/AuditLogsTab'
import { SafetyEventsTab } from '../../components/admin/tabs/SafetyEventsTab'
import { MetricCatalogTab } from '../../components/admin/tabs/MetricCatalogTab'
import { MetricRulesTab } from '../../components/admin/tabs/MetricRulesTab'
import { KnowledgeTab } from '../../components/admin/tabs/KnowledgeTab'
import { TABS, type TabId } from './types'
import type { ReactNode } from 'react'

const TAB_COMPONENTS: Record<TabId, (props: { onTab?: (id: TabId) => void }) => ReactNode> = {
  overview: OverviewTab,
  users: UsersTab,
  roles: RolesTab,
  plans: PlansTab,
  'plan-features': PlanFeaturesTab,
  subscriptions: SubscriptionsTab,
  'ai-config': AiConfigTab,
  'ai-memory': AiMemoryTab,
  configs: ConfigsTab,
  'feature-flags': FeatureFlagsTab,
  education: EducationTab,
  'audit-logs': AuditLogsTab,
  'safety-events': SafetyEventsTab,
  'metric-catalog': MetricCatalogTab,
  'metric-rules': MetricRulesTab,
  knowledge: KnowledgeTab,
}

export function AdminPage() {
  const { user, roles, permissions } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  if (!user) return <section className="settings-panel"><h2>Please login</h2></section>
  const userRoles = roles || []
  const userPermissions = permissions || []
  const isPrivilegedAdmin = userRoles.includes('superAdmin') || userRoles.includes('admin')
  const visibleTabs = TABS.filter(
    tb => !tb.permission || isPrivilegedAdmin || userPermissions.includes(tb.permission) || userPermissions.includes('superAdmin'),
  )
  const TabContent = TAB_COMPONENTS[tab]
  return (
    <section className="settings-panel admin-page">
      <div className="page-heading"><h2>Admin Panel</h2></div>
      <AdminSidebar tabs={visibleTabs} active={tab} onChange={setTab} />
      <div className="admin-content"><TabContent onTab={setTab} /></div>
    </section>
  )
}
