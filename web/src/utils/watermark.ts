import { formatDateTimeIDFull } from './dateFormat'

export type WatermarkOptions = {
  displayName: string
  measuredAt: string
  metrics: Array<{ metricName: string; finalValue: number; unit: string }>
  appName?: string
  format?: 'webp' | 'jpeg'
  position?: 'bottom' | 'top'
}

export type WatermarkedImage = {
  file: File
  width: number
  height: number
}

const FALLBACK_APP_NAME = 'HL Health Companion'

const METRIC_LABELS: Record<string, string> = {
  spo2: 'SpO2',
  heartRate: 'Heart Rate',
  systolic: 'Sistolik',
  diastolic: 'Diastolik',
  bloodPressurePulse: 'Nadi',
  glucoseFasting: 'Gula Darah Puasa',
  glucosePostMeal: 'Gula Darah 2 Jam PP',
  cholesterolTotal: 'Kolesterol Total',
  uricAcid: 'Asam Urat',
  bodyWeight: 'Berat Badan',
  bmi: 'BMI',
  waistCircumference: 'Lingkar Pinggang',
  bodyTemperature: 'Suhu Tubuh',
  sleepDuration: 'Durasi Tidur',
  height: 'Tinggi Badan'
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Gambar tidak bisa dibaca.')) }
    image.src = objectUrl
  })
}

function formatTimestamp(iso: string): string {
  const formatted = formatDateTimeIDFull(iso)
  return formatted === '-' ? iso : formatted
}

function supportsWebp(): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    return canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Watermark gambar gagal.')),
      mime, quality
    )
  })
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<WatermarkedImage> {
  const { displayName, measuredAt, metrics, appName = FALLBACK_APP_NAME, format, position = 'bottom' } = options
  const useWebp = format ? format === 'webp' : supportsWebp()
  const mime = useWebp ? 'image/webp' : 'image/jpeg'

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas browser tidak tersedia.')

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  ctx.drawImage(image, 0, 0)

  const baseFont = Math.max(14, Math.floor(image.naturalWidth / 50))
  const lineH = Math.round(baseFont * 1.35)
  const padding = Math.round(baseFont * 0.8)

  const appLine = appName
  const userLine = `Pemilik: ${displayName}`
  const dateLine = `Waktu: ${formatTimestamp(measuredAt)}`
  const metricLines = metrics.map(m =>
    `${m.metricName}: ${m.finalValue} ${m.unit}`
  )
  const allLines = [appLine, userLine, dateLine, ...metricLines]

  ctx.font = `600 ${baseFont}px Arial, sans-serif`
  const maxWidth = Math.max(...allLines.map(l => ctx.measureText(l).width))
  const blockH = allLines.length * lineH + padding * 2
  const blockW = maxWidth + padding * 2

  const blockX = position === 'top' ? padding : canvas.width - blockW - padding
  const blockY = position === 'top' ? padding : canvas.height - blockH - padding

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(blockX, blockY, blockW, blockH)

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.font = `700 ${baseFont + 2}px Arial, sans-serif`
  ctx.fillText(appLine, blockX + padding, blockY + padding)
  ctx.font = `500 ${baseFont}px Arial, sans-serif`
  allLines.slice(1).forEach((line, i) => {
    ctx.fillText(line, blockX + padding, blockY + padding + (i + 1) * lineH)
  })

  const blob = await canvasToBlob(canvas, mime, useWebp ? 0.85 : 0.85)
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'attachment'
  const ext = useWebp ? 'webp' : 'jpg'
  const watermarkedFile = new File([blob], `${baseName}-watermarked.${ext}`, {
    type: mime,
    lastModified: Date.now()
  })

  return { file: watermarkedFile, width: canvas.width, height: canvas.height }
}

export function getMetricLabel(code: string): string {
  return METRIC_LABELS[code] || code
}
