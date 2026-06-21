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
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setReport(body.data || null)
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(false) }
  }

  async function share() {
    if (!report) return
    setError(null)
    try {
      const res = await fetch(`/api/reports/${report.reportId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientLabel: 'Dokter', expiresInHours: 24 })
      })
      const body = (await res.json()) as ApiResp<{ shareToken: string; shareUrl: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal share.'); return }
      const origin = window.location.origin
      setShareLink(`${origin}${body.data?.shareUrl}`)
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="doctor-title">
      <h2 id="doctor-title">Laporan Dokter</h2>
      <p>Hasil laporan HTML 30 hari untuk dibawa ke dokter.</p>
      <button disabled={loading} onClick={generate} type="button">{loading ? 'Membuat...' : 'Buat Laporan'}</button>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {report ? (
        <div>
          <p>Report ID: <code>{report.reportId}</code></p>
          <a href={`/api/reports/${report.reportId}/download`} rel="noreferrer" target="_blank">Unduh Laporan</a>
          <button onClick={share} type="button">Buat Tautan Share</button>
          {shareLink ? <p>Bagikan ke dokter: <code>{shareLink}</code></p> : null}
        </div>
      ) : null}
    </section>
  )
}
