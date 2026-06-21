import { useEffect, useState } from 'react'

type FastingSession = {
  id: string
  fastingType: string
  targetHours: number
  startedAt: string
  targetAt: string
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function FastingPage() {
  const [active, setActive] = useState(false)
  const [session, setSession] = useState<FastingSession | null>(null)
  const [targetHours, setTargetHours] = useState(8)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/fasting/current', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ active: boolean; session: FastingSession | null }>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat status puasa.')
        return
      }
      setActive(Boolean(body.data?.active))
      setSession(body.data?.session ?? null)
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function start() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/fasting/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fastingType: 'glucoseFasting', targetHours })
      })
      const body = (await res.json()) as ApiResp<{ fastingSessionId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Gagal memulai puasa.')
        return
      }
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function stop() {
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/fasting/stop', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fastingSessionId: session.id, status: 'completed' })
      })
      const body = (await res.json()) as ApiResp<{ status: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Gagal mengakhiri puasa.')
        return
      }
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="fasting-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Pengukuran</p>
          <h2 id="fasting-title">Fasting timer</h2>
          <p>Catat puasa untuk pengukuran glukosa darah puasa.</p>
        </div>
        <span className="status-chip">{active ? 'Aktif' : 'Siap'}</span>
      </div>

      {active && session ? (
        <div className="fasting-active">
          <p>Puasa aktif sejak {new Date(session.startedAt).toLocaleString()}.</p>
          <p>Target selesai: {new Date(session.targetAt).toLocaleString()}.</p>
          <button disabled={submitting} onClick={stop} type="button">
            {submitting ? 'Mengakhiri...' : 'Akhiri puasa'}
          </button>
        </div>
      ) : (
        <div className="fasting-start">
          <label>
            Target jam
            <input
              max={24}
              min={4}
              onChange={(e) => setTargetHours(Number(e.target.value))}
              type="number"
              value={targetHours}
            />
          </label>
          <button disabled={submitting} onClick={start} type="button">
            {submitting ? 'Memulai...' : 'Mulai puasa'}
          </button>
        </div>
      )}

      {error ? <p className="form-message error" role="status">{error}</p> : null}
    </section>
  )
}

export default FastingPage
