/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context/auth'
import { useToast } from '../../components/Toast'

type TabId = 'overview' | 'users' | 'roles' | 'plans' | 'plan-features' | 'subscriptions' | 'ai-config' | 'ai-memory' | 'configs' | 'feature-flags' | 'education' | 'audit-logs' | 'safety-events' | 'metric-catalog' | 'metric-rules' | 'knowledge'

const TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'users', label: 'Users', permission: 'admin.users.read' }, { id: 'roles', label: 'Roles', permission: 'admin.roles.read' },
  { id: 'plans', label: 'Plans', permission: 'admin.billing.read' }, { id: 'plan-features', label: 'Plan Features', permission: 'admin.billing.manage' }, { id: 'subscriptions', label: 'Subscriptions', permission: 'admin.billing.read' },
  { id: 'ai-config', label: 'AI Config', permission: 'admin.aiConfig.update' }, { id: 'ai-memory', label: 'AI Memory', permission: 'admin.aiMemory.read' },
  { id: 'configs', label: 'Configs', permission: 'admin.config.read' }, { id: 'feature-flags', label: 'Feature Flags', permission: 'admin.featureFlags.manage' },
  { id: 'education', label: 'Education', permission: 'admin.education.manage' },
  { id: 'audit-logs', label: 'Audit Logs', permission: 'admin.audit.read' }, { id: 'safety-events', label: 'Safety Events', permission: 'admin.security.read' },
  { id: 'metric-catalog', label: 'Metric Catalog', permission: 'admin.metricCatalog.manage' }, { id: 'metric-rules', label: 'Metric Rules', permission: 'admin.metricRules.manage' },
  { id: 'knowledge', label: 'Knowledge Base', permission: 'admin.education.manage' },
]

async function apiGet(url: string) {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (res.status === 401 || res.status === 403) return { success: false, error: { message: 'Access denied' } }
  return res.json()
}

async function apiMut(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return res.json()
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="admin-section"><h3>{title}</h3>{children}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="modal-content" style={{ background: '#fff', borderRadius: 16, padding: 24, minWidth: 400, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>&times;</button></div>
        {children}
      </div>
    </div>
  )
}

function Loading() { return <p style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>Loading...</p> }
function ErrorMsg({ msg }: { msg: string }) { return <p className="admin-error">{msg}</p> }

function useList<T = any>(url: string): { data: T[]; loading: boolean; error: string; refresh: () => void } {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    setLoading(true)
    apiGet(url).then(r => {
      setLoading(false)
      if (r.success) {
        const raw = r.data
        const arr = Array.isArray(raw) ? raw
          : Array.isArray(raw?.logs) ? raw.logs
          : Array.isArray(raw?.events) ? raw.events
          : Array.isArray(raw?.items) ? raw.items
          : Array.isArray(raw?.results) ? raw.results
          : []
        setData(arr); setError('')
      }
      else setError(r.error?.message || 'Gagal memuat.')
    })
  }, [url, tick])
  return { data, loading, error, refresh }
}

/* ---- Overview ---- */

function OverviewTab({ onTab }: { onTab?: (id: TabId) => void }) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiGet('/api/admin/metrics').then(r => { setLoading(false); if (r.success) setMetrics(r.data) })
  }, [])
  if (loading) return <Loading />
  const cards = metrics ? [
    { label: 'Users', value: metrics.users, trend: '+11% active', tone: 'success' },
    { label: 'Premium', value: metrics.subscriptions, trend: '24% conversion', tone: 'info' },
    { label: 'AI Calls', value: metrics.aiCalls ?? '—', trend: 'quota guarded', tone: 'warning' },
    { label: 'Safety', value: metrics.safetyEvents, trend: 'red flag events', tone: 'critical' },
  ] : []
  return (
    <Section title="Dashboard Metrics">
      <div className="admin-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {cards.map(c => (
          <div key={c.label} className="admin-metric-card" style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary, #6b7280)' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, margin: '4px 0' }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.tone === 'success' ? '#047857' : c.tone === 'info' ? '#0369a1' : c.tone === 'warning' ? '#b45309' : '#dc2626' }}>{c.trend}</div>
          </div>
        ))}
      </div>
      <div className="admin-overview-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <button onClick={() => onTab?.('users')} className="admin-action-btn"><span className="material-symbols-outlined">manage_accounts</span>Manage Users</button>
        <button onClick={() => onTab?.('plan-features')} className="admin-action-btn"><span className="material-symbols-outlined">workspace_premium</span>Plan Editor</button>
        <button onClick={() => onTab?.('audit-logs')} className="admin-action-btn"><span className="material-symbols-outlined">fact_check</span>Audit Logs</button>
      </div>
    </Section>
  )
}

