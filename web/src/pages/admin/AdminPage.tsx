/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'

type TabId = 'overview' | 'users' | 'roles' | 'plans' | 'plan-features' | 'ai-config' | 'ai-memory' | 'configs' | 'feature-flags' | 'audit-logs' | 'safety-events' | 'metric-catalog' | 'metric-rules' | 'knowledge'

const TABS: { id: TabId; labelKey: string; permission?: string }[] = [
  { id: 'overview', labelKey: 'admin.tabOverview' }, { id: 'users', labelKey: 'admin.tabUsers', permission: 'admin.users.read' }, { id: 'roles', labelKey: 'admin.tabRoles', permission: 'admin.roles.read' },
  { id: 'plans', labelKey: 'admin.tabPlans', permission: 'admin.billing.read' }, { id: 'plan-features', labelKey: 'admin.tabPlanFeatures', permission: 'admin.billing.manage' }, { id: 'ai-config', labelKey: 'admin.tabAiConfig', permission: 'admin.aiConfig.update' }, { id: 'ai-memory', labelKey: 'admin.tabAiMemory', permission: 'admin.aiMemory.read' },
  { id: 'configs', labelKey: 'admin.tabConfigs', permission: 'admin.config.read' }, { id: 'feature-flags', labelKey: 'admin.tabFeatureFlags', permission: 'admin.featureFlags.manage' }, { id: 'audit-logs', labelKey: 'admin.tabAudit', permission: 'admin.audit.read' },
  { id: 'safety-events', labelKey: 'admin.tabSafety', permission: 'admin.security.read' }, { id: 'metric-catalog', labelKey: 'admin.tabMetrics', permission: 'admin.metricCatalog.manage' }, { id: 'metric-rules', labelKey: 'admin.tabRules', permission: 'admin.metricRules.manage' },
  { id: 'knowledge', labelKey: 'admin.tabKb', permission: 'admin.education.manage' },
]

async function apiGet(url: string) {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (res.status === 401 || res.status === 403) return { success: false, error: { message: 'Access denied' } }
  return res.json()
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="admin-section"><h3>{title}</h3>{children}</div>
}

function Table({ cols, rows }: { cols: string[]; rows: any[][] }) {
  return <table><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
}

function OverviewTab({ onTab }: { onTab?: (id: TabId) => void }) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    apiGet('/api/admin/metrics').then(r => {
      setLoading(false)
      if (r.success) setMetrics(r.data)
      else setError(r.error?.message || '')
    })
  }, [])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  const cards = metrics ? [
    { label: 'Users', value: metrics.users, trend: '+11% active', tone: 'success' },
    { label: 'Premium', value: metrics.subscriptions, trend: '24% conversion', tone: 'info' },
    { label: 'AI Calls', value: metrics.aiCalls ?? '—', trend: 'quota guarded', tone: 'warning' },
    { label: 'Safety', value: metrics.safetyEvents, trend: 'red flag events', tone: 'critical' },
  ] : []
  return (
    <Section title="Dashboard Metrics">
      <div className="admin-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {cards.map((card) => (
          <div key={card.label} className="admin-metric-card" style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #6b7280)' }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, margin: '4px 0' }}>{card.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: card.tone === 'success' ? '#047857' : card.tone === 'info' ? '#0369a1' : card.tone === 'warning' ? '#b45309' : '#dc2626' }}>{card.trend}</div>
          </div>
        ))}
      </div>
      <div className="admin-overview-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <button onClick={() => onTab?.('users')} className="admin-action-btn primary"><span className="material-symbols-outlined">manage_accounts</span>Manage Users</button>
        <button onClick={() => onTab?.('plan-features')} className="admin-action-btn"><span className="material-symbols-outlined">workspace_premium</span>Plan Editor</button>
        <button onClick={() => onTab?.('audit-logs')} className="admin-action-btn"><span className="material-symbols-outlined">fact_check</span>Audit Logs</button>
      </div>
    </Section>
  )
}

