/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

const ROW_ICONS: Record<string, string> = { measurement: 'monitor_heart', symptom: 'sick', safetyEvent: 'warning', hydration: 'water_drop', cycle: 'cycle' }

export function HistoryTimelinePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<Record<string, boolean>>({ measurement: true, symptom: true, safetyEvent: true, hydration: true, cycle: true })

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const activeTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k)
        const r = await fetch(`/api/history/timeline?types=${activeTypes.join(',')}`, { credentials: 'include' })
        const j = await r.json()
        if (j.success) setEntries(j.data || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [user, types])

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>

  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>📜 Riwayat Kesehatan</h2></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.keys(ROW_ICONS).map(t => (
          <button key={t} className={types[t] ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setTypes(p => ({ ...p, [t]: !p[t] }))}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>{ROW_ICONS[t]}</span> {t}
          </button>
        ))}
      </div>
      {loading ? <p>Memuat...</p> : entries.length === 0 ? <p>Belum ada riwayat.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--colorSurfaceContainer)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: e.isRedFlag ? 'var(--colorStatusCritical)' : 'var(--colorTextMuted)' }}>{ROW_ICONS[e.rowType] || 'info'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ font: 'var(--typLabelMd)' }}>{e.summary || e.rowType}</strong>
                  {e.isRedFlag && <span style={{ color: 'var(--colorStatusCritical)', fontSize: 13 }}>🔴</span>}
                </div>
                <div style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginTop: 2 }}>{e.date || e.createdAt?.slice(0, 10)}</div>
                {e.sourceSessionId && <a href="/measurements/history" style={{ fontSize: 12 }}>Sesi pengukuran →</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
