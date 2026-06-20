import { useState } from 'react'
import { useAuth } from '../../context/auth'

type Field = 'systolic' | 'diastolic' | 'heartRate' | 'spo2' | 'bodyWeight'

const FLOW: Array<{ code: Field; label: string; unit: string; min: number; max: number }> = [
  { code: 'systolic', label: 'Tekanan darah sistolik', unit: 'mmHg', min: 60, max: 260 },
  { code: 'diastolic', label: 'Tekanan darah diastolik', unit: 'mmHg', min: 30, max: 180 },
  { code: 'heartRate', label: 'Detak jantung', unit: 'bpm', min: 30, max: 220 },
  { code: 'spo2', label: 'Saturasi oksigen (SpO2)', unit: '%', min: 50, max: 100 },
  { code: 'bodyWeight', label: 'Berat badan', unit: 'kg', min: 20, max: 300 }
]

export function SeniorMeasurementFlow() {
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = FLOW[step]
  const lastStep = step === FLOW.length - 1

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
        .map(([code, v]) => ({ metricCode: code, finalValue: Number(v), unit: FLOW.find(f => f.code === code)?.unit || '' }))
      const resp = await fetch('/api/measurements/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, source: 'senior', values: payloadValues })
      })
      const body = await resp.json() as { success: boolean; error?: { message: string } }
      if (!resp.ok || !body.success) {
        setError(body.error?.message || 'Gagal menyimpan.'); return
      }
      setDone(true)
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <section className="settings-panel" aria-labelledby="senior-done-title">
        <h2 id="senior-done-title">Selesai</h2>
        <p>Pengukuran Anda sudah tersimpan. Terima kasih.</p>
      </section>
    )
  }

  if (!current) return null

  return (
    <section className="settings-panel" aria-labelledby="senior-flow-title">
      <h2 id="senior-flow-title">Pengukuran ({step + 1} dari {FLOW.length})</h2>
      <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>{current.label}</p>
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
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button disabled={step === 0 || submitting} onClick={prev} type="button">Kembali</button>
        <button disabled={submitting} onClick={next} type="button">
          {submitting ? 'Menyimpan...' : lastStep ? 'Simpan' : 'Lanjut'}
        </button>
      </div>
    </section>
  )
}
