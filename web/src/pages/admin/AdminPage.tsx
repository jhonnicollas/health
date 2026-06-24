/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

type TabId = 'overview' | 'users' | 'roles' | 'plans' | 'ai-config' | 'configs' | 'feature-flags' | 'audit-logs' | 'safety-events' | 'metric-catalog' | 'metric-rules' | 'knowledge'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'users', label: 'Users' }, { id: 'roles', label: 'Roles' },
  { id: 'plans', label: 'Plans' }, { id: 'ai-config', label: 'AI Config' }, { id: 'configs', label: 'Configs' },
  { id: 'feature-flags', label: 'Features' }, { id: 'audit-logs', label: 'Audit' }, { id: 'safety-events', label: 'Safety' },
  { id: 'metric-catalog', label: 'Metrics' }, { id: 'metric-rules', label: 'Rules' }, { id: 'knowledge', label: 'KB' },
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

function OverviewTab() {
  return <p>Sprint 5 Admin Panel. Select a tab from above.</p>
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
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { apiGet('/api/admin/plans').then(r => { setLoading(false); if (r.success) setData(r.data?.plans || r.data || []); else setError(r.error?.message || '') }) }, [])
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="Plans"><Table cols={['Code','Name','Interval','Active']} rows={data.map((p: any) => [p.planCode, p.planName, p.billingInterval, p.active ? 'Yes' : 'No'])} /></Section>
}

function AiConfigTab() {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/ai-config', { credentials: 'include', headers: { Accept: 'application/json' } }).then(r => r.json()).then(r => { setLoading(false); if (r.success) { setData(r.data); setError('') } else setError(r.error?.message || '') }) }, [])
  const handleSave = async () => { setSaving(true); setMsg(''); await fetch('/api/admin/ai-config', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data || {}) }); setMsg('Saved'); setSaving(false) }
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="AI Configuration"><div className="admin-ai-form">{data ? Object.entries(data).filter(([k]) => !['aiClinicalCopilotAllowedActions','aiClinicalCopilotForbiddenActions','aiClinicalCopilotScopeStatus','aiClinicalCopilotRuntimeEnabled'].includes(k)).map(([k, v]: [string, any]) => <div key={k} className="admin-field"><label>{k}</label><input value={typeof v === 'object' ? JSON.stringify(v) : String(v)} onChange={e => { const nv: any = {}; Object.assign(nv, data, { [k]: e.target.value }); setData(nv) }} /></div>) : null}<button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>{msg ? <p>{msg}</p> : null}</div></Section>
}

function ConfigsTab() {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [edit, setEdit] = useState<Record<string,string>>({}); const [saving, setSaving] = useState<string|null>(null); const [msg, setMsg] = useState('')
  useEffect(() => { apiGet('/api/admin/configs').then(r => { setLoading(false); if (r.success) { const c = r.data?.configs || []; setData(c); const e: Record<string,string> = {}; c.forEach((x: any) => e[x.configKey] = x.configValue); setEdit(e) } else setError(r.error?.message || '') }) }, [])
  const handleSave = async (key: string) => { setSaving(key); setMsg(''); await fetch(`/api/admin/configs/${encodeURIComponent(key)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ configValue: edit[key] }) }); setMsg(`Saved ${key}`); setSaving(null) }
  if (loading) return <p>Loading...</p>
  if (error) return <p className="admin-error">{error}</p>
  return <Section title="System Configs">{data.length === 0 ? <p>No configs</p> : <table><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead><tbody>{data.map((r: any) => <tr key={r.configKey}><td>{r.configKey}</td><td><input value={edit[r.configKey] ?? ''} onChange={e => setEdit({...edit, [r.configKey]: e.target.value})} /></td><td><button onClick={() => handleSave(r.configKey)} disabled={saving === r.configKey}>Save</button></td></tr>)}</tbody></table>}{msg ? <p>{msg}</p> : null}</Section>
}

function GenericListTab({ title, url, cols, mapRow }: { title: string; url: string; cols: string[]; mapRow: (item: any) => any[] }) {
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { apiGet(url).then(r => { setLoading(false); if (r.success) setData(r.data || []); else setError(r.error?.message || '') }) }, [url])
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

const TAB_COMPONENTS: Record<TabId, () => React.ReactNode> = {
  overview: OverviewTab, users: UsersTab, roles: RolesTab, plans: PlansTab, 'ai-config': AiConfigTab,
  configs: ConfigsTab, 'feature-flags': FeatureFlagsTab, 'audit-logs': AuditLogsTab,
  'safety-events': SafetyEventsTab, 'metric-catalog': MetricCatalogTab, 'metric-rules': MetricRulesTab, knowledge: KnowledgeTab,
}

export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  const TabContent = TAB_COMPONENTS[tab]
  return (
    <section className="settings-panel admin-page">
      <div className="page-heading"><h2>Admin Panel</h2></div>
      <nav className="admin-tabs">{TABS.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
      <div className="admin-content"><TabContent /></div>
    </section>
  )
}
