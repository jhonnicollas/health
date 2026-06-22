import { useMemo, useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { useAiExtract } from '../../hooks/useAiExtract'
import { compressImage } from '../../utils/imageCompressor'
import { addWatermark } from '../../utils/watermark'

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
  onClearSelection?: () => void
  onSubmit?: (values: SubmitValue[]) => void
}

type ValueState = {
  raw: string
  final: string
  confidence?: number | null
  error?: string
}

type SubmitResponse = {
  success: boolean
  data?: { sessionId: number }
  error?: { message?: string }
}

type AiDeviceStatus = {
  kind: 'success' | 'warning' | 'error' | 'loading'
  message: string
}

async function getLastMeasurements(): Promise<Map<string, { value: number; measuredAt: string }>> {
  try {
    const response = await fetch('/api/measurements/last', { credentials: 'include' })
    if (!response.ok) return new Map()
    const body = await response.json() as { success: boolean; data?: Array<{ metricCode: string; deviceCode?: string; finalValue: number; measuredAt: string }> }
    if (!body.success || !body.data) return new Map()
    const map = new Map<string, { value: number; measuredAt: string }>()
    body.data.forEach(item => map.set(`${item.metricCode}-${item.deviceCode || ''}`, { value: item.finalValue, measuredAt: item.measuredAt }))
    return map
  } catch { return new Map() }
}

function calculateAge(birthDate: string): { years: number; months: number; days: number } {
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate() }
  if (months < 0) { years--; months += 12 }
  return { years, months, days }
}

function deriveMetricGroup(selection: DynamicMetricSelection) {
  const deviceType = selection.device?.deviceType || ''
  if (deviceType === 'bloodPressure') return 'bloodPressure'
  if (deviceType === 'oximeter') return 'oximeter'
  if (deviceType === 'gcu') return 'sinocareGcu'
  return 'manualInput'
}

const DEVICE_ICON_MAP: Record<string, string> = {
  bloodPressure: 'favorite',
  oximeter: 'oxygen_saturation',
  gcu: 'bloodtype',
  bodyScale: 'monitor_weight',
  thermometer: 'thermostat',
  sleepTracker: 'bedtime',
}

const DEVICE_COLOR_MAP: Record<string, string> = {
  bloodPressure: 'var(--colorDanger)',
  oximeter: 'var(--colorPrimary)',
  gcu: 'var(--colorWarning)',
  bodyScale: 'var(--colorSuccess)',
  thermometer: 'var(--colorInfo)',
  sleepTracker: 'var(--colorTertiary)',
}

