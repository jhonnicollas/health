/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, no-empty */
import { useEffect, useState } from 'react'

export function AiMemorySettingsPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const r = await (await fetch('/api/ai/memory/status', { credentials: 'include' })).json()
      if (r.success) setStatus(r.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleRebuild = async () => {
    setRebuilding(true); setMsg('')
    const r = await (await fetch('/api/ai/memory/rebuild', { method: 'POST', credentials: 'include' })).json()
    if (r.success) setMsg(`Rebuild queued. Job #${r.data.jobId}`)
    else setMsg(r.error?.message || 'Failed')
    setRebuilding(false)
  }

  const handleDelete = async () => {
    if (!confirm('Hapus semua AI memory? Data asli tidak akan terhapus.')) return
    setMsg('')
    const r = await (await fetch('/api/ai/memory', { method: 'DELETE', credentials: 'include' })).json()
    if (r.success) setMsg(`Delete queued. Job #${r.data.jobId}`)
    else setMsg(r.error?.message || 'Failed')
    load()
  }

  if (loading) return <section className="settings-panel"><p>Memuat...</p></section>

  const cop6 = status?.sprint6ClinicalCopilot || {}
  const readyChecks = cop6.readyChecks || {}

  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>AI Memory</h2><span className="status-chip">Infrastructure</span></div>
      <p>AI Memory menyimpan konteks kesehatan Anda untuk mendukung fitur AI di Sprint 6. Ini bukan diagnosis AI.</p>

      <div className="settings-card">
        <h3>Status</h3>
        <p>Namespace: <code>{status?.namespace || '-'}</code></p>
        <p>Dokumen: {status?.documentCount ?? 0} | Indexed: {status?.indexedCount ?? 0} | Pending: {status?.pendingCount ?? 0}</p>
        {status?.activeJob && <p>Job aktif: #{status.activeJob.jobId} ({status.activeJob.jobType}) — {status.activeJob.status}</p>}
      </div>

      <div className="settings-card">
        <h3>Aksi</h3>
        <button onClick={handleRebuild} disabled={rebuilding}>{rebuilding ? 'Mengantre...' : 'Rebuild Memory'}</button>
        <button className="danger" onClick={handleDelete} style={{ marginLeft: 8 }}>Hapus Memory</button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      <div className="settings-card">
        <h3>Sprint 6 Readiness</h3>
        <p>Status: <code>{cop6.scopeStatus || 'deferred_to_sprint6'}</code></p>
        <p>Runtime: {cop6.runtimeEnabled ? 'Aktif' : 'Nonaktif'}</p>
        <ul>
          <li>{readyChecks.vectorNamespaceReady ? '✓' : '✗'} Vector Namespace</li>
          <li>{readyChecks.memoryLifecycleReady ? '✓' : '✗'} Memory Lifecycle</li>
          <li>{readyChecks.contextTraceReady ? '✓' : '✗'} Context Trace</li>
          <li>{readyChecks.safetyBoundaryReady ? '✓' : '✗'} Safety Boundary</li>
          <li>{readyChecks.clinicalInterviewRuntimeReady ? '✓' : '✗'} Clinical Interview (Sprint 6)</li>
          <li>{readyChecks.differentialReasoningRuntimeReady ? '✓' : '✗'} Differential Reasoning (Sprint 6)</li>
          <li>{readyChecks.doctorHandoffRuntimeReady ? '✓' : '✗'} Doctor Handoff (Sprint 6)</li>
        </ul>
      </div>
    </section>
  )
}
