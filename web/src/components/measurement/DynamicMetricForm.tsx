import { useState, useEffect, type FormEvent } from 'react'
import { AttachmentUploader } from './AttachmentUploader'
import { useAuth } from '../../context/auth'

export type MetricFormMetric = {
  metricCode: string
  metricName: string
  category: string
  unit: string
  inputType: string
  requiresAttachment: boolean
  requiresSex: boolean
  requiresFasting: boolean
  isCalculated: boolean
  requiredMetric: boolean
  physicalMin: number | null
  physicalMax: number | null
}

export type MetricFormDevice = {
  deviceCode: string
  deviceName: string
  brand: string
  model: string
}

export type SelectedMetric = {
  id: string
  device: MetricFormDevice
  metric: MetricFormMetric
}

type DynamicMetricFormProps = {
  selectedMetrics: SelectedMetric[]
}

function metricHint(metric: MetricFormMetric) {
  const parts = []
  if (metric.physicalMin !== null && metric.physicalMax !== null) {
    parts.push(`${metric.physicalMin}-${metric.physicalMax} ${metric.unit}`)
  }
  if (metric.requiresAttachment) parts.push('foto diperlukan')
  if (metric.requiresFasting) parts.push('puasa')
  if (!metric.requiredMetric) parts.push('opsional')
  return parts.join(' | ')
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string; details?: Array<{ field: string; message: string }> } }

type SubmitValue = { metricCode: string; finalValue: number; unit: string; deviceCode: string; manualOverride: number; rawAiValue: null }
type SavedValue = { id: string; metricCode: string; status: string; severity: string; finalValue: number; unit: string }

export function DynamicMetricForm({ selectedMetrics }: DynamicMetricFormProps) {
  const { profile } = useAuth()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [savedValues, setSavedValues] = useState<SavedValue[] | null>(null)

  useEffect(() => {
    setValues({})
    setError(null)
    setMessage(null)
    setFieldErrors({})
    setSavedValues(null)
  }, [selectedMetrics])

  function handleValueChange(metricCode: string, val: string) {
    setValues((prev) => ({ ...prev, [metricCode]: val }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[metricCode]
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setFieldErrors({})
    setSavedValues(null)

    if (!profile) {
      setError('Profil belum lengkap. Selesaikan onboarding terlebih dahulu.')
      return
    }

    // Build metrics array for validation
    const metrics: Array<{ metricCode: string; finalValue: number; unit: string }> = []
    for (const sel of selectedMetrics) {
      const raw = values[sel.metric.metricCode]
      if (!raw || raw.trim() === '') continue
      const num = Number(raw)
      if (!Number.isFinite(num)) continue
      metrics.push({
        metricCode: sel.metric.metricCode,
        finalValue: num,
        unit: sel.metric.unit
      })
    }

    if (metrics.length === 0) {
      setError('Isi minimal satu nilai metrik.')
      return
    }

    setLoading(true)
    try {
      // Step 1: Validate
      const valRes = await fetch('/api/measurements/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      })
      const valBody = (await valRes.json()) as ApiResp<{ valid: boolean; errors: Array<{ field: string; message: string; code: string }> }>
      if (!valRes.ok || !valBody.success) {
        setError(valBody.error?.message || 'Validasi gagal.')
        setLoading(false)
        return
      }

      if (!valBody.data?.valid) {
        const errs: Record<string, string> = {}
        for (const e of (valBody.data?.errors || [])) {
          errs[e.field] = e.message
        }
        setFieldErrors(errs)
        setError('Ada kesalahan validasi. Periksa nilai yang diisi.')
        setLoading(false)
        return
      }

      // Step 2: Build submit payload
      const payload: SubmitValue[] = metrics.map(m => {
        const sel = selectedMetrics.find(s => s.metric.metricCode === m.metricCode)
        return {
          metricCode: m.metricCode,
          finalValue: m.finalValue,
          unit: m.unit,
          deviceCode: sel?.device.deviceCode || '',
          manualOverride: 0,
          rawAiValue: null
        }
      })

      // Step 3: Submit
      const subRes = await fetch('/api/measurements/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          source: 'manual',
          values: payload
        })
      })
      const subBody = (await subRes.json()) as ApiResp<{ sessionId: string; values: SavedValue[]; hasEmergency: boolean; streak?: { currentCount: number }; badges?: string[] }>
      if (!subRes.ok || !subBody.success) {
        setError(subBody.error?.message || 'Gagal menyimpan.')
        setLoading(false)
        return
      }

      const saved = subBody.data?.values || []
      setSavedValues(saved)

      if (subBody.data?.hasEmergency) {
        setMessage(`⚠️ Pengukuran tersimpan dengan ${saved.length} nilai. TERDETEKSI NILAI DARURAT — segera konsultasi ke dokter.`)
      } else {
        setMessage(`✓ Pengukuran tersimpan (${saved.length} nilai).${subBody.data?.streak ? ` Streak: ${subBody.data.streak.currentCount} hari.` : ''}`)
      }
      setValues({})
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  if (selectedMetrics.length === 0) {
    return (
      <section className="dynamic-metric-form empty" aria-label="Form metrik dinamis">
        <p>Pilih metrik untuk menampilkan form input.</p>
      </section>
    )
  }

  return (
    <section className="dynamic-metric-form" aria-label="Form metrik dinamis">
      <form onSubmit={handleSubmit}>
        {selectedMetrics.map(({ id, device, metric }) => (
          <article className="measurement-card" key={id}>
            <header>
              <div>
                <p className="eyebrow">{device.deviceName}</p>
                <h3>{metric.metricName}</h3>
              </div>
              <span className="source-pill">{values[metric.metricCode] ? 'Diisi manual' : 'Belum diisi'}</span>
            </header>
            <label className="form-field" htmlFor={`${id}-value`}>
              Nilai {metric.metricName}
              <div className="number-input-row">
                <input
                  disabled={metric.isCalculated || loading}
                  id={`${id}-value`}
                  inputMode="decimal"
                  onChange={(e) => handleValueChange(metric.metricCode, e.target.value)}
                  placeholder={metric.isCalculated ? 'Dihitung otomatis' : '0'}
                  type="number"
                  value={values[metric.metricCode] || ''}
                />
                <span>{metric.unit}</span>
              </div>
              {fieldErrors[metric.metricCode] ? (
                <span className="field-error">{fieldErrors[metric.metricCode]}</span>
              ) : null}
            </label>
            {metric.requiresAttachment ? (
              <AttachmentUploader metricCode={metric.metricCode} required={metric.requiredMetric} />
            ) : null}
            <p className="metric-card-hint">{metricHint(metric) || metric.category}</p>
          </article>
        ))}

        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {message ? <p className="form-message success" role="status">{message}</p> : null}

        <button disabled={loading} type="submit">
          {loading ? 'Memproses...' : 'Simpan Pengukuran'}
        </button>
      </form>

      {savedValues && savedValues.length > 0 && (
        <section className="submit-results" aria-label="Hasil pengukuran">
          <h3>Hasil Interpretasi</h3>
          <table className="report-table">
            <thead><tr><th>Metrik</th><th>Nilai</th><th>Status</th><th>Severity</th></tr></thead>
            <tbody>
              {savedValues.map(v => (
                <tr key={v.id} className={v.severity === 'emergency' || v.severity === 'critical' ? 'row-emergency' : ''}>
                  <td>{v.metricCode}</td>
                  <td>{v.finalValue} {v.unit}</td>
                  <td>{v.status}</td>
                  <td>{v.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  )
}
