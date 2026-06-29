import { useState } from 'react'
import { downloadCsv } from '../../utils/csv'
import { useI18n } from '../../i18n'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type Report = { reportId: string; status: string }

type ReportValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt: string
}

export function DoctorReportPage() {
  const { t } = useI18n()
  const [report, setReport] = useState<Report | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)

  async function generate() {
    setError(null); setShareLink(null); setLoading(true)
    try {
      const res = await fetch('/api/reports/doctor-ready', { method: 'POST', credentials: 'include' })
      if (!res.ok) { setError(t('doctor.generateFailed')); return }
      const body = (await res.json()) as ApiResp<Report>
      if (!body.success) { setError(body.error?.message || t('doctor.generateFailed')); return }
      setReport(body.data || null)
    } catch { setError(t('common.connError')) }
    finally { setLoading(false) }
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
      if (!data || data.values.length === 0) {
        setError(t('doctor.noData'))
        return
      }
      const rows = data.values.map(v => ({
        Tanggal: v.measuredAt.slice(0, 10),
        Waktu: v.measuredAt.slice(11, 16),
        Metrik: v.metricCode,
        Nilai: v.finalValue,
        Unit: v.unit,
        Status: v.status,
        Severity: v.severity
      }))
      downloadCsv(`laporan-dokter-${report.reportId}.csv`, rows, ['Tanggal', 'Waktu', 'Metrik', 'Nilai', 'Unit', 'Status', 'Severity'])
    } catch { setError(t('common.connError')) }
    finally { setCsvLoading(false) }
  }

  async function downloadPdf() {
    if (!report) return
    try {
      const htmlRes = await fetch(`/api/reports/${report.reportId}/download`, { credentials: 'include' })
      if (!htmlRes.ok) { setError(t('doctor.viewFailed')); return }
      const htmlText = await htmlRes.text()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlText)
        printWindow.document.close()
        printWindow.onload = () => { printWindow.print() }
      }
    } catch {
      setError(t('doctor.printFailed'))
    }
  }

  async function share() {
    if (!report) return
    setError(null)
    try {
      const res = await fetch(`/api/reports/${report.reportId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientLabel: 'Doctor', expiresInHours: 24 })
      })
      if (!res.ok) { setError(t('doctor.shareFailed')); return }
      const body = (await res.json()) as ApiResp<{ shareToken: string; shareUrl: string }>
      if (!body.success) { setError(body.error?.message || t('doctor.shareFailed')); return }
      const origin = window.location.origin
      setShareLink(`${origin}${body.data?.shareUrl}`)
    } catch { setError(t('common.connError')) }
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
        <button disabled={loading} onClick={generate} type="button">{loading ? t('doctor.generating') : t('doctor.generate')}</button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {report ? (
        <div className="result-card">
          <p>Report ID: <code>{report.reportId}</code></p>
          <a href={`/api/reports/${report.reportId}/download`} rel="noreferrer" target="_blank">{t('doctor.viewHtml')}</a>
          <button onClick={() => void downloadReportCsv()} disabled={csvLoading} className="btn-secondary" type="button">
            <span className="material-symbols-outlined">download</span> {csvLoading ? t('doctor.downloadingCsv') : t('doctor.downloadCsv')}
          </button>
          <button onClick={downloadPdf} type="button">{t('doctor.printPdf')}</button>
          <button onClick={share} type="button">{t('doctor.createShare')}</button>
          {shareLink ? <p>{t('doctor.shareLabel')}: <code>{shareLink}</code></p> : null}
        </div>
      ) : null}
    </section>
  )
}
