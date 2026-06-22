import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
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
  onSubmitted?: () => void
}

type ValueState = {
  raw: string
  final: string
  confidence?: number | null
  error?: string
}

type SubmitResponse = {
  success: boolean
  data?: { sessionId: number; interpretations: MetricInterpretation[] }
  error?: { message?: string }
}

type MetricInterpretation = {
  metricCode: string
  metricName: string
  finalValue: number
  unit: string
  status: string
  severity: string
  popupTitle: string
  popupMessage: string
  recommendation: string
  sourceLabel: string
  emergencyLevel: string
}

type AiDeviceStatus = {
  kind: 'success' | 'warning' | 'error' | 'loading'
  message: string
}

type BpReadings = { sys: string; dia: string; pulse: string }
type BpTrial = BpReadings

const METRIC_EDU: Record<string, { title: string; whyMeasure: string; whatItMeans: string; prevents: string; earlyAction: string; unitRange: string }> = {
  spo2: {
    title: 'Saturasi Oksigen (SpO2)',
    whyMeasure: 'Mengukur persentase oksigen dalam darah Anda.',
    whatItMeans: 'Angka normal 95-100%. Di bawah 90% menunjukkan tubuh kekurangan oksigen.',
    prevents: 'Hipoksemia, gagal napas, kerusakan organ akibat kurang oksigen.',
    earlyAction: 'Latihan napas dalam, posisi duduk tegak, hindari asap rokok. Di bawah 90% segera ke IGD.',
    unitRange: 'Rentang normal: 95-100%'
  },
  heartRate: {
    title: 'Denyut Jantung',
    whyMeasure: 'Mengukur jumlah detak jantung per menit.',
    whatItMeans: '60-100 bpm saat istirahat. Atlet bisa lebih rendah. Lebih dari 100 disebut takikardia.',
    prevents: 'Aritmia, serangan jantung, gagal jantung.',
    earlyAction: 'Kurangi kafein, kelola stres, tidur cukup. Di atas 120 bpm atau di bawah 50 bpm saat istirahat, konsultasi dokter.',
    unitRange: 'Rentang normal: 60-100 bpm'
  },
  systolic: {
    title: 'Tekanan Sistolik',
    whyMeasure: 'Tekanan darah saat jantung memompa darah.',
    whatItMeans: 'Diatas 130 mmHg perlu perhatian. Di atas 180 mmHg darurat hipertensi.',
    prevents: 'Stroke, serangan jantung, gagal ginjal.',
    earlyAction: 'Kurangi garam, olahraga teratur, kelola stres. Di atas 180 mmHg segera ke dokter.',
    unitRange: 'Rentang normal: 90-120 mmHg'
  },
  diastolic: {
    title: 'Tekanan Diastolik',
    whyMeasure: 'Tekanan darah saat jantung beristirahat.',
    whatItMeans: '80-89 mmHg tinggi ringan, 90+ mmHg hipertensi.',
    prevents: 'Stroke, kerusakan pembuluh darah, gagal jantung.',
    earlyAction: 'Diet rendah garam, olahraga aerobik, hindari alkohol berlebih. Konsultasi jika sering di atas 90 mmHg.',
    unitRange: 'Rentang normal: 60-80 mmHg'
  },
  bloodPressurePulse: {
    title: 'Pulse Tensimeter',
    whyMeasure: 'Denyut nadi yang terbaca oleh tensimeter digital.',
    whatItMeans: 'Sama dengan denyut jantung, 60-100 bpm normal saat istirahat.',
    prevents: 'Aritmia, bradikardia, takikardia.',
    earlyAction: 'Ukur ulang setelah istirahat 5 menit. Jika tidak normal, konsultasi dokter.',
    unitRange: 'Rentang normal: 60-100 bpm'
  },
  glucoseFasting: {
    title: 'Gula Darah Puasa',
    whyMeasure: 'Kadar gula darah setelah puasa 8-12 jam.',
    whatItMeans: '70-99 mg/dL normal. 100-125 prediabetes. 126+ diabetes.',
    prevents: 'Diabetes tipe 2, kerusakan saraf, kebutaan, gagal ginjal.',
    earlyAction: 'Kurangi gula, perbanyak serat, olahraga 30 menit/hari. Jika di atas 126 mg/dL, periksa HbA1c.',
    unitRange: 'Rentang normal: 70-99 mg/dL'
  },
  glucosePostMeal: {
    title: 'Gula Darah 2 Jam Setelah Makan',
    whyMeasure: 'Mengukur respons tubuh terhadap makanan.',
    whatItMeans: 'Di bawah 140 mg/dL normal. 140-199 prediabetes. 200+ diabetes.',
    prevents: 'Diabetes, komplikasi kardiovaskular.',
    earlyAction: 'Porsi kecil, indeks glikemik rendah, jalan kaki 10 menit setelah makan.',
    unitRange: 'Rentang normal: <140 mg/dL'
  },
  cholesterolTotal: {
    title: 'Kolesterol Total',
    whyMeasure: 'Jumlah kolesterol dalam darah (LDL+HDL+trigliserida/5).',
    whatItMeans: '<200 mg/dL desirable. 200-239 borderline. 240+ tinggi.',
    prevents: 'Aterosklerosis, serangan jantung, stroke.',
    earlyAction: 'Kurangi gorengan, perbanyak omega-3, olahraga teratur. Di atas 240 konsultasi dokter.',
    unitRange: 'Rentang optimal: <200 mg/dL'
  },
  uricAcid: {
    title: 'Asam Urat',
    whyMeasure: 'Kadar purin dalam darah yang bisa mengkristal di sendi.',
    whatItMeans: 'Pria 3.4-7.0, Wanita 2.4-6.0 mg/dL. Di atas batas risiko gout.',
    prevents: 'Asam urat (gout), batu ginjal, kerusakan sendi.',
    earlyAction: 'Kurangi jeroan, seafood, alkohol. Minum air putih 2L/hari. Konsultasi jika nyeri sendi.',
    unitRange: 'Normal: Pria 3.4-7.0, Wanita 2.4-6.0 mg/dL'
  },
  bodyWeight: {
    title: 'Berat Badan',
    whyMeasure: 'Memantau perubahan berat badan untuk deteksi dini masalah kesehatan.',
    whatItMeans: 'Bergantung tinggi, usia, jenis kelamin. Lihat rekomendasi ideal di bawah input.',
    prevents: 'Obesitas, underweight, malnutrisi, gangguan metabolik.',
    earlyAction: 'Pola makan seimbang, olahraga teratur, cek rutin. Perubahan drastis tanpa sebab perlu konsultasi.',
    unitRange: 'Lihat BMI di bawah'
  },
  bmi: {
    title: 'Body Mass Index (BMI)',
    whyMeasure: 'Indeks massa tubuh untuk kategori berat badan ideal.',
    whatItMeans: '<18.5 underweight, 18.5-24.9 normal, 25-29.9 overweight, 30+ obesitas.',
    prevents: 'Penyakit jantung, diabetes, hipertensi, stroke.',
    earlyAction: 'Hitung otomatis dari berat dan tinggi. Konsultasi jika di luar normal.',
    unitRange: 'Normal: 18.5-24.9'
  },
  waistCircumference: {
    title: 'Lingkar Perut',
    whyMeasure: 'Indikator lemak visceral yang berisiko terhadap penyakit metabolik.',
    whatItMeans: 'Pria <94cm, Wanita <80cm risiko rendah. Di atas itu risiko meningkat.',
    prevents: 'Diabetes tipe 2, jantung, stroke, fatty liver.',
    earlyAction: 'Kurangi gula dan lemak jenuh, olahraga kardio 150 menit/minggu.',
    unitRange: 'Normal: Pria <94cm, Wanita <80cm'
  },
  bodyTemperature: {
    title: 'Suhu Tubuh',
    whyMeasure: 'Tanda vital dasar, indikator infeksi atau peradangan.',
    whatItMeans: '36.1-37.2°C normal. 37.5-37.9 sub-fever. 38+ demam.',
    prevents: 'Dehidrasi berat, kejang demam, sepsis.',
    earlyAction: 'Cukup cairan, istirahat. Di atas 39°C atau 3 hari+, konsultasi dokter.',
    unitRange: 'Rentang normal: 36.1-37.2°C'
  },
  sleepDuration: {
    title: 'Durasi Tidur',
    whyMeasure: 'Tidur cukup penting untuk pemulihan fisik dan mental.',
    whatItMeans: 'Dewasa 7-9 jam. Kurang dari 6 jam berisiko pada kesehatan.',
    prevents: 'Hipertensi, obesitas, depresi, penurunan imun.',
    earlyAction: 'Jadwal tidur konsisten, hindari layar 1 jam sebelum tidur, kamar gelap dan sejuk.',
    unitRange: 'Dewasa: 7-9 jam'
  }
}

