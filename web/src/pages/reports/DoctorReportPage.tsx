import { useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type Report = { reportId: string; status: string }

export function DoctorReportPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setError(null); setShareLink(null); setLoading(true)
    try {
      const res = await fetch('/api/reports/doctor-ready', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<Report>
      if (!body.success) { setError(body.error?.message || 'Failed.'); return }
      setReport(body.data || null)
    } catch { setError('Could not connect to server.') }
    finally { setLoading(false) }
  }

  async function downloadPdf() {
    if (!report) return
    try {
      const htmlRes = await fetch(`/api/reports/${report.reportId}/download`, { credentials: 'include' })
      const htmlText = await htmlRes.text()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlText)
        printWindow.document.close()
        printWindow.onload = () => { printWindow.print() }
      }
    } catch {
      setError('Failed to open print view.')
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
      const body = (await res.json()) as ApiResp<{ shareToken: string; shareUrl: string }>
      if (!body.success) { setError(body.error?.message || 'Failed to share.'); return }
      const origin = window.location.origin
      setShareLink(`${origin}${body.data?.shareUrl}`)
    } catch { setError('Could not connect to server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="doctor-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Doctor Ready</p>
          <h2 id="doctor-title">Doctor Report</h2>
          <p>Generate a 30-day report. Use browser print to save as PDF.</p>
        </div>
        <span className="status-chip">30 days</span>
      </div>
      <div className="action-panel">
        <button disabled={loading} onClick={generate} type="button">{loading ? 'Generating...' : 'Generate Report'}</button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {report ? (
        <div className="result-card">
          <p>Report ID: <code>{report.reportId}</code></p>
          <a href={`/api/reports/${report.reportId}/download`} rel="noreferrer" target="_blank">View HTML Report</a>
          <button onClick={downloadPdf} type="button">Print / Save as PDF</button>
          <button onClick={share} type="button">Create Share Link</button>
          {shareLink ? <p>Share with doctor: <code>{shareLink}</code></p> : null}
        </div>
      ) : null}
    </section>
  )
}
