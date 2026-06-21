import { useState } from 'react'
import type { FormEvent } from 'react'
import { ManualOverrideInput } from './ManualOverrideInput'

export type DynamicMetric = {
  metricCode: string
  metricName: string
  unit: string
  requiresAttachment?: boolean
  physicalMin?: number | null
  physicalMax?: number | null
}

export type DynamicMetricSelection = {
  id?: string
  metric: DynamicMetric
}

type SubmitValue = {
  metricCode: string
  finalValue: number
  manualOverride: boolean
  attachmentId?: string
}

type DynamicMetricFormProps = {
  selectedMetrics: DynamicMetricSelection[]
  onSubmit?: (values: SubmitValue[]) => void
}

export function DynamicMetricForm({ selectedMetrics, onSubmit }: DynamicMetricFormProps) {
  const [values, setValues] = useState<Record<string, { raw: string; final: string; manual: boolean }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(metricCode: string, partial: Partial<{ raw: string; final: string; manual: boolean }>) {
    setValues((prev) => ({
      ...prev,
      [metricCode]: {
        raw: partial.raw ?? prev[metricCode]?.raw ?? '',
        final: partial.final ?? prev[metricCode]?.final ?? '',
        manual: partial.manual ?? prev[metricCode]?.manual ?? false
      }
    }))
  }

  function validate(): { ok: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {}
    for (const sel of selectedMetrics) {
      const metric = sel.metric
      const entry = values[metric.metricCode]
      const finalRaw = entry?.final?.trim() ?? ''
      if (!finalRaw) {
        errors[metric.metricCode] = 'Nilai wajib diisi.'
        continue
      }
      const num = Number(finalRaw)
      if (!Number.isFinite(num)) {
        errors[metric.metricCode] = 'Nilai harus angka.'
        continue
      }
      const min = metric.physicalMin ?? undefined
      const max = metric.physicalMax ?? undefined
      if (min !== undefined && num < min) {
        errors[metric.metricCode] = `Nilai minimum ${min}.`
        continue
      }
      if (max !== undefined && num > max) {
        errors[metric.metricCode] = `Nilai maksimum ${max}.`
      }
    }
    return { ok: Object.keys(errors).length === 0, errors }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validate()
    if (!result.ok) {
      setError('Periksa nilai yang dimasukkan.')
      return
    }
    setSubmitting(true)
    setError(null)
    const payload: SubmitValue[] = selectedMetrics.map((sel) => {
      const entry = values[sel.metric.metricCode]
      return {
        metricCode: sel.metric.metricCode,
        finalValue: Number(entry.final),
        manualOverride: Boolean(entry.manual) && entry.raw !== entry.final
      }
    })
    try {
      const res = await fetch('/api/measurements/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: payload })
      })
      const body = (await res.json()) as { success: boolean; error?: { message: string } }
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal submit.')
        return
      }
      onSubmit?.(payload)
      setValues({})
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedMetrics.length === 0) {
    return <p className="muted">Pilih metrik pada checklist di atas untuk mulai mengisi.</p>
  }

  return (
    <form className="dynamic-metric-form" onSubmit={handleSubmit}>
      {selectedMetrics.map((sel) => {
        const m = sel.metric
        const entry = values[m.metricCode] ?? { raw: '', final: '', manual: false }
        return (
          <fieldset key={sel.id ?? m.metricCode} className="metric-card">
            <legend>
              {m.metricName} <span className="muted">({m.unit})</span>
            </legend>
            <ManualOverrideInput
              metric={m}
              raw={entry.raw}
              final={entry.final}
              manual={entry.manual}
              onChange={(partial) => setField(m.metricCode, partial)}
            />
          </fieldset>
        )
      })}
      <button disabled={submitting} type="submit">
        {submitting ? 'Menyimpan...' : 'Submit pengukuran'}
      </button>
      {error ? <p className="form-message error" role="status">{error}</p> : null}
    </form>
  )
}

export default DynamicMetricForm
