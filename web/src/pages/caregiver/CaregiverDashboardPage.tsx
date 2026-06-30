import { useEffect, useState } from 'react'
import { formatDateTimeID, formatDateID } from '../../utils/dateFormat'
import { useMetricLabels, useSeverityLabels } from '../../i18n/useI18n'

type MonitorValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt: string
}

type MonitorAlert = {
  id: number
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
  latestAlerts: Array<{ id: number; metricCode: string; finalValue: number; unit: string; severity: string; message: string; createdAt: string }>
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
  const ml = useMetricLabels()
  const sl = useSeverityLabels()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/family/caregiver/dashboard', { credentials: 'include' })
      if (!res.ok) {
        setError(res.status >= 500 ? 'Server error. Coba lagi nanti.' : 'Gagal memuat dashboard caregiver.')
        return
      }
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
      if (!res.ok) {
        setError(res.status >= 500 ? 'Server error. Coba lagi nanti.' : 'Gagal memuat detail.')
        return
      }
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">Pengasuh</p>
          <h2 id="caregiver-title">Dashboard Pengasuh</h2>
          <p>Pantau individu yang memberi Anda akses.</p>
        </div>
        <span className="status-chip">{profiles.length} profil</span>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {loading ? <p>Memuat...</p> : null}

      {profiles.length === 0 && !loading ? <p>Belum ada individu terhubung.</p> : (
        <ul className="caregiver-list">
          {profiles.map((p) => (
            <li key={p.ownerUserId} className="caregiver-item">
              <div>
                <strong>{p.displayName}</strong> · {p.role}
                  <div className="muted">
                  Pengukuran terakhir: {p.lastMeasurementAt ? formatDateTimeID(p.lastMeasurementAt) : '—'}
                </div>
              </div>
              <button onClick={() => viewDetail(p.ownerUserId)} type="button">Lihat Detail</button>
            </li>
          ))}
        </ul>
      )}

      {monitor ? (
        <section className="monitor-detail">
            <div className="page-heading compact">
              <div>
                <p className="eyebrow">Monitor</p>
                <h3>Detail untuk {formatDateID(monitor.date)}</h3>
              </div>
              <span className="status-chip">{monitor.values.length} nilai</span>
            </div>
          {monitor.values.length === 0 ? <p>Tidak ada nilai.</p> : (
            <ul className="value-list">
              {monitor.values.map((v, idx) => (
                <li key={`${v.metricCode}-${idx}`} className={`value-card severity-${v.severity}`}>
                  <strong>{ml[v.metricCode] || v.metricCode}</strong>
                  <span>{v.finalValue} {v.unit} (<span className={`badge-status badge-${v.severity}`}><span className="status-dot" />{sl[v.severity] || v.severity}</span>)</span>
                </li>
              ))}
            </ul>
          )}
          {monitor.alerts.length > 0 ? (
            <>
              <h4>Peringatan</h4>
              <ul className="alerts-list">
                {monitor.alerts.map((a) => (
                  <li key={a.id} className={`alert-item severity-${a.severity}`}>{ml[a.metricCode] || a.metricCode}: {a.message}</li>
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
