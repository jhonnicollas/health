import { useEffect, useState } from 'react'

type MonitorValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt: string
}

type MonitorAlert = {
  id: string
  metricCode: string
  finalValue: number
  unit: string
  severity: string
  message: string
  createdAt: string
}

type Profile = {
  ownerUserId: string
  displayName: string
  role: string
  permissions: { canViewDashboard: boolean; canInputMeasurement: boolean; canReceiveAlert: boolean }
  lastMeasurementAt: string | null
  latestAlerts: Array<{ id: string; metricCode: string; finalValue: number; unit: string; severity: string; message: string; createdAt: string }>
}

type Monitor = {
  date: string
  values: MonitorValue[]
  alerts: MonitorAlert[]
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function CaregiverDashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/family/caregiver/dashboard', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ profiles: Profile[] }>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal.')
        return
      }
      setProfiles(body.data?.profiles ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function viewDetail(ownerUserId: string) {
    setError(null)
    setMonitor(null)
    try {
      const res = await fetch(`/api/caregiver/monitor/${ownerUserId}`, { credentials: 'include' })
      const body = (await res.json()) as ApiResp<Monitor>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat detail.')
        return
      }
      setMonitor(body.data ?? null)
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="caregiver-title">
      <div className="auth-copy">
        <p className="eyebrow">Caregiver</p>
        <h2 id="caregiver-title">Caregiver dashboard</h2>
        <p>Pantau individu yang memberikan Anda akses.</p>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {loading ? <p>Memuat...</p> : null}

      {profiles.length === 0 && !loading ? <p>Belum ada individu yang terhubung.</p> : (
        <ul className="caregiver-list">
          {profiles.map((p) => (
            <li key={p.ownerUserId} className="caregiver-item">
              <div>
                <strong>{p.displayName}</strong> · {p.role}
                <div className="muted">
                  Pengukuran terakhir: {p.lastMeasurementAt ? new Date(p.lastMeasurementAt).toLocaleString() : '—'}
                </div>
              </div>
              <button onClick={() => viewDetail(p.ownerUserId)} type="button">Lihat detail</button>
            </li>
          ))}
        </ul>
      )}

      {monitor ? (
        <section className="monitor-detail">
          <h3>Detail {monitor.date}</h3>
          {monitor.values.length === 0 ? <p>Tidak ada nilai.</p> : (
            <ul>
              {monitor.values.map((v, idx) => (
                <li key={`${v.metricCode}-${idx}`}>
                  {v.metricCode}: {v.finalValue} {v.unit} ({v.severity})
                </li>
              ))}
            </ul>
          )}
          {monitor.alerts.length > 0 ? (
            <>
              <h4>Alerts</h4>
              <ul>
                {monitor.alerts.map((a) => (
                  <li key={a.id}>{a.metricCode}: {a.message}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}

export default CaregiverDashboardPage
