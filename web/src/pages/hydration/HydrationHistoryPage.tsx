/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

const SOURCE_VALUES = ['', 'web', 'telegram', 'manual']

function todayStr() { return new Date().toISOString().slice(0, 10) }
function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
function formatTime(iso: string) {
  if (!iso) return '-'
  try { return iso.slice(11, 16) } catch { return '-' }
}

function SkeletonRow() {
  return (
    <tr>
      <td><div className="skeleton" style={{ width: 80, height: 16 }} /></td>
      <td><div className="skeleton" style={{ width: 50, height: 16 }} /></td>
      <td><div className="skeleton" style={{ width: 60, height: 16 }} /></td>
      <td><div className="skeleton" style={{ width: 60, height: 16 }} /></td>
      <td><div className="skeleton" style={{ width: 120, height: 16 }} /></td>
      <td><div className="skeleton" style={{ width: 40, height: 16 }} /></td>
    </tr>
  )
}

export function HydrationHistoryPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(thirtyDaysAgo())
  const [to, setTo] = useState(todayStr())
  const [source, setSource] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  async function load() {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ mode: 'logs', from, to })
      if (source) params.set('source', source)
      if (minAmount) params.set('minAmount', minAmount)
      if (maxAmount) params.set('maxAmount', maxAmount)
      const r = await fetch(`/api/hydration/history?${params.toString()}`, { credentials: 'include' })
      if (!r.ok) { setError(t('hydration.loadFailed')); return }
      const j = await r.json()
      if (j.success) setLogs(j.data?.logs || [])
      else setError(t('hydration.loadFailed'))
    } catch { setError(t('hydration.connError')) } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [user, from, to, source, minAmount, maxAmount])

  async function handleDelete(logId: number) {
    try {
      const r = await fetch(`/api/hydration/logs/${logId}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) { setError(t('hydration.deleteFailed')); return }
      const j = await r.json()
      if (j.success) { setDeleteId(null); void load() }
    } catch { setError(t('hydration.connError')) }
  }

  const stats = useMemo(() => {
    const totalMl = logs.reduce((sum, l) => sum + (l.amountMl || 0), 0)
    const avg = logs.length ? Math.round(totalMl / logs.length) : 0
    return { count: logs.length, totalMl, avg }
  }, [logs])

  if (!user) return (
    <section className="settings-panel">
      <div className="empty-state">
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--colorTextMuted)' }}>login</span>
        <h3>{t('hydration.pleaseLogin')}</h3>
        <p>{t('hydration.loginRequiredDesc')}</p>
      </div>
    </section>
  )

  return (
    <section className="settings-panel hydration-history-page">
      <div className="hydration-header">
        <div className="hydration-header-inner">
          <div className="hydration-title">
            <div className="hydration-icon"><span className="material-symbols-outlined fill-icon">history</span></div>
            <div>
              <p className="eyebrow">{t('hydration.historyEyebrow')}</p>
              <h2>{t('hydration.historyTitle')}</h2>
              <p className="subtitle">{t('hydration.historySubtitle')}</p>
            </div>
          </div>
          <a href="/hydration" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>{t('hydration.back')}</a>
        </div>
      </div>

      {error && (
        <div className="form-message error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined">error</span>
          {error}
          <button className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => void load()}>{t('hydration.retry')}</button>
        </div>
      )}

      <div className="hydration-filters">
        <label className="filter-field">
          <span>{t('hydration.fromLabel')}</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>{t('hydration.toLabel')}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>{t('hydration.sourceLabel')}</span>
          <select value={source} onChange={e => setSource(e.target.value)}>
            {SOURCE_VALUES.map(v => <option key={v} value={v}>{v === '' ? t('hydration.allSources') : v === 'web' ? t('hydration.webSource') : v === 'telegram' ? t('hydration.telegramSource') : t('hydration.manualSource')}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>{t('hydration.minAmount')}</span>
          <input type="number" inputMode="numeric" min={0} value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0" />
        </label>
        <label className="filter-field">
          <span>{t('hydration.maxAmount')}</span>
          <input type="number" inputMode="numeric" min={0} value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="5000" />
        </label>
      </div>

      <div className="hydration-stats" style={{ marginTop: 16 }}>
        <div className="soft-card">
          <p className="stat-label">{t('hydration.totalLogs')}</p>
          <p className="stat-value">{loading ? <span className="skeleton" style={{ width: 40, height: 20, display: 'inline-block' }} /> : stats.count}</p>
        </div>
        <div className="soft-card">
          <p className="stat-label">{t('hydration.totalVolume')}</p>
          <p className="stat-value consumed">{loading ? <span className="skeleton" style={{ width: 60, height: 20, display: 'inline-block' }} /> : `${stats.totalMl.toLocaleString('id-ID')}ml`}</p>
        </div>
        <div className="soft-card">
          <p className="stat-label">{t('hydration.average')}</p>
          <p className="stat-value">{loading ? <span className="skeleton" style={{ width: 50, height: 20, display: 'inline-block' }} /> : `${stats.avg.toLocaleString('id-ID')}ml`}</p>
        </div>
      </div>

      {loading ? (
        <div className="hydration-history" style={{ marginTop: 24 }}>
          <h3>{t('hydration.logList')}</h3>
          <div className="hydration-table-wrap">
            <table className="hydration-table">
              <thead><tr><th>{t('hydration.date')}</th><th>{t('hydration.time')}</th><th>{t('hydration.amount')}</th><th>{t('hydration.source')}</th><th>{t('hydration.notes')}</th><th /></tr></thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--colorTextMuted)' }}>water_drop</span>
          <h3>{t('hydration.noLogs')}</h3>
          <p>{t('hydration.noLogsDetail')}</p>
          <button className="btn-secondary" onClick={() => { setFrom(thirtyDaysAgo()); setTo(todayStr()); setSource(''); setMinAmount(''); setMaxAmount('') }} style={{ marginTop: 12 }}>
            {t('hydration.resetFilter')}
          </button>
        </div>
      ) : (
        <div className="hydration-history" style={{ marginTop: 24 }}>
          <h3>{t('hydration.logList')}</h3>
          <div className="hydration-table-wrap">
            <table className="hydration-table">
              <thead><tr><th>{t('hydration.date')}</th><th>{t('hydration.time')}</th><th>{t('hydration.amount')}</th><th>{t('hydration.source')}</th><th>{t('hydration.notes')}</th><th /></tr></thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td>{l.logDate}</td>
                    <td>{formatTime(l.loggedAt)}</td>
                    <td className="amount">{l.amountMl}ml</td>
                    <td><span className="pill">{l.source || 'manual'}</span></td>
                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.notes || '-'}</td>
                    <td className="actions">
                      {deleteId === l.id ? (
                        <>
                          <button className="delete-confirm" onClick={() => handleDelete(l.id)}>{t('hydration.delete')}</button>
                          <button className="delete-cancel" onClick={() => setDeleteId(null)}>{t('hydration.cancel')}</button>
                        </>
                      ) : (
                        <button className="delete-btn" onClick={() => setDeleteId(l.id)} title={t('hydration.deleteLog')}><span className="material-symbols-outlined">close</span></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
