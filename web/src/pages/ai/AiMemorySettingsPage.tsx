/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { translateErrorCode } from '../../api/translateError'

export function AiMemorySettingsPage() {
  const { t, locale } = useI18n()
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/ai/memory/status', { credentials: 'include' })
      if (!res.ok) { setMsg(t('ai.loadFailed')); return }
      const r = await res.json()
      if (r.success) setStatus(r.data)
    } catch { setMsg(t('ai.connError')) } finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // load runs once on mount; load() is defined fresh each render and does not need to be a dep.
  useEffect(() => { load() }, [])

  const handleRebuild = async () => {
    setRebuilding(true); setMsg('')
    try {
      const res = await fetch('/api/ai/memory/rebuild', { method: 'POST', credentials: 'include' })
      if (!res.ok) { setMsg(t('ai.rebuildFailed')); setRebuilding(false); return }
      const r = await res.json()
      if (r.success) setMsg(`${t('ai.rebuildQueued')}${r.data.jobId}`)
      else setMsg(r.error?.code ? translateErrorCode(r.error.code, locale, r.error.message) : t('ai.rebuildFailed'))
    } catch { setMsg(t('ai.connError')) }
    setRebuilding(false)
  }

  const handleDelete = async () => {
    if (!confirm(t('ai.deleteConfirm'))) return
    setMsg('')
    try {
      const res = await fetch('/api/ai/memory', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) { setMsg(t('ai.deleteFailed')); return }
      const r = await res.json()
      if (r.success) setMsg(`${t('ai.deleteQueued')}${r.data.jobId}`)
      else setMsg(r.error?.code ? translateErrorCode(r.error.code, locale, r.error.message) : t('ai.deleteFailed'))
    } catch { setMsg(t('ai.connError')) }
    load()
  }

  if (loading) return <section className="settings-panel"><p>{t('ai.loadingShort')}</p></section>

  const cop6 = status?.sprint6ClinicalCopilot || {}
  const readyChecks = cop6.readyChecks || {}

  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>{t('ai.memoryTitle')}</h2><span className="status-chip">{t('ai.memoryInfrastructure')}</span></div>
      <p>{t('ai.memoryDesc')}</p>

      <div className="settings-card">
        <h3>{t('ai.statusLabel')}</h3>
        <p>{t('ai.namespace')} <code>{status?.namespace || '-'}</code></p>
        <p>{t('ai.documents')} {status?.documentCount ?? 0} | {t('ai.indexed')} {status?.indexedCount ?? 0} | {t('ai.pending')} {status?.pendingCount ?? 0}</p>
        {status?.activeJob && <p>{t('ai.activeJob')} #{status.activeJob.jobId} ({status.activeJob.jobType}) — {status.activeJob.status}</p>}
      </div>

      <div className="settings-card">
        <h3>{t('ai.actions')}</h3>
        <button onClick={handleRebuild} disabled={rebuilding}>{rebuilding ? t('ai.queuing') : t('ai.rebuildMemory')}</button>
        <button className="danger" onClick={handleDelete} style={{ marginLeft: 8 }}>{t('ai.deleteMemory')}</button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      <div className="settings-card">
        <h3>{t('ai.sprint6ReadinessTitle')}</h3>
        <p>{t('ai.runtimeStatus')} <code>{cop6.scopeStatus || 'deferred_to_sprint6'}</code></p>
        <p>{t('ai.runtime')} {cop6.runtimeEnabled ? t('ai.active') : t('ai.inactive')}</p>
        <ul>
          <li>{readyChecks.vectorNamespaceReady ? '✓' : '✗'} {t('ai.vecNamespace')}</li>
          <li>{readyChecks.memoryLifecycleReady ? '✓' : '✗'} {t('ai.memLifecycle')}</li>
          <li>{readyChecks.contextTraceReady ? '✓' : '✗'} {t('ai.ctxTrace')}</li>
          <li>{readyChecks.safetyBoundaryReady ? '✓' : '✗'} {t('ai.safetyBoundary')}</li>
          <li>{readyChecks.clinicalInterviewRuntimeReady ? '✓' : '✗'} {t('ai.clinicalInterview')}</li>
          <li>{readyChecks.differentialReasoningRuntimeReady ? '✓' : '✗'} {t('ai.diffReasoning')}</li>
          <li>{readyChecks.doctorHandoffRuntimeReady ? '✓' : '✗'} {t('ai.doctorHandoff')}</li>
        </ul>
      </div>
    </section>
  )
}
