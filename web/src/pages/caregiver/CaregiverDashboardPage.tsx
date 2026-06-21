import { useEffect, useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type Profile = {
  ownerUserId: string
  displayName: string
  role: string
  permissions: { canViewDashboard: boolean; canInputMeasurement: boolean; canReceiveAlert: boolean }
  lastMeasurementAt: string | null
  latestAlerts: Array<{ id: string; metricCode: string; finalValue: number; unit: string; severity: string; message: string; createdAt: string }>
}

export function CaregiverDashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [monitor, setMonitor] = useState<{ date: string; values: any[]; alerts: any[] } | null>(null)

  async function load() {
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/family/caregiver/dashboard', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ profiles: Profile[] }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setProfiles(body.data?.profiles || [])
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function viewDetail(ownerUserId: string) {
    setError(null); setMonitor(null)
    try {
      const res = await fetch(`/api/caregiver/monitor/${ownerUserId}`, { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ date: string; values: any[]; alerts: any[] }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMonitor(body.data || null)
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function acknowledge(alertId: string) {
    try {
      const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ acknowledged: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="caregiver-title">
      <h2 id="caregiver-title">Dashboard Caregiver</h2>
      {loading ? <p>Memuat...</p> : null}
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {profiles.length === 0 ? <p>Tidak ada anggota keluarga yang terhubung.</p> : (
        <table className="report-table">
          <thead><tr><th>Nama</th><th>Peran</th><th>Pengukuran Terakhir</th><th>Peringatan Aktif</th><th>Aksi</th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.ownerUserId}>
                <td>{p.displayName}</td>
                <td>{p.role}</td>
                <td>{p.lastMeasurementAt || '—'}</td>
                <td>{p.latestAlerts.length}</td>
                <td>
                  <button onClick={() => viewDetail(p.ownerUserId)} type="button">Detail</button>
                  {p.latestAlerts.map(a => (
                    <button key={a.id} onClick={() => acknowledge(a.id)} type="button">Ack {a.metricCode}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {monitor ? (
        <div>
          <h3>Detail {monitor.date}</h3>
          <h4>Nilai</h4>
          {monitor.values.length === 0 ? <p>Tidak ada.</p> : (
            <table className="report-table">
              <thead><tr><th>Metrik</th><th>Nilai</th><th>Status</th><th>Severity</th></tr></thead>
              <tbody>{monitor.values.map((v, i) => <tr key={i}><td>{v.metricCode}</td><td>{v.finalValue} {v.unit}</td><td>{v.status}</td><td>{v.severity}</td></tr>)}</tbody>
            </table>
          )}
          <h4>Peringatan</h4>
          {monitor.alerts.length === 0 ? <p>Tidak ada.</p> : (
            <ul>{monitor.alerts.map((a, i) => <li key={i}>{a.metricCode}: {a.finalValue} {a.unit} ({a.severity}) - {a.message}</li>)}</ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
