import { useState } from 'react'
import { downloadCsv } from '../../utils/csv'
import { useI18n } from '../../i18n/useI18n'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type Report = { reportId: string; status: string }

type ReportValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt: string
  recommendation?: string
  sourceLabel?: string
}

const METRIC_CATEGORY: Record<string, string> = {
  spo2: 'Pernapasan',
  heartRate: 'Kardiovaskular',
  bloodPressurePulse: 'Kardiovaskular',
  systolic: 'Kardiovaskular',
  diastolic: 'Kardiovaskular',
  bodyTemperature: 'Tanda Vital',
  bodyWeight: 'Antropometri',
  bmi: 'Antropometri',
  waistCircumference: 'Antropometri',
  glucoseFasting: 'Metabolik',
  glucosePostMeal: 'Metabolik',
  cholesterolTotal: 'Metabolik',
  uricAcid: 'Metabolik',
  sleepDuration: 'Gaya Hidup'
}

const METRIC_LABEL: Record<string, string> = {
  spo2: 'Saturasi Oksigen',
  heartRate: 'Denyut Jantung',
  bloodPressurePulse: 'Pulse Tensimeter',
  systolic: 'Tekanan Sistolik',
  diastolic: 'Tekanan Diastolik',
  bodyTemperature: 'Suhu Tubuh',
  bodyWeight: 'Berat Badan',
  bmi: 'BMI',
  waistCircumference: 'Lingkar Perut',
  glucoseFasting: 'Gula Darah Puasa',
  glucosePostMeal: 'Gula Darah 2 Jam PP',
  cholesterolTotal: 'Kolesterol Total',
  uricAcid: 'Asam Urat',
  sleepDuration: 'Durasi Tidur'
}

const METRIC_RANGE: Record<string, string> = {
  spo2: '95-100%',
  heartRate: '60-100 bpm',
  systolic: '90-120 mmHg',
  diastolic: '60-80 mmHg',
  bodyTemperature: '36.1-37.2 °C',
  bodyWeight: 'Sesuai BMI 18.5-24.9',
  bmi: '18.5-24.9',
  glucoseFasting: '70-99 mg/dL',
  glucosePostMeal: '<140 mg/dL',
  cholesterolTotal: '<200 mg/dL',
  uricAcid: 'Pria <7, Wanita <6 mg/dL',
  waistCircumference: 'Pria <94, Wanita <80 cm',
  sleepDuration: '7-9 jam'
}

const SEVERITY_ORDER: Record<string, number> = { emergency: 0, critical: 1, high: 2, warning: 3, info: 4, normal: 5 }
const SEVERITY_COLOR: Record<string, string> = { emergency: '#dc2626', critical: '#ea580c', high: '#d97706', warning: '#ca8a04', info: '#2563eb', normal: '#16a34a' }

