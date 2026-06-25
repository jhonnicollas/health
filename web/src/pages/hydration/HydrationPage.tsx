/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, no-empty */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

function ProgressRing({ percent, size = 140, stroke = 12 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(percent, 100) / 100) * circ
  const color = percent > 100 ? '#e74c3c' : percent > 80 ? '#f39c12' : '#2ecc71'
  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--colorBorderSoft, #eee)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.5s' }} />
      <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fontSize={28} fontWeight={700} fill="var(--colorTextPrimary)">{Math.min(percent, 999)}%</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize={13} fill="var(--colorTextSecondary)">tercapai</text>
    </svg>
  )
}

const QUICK_ADDS = [200, 600]

export function HydrationPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState(200)
  const [msg, setMsg] = useState('')
  const [confirmLarge, setConfirmLarge] = useState<{ amount: number; pending: false } | null>(null)
  const [customModal, setCustomModal] = useState(false)
  const [customVal, setCustomVal] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [eduVisible, setEduVisible] = useState(true)

  async function fetchData() {
    try {
      const r = await fetch('/api/hydration/today', { credentials: 'include', headers: { Accept: 'application/json' } })
      const j = await r.json()
      if (j.success) setData(j.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { void fetchData() }, [])

  async function addWater(ml: number, confirmed = false) {
    setConfirmLarge(null)
    const r = await fetch('/api/hydration/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountMl: ml, confirmedLargeInput: confirmed }) })
    const j = await r.json()
    if (j.success) { setMsg(`+${ml}ml dicatat! Total: ${j.data.totalMl}ml`); void fetchData() }
    else if (j.error?.code === 'LARGE_INPUT_CONFIRMATION_REQUIRED') setConfirmLarge({ amount: ml, pending: false })
    else setMsg(j.error?.message || 'Gagal')
  }

  async function handleDelete(logId: number) {
    const r = await fetch(`/api/hydration/logs/${logId}`, { method: 'DELETE', credentials: 'include' })
    const j = await r.json()
    if (j.success) { setDeleteId(null); void fetchData() }
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>

  return (
    <section className="settings-panel">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>💧 Hidrasi</h2>
        <a href="/hydration/settings" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>⚙️ Pengaturan</a>
      </div>

      {loading ? <p>Memuat...</p> : data ? (
        <div>
          <ProgressRing percent={data.percent} />
          <p style={{ textAlign: 'center', margin: '12px 0' }}>{data.totalMl}ml / {data.targetMl}ml</p>

          {data.targetReasons?.length > 0 && (
            <div style={{ padding: 10, borderRadius: 8, background: 'var(--colorSurfaceContainer)', marginBottom: 12, fontSize: 13, color: 'var(--colorTextSecondary)' }}>
              {data.targetReasons.map((r: string, i: number) => <div key={i}>• {r}</div>)}
            </div>
          )}

          {data.overhydrationWarning && (
            <div style={{ padding: 14, borderRadius: 10, background: 'color-mix(in srgb, var(--colorStatusCritical) 10%, transparent)', border: '1px solid var(--colorStatusCritical)', marginBottom: 12 }}>
              <strong style={{ color: 'var(--colorStatusCritical)' }}>⚠️ Kelebihan Cairan</strong>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {QUICK_ADDS.map(v => <button key={v} className={amount === v ? 'btn-primary' : 'btn-secondary'} onClick={() => setAmount(v)}>+{v}ml</button>)}
            <button className="btn-secondary" onClick={() => setCustomModal(true)}>Custom</button>
          </div>

          <button onClick={() => addWater(amount)} className="btn-primary" style={{ width: '100%', marginBottom: 8 }}>Catat Minum {amount}ml</button>

          {customModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--colorSurfaceElevated, #fff)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 320 }}>
                <h3>Masukkan Jumlah (ml)</h3>
                <input type="number" inputMode="numeric" value={customVal} onChange={e => setCustomVal(e.target.value)} style={{ width: '100%', fontSize: 24, textAlign: 'center', padding: 12, margin: '12px 0', borderRadius: 8, border: '1px solid var(--colorBorder)' }} min={1} max={3000} autoFocus />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => { const v = Number(customVal); if (v > 0) { setAmount(v); setCustomModal(false); setCustomVal('') } }}>OK</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setCustomModal(false)}>Batal</button>
                </div>
              </div>
            </div>
          )}

          {confirmLarge && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--colorSurfaceElevated, #fff)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 340 }}>
                <h3>Konfirmasi Jumlah Besar</h3>
                <p>Anda akan mencatat <strong>{confirmLarge.amount}ml</strong> sekaligus. Apakah Anda yakin?</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => addWater(confirmLarge.amount, true)}>Ya, catat</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmLarge(null)}>Batal</button>
                </div>
              </div>
            </div>
          )}

          {msg && <p className="form-message success">{msg}</p>}

          {data.logs?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Riwayat Hari Ini</h3>
              {data.logs.map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--colorBorderSoft)', marginBottom: 6 }}>
                  <span>{l.amountMl}ml — {l.loggedAt?.slice(11, 16)}</span>
                  {deleteId === l.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ fontSize: 12, padding: '2px 8px', color: 'var(--colorStatusCritical)', cursor: 'pointer' }} onClick={() => handleDelete(l.id)}>Hapus</button>
                      <button style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer' }} onClick={() => setDeleteId(null)}>Batal</button>
                    </div>
                  ) : (
                    <button style={{ fontSize: 18, color: 'var(--colorTextMuted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }} onClick={() => setDeleteId(l.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : <div><p>Gagal memuat data.</p><button className="btn-secondary" onClick={fetchData}>Coba Lagi</button></div>}
      <EducationBottomSheet topicType="hydration" visible={eduVisible} onClose={() => setEduVisible(false)} />
    </section>
  )
}