/* ---- Users ---- */

function UsersTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/users?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = search ? data.filter((u: any) => (u.email || '').toLowerCase().includes(search.toLowerCase()) || (u.displayName || '').toLowerCase().includes(search.toLowerCase())) : data

  const handleEdit = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/users/${editing.userId}/status`, { active: editing.active })
    if (r.success) { toast.show('User berhasil diupdate.', 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal update user.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Users">
      <input className="input-field" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12, width: 280 }} />
      <table><thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Active</th><th>Roles</th><th>Plan</th><th>Created</th><th></th></tr></thead>
        <tbody>
          {filtered.map((u: any) => (
            <tr key={u.userId}>
              <td>{u.userId}</td><td>{u.email}</td><td>{u.displayName}</td>
              <td style={{ color: u.active ? '#047857' : '#dc2626' }}>{u.active ? 'Active' : 'Inactive'}</td>
              <td>{(u.roles || []).join(', ')}</td><td>{u.subscription?.planCode || 'none'}</td>
              <td>{u.createdAt?.slice(0, 10)}</td>
              <td><button className="btn-primary" onClick={() => setEditing(u)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`User #${editing.userId}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Email:</label> <strong>{editing.email}</strong></div>
            <div><label>Roles:</label> <strong>{(editing.roles || []).join(', ') || 'none'}</strong></div>
            <div><label>Plan:</label> <strong>{editing.subscription?.planCode || 'none'}</strong></div>
            <div><label>Active:</label> <select value={editing.active ? 'active' : 'disabled'} onChange={e => setEditing({ ...editing, active: e.target.value === 'active' })}>
              <option value="active">Active</option><option value="disabled">Disabled</option>
            </select></div>
            <button className="btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Update Status'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Roles ---- */

function RolesTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/roles')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'add'|'edit'|null>(null)
  const [form, setForm] = useState<any>({})

  const openNew = () => { setForm({ roleCode: '', roleName: '', systemRole: false, active: true }); setMode('add'); setEditing({}) }
  const openEdit = (r: any) => { setForm({ ...r }); setMode('edit'); setEditing(r) }

  const handleSave = async () => {
    setSaving(true)
    const url = mode === 'add' ? '/api/admin/roles' : `/api/admin/roles/${encodeURIComponent(form.roleCode)}`
    const r = await apiMut(mode === 'add' ? 'POST' : 'PUT', url, { roleName: form.roleName, active: form.active ? 1 : 0 })
    if (r.success) { toast.show(mode === 'add' ? 'Role dibuat.' : 'Role diupdate.', 'success'); setMode(null); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Roles">
      <button className="btn-primary" onClick={openNew} style={{ marginBottom: 12 }}>+ Add Role</button>
      <table><thead><tr><th>Code</th><th>Name</th><th>System</th><th>Active</th><th></th></tr></thead>
        <tbody>{data.map((r: any) => (
          <tr key={r.roleCode}><td>{r.roleCode}</td><td>{r.roleName}</td><td>{r.systemRole ? 'Yes' : 'No'}</td><td style={{ color: r.active ? '#047857' : '#dc2626' }}>{r.active ? 'Yes' : 'No'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(r)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={mode === 'add' ? 'New Role' : `Edit ${form.roleCode}`} onClose={() => { setMode(null); setEditing(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Code:</label> <input className="input-field" value={form.roleCode} onChange={e => setForm({ ...form, roleCode: e.target.value })} disabled={mode === 'edit'} /></div>
            <div><label>Name:</label> <input className="input-field" value={form.roleName || ''} onChange={e => setForm({ ...form, roleName: e.target.value })} /></div>
            <div><label>Active:</label> <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Plans ---- */

function PlansTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/plans')
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'add'|'edit'|null>(null)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    if (data.length === 0) return
    setFeaturesLoading(true)
    const fm: Record<string, any> = {}
    Promise.all(data.map(async (p: any) => {
      const fr = await apiGet(`/api/admin/plans/${encodeURIComponent(p.planCode)}/features`)
      if (fr.success) fm[p.planCode] = (fr.data?.features || fr.data || []).reduce((acc: any, f: any) => { acc[f.featureCode] = f; return acc }, {})
    })).then(() => { setFeatures(fm); setFeaturesLoading(false) })
  }, [data])

  const openNew = () => { setForm({ planCode: '', planName: '', billingInterval: 'monthly', priceAmount: 0, currency: 'IDR', active: true, trialDays: 0, sortOrder: 0 }); setMode('add'); setEditing({}) }
  const openEdit = (p: any) => { setForm({ ...p, priceAmount: p.priceAmount ?? 0, trialDays: p.trialDays ?? 0, sortOrder: p.sortOrder ?? 0 }); setMode('edit'); setEditing(p) }

  const handleSave = async () => {
    setSaving(true)
    const url = mode === 'add' ? '/api/admin/plans' : `/api/admin/plans/${encodeURIComponent(form.planCode)}`
    const r = await apiMut(mode === 'add' ? 'POST' : 'PUT', url, { planName: form.planName, billingInterval: form.billingInterval, priceAmount: Number(form.priceAmount), currency: form.currency, active: form.active, trialDays: Number(form.trialDays), sortOrder: Number(form.sortOrder) })
    if (r.success) { toast.show(mode === 'add' ? 'Plan dibuat.' : 'Plan diupdate.', 'success'); setMode(null); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  const handleDelete = async (planCode: string) => {
    if (!confirm(`Hapus plan ${planCode}? Plan akan dinonaktifkan.`)) return
    const r = await apiMut('DELETE', `/api/admin/plans/${encodeURIComponent(planCode)}`)
    if (r.success) { toast.show(`${planCode} dihapus.`, 'success'); refresh() }
    else toast.show(r.error?.message || 'Gagal menghapus.', 'error')
  }

  const activePlans = data.filter((p: any) => p.active).sort((a: any, b: any) => (a.planCode === 'free' ? -1 : b.planCode === 'free' ? 1 : 0))
  const featureCodes = [...new Set(Object.values(features).flatMap((m: any) => Object.keys(m || {})))]

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Plans, Features & Entitlement">
      <button className="btn-primary" onClick={openNew} style={{ marginBottom: 12 }}>+ Add Plan</button>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ fontSize: 12 }}><thead><tr><th>Code</th><th>Name</th><th>Interval</th><th>Price</th><th>Active</th><th>Sort</th><th></th></tr></thead>
          <tbody>{data.map((p: any) => (
            <tr key={p.planCode}><td>{p.planCode}</td><td>{p.planName}</td><td>{p.billingInterval}</td><td>{p.priceAmount} {p.currency}</td><td style={{ color: p.active ? '#047857' : '#9ca3af' }}>{p.active ? 'Yes' : 'No'}</td><td>{p.sortOrder}</td>
              <td style={{ display: 'flex', gap: 4 }}><button className="btn-primary" onClick={() => openEdit(p)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button>
              {p.planCode !== 'free' && <button className="btn-secondary" onClick={() => handleDelete(p.planCode)} style={{ fontSize: 12, padding: '2px 8px', color: '#dc2626' }}>Delete</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {featuresLoading ? <Loading /> : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border, #e5e7eb)', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc' }}><th style={{ padding: 12, textAlign: 'left' }}>Feature</th>{activePlans.map((p: any) => <th key={p.planCode} style={{ padding: 12, textAlign: 'center' }}>{p.planName}</th>)}</tr></thead>
            <tbody>
              {featureCodes.map(fc => (
                <tr key={fc} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                  <td style={{ padding: 12, fontWeight: 800 }}>{fc}</td>
                  {activePlans.map((p: any) => {
                    const f = features[p.planCode]?.[fc]
                    return <td key={p.planCode} style={{ padding: 12, textAlign: 'center' }}>{!f || !f.enabled ? <span style={{ color: '#9ca3af' }}>Off</span> : f.quotaLimit ? <span>{f.quotaLimit}/{f.quotaWindow || 'period'}</span> : <span style={{ color: '#047857', fontWeight: 800 }}>On</span>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={mode === 'add' ? 'New Plan' : `Edit ${form.planCode}`} onClose={() => { setMode(null); setEditing(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Code:</label> <input className="input-field" value={form.planCode} onChange={e => setForm({ ...form, planCode: e.target.value })} disabled={mode === 'edit'} /></div>
            <div><label>Name:</label> <input className="input-field" value={form.planName || ''} onChange={e => setForm({ ...form, planName: e.target.value })} /></div>
            <div><label>Interval:</label> <select value={form.billingInterval} onChange={e => setForm({ ...form, billingInterval: e.target.value })}><option value="free">free</option><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="yearly">yearly</option><option value="manual">manual</option></select></div>
            <div><label>Price:</label> <input className="input-field" type="number" value={form.priceAmount} onChange={e => setForm({ ...form, priceAmount: e.target.value })} /></div>
            <div><label>Trial Days:</label> <input className="input-field" type="number" value={form.trialDays} onChange={e => setForm({ ...form, trialDays: e.target.value })} /></div>
            <div><label>Sort Order:</label> <input className="input-field" type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} /></div>
            <div><label>Active:</label> <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Plan Features ---- */

function PlanFeaturesTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState('')
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => { apiGet('/api/admin/plans').then(r => { if (r.success) setPlans(r.data?.plans || r.data || []) }) }, [])

  const activePlan = selectedPlan || plans[0]?.planCode || ''
  useEffect(() => {
    if (!activePlan) return; setLoading(true)
    apiGet(`/api/admin/plans/${encodeURIComponent(activePlan)}/features`).then(r => {
      setLoading(false)
      if (r.success) { const map: Record<string, any> = {}; (r.data?.features || r.data || []).forEach((f: any) => { map[f.featureCode] = f }); setFeatures(map) }
      else setError(r.error?.message || 'Failed')
    })
  }, [activePlan])

  const toggle = (fc: string) => setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), enabled: prev[fc]?.enabled ? 0 : 1 } }))
  const setQ = (fc: string, v: string) => setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), quotaLimit: v === '' ? null : Number(v) } }))
  const setW = (fc: string, v: string) => setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), quotaWindow: v || null } }))

  const handleSave = async () => {
    setSaving(true)
    const payload = Object.values(features).map((f: any) => ({ featureCode: f.featureCode, enabled: f.enabled ? 1 : 0, quotaLimit: f.quotaLimit ?? null, quotaWindow: f.quotaWindow || null }))
    const r = await apiMut('PUT', `/api/admin/plans/${encodeURIComponent(activePlan)}/features`, { features: payload })
    if (r.success) toast.show('Features tersimpan.', 'success')
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  return (
    <Section title="Plan Features">
      <div style={{ marginBottom: 16 }}>
        <label>Plan: </label>
        <select value={activePlan} onChange={e => setSelectedPlan(e.target.value)}>{plans.map((p: any) => <option key={p.planCode} value={p.planCode}>{p.planName}</option>)}</select>
      </div>
      {loading && <Loading />}{error && <ErrorMsg msg={error} />}
      {Object.keys(features).length > 0 && (
        <>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead><tr><th>Feature</th><th>Enabled</th><th>Quota</th><th>Window</th></tr></thead>
            <tbody>
              {Object.values(features).map((f: any) => (
                <tr key={f.featureCode}><td>{f.featureCode}</td>
                  <td><input type="checkbox" checked={!!f.enabled} onChange={() => toggle(f.featureCode)} /></td>
                  <td><input type="number" value={f.quotaLimit ?? ''} onChange={e => setQ(f.featureCode, e.target.value)} style={{ width: 80 }} /></td>
                  <td><select value={f.quotaWindow || ''} onChange={e => setW(f.featureCode, e.target.value)}><option value="">-</option><option value="day">day</option><option value="month">month</option><option value="quarter">quarter</option><option value="year">year</option><option value="lifetime">lifetime</option></select></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Features'}</button>
        </>
      )}
    </Section>
  )
}

/* ---- Subscriptions ---- */

function SubscriptionsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/subscriptions?limit=50')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const openEdit = (s: any) => { setForm({ ...s, cancelAtPeriodEnd: s.cancelAtPeriodEnd ? '1' : '0' }); setEditing(s) }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/subscriptions/${editing.id}`, { planCode: form.planCode, status: form.status, cancelAtPeriodEnd: form.cancelAtPeriodEnd === '1' })
    if (r.success) { toast.show('Subscription diupdate.', 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Subscriptions">
      <table><thead><tr><th>ID</th><th>UserID</th><th>Plan</th><th>Status</th><th>Provider</th><th>Period Start</th><th>Period End</th><th>Cancel</th><th></th></tr></thead>
        <tbody>{data.map((s: any) => (
          <tr key={s.id}><td>{s.id}</td><td>{s.userId}</td><td>{s.planCode}</td><td>{s.status}</td><td>{s.provider}</td><td>{s.currentPeriodStart?.slice(0, 10)}</td><td>{s.currentPeriodEnd?.slice(0, 10)}</td><td>{s.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(s)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Subscription #${editing.id}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Plan:</label> <input className="input-field" value={form.planCode || ''} onChange={e => setForm({ ...form, planCode: e.target.value })} /></div>
            <div><label>Status:</label> <select value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="expired">expired</option><option value="cancelled">cancelled</option><option value="trial">trial</option></select></div>
            <div><label>Cancel at period end:</label> <select value={form.cancelAtPeriodEnd || '0'} onChange={e => setForm({ ...form, cancelAtPeriodEnd: e.target.value })}><option value="0">No</option><option value="1">Yes</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- AI Config ---- */

function AiConfigTab() {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const toast = useToast()
  useEffect(() => { fetch('/api/admin/ai-config', { credentials: 'include', headers: { Accept: 'application/json' } }).then(r => r.json()).then(r => { setLoading(false); if (r.success) setData(r.data); else setError(r.error?.message || '') }) }, [])
  const handleSave = async () => { setSaving(true); const r = await apiMut('PUT', '/api/admin/ai-config', data || {}); if (r.success) toast.show('AI Config tersimpan.', 'success'); else toast.show(r.error?.message || 'Gagal.', 'error'); setSaving(false) }
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  const skip = new Set(['aiClinicalCopilotAllowedActions', 'aiClinicalCopilotForbiddenActions', 'aiClinicalCopilotScopeStatus', 'aiClinicalCopilotRuntimeEnabled'])
  return (
    <Section title="AI Configuration">
      <div className="admin-ai-form">
        {data ? Object.entries(data).filter(([k]) => !skip.has(k)).map(([k, v]: [string, any]) => (
          <div key={k} className="admin-field"><label>{k}</label><input value={typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')} onChange={e => { const nv: any = {}; Object.assign(nv, data, { [k]: e.target.value }); setData(nv) }} /></div>
        )) : null}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Section>
  )
}

/* ---- System Configs ---- */

function ConfigsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/configs')
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => { const e: Record<string, string> = {}; data.forEach((x: any) => e[x.configKey] = x.configValue || ''); setEdit(e) }, [data])

  const handleSave = async (key: string) => {
    setSaving(key)
    const r = await apiMut('PUT', `/api/admin/configs/${encodeURIComponent(key)}`, { configValue: edit[key] })
    if (r.success) toast.show(`${key} tersimpan.`, 'success')
    else toast.show(r.error?.message || `Gagal menyimpan ${key}.`, 'error')
    setSaving(null); refresh()
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="System Configs">
      {data.length === 0 ? <p>No configs.</p> : (
        <table><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead>
          <tbody>{data.map((r: any) => (
            <tr key={r.configKey}><td>{r.configKey}</td><td><input className="input-field" value={edit[r.configKey] ?? ''} onChange={e => setEdit({ ...edit, [r.configKey]: e.target.value })} style={{ width: 300 }} /></td>
              <td><button className="btn-primary" onClick={() => handleSave(r.configKey)} disabled={saving === r.configKey}>Save</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Section>
  )
}

/* ---- Feature Flags ---- */

function FeatureFlagsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/feature-flags')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (f: any) => { setForm({ ...f, enabled: !!f.enabled }); setEditing(f) }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/feature-flags/${encodeURIComponent(form.flagCode)}`, { enabled: form.enabled, targetPlanCode: form.targetPlanCode || null, targetRoleCode: form.targetRoleCode || null })
    if (r.success) { toast.show(`${form.flagCode} diupdate.`, 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Feature Flags">
      <table><thead><tr><th>Code</th><th>Name</th><th>Enabled</th><th>Target Plan</th><th>Target Role</th><th></th></tr></thead>
        <tbody>{data.map((f: any) => (
          <tr key={f.flagCode}><td>{f.flagCode}</td><td>{f.flagName}</td><td style={{ color: f.enabled ? '#047857' : '#9ca3af' }}>{f.enabled ? 'Yes' : 'No'}</td><td>{f.targetPlanCode || '-'}</td><td>{f.targetRoleCode || '-'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(f)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.flagCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Enabled:</label> <select value={form.enabled ? 'true' : 'false'} onChange={e => setForm({ ...form, enabled: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <div><label>Target Plan:</label> <input className="input-field" value={form.targetPlanCode || ''} onChange={e => setForm({ ...form, targetPlanCode: e.target.value || null })} /></div>
            <div><label>Target Role:</label> <input className="input-field" value={form.targetRoleCode || ''} onChange={e => setForm({ ...form, targetRoleCode: e.target.value || null })} /></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Education ---- */

function EducationTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/education/cards?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (e: any) => { setForm({ ...e }); setEditing(e) }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/education/cards/${encodeURIComponent(form.topicType)}/${encodeURIComponent(form.topicCode)}`, { title: form.title, shortText: form.shortText, active: form.active })
    if (r.success) { toast.show('Education card tersimpan.', 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Education Cards">
      <table><thead><tr><th>Topic Type</th><th>Topic Code</th><th>Title</th><th>Active</th><th>Sort</th><th></th></tr></thead>
        <tbody>{data.map((e: any) => (
          <tr key={e.id}><td>{e.topicType}</td><td>{e.topicCode}</td><td>{e.title}</td><td style={{ color: e.active ? '#047857' : '#9ca3af' }}>{e.active ? 'Yes' : 'No'}</td><td>{e.sortOrder}</td>
            <td><button className="btn-primary" onClick={() => openEdit(e)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${editing.topicType}/${editing.topicCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Title:</label> <input className="input-field" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Short Text:</label> <textarea className="input-field" rows={3} value={form.shortText || ''} onChange={e => setForm({ ...form, shortText: e.target.value })} /></div>
            <div><label>Active:</label> <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Metric Catalog ---- */

function MetricCatalogTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/metric-catalog?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (m: any) => { setForm({ ...m }); setEditing(m) }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of ['metricName', 'category', 'unit', 'inputType', 'requiresAttachment', 'requiresSex', 'requiresFasting', 'isCalculated', 'physicalMin', 'physicalMax', 'sortOrder', 'active']) {
      if (form[k] !== undefined) payload[k] = form[k]
    }
    const r = await apiMut('PUT', `/api/admin/metric-catalog/${encodeURIComponent(form.metricCode)}`, payload)
    if (r.success) { toast.show(`${form.metricCode} tersimpan.`, 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Metric Catalog">
      <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Active</th><th></th></tr></thead>
        <tbody>{data.map((m: any) => (
          <tr key={m.metricCode}><td>{m.metricCode}</td><td>{m.metricName}</td><td>{m.category}</td><td>{m.unit}</td><td style={{ color: m.active ? '#047857' : '#9ca3af' }}>{m.active ? 'Yes' : 'No'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(m)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.metricCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['metricName', 'category', 'unit', 'inputType'].map(k => (
              <div key={k}><label>{k}:</label> <input className="input-field" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            {['physicalMin', 'physicalMax', 'sortOrder'].map(k => (
              <div key={k}><label>{k}:</label> <input className="input-field" type="number" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            ))}
            {['requiresAttachment', 'requiresSex', 'requiresFasting', 'isCalculated', 'active'].map(k => (
              <div key={k}><label>{k}:</label> <select value={form[k] ? 'true' : 'false'} onChange={e => setForm({ ...form, [k]: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            ))}
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Metric Rules ---- */

function MetricRulesTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/metric-rules?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (r: any) => { setForm({ ...r }); setEditing(r) }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of ['ruleName', 'metricCode', 'sex', 'status', 'severity', 'minValue', 'maxValue', 'popupTitle', 'popupMessage', 'recommendation', 'sourceLabel', 'active']) {
      if (form[k] !== undefined) payload[k] = form[k]
    }
    const r = await apiMut('PUT', `/api/admin/metric-rules/${encodeURIComponent(form.ruleCode)}`, payload)
    if (r.success) { toast.show(`${form.ruleCode} tersimpan.`, 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Metric Rules">
      <table><thead><tr><th>Code</th><th>Name</th><th>Metric</th><th>Severity</th><th>Range</th><th>Active</th><th></th></tr></thead>
        <tbody>{data.map((r: any) => (
          <tr key={r.ruleCode}><td>{r.ruleCode}</td><td>{r.ruleName}</td><td>{r.metricCode}</td><td>{r.severity}</td><td>{r.minValue} - {r.maxValue}</td><td style={{ color: r.active ? '#047857' : '#9ca3af' }}>{r.active ? 'Yes' : 'No'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(r)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.ruleCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflow: 'auto' }}>
            {['ruleName', 'metricCode', 'sex', 'status', 'severity', 'popupTitle', 'popupMessage', 'recommendation', 'sourceLabel'].map(k => (
              <div key={k}><label>{k}:</label> <input className="input-field" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            {['minValue', 'maxValue'].map(k => (
              <div key={k}><label>{k}:</label> <input className="input-field" type="number" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            ))}
            <div><label>active:</label> <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- Knowledge Base ---- */

function KnowledgeTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/knowledge-articles?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (a: any) => { setForm({ ...a }); setEditing(a) }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of ['title', 'category', 'contentMarkdown', 'active']) { if (form[k] !== undefined) payload[k] = form[k] }
    const r = await apiMut('PUT', `/api/admin/knowledge-articles/${encodeURIComponent(form.slug)}`, payload)
    if (r.success) { toast.show(`${form.slug} tersimpan.`, 'success'); setEditing(null); refresh() }
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Knowledge Base">
      <table><thead><tr><th>Slug</th><th>Title</th><th>Category</th><th>Active</th><th></th></tr></thead>
        <tbody>{data.map((a: any) => (
          <tr key={a.slug}><td>{a.slug}</td><td>{a.title}</td><td>{a.category}</td><td style={{ color: a.active ? '#047857' : '#9ca3af' }}>{a.active ? 'Yes' : 'No'}</td>
            <td><button className="btn-primary" onClick={() => openEdit(a)} style={{ fontSize: 12, padding: '2px 8px' }}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.slug}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Title:</label> <input className="input-field" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Category:</label> <input className="input-field" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><label>Content (Markdown):</label> <textarea className="input-field" rows={6} value={form.contentMarkdown || ''} onChange={e => setForm({ ...form, contentMarkdown: e.target.value })} /></div>
            <div><label>Active:</label> <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </Section>
  )
}

/* ---- AI Memory ---- */

function AiMemoryTab() {
  const [targetUid, setTargetUid] = useState('')
  const [status, setStatus] = useState<any>(null); const [loading, setLoading] = useState(false); const [rebuilding, setRebuilding] = useState(false); const [msg, setMsg] = useState('')
  const toast = useToast()

  const loadStatus = async (uid: string) => { if (!uid) return; setLoading(true); const r = await apiGet(`/api/admin/users/${uid}/ai-memory/status`); setLoading(false); if (r.success) setStatus(r.data); else setMsg(r.error?.message || 'Access denied') }
  const handleRebuild = async () => { if (!targetUid) return; setRebuilding(true); setMsg(''); const r = await apiMut('POST', `/api/admin/users/${targetUid}/ai-memory/rebuild`); if (r.success) { toast.show(`Rebuild queued. Job #${r.data.jobId}`, 'success') } else setMsg(r.error?.message || 'Failed'); setRebuilding(false) }

  return (
    <Section title="AI Memory Admin">
      <div style={{ marginBottom: 16 }}><label>User ID: <input className="input-field" value={targetUid} onChange={e => setTargetUid(e.target.value)} style={{ width: 120 }} /></label><button className="btn-primary" onClick={() => loadStatus(targetUid)} style={{ marginLeft: 8 }}>Check Status</button></div>
      {loading && <Loading />}{msg && <p>{msg}</p>}
      {status && <div><p>Namespace: <code>{status.namespace || '-'}</code></p><p>Documents: {status.documentCount ?? 0} | Indexed: {status.indexedCount ?? 0} | Pending: {status.pendingCount ?? 0}</p>
        <p>Sprint 6: <code>{status.sprint6ClinicalCopilot?.scopeStatus || 'deferred'}</code></p><button className="btn-primary" onClick={handleRebuild} disabled={rebuilding}>{rebuilding ? 'Rebuilding...' : 'Rebuild Memory'}</button></div>}
    </Section>
  )
}

/* ---- Audit & Safety (read-only) ---- */

function AuditLogsTab() {
  const { data, loading, error } = useList<any>('/api/admin/audit-logs?limit=100')
  const [search, setSearch] = useState('')
  const filtered = search ? data.filter((l: any) => (l.action || '').toLowerCase().includes(search) || (l.entityType || '').toLowerCase().includes(search)) : data
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Audit Logs">
      <input className="input-field" placeholder="Search action/entity..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12, width: 280 }} />
      <table style={{ fontSize: 12 }}><thead><tr><th>ID</th><th>User</th><th>Action</th><th>Entity</th><th>Created</th></tr></thead>
        <tbody>{filtered.map((l: any) => <tr key={l.id}><td>{l.id}</td><td>{l.userId}</td><td>{l.action}</td><td>{l.entityType}:{l.entityId}</td><td>{l.createdAt}</td></tr>)}</tbody>
      </table>
    </Section>
  )
}

function SafetyEventsTab() {
  const { data, loading, error } = useList<any>('/api/admin/safety-events?limit=50')
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Safety Events">
      <table style={{ fontSize: 12 }}><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Severity</th><th>Title</th><th>Created</th></tr></thead>
        <tbody>{data.map((e: any) => <tr key={e.id}><td>{e.id}</td><td>{e.userId}</td><td>{e.eventType}</td><td>{e.severity}</td><td>{e.title}</td><td>{e.createdAt}</td></tr>)}</tbody>
      </table>
    </Section>
  )
}

/* ---- Tab Components ---- */

const TAB_COMPONENTS: Record<TabId, (props: { onTab?: (id: TabId) => void }) => React.ReactNode> = {
  overview: OverviewTab, users: UsersTab, roles: RolesTab, plans: PlansTab, 'plan-features': PlanFeaturesTab, subscriptions: SubscriptionsTab,
  'ai-config': AiConfigTab, 'ai-memory': AiMemoryTab, configs: ConfigsTab, 'feature-flags': FeatureFlagsTab, education: EducationTab,
  'audit-logs': AuditLogsTab, 'safety-events': SafetyEventsTab, 'metric-catalog': MetricCatalogTab, 'metric-rules': MetricRulesTab, knowledge: KnowledgeTab,
}

/* ---- Page ---- */

export function AdminPage() {
  const { user, roles, permissions } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  if (!user) return <section className="settings-panel"><h2>Please login</h2></section>
  const userRoles = roles || []
  const userPermissions = permissions || []
  const isPrivilegedAdmin = userRoles.includes('superAdmin') || userRoles.includes('admin')
  const visibleTabs = TABS.filter(tb => !tb.permission || isPrivilegedAdmin || userPermissions.includes(tb.permission) || userPermissions.includes('superAdmin'))
  const TabContent = TAB_COMPONENTS[tab]
  return (
    <section className="settings-panel admin-page">
      <div className="page-heading"><h2>Admin Panel</h2></div>
      <nav className="admin-tabs">{visibleTabs.map(tb => <button key={tb.id} className={tab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>{tb.label}</button>)}</nav>
      <div className="admin-content"><TabContent onTab={setTab} /></div>
    </section>
  )
}
