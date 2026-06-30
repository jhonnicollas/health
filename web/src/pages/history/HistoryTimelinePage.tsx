/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

const ROW_ICONS: Record<string, string> = { measurement: 'monitor_heart', symptom: 'sick', safetyEvent: 'warning', hydration: 'water_drop', cycle: 'cycle' }
const ROW_TYPE_KEYS: Record<string, string> = { measurement: 'history.measurement', symptom: 'history.symptom', safetyEvent: 'history.safetyEvent', hydration: 'history.hydration', cycle: 'history.cycle' }

export function HistoryTimelinePage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [types, setTypes] = useState<Record<string, boolean>>({ measurement: true, symptom: true, safetyEvent: true, hydration: true, cycle: true })

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const activeTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k)
        const r = await fetch(`/api/history/timeline?types=${activeTypes.join(',')}`, { credentials: 'include' })
        if (!r.ok) { setError(t('history.loadFailed')); return }
        const j = await r.json()
        if (j.success) setEntries(j.data || [])
      } catch { setError(t('history.connError')) } finally { setLoading(false) }
    })()
  }, [user, types, t])

  if (!user) return <section className="settings-panel"><h2>{t('history.loginRequired')}</h2></section>

  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>📜 {t('history.title')}</h2></div>
      {error && <p className="form-message error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.keys(ROW_ICONS).map(ty => (
          <button key={ty} className={types[ty] ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setTypes(p => ({ ...p, [ty]: !p[ty] }))}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>{ROW_ICONS[ty]}</span> {t(ROW_TYPE_KEYS[ty] || ty)}
          </button>
        ))}
      </div>
      {loading ? <p>{t('common.loading')}</p> : entries.length === 0 ? <p>{t('history.noHistory')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--colorSurfaceContainer)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: e.isRedFlag ? 'var(--colorStatusCritical)' : 'var(--colorTextMuted)' }}>{ROW_ICONS[e.rowType] || 'info'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ font: 'var(--typLabelMd)' }}>{e.summary || t(ROW_TYPE_KEYS[e.rowType] || e.rowType)}</strong>
                  {e.isRedFlag && <span style={{ color: 'var(--colorStatusCritical)', fontSize: 13 }}>🔴</span>}
                </div>
                <div style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginTop: 2 }}>{e.date || e.createdAt?.slice(0, 10)}</div>
                {e.sourceSessionId && <a href="/measurements/history" style={{ fontSize: 12 }}>{t('history.sessionLink')}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
