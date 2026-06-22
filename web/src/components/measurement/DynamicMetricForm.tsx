import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { useAiExtract } from '../../hooks/useAiExtract'
import { compressImage } from '../../utils/imageCompressor'
import { addWatermark } from '../../utils/watermark'
import { ManualOverrideInput } from './ManualOverrideInput'

export type DynamicMetric = {
  metricCode: string
  metricName: string
  unit: string
  requiresAttachment?: boolean
  physicalMin?: number | null
  physicalMax?: number | null
}

type DynamicMetricDevice = {
  deviceCode: string
  deviceName: string
  deviceType?: string
}

export type DynamicMetricSelection = {
  id?: string
  metric: DynamicMetric
  device?: DynamicMetricDevice
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

type ValueState = {
  raw: string
  final: string
  manual: boolean
  confidence?: number | null
}

type SubmitResponse = {
  success: boolean
  data?: {
    sessionId: string
  }
  error?: {
    message?: string
  }
}

type AiMetricStatus = {
  kind: 'success' | 'warning' | 'error'
  message: string
}

function deriveMetricGroup(selection: DynamicMetricSelection) {
  const deviceType = selection.device?.deviceType || ''
  if (deviceType === 'bloodPressure') return 'bloodPressure'
  if (deviceType === 'oximeter') return 'oximeter'
  if (deviceType === 'gcu') return 'sinocareGcu'
  return 'manualInput'
}

export function DynamicMetricForm({ selectedMetrics, onSubmit }: DynamicMetricFormProps) {
  const { profile, user } = useAuth()
  const { extract, loading: aiLoading, error: aiError } = useAiExtract()
  const [values, setValues] = useState<Record<string, ValueState>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [extractingMetricCode, setExtractingMetricCode] = useState<string | null>(null)
  const [aiMetricStatus, setAiMetricStatus] = useState<Record<string, AiMetricStatus>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const metricsByDevice = useMemo(() => {
    const grouped = new Map<string, DynamicMetricSelection[]>()
    for (const selection of selectedMetrics) {
      const key = selection.device?.deviceCode || selection.metric.metricCode
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(selection)
    }
    return grouped
  }, [selectedMetrics])

  function setField(metricCode: string, partial: Partial<ValueState>) {
    setValues((prev) => ({
      ...prev,
      [metricCode]: {
        raw: partial.raw ?? prev[metricCode]?.raw ?? '',
        final: partial.final ?? prev[metricCode]?.final ?? '',
        manual: partial.manual ?? prev[metricCode]?.manual ?? false,
        confidence: partial.confidence ?? prev[metricCode]?.confidence ?? null
      }
    }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    for (const selection of selectedMetrics) {
      const metric = selection.metric
      const entry = values[metric.metricCode]
      const finalRaw = entry?.final?.trim() ?? ''
      if (!finalRaw) {
        nextErrors[metric.metricCode] = 'Nilai wajib diisi.'
        continue
      }
      const num = Number(finalRaw)
      if (!Number.isFinite(num)) {
        nextErrors[metric.metricCode] = 'Nilai harus angka.'
        continue
      }
      if (metric.physicalMin !== null && metric.physicalMin !== undefined && num < metric.physicalMin) {
        nextErrors[metric.metricCode] = `Nilai minimum ${metric.physicalMin}.`
      }
      if (metric.physicalMax !== null && metric.physicalMax !== undefined && num > metric.physicalMax) {
        nextErrors[metric.metricCode] = `Nilai maksimum ${metric.physicalMax}.`
      }
    }
    return nextErrors
  }

  async function handleAiFill(selection: DynamicMetricSelection) {
    const file = files[selection.metric.metricCode]
    const deviceCode = selection.device?.deviceCode
    if (!file || !deviceCode) {
      setError('Pilih bukti gambar terlebih dahulu untuk pembacaan AI.')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setExtractingMetricCode(selection.metric.metricCode)
    setAiMetricStatus((prev) => ({
      ...prev,
      [selection.metric.metricCode]: {
        kind: 'warning',
        message: 'AI sedang membaca foto. Input manual tetap bisa digunakan.'
      }
    }))
    const siblings = metricsByDevice.get(deviceCode) || [selection]
    const selectedMetricCodes = siblings.map((item) => item.metric.metricCode)
    try {
      const { result, error: resultError } = await extract(
        file,
        deviceCode,
        deriveMetricGroup(selection),
        selectedMetricCodes
      )

      if (result?.metrics?.length) {
        for (const metric of result.metrics) {
          setField(metric.metricCode, {
            raw: String(metric.rawAiValue),
            final: String(metric.rawAiValue),
            manual: false,
            confidence: metric.confidence
          })
          setAiMetricStatus((prev) => ({
            ...prev,
            [metric.metricCode]: {
              kind: result.needsManualReview ? 'warning' : 'success',
              message: `AI terbaca. Confidence ${Math.round(metric.confidence * 100)}%. Verifikasi sebelum simpan.`
            }
          }))
        }
        setSuccessMessage('AI berhasil mengisi angka awal. Silakan verifikasi dan ubah jika perlu.')
        return
      }

      const fallbackMessage = resultError?.error.code === 'AI_TIMEOUT'
        ? 'AI terlalu lama membaca foto. Silakan input manual.'
        : resultError?.error.message ?? 'AI belum bisa membaca bukti ini. Silakan input manual.'
      setAiMetricStatus((prev) => ({
        ...prev,
        [selection.metric.metricCode]: {
          kind: resultError?.error.code === 'AI_TIMEOUT' ? 'warning' : 'error',
          message: fallbackMessage
        }
      }))
      setError(fallbackMessage)
    } finally {
      setExtractingMetricCode(null)
    }
  }

  async function uploadAttachment(sessionId: string, selection: DynamicMetricSelection, measuredAt: string) {
    const original = files[selection.metric.metricCode]
    if (!original || !user) return

    const compressed = await compressImage(original)
    const watermarked = await addWatermark(compressed.file, {
      displayName: user.displayName,
      measuredAt,
      metrics: [
        {
          metricName: selection.metric.metricName,
          finalValue: Number(values[selection.metric.metricCode]?.final || 0),
          unit: selection.metric.unit
        }
      ]
    })

    const formData = new FormData()
    formData.append('file', watermarked.file)
    formData.append('sessionId', sessionId)
    formData.append('metricCode', selection.metric.metricCode)
    formData.append('fileName', watermarked.file.name)
    formData.append('width', String(watermarked.width))
    formData.append('height', String(watermarked.height))

    const response = await fetch('/api/measurements/attachments/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message || 'Upload bukti pengukuran gagal.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!profile?.id) {
      setError('Profil kesehatan belum aktif. Selesaikan onboarding terlebih dahulu.')
      return
    }

    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setError('Periksa nilai pengukuran sebelum menyimpan.')
      return
    }

    const measuredAt = new Date().toISOString()
    const payload = selectedMetrics.map((selection) => {
      const entry = values[selection.metric.metricCode]
      return {
        metricCode: selection.metric.metricCode,
        deviceCode: selection.device?.deviceCode || null,
        rawAiValue: entry?.raw ? Number(entry.raw) : null,
        finalValue: Number(entry?.final || 0),
        unit: selection.metric.unit,
        confidence: entry?.confidence ?? null,
        manualOverride: entry?.manual && entry?.raw !== entry?.final
      }
    })

    setSubmitting(true)
    try {
      const response = await fetch('/api/measurements/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          measuredAt,
          source: Object.values(files).some(Boolean) ? 'mixed' : 'manual',
          values: payload
        })
      })
      const body = (await response.json()) as SubmitResponse
      if (!response.ok || !body.success || !body.data?.sessionId) {
        setError(body.error?.message ?? 'Gagal menyimpan pengukuran.')
        return
      }

      for (const selection of selectedMetrics.filter((item) => item.metric.requiresAttachment)) {
        if (files[selection.metric.metricCode]) {
          await uploadAttachment(body.data.sessionId, selection, measuredAt)
        }
      }

      onSubmit?.(
        payload.map((value) => ({
          metricCode: value.metricCode,
          finalValue: value.finalValue,
          manualOverride: value.manualOverride
        }))
      )
      setValues({})
      setFiles({})
      setSuccessMessage('Pengukuran tersimpan ke database dan bukti final berhasil diunggah.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedMetrics.length === 0) {
    return <p className="muted">Pilih metrik pada checklist di atas untuk mulai mengisi.</p>
  }

  function toggleCollapse(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <form className="dynamic-metric-form" onSubmit={handleSubmit}>
      {selectedMetrics.map((selection) => {
        const metric = selection.metric
        const entry = values[metric.metricCode] ?? { raw: '', final: '', manual: false, confidence: null }
        const isCollapsed = collapsed[metric.metricCode] ?? false
        return (
          <fieldset key={selection.id ?? metric.metricCode} className="metric-card">
            <div className="metric-card-header" onClick={() => toggleCollapse(metric.metricCode)} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div className="metric-card-header-left">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--colorTextMuted)', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>expand_more</span>
                <legend style={{ margin: 0, padding: 0, border: 'none' }}>
                  {metric.metricName} <span className="muted">({metric.unit})</span>
                </legend>
              </div>
              {entry.final ? (
                <span className="badge-status badge-normal" style={{ fontSize: 12 }}>{entry.final} {metric.unit}</span>
              ) : null}
            </div>

            {!isCollapsed && (
              <div className="metric-card-body">
                {metric.requiresAttachment ? (
                  <div className="metric-file-row">
                    <label className="metric-file-field" style={{ flex: 1 }}>
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        capture="environment"
                        onChange={(event) =>
                          setFiles((prev) => ({
                            ...prev,
                            [metric.metricCode]: event.target.files?.[0] ?? null
                          }))
                        }
                        type="file"
                      />
                    </label>
                    <div className="metric-ai-col">
                      {selection.device?.deviceCode && metric.requiresAttachment ? (
                        <button
                          className="btn-ai-extract"
                          disabled={aiLoading || extractingMetricCode === metric.metricCode || !files[metric.metricCode]}
                          onClick={() => void handleAiFill(selection)}
                          type="button"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>document_scanner</span>
                          {extractingMetricCode === metric.metricCode ? 'Processing...' : 'Auto-Read with AI'}
                        </button>
                      ) : null}
                      {metric.requiresAttachment && !files[metric.metricCode] ? (
                        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Select image first</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <ManualOverrideInput
                  metric={metric}
                  raw={entry.raw}
                  final={entry.final}
                  manual={entry.manual}
                  onChange={(partial) => setField(metric.metricCode, partial)}
                />

                {entry.confidence !== null && entry.confidence !== undefined ? (
                  <p className="ai-confidence">
                    rawAiValue: {entry.raw || '-'} / confidence {Math.round(entry.confidence * 100)}%
                  </p>
                ) : null}

                {aiMetricStatus[metric.metricCode] ? (
                  <p className={`form-message ${aiMetricStatus[metric.metricCode].kind}`} role="status">
                    {aiMetricStatus[metric.metricCode].message}
                  </p>
                ) : null}

                {files[metric.metricCode] ? (
                  <p className="muted">File: {files[metric.metricCode]?.name}</p>
                ) : null}
              </div>
            )}
          </fieldset>
        )
      })}

      <button disabled={submitting} type="submit" className="btn-submit" style={{ minHeight: 56, border: 0, borderRadius: 'var(--radiusXl)', padding: '16px 24px', color: 'var(--colorPrimaryText)', background: 'var(--colorPrimary)', font: 'var(--typHeadlineMd)', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,97,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span className="material-symbols-outlined">check_circle</span>
        {submitting ? 'Saving...' : 'Validate & Save Results'}
      </button>

      {aiError ? (
        <p className="form-message error" role="status">
          {aiError}
        </p>
      ) : null}
      {error ? (
        <p className="form-message error" role="status">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="form-message success" role="status">
          {successMessage}
        </p>
      ) : null}
    </form>
  )
}

export default DynamicMetricForm