export function DynamicMetricForm({ selectedMetrics, onClearSelection, onSubmit }: DynamicMetricFormProps) {
  const { profile, user } = useAuth()
  const { extract, error: aiError } = useAiExtract()
  const [values, setValues] = useState<Record<string, ValueState>>({})
  const [deviceFiles, setDeviceFiles] = useState<Record<string, File | null>>({})
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [extractingDevice, setExtractingDevice] = useState<string | null>(null)
  const [aiDeviceStatus, setAiDeviceStatus] = useState<Record<string, AiDeviceStatus>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [ageInfo, setAgeInfo] = useState<{ years: number; months: number; days: number } | null>(null)
  const [lastMeasurements, setLastMeasurements] = useState<Map<string, { value: number; measuredAt: string }>>(new Map())

  useEffect(() => { void getLastMeasurements().then(setLastMeasurements) }, [])
  useEffect(() => { if (profile?.birthDate) setAgeInfo(calculateAge(profile.birthDate)) }, [profile?.birthDate])

  // Auto-fill from last measurements
  useEffect(() => {
    const autofillMetrics = ['bodyWeight', 'waistCircumference', 'bodyTemperature', 'spo2']
    setValues(prev => {
      const updated = { ...prev }
      for (const selection of selectedMetrics) {
        const key = `${selection.metric.metricCode}-${selection.device?.deviceCode || ''}`
        const lastData = lastMeasurements.get(key)
        if (autofillMetrics.includes(selection.metric.metricCode) && lastData && !updated[selection.metric.metricCode]?.final) {
          updated[selection.metric.metricCode] = {
            ...updated[selection.metric.metricCode],
            final: String(lastData.value),
            confidence: null,
            error: undefined
          }
        } else if (!updated[selection.metric.metricCode]) {
          updated[selection.metric.metricCode] = { raw: '', final: '', confidence: null }
        }
      }
      return updated
    })
  }, [selectedMetrics, lastMeasurements])

  const deviceGroups = useMemo(() => {
    const groups = new Map<string, { device: DynamicMetricDevice; selections: DynamicMetricSelection[] }>()
    for (const selection of selectedMetrics) {
      const key = selection.device?.deviceCode || selection.metric.metricCode
      if (!groups.has(key)) {
        groups.set(key, {
          device: selection.device || { deviceCode: key, deviceName: selection.metric.metricName },
          selections: []
        })
      }
      groups.get(key)!.selections.push(selection)
    }
    return groups
  }, [selectedMetrics])

  const setField = useCallback((metricCode: string, partial: Partial<ValueState>) => {
    setValues(prev => ({
      ...prev,
      [metricCode]: {
        raw: partial.raw ?? prev[metricCode]?.raw ?? '',
        final: partial.final ?? prev[metricCode]?.final ?? '',
        confidence: partial.confidence ?? prev[metricCode]?.confidence ?? null,
        error: partial.error
      }
    }))
  }, [])

  // Enforce maxLength on number inputs (maxLength doesn't work on type=number)
  function handleValueChange(metricCode: string, raw: string, physicalMax: number | null | undefined) {
    const maxDigits = physicalMax != null ? String(Math.ceil(physicalMax)).length + 3 : 8
    const truncated = raw.length > maxDigits ? raw.slice(0, maxDigits) : raw
    setField(metricCode, { final: truncated, error: undefined })
  }

  // BMI auto-calculate
  useEffect(() => {
    const weightEntry = values['bodyWeight']
    if (weightEntry?.final && profile?.heightCm) {
      const weight = Number(weightEntry.final)
      const heightM = profile.heightCm / 100
      if (weight > 0 && heightM > 0) {
        const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10
        if (!values['bmi'] || values['bmi'].final === '' || values['bmi'].final !== String(bmi)) {
          setValues(prev => ({ ...prev, bmi: { ...prev['bmi'], final: String(bmi), raw: String(bmi), confidence: null } }))
        }
      }
    }
  }, [values['bodyWeight']?.final, profile?.heightCm])

  function validate() {
    const nextErrors: Record<string, string> = {}
    for (const selection of selectedMetrics) {
      const metric = selection.metric
      if (metric.metricCode === 'bmi') continue // BMI is auto-calculated
      const entry = values[metric.metricCode]
      const finalRaw = entry?.final?.trim() ?? ''
      if (!finalRaw) { nextErrors[metric.metricCode] = 'Nilai wajib diisi.'; continue }
      const num = Number(finalRaw)
      if (!Number.isFinite(num)) { nextErrors[metric.metricCode] = 'Nilai harus angka.'; continue }
      if (metric.physicalMin != null && num < metric.physicalMin) nextErrors[metric.metricCode] = `Minimum ${metric.physicalMin} ${metric.unit}`
      if (metric.physicalMax != null && num > metric.physicalMax) nextErrors[metric.metricCode] = `Maksimum ${metric.physicalMax} ${metric.unit}`
    }
    return nextErrors
  }

  async function handleFileChange(deviceCode: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrls(prev => ({ ...prev, [deviceCode]: objectUrl }))
    setDeviceFiles(prev => ({ ...prev, [deviceCode]: file }))
    setTimeout(() => {
      const group = deviceGroups.get(deviceCode)
      if (group) void handleAiExtract(deviceCode, group)
    }, 800)
  }

  async function handleAiExtract(deviceCode: string, group: { device: DynamicMetricDevice; selections: DynamicMetricSelection[] }) {
    const file = deviceFiles[deviceCode]
    if (!file) return
    setError(null); setSuccessMessage(null); setExtractingDevice(deviceCode)
    setAiDeviceStatus(prev => ({ ...prev, [deviceCode]: { kind: 'loading', message: 'AI sedang membaca foto...' } }))
    const selectedMetricCodes = group.selections.map(s => s.metric.metricCode)
    const metricGroup = deriveMetricGroup(group.selections[0])
    try {
      const { result, error: resultError } = await extract(file, deviceCode, metricGroup, selectedMetricCodes)
      if (result?.metrics?.length) {
        const updates: Record<string, ValueState> = {}
        for (const metric of result.metrics) {
          updates[metric.metricCode] = { raw: String(metric.rawAiValue), final: String(metric.rawAiValue), confidence: metric.confidence, error: undefined }
        }
        const avgConfidence = result.metrics.reduce((sum, m) => sum + m.confidence, 0) / result.metrics.length
        const metricsCount = result.metrics.length
        setAiDeviceStatus(prev => ({ ...prev, [deviceCode]: { kind: result.needsManualReview ? 'warning' : 'success', message: `AI berhasil membaca ${metricsCount} nilai (${Math.round(avgConfidence * 100)}% confidence). Verifikasi sebelum simpan.` } }))
        setValues(prev => ({ ...prev, ...updates }))
        setSuccessMessage('AI berhasil mengisi nilai. Silakan verifikasi.')
        return
      }
      const msg = resultError?.error.code === 'AI_TIMEOUT' ? 'AI terlalu lama membaca foto. Silakan input manual.' : resultError?.error.message ?? 'AI belum bisa membaca bukti ini.'
      setAiDeviceStatus(prev => ({ ...prev, [deviceCode]: { kind: resultError?.error.code === 'AI_TIMEOUT' ? 'warning' : 'error', message: msg } }))
      setError(msg)
    } finally { setExtractingDevice(null) }
  }

  async function uploadAttachments(sessionId: number, measuredAt: string) {
    if (!user) return
    for (const [deviceCode, file] of Object.entries(deviceFiles)) {
      if (!file) continue
      const group = deviceGroups.get(deviceCode)
      if (!group) continue
      const compressed = await compressImage(file)
      const watermarked = await addWatermark(compressed.file, {
        displayName: user.displayName, measuredAt,
        metrics: group.selections.map(s => ({ metricName: s.metric.metricName, finalValue: Number(values[s.metric.metricCode]?.final || 0), unit: s.metric.unit }))
      })
      const formData = new FormData()
      formData.append('file', watermarked.file)
      formData.append('sessionId', String(sessionId))
      formData.append('metricCode', group.selections[0].metric.metricCode)
      formData.append('fileName', watermarked.file.name)
      formData.append('width', String(watermarked.width))
      formData.append('height', String(watermarked.height))
      const response = await fetch('/api/measurements/attachments/upload', { method: 'POST', credentials: 'include', body: formData })
      if (!response.ok) throw new Error('Upload bukti pengukuran gagal.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null); setSuccessMessage(null)
    if (!profile?.id) { setError('Profil kesehatan belum aktif.'); return }
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setValues(prev => {
        const updated = { ...prev }
        for (const [code, msg] of Object.entries(nextErrors)) {
          updated[code] = { ...updated[code], error: msg }
        }
        return updated
      })
      setError('Periksa nilai pengukuran sebelum menyimpan.')
      return
    }
    const measuredAt = new Date().toISOString()
    const payload = selectedMetrics.map(selection => {
      const entry = values[selection.metric.metricCode]
      return {
        metricCode: selection.metric.metricCode,
        deviceCode: selection.device?.deviceCode || null,
        rawAiValue: entry?.raw ? Number(entry.raw) : null,
        finalValue: Number(entry?.final || 0),
        unit: selection.metric.unit,
        confidence: entry?.confidence ?? null,
        manualOverride: entry?.raw !== entry?.final
      }
    })
    setSubmitting(true)
    try {
      const response = await fetch('/api/measurements/submit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, measuredAt, source: Object.values(deviceFiles).some(Boolean) ? 'mixed' : 'manual', values: payload })
      })
      const body = (await response.json()) as SubmitResponse
      if (!response.ok || !body.success || !body.data?.sessionId) { setError(body.error?.message ?? 'Gagal menyimpan.'); return }
      await uploadAttachments(body.data.sessionId, measuredAt)
      const metricsToSave = ['bodyWeight', 'waistCircumference', 'bodyTemperature', 'spo2']
      for (const p of payload) {
        if (metricsToSave.includes(p.metricCode)) {
          await fetch('/api/measurements/last/save', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metricCode: p.metricCode, deviceCode: p.deviceCode, finalValue: p.finalValue, unit: p.unit, measuredAt })
          }).catch(() => {})
        }
      }
      onSubmit?.(payload.map(v => ({ metricCode: v.metricCode, finalValue: v.finalValue, manualOverride: v.manualOverride })))
      setValues({}); setDeviceFiles({}); setPreviewUrls({})
      setSuccessMessage('Pengukuran berhasil tersimpan.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Tidak bisa terhubung ke server.') }
    finally { setSubmitting(false) }
  }

  if (selectedMetrics.length === 0) {
    return <p className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>Pilih alat pada daftar di atas untuk mulai mengisi.</p>
  }

  return (
    <form className="stitch-measurement-form" onSubmit={handleSubmit}>
      {/* Age Banner - Prominent at top */}
      {ageInfo ? (
        <div className="user-info-banner">
          <span className="material-symbols-outlined">person</span>
          <span>Anda berusia <strong>{ageInfo.years} Tahun {ageInfo.months} Bulan {ageInfo.days} Hari</strong></span>
        </div>
      ) : null}

      {/* Device Cards */}
      <div className="stitch-device-cards">
        {Array.from(deviceGroups.entries()).map(([deviceCode, group]) => {
          const hasAttachment = group.selections.some(s => s.metric.requiresAttachment)
          const file = deviceFiles[deviceCode]
          const previewUrl = previewUrls[deviceCode]
          const aiStatus = aiDeviceStatus[deviceCode]
          const isExtracting = extractingDevice === deviceCode
          const icon = DEVICE_ICON_MAP[group.device.deviceType || ''] || 'medical_services'
          const color = DEVICE_COLOR_MAP[group.device.deviceType || ''] || 'var(--colorPrimary)'

          return (
            <div key={deviceCode} className="stitch-device-card">
              {/* Card Header */}
              <div className="stitch-card-header">
                <div className="stitch-card-header-left">
                  <div className="stitch-device-icon" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <h3 className="stitch-device-title">{group.device.deviceName}</h3>
                </div>
                {aiStatus && (
                  <span className={`stitch-ai-badge stitch-ai-badge-${aiStatus.kind}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {aiStatus.kind === 'success' ? 'check_circle' : aiStatus.kind === 'error' ? 'error' : aiStatus.kind === 'loading' ? 'hourglass_empty' : 'warning'}
                    </span>
                    {aiStatus.kind === 'loading' ? 'Processing...' : aiStatus.kind}
                  </span>
                )}
              </div>

              {/* Card Body - 2 column layout */}
              <div className="stitch-card-body">
                {/* Left: Image capture */}
                {hasAttachment ? (
                  <div className="stitch-image-side">
                    {previewUrl ? (
                      <div className="stitch-preview">
                        <img src={previewUrl} alt="Preview" />
                        <label className="stitch-retake-btn">
                          <input accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => void handleFileChange(deviceCode, e)} type="file" />
                          <span className="material-symbols-outlined">photo_camera</span> Retake
                        </label>
                      </div>
                    ) : (
                      <label className="stitch-capture-area">
                        <input accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => void handleFileChange(deviceCode, e)} type="file" />
                        <span className="material-symbols-outlined">add_a_photo</span>
                        <span className="stitch-capture-label">Tap to Capture</span>
                        <span className="stitch-capture-hint">{file ? file.name : 'Photo or Upload'}</span>
                      </label>
                    )}
                    {isExtracting && (
                      <div className="stitch-ai-progress">
                        <div className="stitch-ai-progress-bar" />
                        <span>AI reading...</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Right: Metric inputs */}
                <div className="stitch-input-side">
                  {(() => {
                    const isBpGroup = group.device.deviceType === 'bloodPressure' && group.selections.length >= 2
                    if (isBpGroup) {
                      const sysMetric = group.selections.find(s => s.metric.metricCode === 'systolic')?.metric
                      const diaMetric = group.selections.find(s => s.metric.metricCode === 'diastolic')?.metric
                      const pulseMetric = group.selections.find(s => ['bloodPressurePulse','heartRate'].includes(s.metric.metricCode))?.metric
                      const sysEntry = values['systolic'] ?? { raw: '', final: '', confidence: null }
                      const diaEntry = values['diastolic'] ?? { raw: '', final: '', confidence: null }
                      const pulseEntry = pulseMetric ? (values[pulseMetric.metricCode] ?? { raw: '', final: '', confidence: null }) : null
                      return (
                        <>
                          <div className="stitch-bp-row">
                            {sysMetric ? (
                              <div className="stitch-metric-input-group stitch-bp-field">
                                <label htmlFor="input-systolic" className="stitch-metric-label">Systolic</label>
                                <div className="stitch-input-wrap">
                                  <input id="input-systolic" className={`stitch-metric-input ${sysEntry.error ? 'has-error' : ''}`} inputMode="decimal" min={sysMetric.physicalMin ?? ''} max={sysMetric.physicalMax ?? ''} step="1" placeholder="120" type="number" value={sysEntry.final} onChange={(e) => handleValueChange('systolic', e.target.value, sysMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                                  <span className="stitch-input-unit">mmHg</span>
                                </div>
                                {sysEntry.error ? <span className="stitch-field-error">{sysEntry.error}</span> : null}
                              </div>
                            ) : null}
                            <span className="stitch-bp-divider">/</span>
                            {diaMetric ? (
                              <div className="stitch-metric-input-group stitch-bp-field">
                                <label htmlFor="input-diastolic" className="stitch-metric-label">Diastolic</label>
                                <div className="stitch-input-wrap">
                                  <input id="input-diastolic" className={`stitch-metric-input ${diaEntry.error ? 'has-error' : ''}`} inputMode="decimal" min={diaMetric.physicalMin ?? ''} max={diaMetric.physicalMax ?? ''} step="1" placeholder="80" type="number" value={diaEntry.final} onChange={(e) => handleValueChange('diastolic', e.target.value, diaMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                                  <span className="stitch-input-unit">mmHg</span>
                                </div>
                                {diaEntry.error ? <span className="stitch-field-error">{diaEntry.error}</span> : null}
                              </div>
                            ) : null}
                          </div>
                          {pulseMetric && pulseEntry ? (
                            <div className="stitch-metric-input-group">
                              <label htmlFor={`input-${pulseMetric.metricCode}`} className="stitch-metric-label">{pulseMetric.metricName}</label>
                              <div className="stitch-input-wrap">
                                <input id={`input-${pulseMetric.metricCode}`} className={`stitch-metric-input ${pulseEntry.error ? 'has-error' : ''}`} inputMode="decimal" min={pulseMetric.physicalMin ?? ''} max={pulseMetric.physicalMax ?? ''} step="1" placeholder="72" type="number" value={pulseEntry.final} onChange={(e) => handleValueChange(pulseMetric.metricCode, e.target.value, pulseMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                                <span className="stitch-input-unit">{pulseMetric.unit}</span>
                              </div>
                              {pulseEntry.error ? <span className="stitch-field-error">{pulseEntry.error}</span> : null}
                            </div>
                          ) : null}
                        </>
                      )
                    }
                    return group.selections.map((selection) => {
                      const metric = selection.metric
                      const entry = values[metric.metricCode] ?? { raw: '', final: '', confidence: null }
                      const isBmi = metric.metricCode === 'bmi'
                      return (
                        <div key={metric.metricCode} className="stitch-metric-input-group">
                          <label htmlFor={`input-${metric.metricCode}`} className="stitch-metric-label">
                            {metric.metricName}
                            {entry.confidence != null ? (
                              <span className="stitch-confidence">AI {Math.round(entry.confidence * 100)}%</span>
                            ) : null}
                          </label>
                          <div className="stitch-input-wrap">
                            <input
                              id={`input-${metric.metricCode}`}
                              className={`stitch-metric-input ${entry.error ? 'has-error' : ''} ${isBmi ? 'is-calculated' : ''}`}
                              inputMode="decimal"
                              min={metric.physicalMin ?? ''}
                              max={metric.physicalMax ?? ''}
                              step={(metric.physicalMin != null && metric.physicalMax != null) ? ((metric.physicalMax - metric.physicalMin) >= 10 ? '1' : '0.1') : 'any'}
                              placeholder={isBmi ? 'Auto' : (metric.physicalMin != null && metric.physicalMax != null ? `${metric.physicalMin}–${metric.physicalMax}` : '0')}
                              readOnly={isBmi}
                              type="number"
                              value={entry.final}
                              onChange={(e) => handleValueChange(metric.metricCode, e.target.value, metric.physicalMax)}
                              onFocus={(e) => e.target.select()}
                            />
                            <span className="stitch-input-unit">{metric.unit}</span>
                          </div>
                          {entry.error ? <span className="stitch-field-error">{entry.error}</span> : null}
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

              {/* AI status message */}
              {aiStatus && !isExtracting ? (
                <div className={`stitch-ai-message stitch-ai-message-${aiStatus.kind}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {aiStatus.kind === 'success' ? 'check_circle' : aiStatus.kind === 'error' ? 'error' : 'warning'}
                  </span>
                  {aiStatus.message}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Footer Actions */}
      <div className="stitch-form-footer">
        <button type="button" onClick={onClearSelection} className="stitch-btn-clear" disabled={submitting}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          Clear Selection
        </button>
        <button disabled={submitting} type="submit" className="stitch-btn-submit">
          {submitting ? (
            <><span className="spinner" /> Saving...</>
          ) : (
            <><span className="material-symbols-outlined">check_circle</span> Validate & Save Results</>
          )}
        </button>
      </div>

      {aiError ? <p className="form-message error" role="status">{aiError}</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {successMessage ? <p className="form-message success" role="status">{successMessage}</p> : null}
    </form>
  )
}

export default DynamicMetricForm
