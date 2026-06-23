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
            Measurement History
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
          <p>Log lengkap semua pengukuran dengan rekomendasi.</p>
        </div>
        <span className="status-chip">{sessions.length} sessions</span>
      </div>

      {loading ? <p>Loading history...</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
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
