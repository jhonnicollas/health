/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

export function DailyHealthHubPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/daily-health?date=${date}`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(r => r.json()).then(r => { setLoading(false); if (r.success) setData(r.data) })
      .catch(() => setLoading(false))
  }, [date])

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>Ringkasan Harian</h2><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      {loading ? <p>Memuat...</p> : !data ? <p>Gagal memuat data.</p> : !data.hasData ? <p>Belum ada data untuk tanggal ini.</p> : (
        <div>
          {data.measurements?.length > 0 && <div><h3>Pengukuran ({data.measurements.length})</h3>{data.measurements.map((m: any, i: number) => <div key={i} className="metric-chip">{m.metricCode}: {m.finalValue} ({m.status})</div>)}</div>}
          {data.symptoms?.length > 0 && <div><h3>Keluhan ({data.symptoms.length})</h3>{data.symptoms.map((s: any, i: number) => <div key={i} className="metric-chip">{s.isRedFlag ? '🔴' : '💬'} {s.bodyArea || 'Keluhan'} {s.painScale ? `(Nyeri: ${s.painScale}/10)` : ''}</div>)}</div>}
        </div>
      )}
    </section>
  )
}
