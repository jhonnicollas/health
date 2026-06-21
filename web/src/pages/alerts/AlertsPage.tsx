import { useEffect, useState } from 'react'

type AlertItem = {
  id: string
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  alertType: string
  message: string
  acknowledged: boolean
  createdAt: string
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/alerts', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<AlertItem[]>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat alerts.')
        return
      }
      setAlerts(body.data ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function acknowledge(id: string) {
    const res = await fetch(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="alerts-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Notifikasi</p>
          <h2 id="alerts-title">Alerts</h2>
          <p>Daftar alert yang dihasilkan oleh rule engine.</p>
        </div>
        <span className="status-chip">{alerts.length} alert</span>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}

      {alerts.length === 0 ? <p>Tidak ada alert aktif.</p> : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-item severity-${a.severity}`}>
              <div>
                <strong>{a.metricCode}</strong>: {a.message}
                <div className="muted">
                  Nilai {a.finalValue} {a.unit} · {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
              {a.acknowledged ? (
                <span className="badge">Sudah dikonfirmasi</span>
              ) : (
                <button onClick={() => acknowledge(a.id)} type="button">Konfirmasi</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AlertsPage