export function DoctorReportPage() {
  const { t } = useI18n()
  const [report, setReport] = useState<Report | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [reportData, setReportData] = useState<{ patientName: string; rangeStart: string; rangeEnd: string; values: ReportValue[] } | null>(null)

  async function generate() {
    setError(null); setShareLink(null); setReportData(null); setLoading(true)
    try {
      const res = await fetch('/api/reports/doctor-ready', { method: 'POST', credentials: 'include' })
      if (!res.ok) { setError(t('doctor.generateFailed')); return }
      const body = (await res.json()) as ApiResp<Report>
      if (!body.success) { setError(body.error?.message || t('doctor.generateFailed')); return }
      setReport(body.data || null)
      if (body.data) void fetchReportData(body.data.reportId)
    } catch { setError(t('common.connError')) }
    finally { setLoading(false) }
  }

  async function fetchReportData(id: string) {
    try {
      const res = await fetch(`/api/reports/${id}/data`, { credentials: 'include' })
      if (!res.ok) return
      const body = (await res.json()) as ApiResp<{ patientName: string; rangeStart: string; rangeEnd: string; values: ReportValue[] }>
      if (body.success && body.data) setReportData(body.data)
    } catch { /* ignore */ }
  }

  async function downloadReportCsv() {
    if (!report) return
    setCsvLoading(true); setError(null)
    try {
      const res = await fetch(`/api/reports/${report.reportId}/data`, { credentials: 'include' })
      if (!res.ok) { setError(t('doctor.dataFailed')); return }
      const body = (await res.json()) as ApiResp<{ patientName: string; rangeStart: string; rangeEnd: string; count: number; values: ReportValue[] }>
      if (!body.success) { setError(body.error?.message || t('doctor.dataFailed')); return }
      const data = body.data
      if (!data || data.values.length === 0) { setError(t('doctor.noData')); return }
      downloadCsv(`laporan-dokter-${report.reportId}.csv`, data.values.map(v => ({
        Tanggal: v.measuredAt.slice(0, 10), Waktu: v.measuredAt.slice(11, 16), Metrik: v.metricCode, Nilai: v.finalValue, Unit: v.unit, Status: v.status, Severity: v.severity
      })), ['Tanggal', 'Waktu', 'Metrik', 'Nilai', 'Unit', 'Status', 'Severity'])
    } catch { setError(t('common.connError')) }
    finally { setCsvLoading(false) }
  }

  async function downloadPdf() {
    if (!reportData) return
    const patientName = reportData.patientName
    const rangeStart = reportData.rangeStart.slice(0, 10)
    const rangeEnd = reportData.rangeEnd.slice(0, 10)
    const values = reportData.values
    const categories = new Map<string, ReportValue[]>()
    for (const v of values) {
      const cat = METRIC_CATEGORY[v.metricCode] || 'Lainnya'
      if (!categories.has(cat)) categories.set(cat, [])
      categories.get(cat)!.push(v)
    }
    const worstValues = [...values].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)).slice(0, 5)
    const dailyMap = new Map<string, ReportValue[]>()
    for (const v of values) {
      const day = v.measuredAt.slice(0, 10)
      if (!dailyMap.has(day)) dailyMap.set(day, [])
      dailyMap.get(day)!.push(v)
    }
    const days = [...dailyMap.keys()].sort()
    const chartMetrics = [...new Set(values.map(v => v.metricCode))].filter(m => values.filter(v => v.metricCode === m).length >= 2).slice(0, 4)
    const chartSvg = chartMetrics.map(mc => {
      const mv = values.filter(v => v.metricCode === mc).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
      const allVals = mv.map(v => v.finalValue)
      const mn = Math.min(...allVals), mx = Math.max(...allVals), range = mx - mn || 1
      const w = 460, h = 100, pad = 20
      const pts = mv.map((v, i) => `${pad + (i / Math.max(mv.length - 1, 1)) * (w - 2 * pad)},${h - pad - ((v.finalValue - mn) / range) * (h - 2 * pad)}`).join(' ')
      return `<div style="margin-bottom:12px"><strong>${METRIC_LABEL[mc] || mc}</strong><svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:6px"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"/>${mv.map((v, i) => `<circle cx="${pad + (i / Math.max(mv.length - 1, 1)) * (w - 2 * pad)}" cy="${h - pad - ((v.finalValue - mn) / range) * (h - 2 * pad)}" r="3" fill="#2563eb"/><text x="${pad + (i / Math.max(mv.length - 1, 1)) * (w - 2 * pad)}" y="${h - pad - ((v.finalValue - mn) / range) * (h - 2 * pad) - 6}" text-anchor="middle" font-size="9" fill="#374151">${v.finalValue}</text>`).join('')}</svg></div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Laporan Dokter - iSehat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;padding:24px;font-size:11px;line-height:1.4}
@page{size:A4;margin:12mm}.page{page-break-after:always;padding-bottom:20px}
h1{font-size:18px;margin-bottom:4px;color:#1e40af}h2{font-size:14px;margin:12px 0 6px;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:2px}
.meta{font-size:10px;color:#6b7280;margin-bottom:12px}.meta strong{color:#374151}
table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}th{background:#eff6ff;color:#1e40af;font-weight:600}
.badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;color:#fff}
.alert-box{border-left:4px solid #dc2626;background:#fef2f2;padding:8px 12px;border-radius:0 6px 6px 0;margin-bottom:8px}
.disclaimer{background:#fefce8;border:1px solid #fde047;border-radius:6px;padding:10px;font-size:10px;color:#713f12;margin-top:12px}
.cat-header{font-weight:700;font-size:11px;color:#1e40af;background:#eff6ff;padding:4px 8px;border-radius:4px;margin:8px 0 4px}
.day-header{font-size:10px;font-weight:600;color:#4b5563;margin:6px 0 2px}
</style></head><body>
<div class="page"><h1>LAPORAN KESEHATAN DOKTER</h1><p style="font-size:12px;color:#1e40af;font-weight:600">iSehat</p>
<div class="meta"><strong>Pasien:</strong> ${patientName} &nbsp;|&nbsp; <strong>Periode:</strong> ${rangeStart} s/d ${rangeEnd} &nbsp;|&nbsp; <strong>Dibuat:</strong> ${new Date().toISOString().slice(0,10)}</div>
${worstValues.length > 0 ? `<h2>Perlu Perhatian Khusus</h2>${worstValues.map(v => `<div class="alert-box"><strong>${METRIC_LABEL[v.metricCode] || v.metricCode}</strong>: ${v.finalValue} ${v.unit} — <span style="color:${SEVERITY_COLOR[v.severity] || '#6b7280'};font-weight:700">${v.status}</span><br/>${v.measuredAt.slice(0,16)} | Rentang normal: ${METRIC_RANGE[v.metricCode] || '-'}</div>`).join('')}` : ''}
<h2>Ringkasan Metrik (30 Hari)</h2><table><tr><th>Metrik</th><th>Rentang Normal</th><th>Min</th><th>Max</th><th>Terakhir</th><th>Status Terburuk</th></tr>
${[...new Set(values.map(v => v.metricCode))].map(mc => {const mv = values.filter(v => v.metricCode === mc); const worst = mv.reduce((a,b) => (SEVERITY_ORDER[a.severity]??9)<=(SEVERITY_ORDER[b.severity]??9)?a:b); const vals = mv.map(v=>v.finalValue); return `<tr><td><strong>${METRIC_LABEL[mc]||mc}</strong></td><td>${METRIC_RANGE[mc]||'-'}</td><td>${Math.min(...vals)}</td><td>${Math.max(...vals)}</td><td>${mv[mv.length-1].finalValue}</td><td><span class="badge" style="background:${SEVERITY_COLOR[worst.severity]||'#6b7280'}">${worst.status}</span></td></tr>`}).join('')}</table></div>
<div class="page"><h2>Data Mentah per Kategori</h2>
${[...categories.entries()].map(([cat, vals]) => `<div class="cat-header">${cat}</div><table><tr><th>Tanggal</th><th>Metrik</th><th>Nilai</th><th>Unit</th><th>Status</th></tr>${vals.map(v=>`<tr><td>${v.measuredAt.slice(0,16)}</td><td>${METRIC_LABEL[v.metricCode]||v.metricCode}</td><td><strong>${v.finalValue}</strong></td><td>${v.unit}</td><td><span class="badge" style="background:${SEVERITY_COLOR[v.severity]||'#6b7280'}">${v.severity}</span></td></tr>`).join('')}</table>`).join('')}
</div>
${chartSvg ? `<div class="page"><h2>Tren Metrik</h2>${chartSvg}<h2>Kronologi Harian</h2>${days.map(d => `<div class="day-header">${d}</div><table><tr><th>Metrik</th><th>Nilai</th><th>Unit</th><th>Status</th></tr>${(dailyMap.get(d)||[]).map(v=>`<tr><td>${METRIC_LABEL[v.metricCode]||v.metricCode}</td><td>${v.finalValue}</td><td>${v.unit}</td><td>${v.status}</td></tr>`).join('')}</table>`).join('')}</div>` : ''}
<div class="disclaimer"><strong>Disclaimer:</strong> Laporan ini berisi data pengukuran kesehatan dari aplikasi iSehat. Data ini BUKAN diagnosis medis. Hasil interpretasi berbasis rule engine dan tidak menggantikan pertimbangan klinis dokter. Selalu verifikasi dengan pemeriksaan klinis langsung.</div>
</body></html>`
    const printWindow = window.open('', '_blank')
    if (printWindow) { printWindow.document.write(html); printWindow.document.close(); printWindow.onload = () => { printWindow.print() } }
  }

  async function share() {
    if (!report) return
    setError(null)
    try {
      const res = await fetch(`/api/reports/${report.reportId}/share`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientLabel: 'Doctor', expiresInHours: 24 })
      })
      if (!res.ok) { setError(t('doctor.shareFailed')); return }
      const body = (await res.json()) as ApiResp<{ shareToken: string; shareUrl: string }>
      if (!body.success) { setError(body.error?.message || t('doctor.shareFailed')); return }
      setShareLink(`${window.location.origin}${body.data?.shareUrl}`)
    } catch { setError(t('common.connError')) }
  }

  function copyLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  return (
    <section className="settings-panel" aria-labelledby="doctor-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('doctor.eyebrow')}</p>
          <h2 id="doctor-title">{t('doctor.title')}</h2>
          <p>{t('doctor.subtitle')}</p>
        </div>
        <span className="status-chip">30 days</span>
      </div>
      <div className="action-panel">
        <button disabled={loading} onClick={generate} type="button" className="btn-primary">{loading ? t('doctor.generating') : t('doctor.generate')}</button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {report ? (
        <div className="result-card">
          <p>Report ID: <code>{report.reportId}</code></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <a href={`/api/reports/${report.reportId}/download`} rel="noreferrer" target="_blank" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span> {t('doctor.viewHtml')}
            </a>
            <button onClick={() => void downloadReportCsv()} disabled={csvLoading} className="btn-secondary" type="button">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> {csvLoading ? t('doctor.downloadingCsv') : t('doctor.downloadCsv')}
            </button>
            <button onClick={downloadPdf} type="button" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span> {t('doctor.printPdf')}
            </button>
            <button onClick={share} type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>share</span> {t('doctor.createShare')}
            </button>
          </div>
          {shareLink ? (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{shareLink}</code>
              <button onClick={copyLink} type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Tersalin!' : 'Copy'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
