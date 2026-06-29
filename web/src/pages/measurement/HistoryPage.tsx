import { useEffect, useState } from 'react'
import { formatDateTimeShort } from '../../utils/dateFormat'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { AttachmentViewer } from '../../components/AttachmentViewer'
import type { HistoryAttachment } from '../../components/AttachmentViewer'
import { UnitInfoModal } from '../../components/UnitInfoModal'

type HistoryValue = {
  id: number
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
}

type HistorySession = {
  id: number
  measuredAt: string
  source: string
  hasAttachment: number
  values: HistoryValue[]
  attachments: HistoryAttachment[]
}

function HistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [selectedAttachment, setSelectedAttachment] = useState<HistoryAttachment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUnitInfo, setShowUnitInfo] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  async function handleDelete(sessionId: number) {
    if (!confirm('Hapus sesi pengukuran ini? Tindakan tidak bisa dibatalkan.')) return
    setDeleting(sessionId); setDeleteMsg(null)
    try {
      const res = await fetch(`/api/measurements/${sessionId}`, { method: 'DELETE', credentials: 'include' })
      const body = (await res.json()) as { success: boolean; error?: { message: string } }
      if (!body.success) { setDeleteMsg(body.error?.message || 'Gagal menghapus.'); return }
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      setDeleteMsg('Pengukuran dihapus.')
    } catch { setDeleteMsg('Could not connect.') }
    finally { setDeleting(null) }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/measurements/history', { credentials: 'include' })
        const body = (await res.json()) as {
          success: boolean
          data?: { sessions: HistorySession[] }
          error?: { message: string }
        }
        if (!body.success) {
          setError(body.error?.message ?? 'Failed to load history.')
          return
        }
        setSessions(body.data?.sessions ?? [])
      } catch {
        setError('Could not connect to server.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <section className="settings-panel history-panel" aria-labelledby="history-title">
      <div className="page-heading">
        <div>
          <h2 id="history-title" className="page-heading-with-help">
            Riwayat Pengukuran
            <button
              type="button"
              className="medical-term-info page-heading-help"
              onClick={() => setShowUnitInfo(true)}
              aria-label="Lihat satuan yang digunakan"
              title="Lihat satuan"
            >
              <span className="material-symbols-outlined">help</span>
            </button>
          </h2>
          <p>Log lengkap semua sesi pengukuran (tekanan darah, SpO₂, gula darah, suhu, berat badan) dengan status dan rekomendasi. Klik bukti foto untuk melihat detail.</p>
        </div>
        <span className="status-chip">{sessions.length} sesi</span>
      </div>

      {sessions.length > 0 && (() => {
        const allValues = sessions.flatMap(s => s.values)
        const abnormal = allValues.filter(v => v.severity !== 'normal' && v.severity !== undefined)
        const metrics = new Set(allValues.map(v => v.metricCode))
        const latest = sessions[0]
        return (
          <div className="history-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="soft-card" style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#6b7280' }}>Total Sesi</p>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900 }}>{sessions.length}</p>
            </div>
            <div className="soft-card" style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#6b7280' }}>Metrik Diukur</p>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900 }}>{metrics.size}</p>
            </div>
            <div className="soft-card" style={{ padding: 16, borderRadius: 12, background: '#fef3f2', border: '1px solid #fecaca' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#dc2626' }}>Hasil Abnormal</p>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#dc2626' }}>{abnormal.length}</p>
            </div>
            <div className="soft-card" style={{ padding: 16, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#16a34a' }}>Pengukuran Terakhir</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 800 }}>{formatDateTimeShort(latest.measuredAt).date}</p>
            </div>
          </div>
        )
      })()}

      {loading ? <p>Memuat riwayat...</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {deleteMsg ? <p className={`form-message ${deleteMsg.includes('dihapus') ? 'success' : 'error'}`} role="status">{deleteMsg}</p> : null}
      {!loading && sessions.length === 0 ? <p>No measurement history yet.</p> : null}

      {sessions.length > 0 ? (
        <table className="report-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Metric</th>
              <th>Result Value</th>
              <th>Status</th>
              <th>Rekomendasi</th>
              <th>Evidence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.flatMap((session) =>
              session.values.map((value, idx) => {
                const attachment = session.attachments.find(a => a.metricCode === value.metricCode)
                const dt = formatDateTimeShort(session.measuredAt)
                return (
                  <tr key={`${session.id}-${value.id}`}>
                    {idx === 0 ? (
                      <td rowSpan={session.values.length} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--colorBorder)' }}>
                        <div className="history-date-cell">
                          <span className="date">{dt.date}</span>
                          <span className="time">{dt.time}</span>
                        </div>
                      </td>
                    ) : null}
                    <td>
                      <span className="metric-code-badge-cell">
                        <span>{value.metricCode}</span>
                        <MedicalTerm term="" shortDef={MEDICAL_GLOSSARY[value.metricCode] || ''} />
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1.05em' }}>{value.finalValue}</strong> <span className="meta">{value.unit}</span>
                    </td>
                    <td>
                      <span className={`badge-status badge-${value.status}`}>
                        <span className="status-dot" />{value.status}
                      </span>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: '0.85em' }}>
                        {value.severity === 'normal' ? 'Lanjutkan pola hidup sehat.' : `Lihat saran: ${value.status}`}
                      </span>
                    </td>
                    <td>
                      {attachment ? (
                        <button className="evidence-btn" onClick={() => setSelectedAttachment(attachment)} type="button">
                          <span className="material-symbols-outlined">photo_camera</span> View
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.85em' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button className="evidence-btn" disabled={deleting === session.id} onClick={() => void handleDelete(session.id)} style={{ color: 'var(--colorStatusCritical, #dc2626)' }} type="button" title="Hapus sesi">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      ) : null}

      <AttachmentViewer attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} />
      <UnitInfoModal open={showUnitInfo} onClose={() => setShowUnitInfo(false)} />
    </section>
  )
}

export default HistoryPage
export { HistoryPage }