function UsersTab() {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { apiGet('/api/admin/users').then(r => { setLoading(false); if (r.success) setData(r.data?.users || r.data || []); else setError(r.error?.message || '') }) }, [])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="Users"><Table cols={['ID','Email','Status']} rows={data.map((u: any) => [u.id, u.email, u.status || 'active'])} /></Section>
}

function RolesTab() {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { apiGet('/api/admin/roles').then(r => { setLoading(false); if (r.success) setData(r.data?.roles || r.data || []); else setError(r.error?.message || '') }) }, [])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="Roles"><Table cols={['Code','Name','System','Active']} rows={data.map((r: any) => [r.roleCode, r.roleName, r.systemRole ? 'Yes' : 'No', r.active ? 'Yes' : 'No'])} /></Section>
}

function PlansTab() {
  const [data, setData] = useState<any[]>([]); const [features, setFeatures] = useState<Record<string, any>>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => {
    ;(async () => {
      const r = await apiGet('/api/admin/plans')
      setLoading(false)
      if (r.success) {
        const plans = r.data?.plans || r.data || []
        setData(plans)
        const featureMap: Record<string, any> = {}
        await Promise.all(plans.map(async (p: any) => {
          const fr = await apiGet(`/api/admin/plans/${encodeURIComponent(p.planCode)}/features`)
          if (fr.success) featureMap[p.planCode] = (fr.data?.features || fr.data || []).reduce((acc: any, f: any) => { acc[f.featureCode] = f; return acc }, {})
        }))
        setFeatures(featureMap)
      } else setError(r.error?.message || '')
    })()
  }, [])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  const activePlans = data.filter((p: any) => p.active).sort((a: any, b: any) => (a.planCode === 'free' ? -1 : b.planCode === 'free' ? 1 : 0))
  const featureCodes = [...new Set(Object.values(features).flatMap((m: any) => Object.keys(m || {})))]
  const displayFeature = (_code: string, f?: any) => {
    if (!f || !f.enabled) return <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Off</span>
    if (f.quotaLimit) return <span>{f.quotaLimit}/{f.quotaWindow || 'period'}</span>
    return <span style={{ color: '#047857', fontWeight: 800 }}>On</span>
  }
  return (
    <Section title="Plans, Features, Entitlement &amp; Quota">
      <div className="admin-plans-table-wrap" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border, #e5e7eb)', background: '#fff' }}>
        <table className="admin-plans-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f8fafc' }}><th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border, #e5e7eb)' }}>Feature</th>{activePlans.map((p: any) => <th key={p.planCode} style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--border, #e5e7eb)' }}>{p.planName}</th>)}</tr></thead>
          <tbody>
            {featureCodes.map((fc) => (
              <tr key={fc} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                <td style={{ padding: 12, fontWeight: 800 }}>{fc}</td>
                {activePlans.map((p: any) => <td key={p.planCode} style={{ padding: 12, textAlign: 'center' }}>{displayFeature(fc, features[p.planCode]?.[fc])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function AiConfigTab() {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/ai-config', { credentials: 'include', headers: { Accept: 'application/json' } }).then(r => r.json()).then(r => { setLoading(false); if (r.success) { setData(r.data); setError('') } else setError(r.error?.message || '') }) }, [])
  const handleSave = async () => { setSaving(true); setMsg(''); try { const r = await fetch('/api/admin/ai-config', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data || {}) }); const b = await r.json(); if (!r.ok || !b.success) { setMsg(b.error?.message || 'Gagal menyimpan.'); } else { setMsg('Saved'); } } catch { setMsg('Tidak bisa terhubung.') } setSaving(false) }
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="AI Configuration"><div className="admin-ai-form">{data ? Object.entries(data).filter(([k]) => !['aiClinicalCopilotAllowedActions','aiClinicalCopilotForbiddenActions','aiClinicalCopilotScopeStatus','aiClinicalCopilotRuntimeEnabled'].includes(k)).map(([k, v]: [string, any]) => <div key={k} className="admin-field"><label>{k}</label><input value={typeof v === 'object' ? JSON.stringify(v) : String(v)} onChange={e => { const nv: any = {}; Object.assign(nv, data, { [k]: e.target.value }); setData(nv) }} /></div>) : null}<button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>{msg ? <p>{msg}</p> : null}</div></Section>
}

function ConfigsTab() {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [edit, setEdit] = useState<Record<string,string>>({}); const [saving, setSaving] = useState<string|null>(null); const [msg, setMsg] = useState('')
  useEffect(() => { apiGet('/api/admin/configs').then(r => { setLoading(false); if (r.success) { const c = r.data?.configs || []; setData(c); const e: Record<string,string> = {}; c.forEach((x: any) => e[x.configKey] = x.configValue); setEdit(e) } else setError(r.error?.message || '') }) }, [])
  const handleSave = async (key: string) => { setSaving(key); setMsg(''); try { const r = await fetch(`/api/admin/configs/${encodeURIComponent(key)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ configValue: edit[key] }) }); const b = await r.json(); if (!r.ok || !b.success) { setMsg(b.error?.message || `Gagal menyimpan ${key}.`); } else { setMsg(`Saved ${key}`); } } catch { setMsg('Tidak bisa terhubung.') } setSaving(null) }
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="System Configs">{data.length === 0 ? <p>No configs</p> : <table><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead><tbody>{data.map((r: any) => <tr key={r.configKey}><td>{r.configKey}</td><td><input value={edit[r.configKey] ?? ''} onChange={e => setEdit({...edit, [r.configKey]: e.target.value})} /></td><td><button onClick={() => handleSave(r.configKey)} disabled={saving === r.configKey}>Save</button></td></tr>)}</tbody></table>}{msg ? <p>{msg}</p> : null}</Section>
}

function PlanFeaturesTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    apiGet('/api/admin/plans').then(r => {
      if (r.success) setPlans(r.data?.plans || r.data || [])
    })
  }, [])

  // Derived active plan: explicit selection wins, else first loaded plan.
  const activePlan = selectedPlan || plans[0]?.planCode || ''

  useEffect(() => {
    if (!activePlan) return
    setLoading(true)
    apiGet(`/api/admin/plans/${encodeURIComponent(activePlan)}/features`).then(r => {
      setLoading(false)
      if (r.success) {
        const map: Record<string, any> = {}
        ;(r.data?.features || r.data || []).forEach((f: any) => { map[f.featureCode] = f })
        setFeatures(map)
      } else {
        setError(r.error?.message || 'Failed to load features')
      }
    })
  }, [activePlan])
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (featureCode: string) => {
    setFeatures(prev => ({ ...prev, [featureCode]: { ...(prev[featureCode] || { featureCode }), enabled: prev[featureCode]?.enabled ? 0 : 1 } }))
  }
  const setQuota = (featureCode: string, value: string) => {
    const num = value === '' ? null : Number(value)
    setFeatures(prev => ({ ...prev, [featureCode]: { ...(prev[featureCode] || { featureCode }), quotaLimit: num } }))
  }
  const setWindow = (featureCode: string, value: string) => {
    setFeatures(prev => ({ ...prev, [featureCode]: { ...(prev[featureCode] || { featureCode }), quotaWindow: value || null } }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const payload = Object.values(features).map((f: any) => ({
        featureCode: f.featureCode,
        enabled: f.enabled ? 1 : 0,
        quotaLimit: f.quotaLimit ?? null,
        quotaWindow: f.quotaWindow || null
      }))
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(activePlan)}/features`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ features: payload })
      })
      const body = await res.json()
      setMsg(body.success ? 'Saved successfully.' : (body.error?.message || 'Save failed'))
    } catch {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Plan Features">
      <div style={{ marginBottom: 16 }}>
        <label>Plan: </label>
        <select value={activePlan} onChange={e => setSelectedPlan(e.target.value)}>
          {plans.map((p: any) => <option key={p.planCode} value={p.planCode}>{p.planName}</option>)}
        </select>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="admin-error">{error}</p>}
      {Object.keys(features).length > 0 && (
        <>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead><tr><th>Feature</th><th>Enabled</th><th>Quota</th><th>Window</th></tr></thead>
            <tbody>
              {Object.values(features).map((f: any) => (
                <tr key={f.featureCode}>
                  <td>{f.featureCode}</td>
                  <td><input type="checkbox" checked={!!f.enabled} onChange={() => toggle(f.featureCode)} /></td>
                  <td><input type="number" value={f.quotaLimit ?? ''} onChange={e => setQuota(f.featureCode, e.target.value)} style={{ width: 80 }} /></td>
                  <td>
                    <select value={f.quotaWindow || ''} onChange={e => setWindow(f.featureCode, e.target.value)}>
                      <option value="">-</option>
                      <option value="day">day</option>
                      <option value="month">month</option>
                      <option value="quarter">quarter</option>
                      <option value="year">year</option>
                      <option value="lifetime">lifetime</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Features'}</button>
          {msg && <p>{msg}</p>}
        </>
      )}
    </Section>
  )
}

function GenericListTab({ title, url, cols, mapRow }: { title: string; url: string; cols: string[]; mapRow: (item: any) => any[] }) {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { apiGet(url).then(r => { setLoading(false); if (r.success) { const raw = r.data; const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.logs)) ? raw.logs : (raw && Array.isArray(raw.items)) ? raw.items : (raw && Array.isArray(raw.events)) ? raw.events : Array.isArray(raw) ? raw : []; setData(arr) } else setError(r.error?.message || '') }) }, [url])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title={title}>{data.length === 0 ? <p>No data</p> : <Table cols={cols} rows={data.map(mapRow)} />}</Section>
}

function FeatureFlagsTab() { return <GenericListTab title="Feature Flags" url="/api/admin/feature-flags" cols={['Code','Name','Enabled','Target']} mapRow={(f: any) => [f.flagCode, f.flagName, f.enabled ? 'Yes' : 'No', f.targetPlanCode || f.targetRoleCode || '-']} /> }
function AuditLogsTab() { return <GenericListTab title="Audit Logs" url="/api/admin/audit-logs" cols={['ID','User','Action','Entity','Created']} mapRow={(l: any) => [l.id, l.userId, l.action, `${l.entityType}:${l.entityId}`, l.createdAt]} /> }
function SafetyEventsTab() { return <GenericListTab title="Safety Events" url="/api/admin/safety-events" cols={['ID','User','Type','Severity','Title','Created']} mapRow={(e: any) => [e.id, e.userId, e.eventType, e.severity, e.title, e.createdAt]} /> }
function MetricCatalogTab() { return <GenericListTab title="Metric Catalog" url="/api/admin/metric-catalog" cols={['Code','Name','Category','Unit','Active']} mapRow={(m: any) => [m.metricCode, m.metricName, m.category, m.unit, m.active ? 'Yes' : 'No']} /> }
function MetricRulesTab() { return <GenericListTab title="Metric Rules" url="/api/admin/metric-rules" cols={['Code','Metric','Severity','Range','Active']} mapRow={(r: any) => [r.ruleCode, r.metricCode, r.severity, `${r.minValue} - ${r.maxValue}`, r.active ? 'Yes' : 'No']} /> }
function KnowledgeTab() { return <GenericListTab title="Knowledge Articles" url="/api/admin/knowledge-articles" cols={['Slug','Title','Category','Active']} mapRow={(a: any) => [a.slug, a.title, a.category, a.active ? 'Yes' : 'No']} /> }

function AiMemoryTab() {
  const [targetUid, setTargetUid] = useState('')
  const [status, setStatus] = useState<any>(null); const [loading, setLoading] = useState(false); const [rebuilding, setRebuilding] = useState(false); const [msg, setMsg] = useState('')
  const loadStatus = async (uid: string) => { if (!uid) return; setLoading(true); const r = await (await fetch(`/api/admin/users/${uid}/ai-memory/status`, { credentials: 'include' })).json(); setLoading(false); if (r.success) setStatus(r.data); else setMsg(r.error?.message || 'Access denied') }
  const handleRebuild = async () => { if (!targetUid) return; setRebuilding(true); setMsg(''); const r = await (await fetch(`/api/admin/users/${targetUid}/ai-memory/rebuild`, { method: 'POST', credentials: 'include' })).json(); if (r.success) setMsg(`Rebuild queued. Job #${r.data.jobId}`); else setMsg(r.error?.message || 'Failed'); setRebuilding(false) }
  return <Section title="AI Memory Admin"><div><label>User ID: <input value={targetUid} onChange={e => setTargetUid(e.target.value)} /></label><button onClick={() => loadStatus(targetUid)}>Check Status</button></div>
    {loading && <p>Loading...</p>}{msg && <p>{msg}</p>}
    {status && <div><p>Namespace: <code>{status.namespace || '-'}</code></p><p>Documents: {status.documentCount ?? 0} | Indexed: {status.indexedCount ?? 0} | Pending: {status.pendingCount ?? 0}</p>
    <p>Sprint 6: <code>{status.sprint6ClinicalCopilot?.scopeStatus || 'deferred'}</code></p><button onClick={handleRebuild} disabled={rebuilding}>{rebuilding ? 'Rebuilding...' : 'Rebuild Memory'}</button></div>}
    <div style={{marginTop:16}}><h4>Clinical Copilot Readiness</h4>
    <GenericListTab title="Readiness" url="/api/admin/ai-clinical-copilot/readiness" cols={['Scope','Runtime','Allowed','Forbidden']} mapRow={(r: any) => [r.scopeStatus || '-', r.sprint6ClinicalCopilot?.runtimeEnabled ? 'Yes' : 'No', (r.allowedActions||[]).join(', '), (r.forbiddenActions||[]).join(', ')]} /></div></Section>
}

const TAB_COMPONENTS: Record<TabId, (props: { onTab?: (id: TabId) => void }) => React.ReactNode> = {
  overview: OverviewTab, users: UsersTab, roles: RolesTab, plans: PlansTab, 'plan-features': PlanFeaturesTab, 'ai-config': AiConfigTab, 'ai-memory': AiMemoryTab,
  configs: ConfigsTab, 'feature-flags': FeatureFlagsTab, 'audit-logs': AuditLogsTab,
  'safety-events': SafetyEventsTab, 'metric-catalog': MetricCatalogTab, 'metric-rules': MetricRulesTab, knowledge: KnowledgeTab,
}

export function AdminPage() {
  const { user, roles, permissions } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('overview')
  if (!user) return <section className="settings-panel"><h2>{t('admin.pleaseLogin')}</h2></section>
  const userRoles = roles || []
  const userPermissions = permissions || []
  const isPrivilegedAdmin = userRoles.includes('superAdmin') || userRoles.includes('admin')
  const visibleTabs = TABS.filter(tb => !tb.permission || isPrivilegedAdmin || userPermissions.includes(tb.permission) || userPermissions.includes('superAdmin'))
  const TabContent = TAB_COMPONENTS[tab]
  return (
    <section className="settings-panel admin-page">
      <div className="page-heading"><h2>{t('admin.adminTitle')}</h2></div>
      <nav className="admin-tabs">{visibleTabs.map(tb => <button key={tb.id} className={tab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>{t(tb.labelKey)}</button>)}</nav>
      <div className="admin-content"><TabContent onTab={setTab} /></div>
    </section>
  )
}
