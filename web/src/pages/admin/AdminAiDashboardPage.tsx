import { useEffect, useState } from 'react'

type TabId = 'overview' | 'model-runs' | 'safety' | 'prompts' | 'evaluation' | 'whatsapp' | 'operating-mode'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'AI Governance' },
  { id: 'model-runs', label: 'Model Runs' },
  { id: 'safety', label: 'Safety Flags' },
  { id: 'prompts', label: 'Prompt Versions' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'whatsapp', label: 'WhatsApp AI' },
  { id: 'operating-mode', label: 'Operating Mode' },
]

export function AdminAiDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [message] = useState('')

  function renderTabContent() {
    switch (activeTab) {
      case 'overview': return <AiGovernanceOverview />
      case 'model-runs': return <AiModelRunsView />
      case 'safety': return <AiSafetyView />
      case 'prompts': return <AiPromptsView />
      case 'evaluation': return <AiEvaluationView />
      case 'whatsapp': return <WhatsAppSessionsView />
      case 'operating-mode': return <AiOperatingModeView />
    }
  }

  return (
    <div className="page-container" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>AI Governance</h2>
      {message && <div className="success-message" style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#d4edda', borderRadius: '4px' }}>{message}</div>}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '2px solid #ddd', paddingBottom: '0.5rem' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: activeTab === tab.id ? '#007bff' : '#f0f0f0', color: activeTab === tab.id ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px 4px 0 0', fontWeight: activeTab === tab.id ? 'bold' : 'normal' }}>
            {tab.label}
          </button>
        ))}
      </div>
      <div>{renderTabContent()}</div>
    </div>
  )
}

