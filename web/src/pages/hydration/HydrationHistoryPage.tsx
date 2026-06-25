/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

export function HydrationHistoryPage() {
  const { user } = useAuth()
  const [days, setDays] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [dayLogs, setDayLogs] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/hydration/history', { credentials: 'include' })
        const j = await r.json()
        if (j.success) setDays(j.data || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  async function loadDayLogs(date: string) {
    setExpandedDate(date)
    try {
      const r = await fetch(`/api/hydration/today?date=${date}`, { credentials: 'include' })
      const j = await r.json()
      if (j.success) setDayLogs(j.data?.logs || [])
    } catch { setDayLogs([]) }
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>

  return (
    <section className="settings-panel">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>📊 Riwayat Hidrasi</h2>
        <a href="/hydration" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>← Kembali</a>
      </div>

      {loading ? <p>Memuat...</p> : days.length === 0 ? <p>Belum ada riwayat.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {days.map((d: any) => (
            <div key={d.date} style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
              <button type="button" onClick={() => expandedDate === d.date ? setExpandedDate(null) : loadDayLogs(d.date)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <div>
                  <strong>{d.date}</strong>
                  <div style={{ fontSize: 13, color: 'var(--colorTextSecondary)' }}>
                    {d.totalMl}ml / {d.targetMl}ml — {d.percent}% — {d.logCount} log
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.overhydrationWarning ? 'var(--colorStatusCritical)' : 'var(--colorStatusOK)' }} />
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{expandedDate === d.date ? 'expand_less' : 'expand_more'}</span>
                </div>
              </button>
              {expandedDate === d.date && (
                <div style={{ borderTop: '1px solid var(--colorBorderSoft)', marginTop: 8, paddingTop: 8 }}>
                  {dayLogs.map((l: any, i: number) => (
                    <div key={i} style={{ padding: '4px 0', fontSize: 13, color: 'var(--colorTextSecondary)' }}>
                      {l.amountMl}ml — {l.loggedAt?.slice(11, 16)} {l.source !== 'web' ? `(${l.source})` : ''}
                    </div>
                  ))}
                  {dayLogs.length === 0 && <div style={{ fontSize: 13, color: 'var(--colorTextMuted)' }}>Tidak ada log hari ini.</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
