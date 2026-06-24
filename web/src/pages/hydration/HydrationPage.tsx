/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

export function HydrationPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState(250); const [msg, setMsg] = useState('')

  useEffect(() => { fetch('/api/hydration/today', { credentials: 'include', headers: { Accept: 'application/json' } }).then(r => r.json()).then(r => { setLoading(false); if (r.success) setData(r.data) }).catch(() => setLoading(false)) }, [])

  const addWater = async () => {
    const r = await fetch('/api/hydration/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountMl: amount }) })
    const j = await r.json()
    if (j.success) { setMsg(`+${amount}ml dicatat! Total: ${j.data.totalMl}ml`); setData((d: any) => d ? { ...d, totalMl: j.data.totalMl, percent: Math.round((j.data.totalMl / d.targetMl) * 100) } : d) }
    else setMsg('Gagal')
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>💧 Hidrasi</h2></div>
      {loading ? <p>Memuat...</p> : data ? (
        <div>
          <div className="progress-bar" style={{ height: 20, background: '#eee', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${Math.min(data.percent, 100)}%`, height: '100%', background: data.percent > 100 ? '#e74c3c' : '#2ecc71', transition: 'width 0.3s' }} />
          </div>
          <p>{data.totalMl}ml / {data.targetMl}ml ({data.percent}%)</p>
          {data.overhydrationWarning && <p className="form-message error">⚠️ Kelebihan cairan!</p>}
          <div className="admin-field"><label>Tambah Air (ml)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {[100, 200, 250, 300, 500].map(v => <button key={v} className={amount === v ? 'btn-primary' : 'btn-secondary'} onClick={() => setAmount(v)}>{v}ml</button>)}
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: 80 }} />
            </div>
          </div>
          <button onClick={addWater} className="btn-primary">Catat Minum</button>
          {msg && <p>{msg}</p>}
          {data.logs?.length > 0 && <div><h3>Riwayat Hari Ini</h3>{data.logs.map((l: any, i: number) => <div key={i} className="metric-chip">{l.amountMl}ml {l.loggedAt?.slice(11,16)}</div>)}</div>}
        </div>
      ) : <p>Gagal memuat data.</p>}
    </section>
  )
}