// ─── Tab 1: Overview ───
function AiGovernanceOverview() {
  const [stats, setStats] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch('/api/admin/ai/model-runs?limit=1', { credentials: 'include' }).then(r => r.json()).then(d => {
      const summary = d?.data?.summary || {}
      setStats(prev => ({ ...prev, runCount: summary.totalRuns || 0, successRate: summary.successRate || 0 }))
    }).catch(() => {})
    fetch('/api/admin/ai/safety-flags?limit=1', { credentials: 'include' }).then(r => r.json()).then(d => {
      setStats(prev => ({ ...prev, flagCount: d?.data?.summary?.totalFlags || 0 }))
    }).catch(() => {})
    fetch('/api/admin/whatsapp/sessions', { credentials: 'include' }).then(r => r.json()).then(d => {
      const s = d?.data?.summary || {}
      setStats(prev => ({ ...prev, waLinked: s.totalLinked || 0, waActive: s.aiEnabled || 0 }))
    }).catch(() => {})
  }, [])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {[
        { label: 'Model Runs', value: stats.runCount || '—' },
        { label: 'Success Rate', value: stats.successRate ? `${(stats.successRate * 100).toFixed(0)}%` : '—' },
        { label: 'Safety Flags', value: stats.flagCount || '—' },
        { label: 'WA Linked Users', value: stats.waLinked || '—' },
        { label: 'WA AI Active', value: stats.waActive || '—' },
      ].map(card => (
        <div key={card.label} style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>{card.label}</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab 2: Model Runs ───
function AiModelRunsView() {
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/ai/model-runs?limit=20', { credentials: 'include' })
      .then(r => r.json()).then(d => setRuns(d?.data?.runs || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div>Loading...</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr style={{ background: '#f0f0f0' }}>
        <th style={th}>ID</th><th style={th}>User</th><th style={th}>Task</th><th style={th}>Provider</th><th style={th}>Status</th><th style={th}>Latency</th><th style={th}>Mode</th><th style={th}>Created</th>
      </tr></thead>
      <tbody>
        {runs.map((r: any) => (
          <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
            <td style={td}>{r.id}</td>
            <td style={td}>{r.userId}</td>
            <td style={td}>{r.taskCode}</td>
            <td style={td}>{r.providerCode}</td>
            <td style={td}><span style={{ color: r.status === 'success' ? 'green' : r.status === 'fallback' ? 'orange' : 'red' }}>{r.status}</span></td>
            <td style={td}>{r.latencyMs}ms</td>
            <td style={td}>{r.operatingMode}</td>
            <td style={td}>{r.createdAt?.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tab 3: Safety Flags ───
function AiSafetyView() {
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/ai/safety-flags?limit=20', { credentials: 'include' })
      .then(r => r.json()).then(d => setFlags(d?.data?.flags || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div>Loading...</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr style={{ background: '#f0f0f0' }}>
        <th style={th}>ID</th><th style={th}>Flag Code</th><th style={th}>Severity</th><th style={th}>Action</th><th style={th}>Created</th>
      </tr></thead>
      <tbody>
        {flags.map((f: any) => (
          <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
            <td style={td}>{f.id}</td>
            <td style={td}><code>{f.flagCode}</code></td>
            <td style={td}><span style={{ color: f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'orange' : 'blue' }}>{f.severity}</span></td>
            <td style={td}>{f.actionTaken}</td>
            <td style={td}>{f.createdAt?.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tab 4: Prompt Versions ───
function AiPromptsView() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/ai/prompt-versions', { credentials: 'include' })
      .then(r => r.json()).then(d => setPrompts(d?.data?.prompts || d?.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div>Loading...</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr style={{ background: '#f0f0f0' }}>
        <th style={th}>ID</th><th style={th}>Prompt Code</th><th style={th}>Version</th><th style={th}>Status</th><th style={th}>Activated</th>
      </tr></thead>
      <tbody>
        {prompts.map((p: any) => (
          <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
            <td style={td}>{p.id}</td>
            <td style={td}>{p.promptCode}</td>
            <td style={td}>{p.version}</td>
            <td style={td}><span style={{ color: p.status === 'active' ? 'green' : p.status === 'draft' ? 'blue' : 'gray' }}>{p.status}</span></td>
            <td style={td}>{p.activatedAt?.slice(0, 10) || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tab 5: Evaluation Queue ───
function AiEvaluationView() {
  const [evals, setEvals] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/admin/ai/evaluations?limit=10', { credentials: 'include' })
      .then(r => r.json()).then(d => setEvals(d?.data?.evaluations || d?.data || [])).catch(() => {})
  }, [])
  return (
    <div>
      <p>Evaluation cases are queued to the jobs worker. {evals.length > 0 ? `${evals.length} results available` : 'Run from the API: POST /api/admin/ai/evaluations/run'}</p>
      {evals.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f0f0f0' }}>
            <th style={th}>Case ID</th><th style={th}>Category</th><th style={th}>Status</th><th style={th}>Decision</th>
          </tr></thead>
          <tbody>
            {evals.map((e: any) => (
              <tr key={e.caseId || e.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={td}>{e.caseId || e.id}</td>
                <td style={td}>{e.category || '—'}</td>
                <td style={td}>{e.reviewStatus || 'pending'}</td>
                <td style={td}>{e.reviewDecision || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Tab 6: WhatsApp Sessions ───
function WhatsAppSessionsView() {
  const [data, setData] = useState<any>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/admin/whatsapp/sessions', { credentials: 'include' })
      .then(r => r.json()).then(d => setData(d?.data)).catch(() => {}).finally(() => setLoaded(true))
  }, [])
  if (!loaded) return <div>Loading...</div>
  const summary = data?.summary || {}
  const sessions = data?.sessions || []
  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {[{ label: 'Total Linked', value: summary.totalLinked || 0 }, { label: 'AI Enabled', value: summary.aiEnabled || 0 }, { label: 'Active Now', value: summary.activeNow || 0 }].map(card => (
          <div key={card.label} style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>{card.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{card.value}</div>
          </div>
        ))}
      </div>
      {sessions.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f0f0f0' }}>
            <th style={th}>Link ID</th><th style={th}>User</th><th style={th}>Verified</th><th style={th}>AI Enabled</th><th style={th}>Last Message</th>
          </tr></thead>
          <tbody>
            {sessions.map((s: any) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={td}>{s.id}</td>
                <td style={td}>{s.userId}</td>
                <td style={td}>{s.verified ? '✅' : '❌'}</td>
                <td style={td}>{s.aiEnabled ? '✅' : '❌'}</td>
                <td style={td}>{s.lastMessageAt?.slice(0, 10) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Tab 7: Operating Mode ───
function AiOperatingModeView() {
  const [currentMode, setCurrentMode] = useState('standard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/ai/operating-mode', { credentials: 'include' })
      .then(r => r.json()).then(d => setCurrentMode(d?.data?.mode || d?.data?.configValue || 'standard')).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleChange(mode: string) {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/ai/operating-mode', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const d = await res.json()
      if (d.success) { setCurrentMode(mode); setMsg(`Mode changed to ${mode}`) }
      else setMsg(`Error: ${d.error?.message || 'unknown'}`)
    } catch { setMsg('Network error') }
    setSaving(false)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: '600px' }}>
      {msg && <div style={{ padding: '0.5rem', marginBottom: '1rem', background: msg.startsWith('Error') ? '#f8d7da' : '#d4edda', borderRadius: '4px' }}>{msg}</div>}
      <p style={{ marginBottom: '1rem', color: '#666' }}>Current mode: <strong style={{ color: '#007bff' }}>{currentMode}</strong></p>
      {([
        { value: 'standard', label: 'Standard (safe mode)', desc: 'No diagnosis, no prescription, no specialist claim' },
        { value: 'proactive', label: 'Proactive', desc: 'AI can give final diagnosis. No prescription/dosage' },
        { value: 'super_aktif', label: 'Super Active', desc: 'Full AI capability: diagnosis, prescription, dosage. Medication change still blocked' },
      ] as const).map(opt => (
        <button key={opt.value} onClick={() => handleChange(opt.value)} disabled={saving || currentMode === opt.value}
          style={{ display: 'block', width: '100%', padding: '1rem', marginBottom: '0.5rem', textAlign: 'left', cursor: 'pointer', background: currentMode === opt.value ? '#007bff' : '#f8f9fa', color: currentMode === opt.value ? '#fff' : '#333', border: currentMode === opt.value ? '2px solid #0056b3' : '1px solid #ccc', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{opt.label}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{opt.desc}</div>
        </button>
      ))}
    </div>
  )
}

const th: React.CSSProperties = { padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', fontSize: '0.85rem' }
const td: React.CSSProperties = { padding: '0.5rem', fontSize: '0.85rem' }

export default AdminAiDashboardPage
