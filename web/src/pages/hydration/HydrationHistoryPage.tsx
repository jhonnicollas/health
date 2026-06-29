/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/auth'

const SOURCES = [
  { value: '', label: 'Semua Sumber' },
  { value: 'web', label: 'Web' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'manual', label: 'Manual' },
]

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
      if (!r.ok) { setError('Gagal memuat riwayat.'); return }
      const j = await r.json()
      if (j.success) setLogs(j.data?.logs || [])
      else setError('Gagal memuat riwayat.')
    } catch { setError('Tidak bisa terhubung ke server.') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [user, from, to, source, minAmount, maxAmount])

  async function handleDelete(logId: number) {
    try {
      const r = await fetch(`/api/hydration/logs/${logId}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) { setError('Gagal menghapus log.'); return }
      const j = await r.json()
      if (j.success) { setDeleteId(null); void load() }
    } catch { setError('Tidak bisa terhubung ke server.') }
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
        <h3>Silakan login</h3>
        <p>Anda perlu masuk untuk melihat riwayat hidrasi.</p>
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
              <p className="eyebrow">Sprint 5B</p>
              <h2>Riwayat Asupan Air</h2>
              <p className="subtitle">Filter berdasarkan tanggal, sumber, dan jumlah.</p>
            </div>
          </div>
          <a href="/hydration" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>← Kembali</a>
        </div>
      </div>

      {error && (
        <div className="form-message error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined">error</span>
          {error}
          <button className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="hydration-filters">
        <label className="filter-field">
          <span>Dari</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>Sampai</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>Sumber</span>
          <select value={source} onChange={e => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Min (ml)</span>
          <input type="number" inputMode="numeric" min={0} value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0" />
        </label>
        <label className="filter-field">
          <span>Max (ml)</span>
          <input type="number" inputMode="numeric" min={0} value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="5000" />
        </label>
      </div>

      <div className="hydration-stats" style={{ marginTop: 16 }}>
        <div className="soft-card">
          <p className="stat-label">Total Log</p>
          <p className="stat-value">{loading ? <span className="skeleton" style={{ width: 40, height: 20, display: 'inline-block' }} /> : stats.count}</p>
        </div>
        <div className="soft-card">
          <p className="stat-label">Total Volume</p>
          <p className="stat-value consumed">{loading ? <span className="skeleton" style={{ width: 60, height: 20, display: 'inline-block' }} /> : `${stats.totalMl.toLocaleString('id-ID')}ml`}</p>
        </div>
        <div className="soft-card">
          <p className="stat-label">Rata-rata</p>
          <p className="stat-value">{loading ? <span className="skeleton" style={{ width: 50, height: 20, display: 'inline-block' }} /> : `${stats.avg.toLocaleString('id-ID')}ml`}</p>
        </div>
      </div>

      {loading ? (
        <div className="hydration-history" style={{ marginTop: 24 }}>
          <h3>Daftar Log</h3>
          <div className="hydration-table-wrap">
            <table className="hydration-table">
              <thead><tr><th>Tanggal</th><th>Waktu</th><th>Jumlah</th><th>Sumber</th><th>Catatan</th><th /></tr></thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--colorTextMuted)' }}>water_drop</span>
          <h3>Tidak ada log</h3>
          <p>Tidak ada log yang cocok dengan filter. Coba ubah rentang tanggal atau filter lainnya.</p>
          <button className="btn-secondary" onClick={() => { setFrom(thirtyDaysAgo()); setTo(todayStr()); setSource(''); setMinAmount(''); setMaxAmount('') }} style={{ marginTop: 12 }}>
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="hydration-history" style={{ marginTop: 24 }}>
          <h3>Daftar Log</h3>
          <div className="hydration-table-wrap">
            <table className="hydration-table">
              <thead><tr><th>Tanggal</th><th>Waktu</th><th>Jumlah</th><th>Sumber</th><th>Catatan</th><th /></tr></thead>
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
                          <button className="delete-confirm" onClick={() => handleDelete(l.id)}>Hapus</button>
                          <button className="delete-cancel" onClick={() => setDeleteId(null)}>Batal</button>
                        </>
                      ) : (
                        <button className="delete-btn" onClick={() => setDeleteId(l.id)} title="Hapus log"><span className="material-symbols-outlined">close</span></button>
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