const SLEEP_RECOMMENDATION: Array<{ maxAge: number; minH: number; maxH: number; label: string }> = [
  { maxAge: 5, minH: 10, maxH: 14, label: 'Anak usia 3-5 tahun' },
  { maxAge: 12, minH: 9, maxH: 12, label: 'Anak usia 6-12 tahun' },
  { maxAge: 17, minH: 8, maxH: 10, label: 'Remaja 13-17 tahun' },
  { maxAge: 64, minH: 7, maxH: 9, label: 'Dewasa 18-64 tahun' },
  { maxAge: 200, minH: 7, maxH: 8, label: 'Lansia 65+ tahun' }
]

async function getLastMeasurements(): Promise<Record<string, { value: number; measuredAt: string }>> {
  try {
    const response = await fetch('/api/measurements/last', { credentials: 'include' })
    if (!response.ok) return {}
    const body = await response.json() as { success: boolean; data?: Array<{ metricCode: string; deviceCode?: string; finalValue: number; measuredAt: string }> }
    if (!body.success || !Array.isArray(body.data)) return {}
    const map: Record<string, { value: number; measuredAt: string }> = {}
    for (const item of body.data) {
      const key = item.deviceCode ? `${item.metricCode}-${item.deviceCode}` : item.metricCode
      map[key] = { value: item.finalValue, measuredAt: item.measuredAt }
    }
    return map
  } catch {
    return {}
  }
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

function idealWeightRange(heightCm: number, _sex: string): { min: number; max: number } {
  const h = heightCm / 100
  return {
    min: Math.round(18.5 * h * h * 10) / 10,
    max: Math.round(24.9 * h * h * 10) / 10
  }
}

function sleepRecommendation(years: number): { minH: number; maxH: number; label: string } {
  return SLEEP_RECOMMENDATION.find(r => years <= r.maxAge) || SLEEP_RECOMMENDATION[SLEEP_RECOMMENDATION.length - 1]
}

function deriveMetricGroup(deviceType: string | undefined): string {
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

const ALL_AUTOFILL_METRICS = new Set([
  'bodyWeight', 'waistCircumference', 'bodyTemperature', 'spo2',
  'heartRate', 'sleepDuration', 'glucoseFasting', 'glucosePostMeal',
  'cholesterolTotal', 'uricAcid', 'systolic', 'diastolic', 'bloodPressurePulse'
])

function InfoChip({ info }: { info: typeof METRIC_EDU[string] }) {
  return (
    <details className="metric-info-chip">
      <summary>
        <span className="material-symbols-outlined">info</span>
        <span>Kenapa diukur?</span>
      </summary>
      <div className="metric-info-content">
        <div className="metric-info-row">
          <span className="metric-info-label">Tujuan:</span>
          <span>{info.whyMeasure}</span>
        </div>
        <div className="metric-info-row">
          <span className="metric-info-label">Arti angka:</span>
          <span>{info.whatItMeans}</span>
        </div>
        <div className="metric-info-row">
          <span className="metric-info-label">Mencegah:</span>
          <span>{info.prevents}</span>
        </div>
        <div className="metric-info-row">
          <span className="metric-info-label">Tindakan dini:</span>
          <span>{info.earlyAction}</span>
        </div>
        <div className="metric-info-row metric-info-range">
          <span className="material-symbols-outlined">straighten</span>
          <span>{info.unitRange}</span>
        </div>
      </div>
    </details>
  )
}

export function DynamicMetricForm({ selectedMetrics, onClearSelection, onSubmit, onSubmitted }: DynamicMetricFormProps) {
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
  const [lastMeasurements, setLastMeasurements] = useState<Record<string, { value: number; measuredAt: string }>>({})
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ title: string; values: Array<{ label: string; value: string; unit: string }> } | null>(null)
  const [interpretation, setInterpretation] = useState<{ interpretations: MetricInterpretation[]; values: Array<{ metricCode: string; finalValue: number; unit: string }> } | null>(null)
  const [removedDevices, setRemovedDevices] = useState<Set<string>>(new Set())
  const [bpTrials, setBpTrials] = useState<Record<string, BpTrial[]>>({})
  const pendingTimersRef = useRef<Set<number>>(new Set())

  useEffect(() => { void getLastMeasurements().then(setLastMeasurements) }, [])
  useEffect(() => { if (profile?.birthDate) setAgeInfo(calculateAge(profile.birthDate)) }, [profile?.birthDate])

  // Cleanup: revoke all Object URLs and clear pending timers on unmount
  useEffect(() => {
    return () => {
      const timers = pendingTimersRef.current
      for (const t of timers) window.clearTimeout(t)
      timers.clear()
      setPreviewUrls(current => {
        for (const url of Object.values(current)) URL.revokeObjectURL(url)
        return {}
      })
    }
  }, [])

  useEffect(() => {
    setValues(prev => {
      const updated = { ...prev }
      const newAutoFilled = new Set<string>()
      for (const selection of selectedMetrics) {
        if (removedDevices.has(selection.device?.deviceCode || '')) continue
        const key = selection.device?.deviceCode ? `${selection.metric.metricCode}-${selection.device.deviceCode}` : selection.metric.metricCode
        const lastData = lastMeasurements[key]
        if (ALL_AUTOFILL_METRICS.has(selection.metric.metricCode) && lastData && !updated[selection.metric.metricCode]?.final) {
          updated[selection.metric.metricCode] = {
            ...updated[selection.metric.metricCode],
            final: String(lastData.value),
            confidence: null,
            error: undefined
          }
          newAutoFilled.add(selection.metric.metricCode)
        } else if (!updated[selection.metric.metricCode]) {
          updated[selection.metric.metricCode] = { raw: '', final: '', confidence: null }
        }
      }
      if (newAutoFilled.size > 0) setAutoFilled(prev => new Set([...prev, ...newAutoFilled]))
      return updated
    })
  }, [selectedMetrics, lastMeasurements, removedDevices])

  const deviceGroups = useMemo(() => {
    const groups = new Map<string, { device: DynamicMetricDevice; selections: DynamicMetricSelection[] }>()
    for (const selection of selectedMetrics) {
      if (removedDevices.has(selection.device?.deviceCode || '')) continue
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
  }, [selectedMetrics, removedDevices])

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

  function handleValueChange(metricCode: string, raw: string, physicalMax: number | null | undefined) {
    const maxDigits = physicalMax != null ? String(Math.ceil(physicalMax)).length + 3 : 8
    let sanitized = raw
    if (sanitized.length > maxDigits) sanitized = sanitized.slice(0, maxDigits)
    if (physicalMax != null) {
      const num = Number(sanitized)
      if (Number.isFinite(num) && num > physicalMax) {
        sanitized = String(physicalMax)
      }
    }
    if (autoFilled.has(metricCode)) {
      const newSet = new Set(autoFilled)
      newSet.delete(metricCode)
      setAutoFilled(newSet)
    }
    setField(metricCode, { raw: sanitized, final: sanitized, error: undefined })
  }

  useEffect(() => {
    const weightEntry = values['bodyWeight']
    if (weightEntry?.final && profile?.heightCm) {
      const weight = Number(weightEntry.final)
      const heightM = profile.heightCm / 100
      if (weight > 0 && heightM > 0) {
        const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10
        const bmiEntry = values['bmi']
        // Don't overwrite if user already manually set BMI (i.e. it isn't from auto-calc)
        const isBmiAuto = !bmiEntry?.raw || bmiEntry.raw === bmiEntry.final
        const differs = !bmiEntry || bmiEntry.final === '' || bmiEntry.final !== String(bmi)
        if (differs && isBmiAuto) {
          setValues(prev => ({ ...prev, bmi: { ...prev['bmi'], final: String(bmi), raw: String(bmi), confidence: null } }))
        }
      }
    }
  }, [values['bodyWeight']?.final, profile?.heightCm])

  function removeDevice(deviceCode: string) {
    setRemovedDevices(prev => new Set([...prev, deviceCode]))
    const newValues = { ...values }
    const group = deviceGroups.get(deviceCode)
    if (group) {
      for (const sel of group.selections) delete newValues[sel.metric.metricCode]
    }
    setValues(newValues)
    const newDeviceFiles = { ...deviceFiles }
    delete newDeviceFiles[deviceCode]
    setDeviceFiles(newDeviceFiles)
    const newPreviews = { ...previewUrls }
    if (newPreviews[deviceCode]) URL.revokeObjectURL(newPreviews[deviceCode])
    delete newPreviews[deviceCode]
    setPreviewUrls(newPreviews)
    const newStatus = { ...aiDeviceStatus }
    delete newStatus[deviceCode]
    setAiDeviceStatus(newStatus)
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    for (const selection of selectedMetrics) {
      if (removedDevices.has(selection.device?.deviceCode || '')) continue
      const metric = selection.metric
      if (metric.metricCode === 'bmi') continue
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
    const timerId = window.setTimeout(() => {
      pendingTimersRef.current.delete(timerId)
      const group = deviceGroups.get(deviceCode)
      if (group) void handleAiExtract(deviceCode, group)
    }, 800)
    pendingTimersRef.current.add(timerId)
  }

  async function handleAiExtract(deviceCode: string, group: { device: DynamicMetricDevice; selections: DynamicMetricSelection[] }) {
    const file = deviceFiles[deviceCode]
    if (!file) return
    setError(null); setSuccessMessage(null); setExtractingDevice(deviceCode)
    setAiDeviceStatus(prev => ({ ...prev, [deviceCode]: { kind: 'loading', message: 'AI sedang membaca foto...' } }))
    const selectedMetricCodes = group.selections.map(s => s.metric.metricCode)
    const metricGroup = deriveMetricGroup(group.device.deviceType)
    try {
      const { result, error: resultError } = await extract(file, deviceCode, metricGroup, selectedMetricCodes)
      if (result?.metrics?.length) {
        const updates: Record<string, ValueState> = {}
        for (const metric of result.metrics) {
          updates[metric.metricCode] = { raw: String(metric.rawAiValue), final: String(metric.rawAiValue), confidence: metric.confidence, error: undefined }
        }
        const avgConfidence = result.metrics.reduce((sum, m) => sum + m.confidence, 0) / result.metrics.length
        const metricsCount = result.metrics.length
        setAiDeviceStatus(prev => ({ ...prev, [deviceCode]: { kind: result.needsManualReview ? 'warning' : 'success', message: `AI berhasil membaca ${metricsCount} nilai (${Math.round(avgConfidence * 100)}% keyakinan). Verifikasi sebelum simpan.` } }))
        setValues(prev => ({ ...prev, ...updates }))
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
    const payload = selectedMetrics
      .filter(s => !removedDevices.has(s.device?.deviceCode || ''))
      .map(selection => {
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

      // Build toast immediately from input
      const toastValues = payload.map(p => {
        const sel = selectedMetrics.find(s => s.metric.metricCode === p.metricCode)
        return { label: sel?.metric.metricName || p.metricCode, value: String(p.finalValue), unit: p.unit }
      })
      setToast({ title: 'Pengukuran Tersimpan', values: toastValues })
      setTimeout(() => setToast(null), 5000)

      if (body.data.interpretations) {
        setInterpretation({ interpretations: body.data.interpretations, values: payload.map(p => ({ metricCode: p.metricCode, finalValue: p.finalValue, unit: p.unit })) })
      }

      await uploadAttachments(body.data.sessionId, measuredAt)
      for (const p of payload) {
        if (ALL_AUTOFILL_METRICS.has(p.metricCode)) {
          await fetch('/api/measurements/last/save', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metricCode: p.metricCode, deviceCode: p.deviceCode, finalValue: p.finalValue, unit: p.unit, measuredAt })
          }).catch(() => {})
        }
      }
      onSubmit?.(payload.map(v => ({ metricCode: v.metricCode, finalValue: v.finalValue, manualOverride: v.manualOverride })))
      onSubmitted?.()
      setValues({}); setDeviceFiles({}); setPreviewUrls({}); setAutoFilled(new Set()); setRemovedDevices(new Set())
      // Refresh last-measurement cache so the next visit auto-fills with the just-submitted values
      void getLastMeasurements().then(setLastMeasurements)
      setSuccessMessage('Pengukuran berhasil tersimpan.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Tidak bisa terhubung ke server.') }
    finally { setSubmitting(false) }
  }

  if (selectedMetrics.length === 0) {
    return <p className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>Pilih alat pada daftar di atas untuk mulai mengisi.</p>
  }

  const heightCm = profile?.heightCm
  const idealW = heightCm ? idealWeightRange(heightCm, profile?.sex || 'all') : null
  const sleepRec = ageInfo ? sleepRecommendation(ageInfo.years) : null

  return (
    <form className="stitch-measurement-form" onSubmit={handleSubmit}>
      <div className="stitch-device-cards">
        {Array.from(deviceGroups.entries()).map(([deviceCode, group]) => {
          const hasAttachment = group.selections.some(s => s.metric.requiresAttachment)
          const previewUrl = previewUrls[deviceCode]
          const aiStatus = aiDeviceStatus[deviceCode]
          const isExtracting = extractingDevice === deviceCode
          const icon = DEVICE_ICON_MAP[group.device.deviceType || ''] || 'medical_services'
          const color = DEVICE_COLOR_MAP[group.device.deviceType || ''] || 'var(--colorPrimary)'
          const isBpGroup = group.device.deviceType === 'bloodPressure' && group.selections.length >= 2
          const trials = bpTrials[deviceCode] || []

          function addBpTrial() {
            const sysEntry = values['systolic']?.final
            const diaEntry = values['diastolic']?.final
            const pulseEntry = values['bloodPressurePulse']?.final
            if (!sysEntry || !diaEntry) {
              setError('Isi sistolik dan diastolik dulu untuk tambah percobaan.')
              return
            }
            setBpTrials(prev => {
              const list = prev[deviceCode] || []
              if (list.length >= 3) {
                setError('Maksimal 3 kali percobaan untuk tensimeter.')
                return prev
              }
              return { ...prev, [deviceCode]: [...list, { sys: sysEntry, dia: diaEntry, pulse: pulseEntry || '' }] }
            })
            setField('systolic', { final: '', raw: '' })
            setField('diastolic', { final: '', raw: '' })
            setField('bloodPressurePulse', { final: '', raw: '' })
          }

          function averageBp() {
            const list = bpTrials[deviceCode] || []
            if (list.length === 0) return
            const sysVals = list.map(t => Number(t.sys)).filter(n => Number.isFinite(n))
            const diaVals = list.map(t => Number(t.dia)).filter(n => Number.isFinite(n))
            const pulseVals = list.map(t => Number(t.pulse)).filter(n => Number.isFinite(n))
            const avg = (arr: number[]) => arr.length === 0 ? 0 : Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10
            setField('systolic', { final: String(avg(sysVals)), raw: String(avg(sysVals)) })
            setField('diastolic', { final: String(avg(diaVals)), raw: String(avg(diaVals)) })
            if (pulseVals.length > 0) {
              setField('bloodPressurePulse', { final: String(avg(pulseVals)), raw: String(avg(pulseVals)) })
            }
            setBpTrials(prev => ({ ...prev, [deviceCode]: [] }))
          }

          return (
            <div key={deviceCode} className="stitch-device-card">
              <div className="stitch-card-header">
                <div className="stitch-card-header-left">
                  <div className="stitch-device-icon" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <h3 className="stitch-device-title">{group.device.deviceName}</h3>
                </div>
                <div className="stitch-card-header-right">
                  {aiStatus ? (
                    <span className={`stitch-ai-badge stitch-ai-badge-${aiStatus.kind}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {aiStatus.kind === 'success' ? 'check_circle' : aiStatus.kind === 'error' ? 'error' : aiStatus.kind === 'loading' ? 'hourglass_empty' : 'warning'}
                      </span>
                      {aiStatus.kind === 'loading' ? 'Memproses...' : aiStatus.kind}
                    </span>
                  ) : null}
                  <button
                    className="stitch-card-remove-btn"
                    onClick={() => removeDevice(deviceCode)}
                    type="button"
                    aria-label="Hapus pengukuran"
                    title="Batalkan pengukuran ini"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="stitch-card-body">
                {hasAttachment ? (
                  <div className="stitch-image-side">
                    {previewUrl ? (
                      <div className="stitch-preview">
                        <img src={previewUrl} alt="Preview foto alat" />
                        <label className="stitch-retake-btn">
                          <input accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => void handleFileChange(deviceCode, e)} type="file" />
                          <span className="material-symbols-outlined">photo_camera</span> Foto Ulang
                        </label>
                      </div>
                    ) : (
                      <label className="stitch-capture-area">
                        <input accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => void handleFileChange(deviceCode, e)} type="file" />
                        <span className="material-symbols-outlined">add_a_photo</span>
                        <span className="stitch-capture-label">Ambil Foto Layar</span>
                        <span className="stitch-capture-hint">Kamera akan terbuka di HP. Foto akan otomatis dikecilkan.</span>
                      </label>
                    )}
                    {isExtracting ? (
                      <div className="stitch-ai-progress">
                        <div className="stitch-ai-progress-bar" />
                        <span>AI sedang membaca foto...</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="stitch-input-side">
                  {isBpGroup ? (
                    <>
                      <div className="stitch-bp-row">
                        {(() => {
                          const sysMetric = group.selections.find(s => s.metric.metricCode === 'systolic')?.metric
                          const diaMetric = group.selections.find(s => s.metric.metricCode === 'diastolic')?.metric
                          const sysEntry = values['systolic'] ?? { raw: '', final: '', confidence: null }
                          const diaEntry = values['diastolic'] ?? { raw: '', final: '', confidence: null }
                          return (
                            <>
                              {sysMetric ? (
                                <div className="stitch-metric-input-group stitch-bp-field">
                                  <label htmlFor="input-systolic" className="stitch-metric-label">
                                    <span className="material-symbols-outlined label-icon">favorite</span>
                                    Sistolik
                                  </label>
                                  <div className="stitch-input-wrap">
                                    <input id="input-systolic" className={`stitch-metric-input ${sysEntry.error ? 'has-error' : ''} ${autoFilled.has('systolic') ? 'is-autofilled' : ''}`} inputMode="decimal" min={sysMetric.physicalMin ?? ''} max={sysMetric.physicalMax ?? ''} step="1" placeholder="120" type="number" value={sysEntry.final} onChange={(e) => handleValueChange('systolic', e.target.value, sysMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                                    <span className="stitch-input-unit">mmHg</span>
                                  </div>
                                  {sysEntry.error ? <span className="stitch-field-error">{sysEntry.error}</span> : null}
                                  <InfoChip info={METRIC_EDU.systolic} />
                                </div>
                              ) : null}
                              <span className="stitch-bp-divider">/</span>
                              {diaMetric ? (
                                <div className="stitch-metric-input-group stitch-bp-field">
                                  <label htmlFor="input-diastolic" className="stitch-metric-label">
                                    <span className="material-symbols-outlined label-icon">monitor_heart</span>
                                    Diastolik
                                  </label>
                                  <div className="stitch-input-wrap">
                                    <input id="input-diastolic" className={`stitch-metric-input ${diaEntry.error ? 'has-error' : ''} ${autoFilled.has('diastolic') ? 'is-autofilled' : ''}`} inputMode="decimal" min={diaMetric.physicalMin ?? ''} max={diaMetric.physicalMax ?? ''} step="1" placeholder="80" type="number" value={diaEntry.final} onChange={(e) => handleValueChange('diastolic', e.target.value, diaMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                                    <span className="stitch-input-unit">mmHg</span>
                                  </div>
                                  {diaEntry.error ? <span className="stitch-field-error">{diaEntry.error}</span> : null}
                                  <InfoChip info={METRIC_EDU.diastolic} />
                                </div>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                      {(() => {
                        const pulseMetric = group.selections.find(s => s.metric.metricCode === 'bloodPressurePulse')?.metric
                        if (!pulseMetric) return null
                        const pulseEntry = values['bloodPressurePulse'] ?? { raw: '', final: '', confidence: null }
                        return (
                          <div className="stitch-metric-input-group">
                            <label htmlFor="input-bloodPressurePulse" className="stitch-metric-label">
                              <span className="material-symbols-outlined label-icon">pulse_alert</span>
                              Pulse Tensimeter
                            </label>
                            <div className="stitch-input-wrap">
                              <input id="input-bloodPressurePulse" className={`stitch-metric-input ${pulseEntry.error ? 'has-error' : ''} ${autoFilled.has('bloodPressurePulse') ? 'is-autofilled' : ''}`} inputMode="decimal" min={pulseMetric.physicalMin ?? ''} max={pulseMetric.physicalMax ?? ''} step="1" placeholder="72" type="number" value={pulseEntry.final} onChange={(e) => handleValueChange('bloodPressurePulse', e.target.value, pulseMetric.physicalMax)} onFocus={(e) => e.target.select()} />
                              <span className="stitch-input-unit">{pulseMetric.unit}</span>
                            </div>
                            {pulseEntry.error ? <span className="stitch-field-error">{pulseEntry.error}</span> : null}
                            <InfoChip info={METRIC_EDU.bloodPressurePulse} />
                          </div>
                        )
                      })()}
                      <div className="bp-trial-row">
                        {trials.length > 0 ? (
                          <div className="bp-trial-list">
                            <strong>Percobaan tersimpan:</strong>
                            {trials.map((t, i) => (
                              <span key={i} className="bp-trial-pill">#{i + 1}: {t.sys}/{t.dia}{t.pulse ? ` • ${t.pulse}` : ''}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="bp-trial-actions">
                          {trials.length < 2 ? (
                            <button type="button" className="btn-secondary" onClick={addBpTrial}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                              Tambah Ukur (max 3x)
                            </button>
                          ) : (
                            <button type="button" className="btn-secondary" onClick={averageBp}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calculate</span>
                              Hitung Rata-rata ({trials.length + 1} data)
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {!isBpGroup ? group.selections.map((selection) => {
                    const metric = selection.metric
                    const entry = values[metric.metricCode] ?? { raw: '', final: '', confidence: null }
                    const isBmi = metric.metricCode === 'bmi'
                    const isWeight = metric.metricCode === 'bodyWeight'
                    const isSleep = metric.metricCode === 'sleepDuration'
                    const isHeight = metric.metricCode === 'height'
                    const edu = METRIC_EDU[metric.metricCode]
                    const isAuto = autoFilled.has(metric.metricCode)
                    const labelIcon = isBmi ? 'straighten'
                      : isWeight ? 'monitor_weight'
                      : isSleep ? 'bedtime'
                      : isHeight ? 'height'
                      : 'medical_services'
                    return (
                      <div key={metric.metricCode} className="stitch-metric-input-group">
                        <label htmlFor={`input-${metric.metricCode}`} className="stitch-metric-label">
                          <span className="material-symbols-outlined label-icon">{labelIcon}</span>
                          {metric.metricName}
                          {isAuto ? <span className="stitch-autofill-badge">Data Terakhir</span> : null}
                          {entry.confidence != null ? <span className="stitch-confidence">AI {Math.round(entry.confidence * 100)}%</span> : null}
                        </label>
                        {isBmi && heightCm ? (
                          <div className="stitch-bmi-height">Tinggi: {heightCm} cm</div>
                        ) : null}
                        {isWeight && idealW ? (
                          <div className="stitch-ideal-weight">
                            <span className="material-symbols-outlined">lightbulb</span>
                            Berat badan ideal untuk tinggi {heightCm}cm: <strong>{idealW.min}–{idealW.max} kg</strong>
                          </div>
                        ) : null}
                        {isSleep && sleepRec ? (
                          <div className="stitch-ideal-weight">
                            <span className="material-symbols-outlined">bedtime</span>
                            {sleepRec.label}: <strong>{sleepRec.minH}–{sleepRec.maxH} jam</strong>
                          </div>
                        ) : null}
                        <div className="stitch-input-wrap">
                          <input
                            id={`input-${metric.metricCode}`}
                            className={`stitch-metric-input ${entry.error ? 'has-error' : ''} ${isBmi ? 'is-calculated' : ''} ${isAuto ? 'is-autofilled' : ''}`}
                            inputMode="decimal"
                            min={metric.physicalMin ?? ''}
                            max={metric.physicalMax ?? ''}
                            step={(metric.physicalMin != null && metric.physicalMax != null) ? ((metric.physicalMax - metric.physicalMin) >= 10 ? '1' : '0.1') : 'any'}
                            placeholder={isBmi ? 'Otomatis' : (metric.physicalMin != null && metric.physicalMax != null ? `${metric.physicalMin}–${metric.physicalMax}` : '0')}
                            readOnly={isBmi}
                            type="number"
                            value={entry.final}
                            onChange={(e) => handleValueChange(metric.metricCode, e.target.value, metric.physicalMax)}
                            onFocus={(e) => e.target.select()}
                          />
                          <span className="stitch-input-unit">{metric.unit}</span>
                        </div>
                        {entry.error ? <span className="stitch-field-error">{entry.error}</span> : null}
                        {edu ? <InfoChip info={edu} /> : null}
                      </div>
                    )
                  }) : null}
                </div>
              </div>

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

      <div className="stitch-form-footer">
        <button type="button" onClick={onClearSelection} className="stitch-btn-clear" disabled={submitting}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          Hapus Semua
        </button>
        <button disabled={submitting} type="submit" className="stitch-btn-submit">
          {submitting ? (
            <><span className="spinner" /> Menyimpan...</>
          ) : (
            <><span className="material-symbols-outlined">check_circle</span> Validasi & Simpan</>
          )}
        </button>
      </div>

      {aiError ? <p className="form-message error" role="status">{aiError}</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {successMessage && !toast ? <p className="form-message success" role="status">{successMessage}</p> : null}

      {toast ? (
        <div className="toast-overlay" role="status" aria-live="polite">
          <div className="toast-card">
            <div className="toast-header">
              <span className="material-symbols-outlined">check_circle</span>
              <strong>{toast.title}</strong>
              <button onClick={() => setToast(null)} type="button" aria-label="Tutup">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ul className="toast-values">
              {toast.values.map((v, i) => (
                <li key={i}>
                  <span>{v.label}</span>
                  <strong>{v.value} {v.unit}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {interpretation ? (
        <div className="interpretation-modal" role="dialog" aria-modal="true" aria-label="Interpretasi pengukuran">
          <div className="interpretation-card">
            <div className="page-heading compact">
              <h3>Hasil Interpretasi Pengukuran</h3>
              <button onClick={() => setInterpretation(null)} type="button">Tutup</button>
            </div>
            {interpretation.interpretations.map((interp) => (
              <div key={interp.metricCode} className={`interpretation-item severity-${interp.severity}`}>
                <div className="interpretation-item-header">
                  <strong>{interp.metricName}</strong>
                  <span className={`badge-status badge-${interp.severity}`}>
                    <span className="status-dot" />{interp.status}
                  </span>
                </div>
                <p className="interpretation-value">{interp.finalValue} {interp.unit}</p>
                <h4>{interp.popupTitle}</h4>
                <p>{interp.popupMessage}</p>
                <p><strong>Saran:</strong> {interp.recommendation}</p>
                <small className="muted">Sumber: {interp.sourceLabel}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  )
}

export default DynamicMetricForm
