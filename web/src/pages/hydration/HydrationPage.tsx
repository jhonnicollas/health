/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'
import { translateErrorCode } from '../../api/translateError'
import { useToast } from '../../components/Toast'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

function ProgressRing({ percent, size = 220, stroke = 14 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(percent, 100)
  const offset = circ - (clamped / 100) * circ
  const color = '#0369a1'
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#c6c6cd" strokeWidth={stroke} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

const QUICK_AMOUNTS = [200, 600]

function formatTime(iso: string) {
  if (!iso) return '-'
  try { return iso.slice(11, 16) } catch { return '-' }
}

export function HydrationPage() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const { show: showToast } = useToast()
  const [data, setData] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState(200)
  const [msg, setMsg] = useState('')
  const [confirmLarge, setConfirmLarge] = useState<{ amount: number } | null>(null)
  const [customModal, setCustomModal] = useState(false)
  const [customVal, setCustomVal] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [eduVisible, setEduVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchToday() {
    try {
      const r = await fetch('/api/hydration/today', { credentials: 'include', headers: { Accept: 'application/json' } })
      if (!r.ok) { setError(t('hydration.loadFailed')); return }
      const j = await r.json()
      if (j.success) setData(j.data)
    } catch { setError(t('hydration.connError')) }
  }

  async function fetchHistory() {
    try {
      const r = await fetch('/api/hydration/history', { credentials: 'include', headers: { Accept: 'application/json' } })
      if (!r.ok) return
      const j = await r.json()
      if (j.success) setHistory(j.data?.days || j.data || [])
    } catch { /* ignore */ }
  }

  async function loadAll() {
    setLoading(true)
    await Promise.all([fetchToday(), fetchHistory()])
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  async function addWater(ml: number, confirmed = false) {
    setConfirmLarge(null)
    try {
      const r = await fetch('/api/hydration/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountMl: ml, confirmedLargeInput: confirmed }) })
      if (!r.ok) { setMsg(t('hydration.logFailed')); return }
      const j = await r.json()
      if (j.success) { setMsg(`+${ml}ml ${t('hydration.loggedSuccess')} ${j.data.totalMl}ml`); showToast(`+${ml}ml ${t('hydration.loggedToast')}`, 'success'); await loadAll() }
      else if (j.error?.code === 'LARGE_INPUT_CONFIRMATION_REQUIRED') setConfirmLarge({ amount: ml })
      else setMsg(j.error?.code ? translateErrorCode(j.error.code, locale, j.error?.message) : t('hydration.logFailed'))
    } catch { setError(t('hydration.connError')) }
  }

  async function handleDelete(logId: number) {
    try {
      const r = await fetch(`/api/hydration/logs/${logId}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) { setError(t('hydration.deleteFailed')); return }
      const j = await r.json()
      if (j.success) { setDeleteId(null); showToast(t('hydration.deletedToast'), 'success'); await loadAll() }
    } catch { setError(t('hydration.connError')) }
  }

  const allLogs = useMemo(() => {
    const todayLogs = (data?.logs || []).map((l: any) => ({ ...l, dateLabel: t('hydration.today') }))
    const pastLogs: any[] = []
    history.forEach((day: any) => {
      ;(day.logs || []).forEach((l: any) => {
        pastLogs.push({ ...l, dateLabel: day.date })
      })
    })
    return [...todayLogs, ...pastLogs].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)).slice(0, 20)
  }, [data, history])

  if (!user) return <section className="settings-panel"><h2>{t('hydration.pleaseLogin')}</h2></section>

  const percent = data?.percent || 0
  const remaining = Math.max((data?.targetMl || 0) - (data?.totalMl || 0), 0)

  return (
    <section className="settings-panel hydration-page">
      <div className="hydration-header">
        <div className="hydration-header-top" />
        <div className="hydration-header-inner">
          <div className="hydration-title">
            <div className="hydration-icon"><span className="material-symbols-outlined fill-icon">water_drop</span></div>
            <div>
            <p className="eyebrow">{t('hydration.eyebrow')}</p>
            <h2>{t('hydration.title')}</h2>
            <p className="subtitle">{t('hydration.subtitle')}</p>
            </div>
          </div>
          <span className="pill target-pill">{t('hydration.target')} {data?.targetMl?.toLocaleString('id-ID') || 0}ml</span>
        </div>
      </div>

      {error && <p className="form-message error">{error}</p>}

      {data?.overhydrationWarning && (
        <div className="hydration-warning">
          <div className="warning-icon"><span className="material-symbols-outlined fill-icon">warning</span></div>
          <div>
            <p className="warning-title">{t('hydration.overhydrationTitle')}</p>
            <p className="warning-text">{t('hydration.overhydrationText')}</p>
            <p className="warning-note">{t('hydration.overhydrationNote')}</p>
          </div>
        </div>
      )}

      {loading ? <p>{t('hydration.loading')}</p> : (
        <div className="hydration-grid">
          <div className="hydration-ring-section">
            <div className="hydration-ring-wrap">
              <ProgressRing percent={percent} />
              <div className="hydration-ring-center">
                <span className="material-symbols-outlined fill-icon">water_drop</span>
                <p className="ring-value">{(data?.totalMl || 0).toLocaleString('id-ID')}</p>
                <p className="ring-unit">ml</p>
                <p className="ring-sub">{t('hydration.from')} {(data?.targetMl || 0).toLocaleString('id-ID')} ml</p>
              </div>
            </div>
            <span className="pill ring-badge">{percent}% {t('hydration.achieved')}</span>
          </div>

          <div className="hydration-controls">
            <div className="hydration-stats">
              <div className="soft-card"><p className="stat-label">{t('hydration.consumed')}</p><p className="stat-value consumed">{(data?.totalMl || 0).toLocaleString('id-ID')}ml</p></div>
              <div className="soft-card"><p className="stat-label">{t('hydration.remaining')}</p><p className="stat-value remaining">{remaining.toLocaleString('id-ID')}ml</p></div>
              <div className="soft-card"><p className="stat-label">{t('hydration.reason')}</p><p className="stat-text">{data?.targetReasons?.[0] || '70kg × 30ml'}</p></div>
              <div className="soft-card"><p className="stat-label">{t('hydration.adjustment')}</p><p className="stat-text">{data?.targetReasons?.[1] || '+500ml jika demam'}</p></div>
            </div>

            <div className="hydration-quick-add">
              {QUICK_AMOUNTS.map(v => (
                <button key={v} className={amount === v ? 'quick-btn active' : 'quick-btn'} onClick={() => setAmount(v)}>+{v} ml</button>
              ))}
              <button className="quick-btn custom" onClick={() => setCustomModal(true)}>{t('hydration.custom')}</button>
            </div>

            <button onClick={() => addWater(amount)} className="hydration-primary-btn">{t('hydration.logWater')} {amount}ml</button>

            {msg && <p className="form-message success">{msg}</p>}

            <div className="hydration-history">
              <h3>{t('hydration.intakeHistory')}</h3>
              <div className="hydration-table-wrap">
                <table className="hydration-table">
                  <thead><tr><th>{t('hydration.date')}</th><th>{t('hydration.time')}</th><th>{t('hydration.amount')}</th><th>{t('hydration.source')}</th><th /></tr></thead>
                  <tbody>
                    {allLogs.length === 0 ? (
                      <tr><td colSpan={5} className="empty">{t('hydration.noHistory')}</td></tr>
                    ) : allLogs.map((l: any) => (
                      <tr key={l.id}>
                        <td>{l.dateLabel}</td>
                        <td>{formatTime(l.loggedAt)}</td>
                        <td className="amount">{l.amountMl}ml</td>
                        <td>{l.source || t('hydration.manual')}</td>
                        <td className="actions">
                          {deleteId === l.id ? (
                            <>
                              <button className="delete-confirm" onClick={() => handleDelete(l.id)}>{t('hydration.delete')}</button>
                              <button className="delete-cancel" onClick={() => setDeleteId(null)}>{t('hydration.cancel')}</button>
                            </>
                          ) : (
                            <button className="delete-btn" onClick={() => setDeleteId(l.id)}><span className="material-symbols-outlined">close</span></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {customModal && (
        <div className="modal-backdrop" onClick={() => setCustomModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <h3>{t('hydration.customAmountTitle')}</h3>
            <input type="number" inputMode="numeric" value={customVal} onChange={e => setCustomVal(e.target.value)} min={1} max={3000} autoFocus />
            <div className="modal-actions">
              <button className="primary" onClick={() => { const v = Number(customVal); if (v > 0) { setAmount(v); setCustomModal(false); setCustomVal('') } }}>{t('hydration.ok')}</button>
              <button className="secondary" onClick={() => setCustomModal(false)}>{t('hydration.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {confirmLarge && (
        <div className="modal-backdrop" onClick={() => setConfirmLarge(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <h3>{t('hydration.largeConfirmTitle')}</h3>
            <p>{t('hydration.largeConfirmText')} <strong>{confirmLarge.amount}ml</strong> {t('hydration.largeConfirmText2')}</p>
            <div className="modal-actions">
              <button className="primary" onClick={() => addWater(confirmLarge.amount, true)}>{t('hydration.yesLog')}</button>
              <button className="secondary" onClick={() => setConfirmLarge(null)}>{t('hydration.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <EducationBottomSheet topicType="hydration" visible={eduVisible} onClose={() => setEduVisible(false)} />
    </section>
  )
}
