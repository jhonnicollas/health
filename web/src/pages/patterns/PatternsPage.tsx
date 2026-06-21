import { useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function PatternsPage() {
  const [wbResult, setWbResult] = useState<string | null>(null)
  const [medResult, setMedResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'weight-bp' | 'medication' | null>(null)

  async function generate(kind: 'weight-bp' | 'medication') {
    setLoading(kind); setError(null)
    try {
      const res = await fetch(`/api/patterns/generate/${kind}`, { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ insight?: string; hasEnoughData?: boolean; adherence?: number }>
      if (!body.success) { setError(body.error?.message || 'Failed.'); return }
      const msg = body.data?.hasEnoughData === false
        ? 'Not enough data (minimum 14 days).'
        : body.data?.insight || 'Done.'
      if (kind === 'weight-bp') setWbResult(msg)
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
        <h3>Weight vs Blood Pressure Pattern (14 days)</h3>
        <button disabled={loading !== null} onClick={() => generate('weight-bp')} type="button">{loading === 'weight-bp' ? 'Generating...' : 'Generate Insight'}</button>
        {wbResult ? <p>{wbResult}</p> : null}
      </div>
      <div className="settings-card">
        <h3>Medication Adherence Pattern (14 days)</h3>
        <button disabled={loading !== null} onClick={() => generate('medication')} type="button">{loading === 'medication' ? 'Generating...' : 'Generate Insight'}</button>
        {medResult ? <p>{medResult}</p> : null}
      </div>
    </section>
  )
}
