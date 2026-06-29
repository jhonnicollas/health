import { useEffect, useState } from 'react'

type PatternInsight = {
  id: number
  insightType: string
  rangeStart: string
  rangeEnd: string
  summaryText: string
  confidence: number | null
  createdAt: string
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function PatternsPage() {
  const [wbResult, setWbResult] = useState<string | null>(null)
  const [medResult, setMedResult] = useState<string | null>(null)
  const [sleepBpResult, setSleepBpResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'weight-bp' | 'medication' | 'sleep-bp' | null>(null)
  const [insights, setInsights] = useState<PatternInsight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/patterns?limit=20', { credentials: 'include' })
      .then(r => { if (!r.ok) { setInsightsError('Gagal memuat pattern history.'); return null } return r.json() as Promise<ApiResp<{ insights: PatternInsight[] }>> })
      .then(body => { if (body && body.success && body.data?.insights) setInsights(body.data.insights) })
      .catch(() => { setInsightsError('Tidak bisa terhubung ke server.') })
      .finally(() => setInsightsLoading(false))
  }, [])

  async function generate(kind: 'weight-bp' | 'medication' | 'sleep-bp') {
    setLoading(kind); setError(null)
    try {
      const res = await fetch(`/api/patterns/generate/${kind}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) { setError('Gagal membuat insight.'); return }
      const body = (await res.json()) as ApiResp<{ insight?: string; hasEnoughData?: boolean; adherence?: number; lowSleepAvg?: number; normalSleepAvg?: number }>
      if (!body.success) { setError(body.error?.message || 'Gagal membuat insight.'); return }
      const msg = body.data?.hasEnoughData === false
        ? 'Not enough data (minimum 14 days).'
        : body.data?.insight || 'Done.'
      if (kind === 'weight-bp') setWbResult(msg)
      else if (kind === 'sleep-bp') setSleepBpResult(msg)
      else setMedResult(msg + (body.data?.adherence !== undefined ? ` (Adherence: ${body.data.adherence}%)` : ''))
    } catch { setError('Could not connect to server.') }
    finally { setLoading(null) }
  }

  return (
    <section className="settings-panel" aria-labelledby="patterns-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Insights</p>
          <h2 id="patterns-title">Health Patterns</h2>
          <p>Automated insights from your data (not a diagnosis, only a summary).</p>
        </div>
        <span className="status-chip">14 days minimum</span>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div className="settings-card">
        <h3>Sleep vs Blood Pressure Pattern (14 days)</h3>
        <p className="muted">{'Compares systolic BP on days with <6h sleep vs >=7h sleep.'}</p>
        <button disabled={loading !== null} onClick={() => generate('sleep-bp')} type="button">{loading === 'sleep-bp' ? 'Generating...' : 'Generate Sleep-BP Insight'}</button>
        {sleepBpResult ? <p>{sleepBpResult}</p> : null}
      </div>
      <div className="settings-card">
        <h3>Weight vs Blood Pressure Pattern (14 days)</h3>
        <button disabled={loading !== null} onClick={() => generate('weight-bp')} type="button">{loading === 'weight-bp' ? 'Generating...' : 'Generate Insight'}</button>
        {wbResult ? <p>{wbResult}</p> : null}
      </div>
      <div className="settings-card">
        <h3>Medication Adherence Pattern (14 days)</h3>
        <button disabled={loading !== null} onClick={() => generate('medication')} type="button">{loading === 'medication' ? 'Generating...' : 'Generate Insight'}</button>
        {medResult ? <p>{medResult}</p> : null}
      </div>

      <div className="settings-card" style={{ marginTop: 24 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>history</span>
          Pattern History
        </h3>
        {insightsLoading ? <p className="muted">Loading...</p> : null}
        {!insightsLoading && insightsError ? <p className="form-message error">{insightsError}</p> : null}
        {!insightsLoading && !insightsError && insights.length === 0 ? <p className="muted">No pattern insights yet. Generate one above.</p> : null}
        {insights.map(ins => (
          <div key={ins.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--colorBorderSoft, #e5e7eb)' }}>
            <p style={{ margin: '0 0 4px' }}>{ins.summaryText}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge-status badge-info"><span className="status-dot" />{ins.insightType}</span>
              {ins.confidence !== null ? <span className="meta" style={{ fontSize: '0.75em' }}>conf: {(ins.confidence * 100).toFixed(0)}%</span> : null}
              <span className="meta" style={{ fontSize: '0.75em' }}>{ins.rangeStart?.slice(0, 10)} — {ins.rangeEnd?.slice(0, 10)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
