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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
    const siblings = metricsByDevice.get(deviceCode) || [selection]
    const selectedMetricCodes = siblings.map((item) => item.metric.metricCode)
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
      }
      setSuccessMessage('AI berhasil mengisi angka awal. Silakan verifikasi dan ubah jika perlu.')
      return
    }

    setError(resultError?.error.message ?? 'AI belum bisa membaca bukti ini. Silakan input manual.')
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

  return (
    <form className="dynamic-metric-form" onSubmit={handleSubmit}>
      {selectedMetrics.map((selection) => {
        const metric = selection.metric
        const entry = values[metric.metricCode] ?? { raw: '', final: '', manual: false, confidence: null }
        return (
          <fieldset key={selection.id ?? metric.metricCode} className="metric-card">
            <legend>
              {metric.metricName} <span className="muted">({metric.unit})</span>
            </legend>

            {metric.requiresAttachment ? (
              <label className="metric-file-field">
                Bukti pengukuran
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
            ) : null}

            {selection.device?.deviceCode && metric.requiresAttachment ? (
              <button
                className="secondary-action"
                disabled={aiLoading || !files[metric.metricCode]}
                onClick={() => void handleAiFill(selection)}
                type="button"
              >
                {aiLoading ? 'AI membaca...' : 'Baca otomatis'}
              </button>
            ) : null}

            <ManualOverrideInput
              metric={metric}
              raw={entry.raw}
              final={entry.final}
              manual={entry.manual}
              onChange={(partial) => setField(metric.metricCode, partial)}
            />

            {files[metric.metricCode] ? (
              <p className="muted">File dipilih: {files[metric.metricCode]?.name}</p>
            ) : null}
          </fieldset>
        )
      })}

      <button disabled={submitting} type="submit">
        {submitting ? 'Menyimpan...' : 'Submit pengukuran'}
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
