import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

type FlowStep = { code: string; label: string; unit: string; min: number; max: number }

export function SeniorMeasurementFlow() {
  const { profile } = useAuth()
  const [flow, setFlow] = useState<FlowStep[]>([
    { code: 'systolic', label: 'Tekanan darah sistolik', unit: 'mmHg', min: 60, max: 260 },
    { code: 'diastolic', label: 'Tekanan darah diastolik', unit: 'mmHg', min: 30, max: 180 },
    { code: 'heartRate', label: 'Detak jantung', unit: 'bpm', min: 30, max: 220 },
    { code: 'spo2', label: 'Saturasi oksigen (SpO2)', unit: '%', min: 50, max: 100 },
    { code: 'bodyWeight', label: 'Berat badan', unit: 'kg', min: 20, max: 300 }
  ])
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [promptSymptom, setPromptSymptom] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCatalog() {
      // Resilient fetch: fall back to default flow if catalog endpoint is unreachable.
      const res = await fetch('/api/metrics/catalog', { credentials: 'include' }).catch(() => null)
      if (!res) return
      const body = (await res.json().catch(() => null)) as {
        success: boolean
        data?: { metrics: Array<{ metricCode: string; metricName: string; unit: string; physicalMin: number | null; physicalMax: number | null }> }
      } | null
      if (body && body.success && body.data?.metrics?.length) {
        setFlow(body.data.metrics.map(m => ({
          code: m.metricCode,
          label: m.metricName,
          unit: m.unit,
          min: m.physicalMin ?? 0,
          max: m.physicalMax ?? 999
        })))
      }
    }
    void loadCatalog()
  }, [])

  const current = flow[step]
  const lastStep = step === flow.length - 1

  function next() {
    if (!current) return
    const v = values[current.code]
    if (!v) { setError('Isi nilai terlebih dahulu.'); return }
    const num = Number(v)
    if (Number.isNaN(num) || num < current.min || num > current.max) {
      setError(`Nilai harus antara ${current.min} dan ${current.max}.`); return
    }
    setError(null)
    if (!lastStep) { setStep(s => s + 1); return }
    void submit()
  }

  function prev() { if (step > 0) { setStep(s => s - 1); setError(null) } }

  async function submit() {
    if (!profile) return
    setSubmitting(true)
    setError(null)
    try {
      const payloadValues = Object.entries(values)
        .filter(([, v]) => v && !Number.isNaN(Number(v)))
        .map(([code, v]) => ({ metricCode: code, finalValue: Number(v), unit: flow.find(f => f.code === code)?.unit || '' }))
      const resp = await fetch('/api/measurements/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, source: 'senior', values: payloadValues })
      })
      const body = await resp.json() as { success: boolean; data?: { postSubmitPrompt?: { type: string }; sessionId?: number }; error?: { message: string } }
      if (!resp.ok || !body.success) {
        setError(body.error?.message || 'Gagal menyimpan.'); return
      }
      if (body.data?.postSubmitPrompt?.type === 'symptomCheck') {
        setSessionId(body.data.sessionId ?? null)
        setPromptSymptom(true)
      } else {
        setDone(true)
      }
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  if (promptSymptom) {
    return (
      <section className="settings-panel">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h2>Apakah Anda mengalami keluhan?</h2>
          <p style={{ margin: '12px 0 24px', color: 'var(--colorTextSecondary)' }}>Catat keluhan untuk pemantauan kesehatan lebih lengkap.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a className="btn-primary" href={sessionId ? `/symptoms?sessionId=${sessionId}` : '/symptoms'} style={{ textDecoration: 'none' }}>Ya, catat keluhan</a>
            <button className="btn-secondary" onClick={async () => {
              try { await fetch('/api/symptoms/prompt-dismissals', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSessionId: sessionId, reason: 'noSymptoms' }) }) } catch { void 0 /* best-effort log */ }
              setPromptSymptom(false); setDone(true)
            }}>Tidak, selesai</button>
          </div>
        </div>
      </section>
    )
  }

  if (done) {
    return (
      <section className="settings-panel" aria-labelledby="senior-done-title">
        <div className="clinical-empty">
          <p className="eyebrow">Mode Lansia</p>
          <h2 id="senior-done-title">Selesai</h2>
          <p>Pengukuran Anda sudah tersimpan. Terima kasih.</p>
        </div>
      </section>
    )
  }

  if (!current) return null

  return (
    <section className="settings-panel" aria-labelledby="senior-flow-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Mode Lansia</p>
          <h2 id="senior-flow-title">Pengukuran ({step + 1} dari {flow.length})</h2>
          <p>{current.label}</p>
        </div>
        <span className="status-chip">{current.unit}</span>
      </div>
      <div className="senior-card">
        <label>
          Nilai ({current.unit})
          <input
            autoFocus
            inputMode="decimal"
            max={current.max}
            min={current.min}
            onChange={(e) => setValues((p) => ({ ...p, [current.code]: e.target.value }))}
            type="number"
            value={values[current.code] || ''}
          />
        </label>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div className="action-row">
        <button disabled={step === 0 || submitting} onClick={prev} type="button">Kembali</button>
        <button disabled={submitting} onClick={next} type="button">
          {submitting ? 'Menyimpan...' : lastStep ? 'Simpan' : 'Lanjut'}
        </button>
      </div>
    </section>
  )
}
