import { useEffect, useMemo, useState } from 'react'

type FastingSession = {
  id: string
  fastingType: string
  targetHours: number
  startedAt: string
  elapsedHours?: number
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

function formatCountdown(targetHours: number, startedAt: string, nowTick: number) {
  const targetMs = new Date(startedAt).getTime() + targetHours * 60 * 60 * 1000
  const remainingMs = Math.max(targetMs - nowTick, 0)
  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function FastingPage() {
  const [active, setActive] = useState(false)
  const [session, setSession] = useState<FastingSession | null>(null)
  const [targetHours, setTargetHours] = useState(8)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/fasting/current', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<
        | { active: false }
        | ({ active: true } & FastingSession)
      >
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat status puasa.')
        return
      }
      if (body.data?.active) {
        setActive(true)
        setSession({
          id: body.data.id,
          fastingType: body.data.fastingType,
          targetHours: body.data.targetHours,
          startedAt: body.data.startedAt,
          elapsedHours: body.data.elapsedHours
        })
      } else {
        setActive(false)
        setSession(null)
      }
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])

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
      const body = (await res.json()) as ApiResp<{ fastingId: string }>
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

  async function stop(status: 'completed' | 'cancelled') {
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/fasting/stop', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fastingSessionId: session.id, status })
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

  const countdown = useMemo(() => {
    if (!session) return '00:00:00'
    return formatCountdown(session.targetHours, session.startedAt, nowTick)
  }, [nowTick, session])

  return (
    <section className="settings-panel" aria-labelledby="fasting-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tracker</p>
          <h2 id="fasting-title">Fasting timer</h2>
          <p>Mulai, lihat hitung mundur, lalu selesaikan atau batalkan sesi puasa.</p>
        </div>
        <span className="status-chip">{active ? 'Aktif' : 'Siap'}</span>
      </div>

      {active && session ? (
        <div className="fasting-active">
          <p>Puasa aktif sejak {new Date(session.startedAt).toLocaleString()}.</p>
          <div className="big-value">{countdown}</div>
          <div className="button-stack">
            <button disabled={submitting} onClick={() => void stop('completed')} type="button">
              {submitting ? 'Menyimpan...' : 'Stop'}
            </button>
            <button className="secondary-action" disabled={submitting} onClick={() => void stop('cancelled')} type="button">
              Cancel
            </button>
          </div>
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
          <button disabled={submitting} onClick={() => void start()} type="button">
            {submitting ? 'Memulai...' : 'Mulai puasa'}
          </button>
        </div>
      )}

      {error ? <p className="form-message error" role="status">{error}</p> : null}
    </section>
  )
}

export default FastingPage
