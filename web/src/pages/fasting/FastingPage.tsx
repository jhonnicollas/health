import { useEffect, useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type Current = {
  active: boolean
  id?: string
  fastingType?: string
  targetHours?: number
  startedAt?: string
  elapsedHours?: number
}

export function FastingPage() {
  const [current, setCurrent] = useState<Current | null>(null)
  const [type, setType] = useState('glucoseFasting')
  const [hours, setHours] = useState(8)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/fasting/current', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<Current>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setCurrent(body.data || null)
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  useEffect(() => { void load() }, [])

  async function start() {
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/fasting/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fastingType: type, targetHours: hours })
      })
      const body = (await res.json()) as ApiResp<{ fastingId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage('Sesi puasa dimulai.')
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function stop(status: 'completed' | 'cancelled') {
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/fasting/stop', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const body = (await res.json()) as ApiResp<{ status: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage(`Sesi ${status}.`)
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="fasting-title">
      <h2 id="fasting-title">Sesi Puasa</h2>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
      {current?.active ? (
        <div>
          <p>Sedang berpuasa: <strong>{current.fastingType}</strong></p>
          <p>Target: {current.targetHours} jam | Sudah: {current.elapsedHours?.toFixed(2)} jam</p>
          <p>Mulai: {current.startedAt}</p>
          <button onClick={() => stop('completed')} type="button">Selesaikan</button>
          <button onClick={() => stop('cancelled')} type="button">Batalkan</button>
        </div>
      ) : (
        <div>
          <p>Tidak ada sesi aktif.</p>
          <label>Tipe puasa
            <select onChange={(e) => setType(e.target.value)} value={type}>
              <option value="glucoseFasting">Gula darah puasa</option>
              <option value="cholesterolTotal">Kolesterol total</option>
              <option value="uricAcid">Asam urat</option>
              <option value="general">Umum</option>
            </select>
          </label>
          <label>Target jam <input max={48} min={1} onChange={(e) => setHours(Number(e.target.value))} type="number" value={hours} /></label>
          <button onClick={start} type="button">Mulai Puasa</button>
        </div>
      )}
    </section>
  )
}
