import { useEffect, useState } from 'react'

type Alert = {
  id: string
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  alertType: string
  message: string
  acknowledged: number
  acknowledgedAt: string | null
  createdAt: string
}

type Notif = {
  id: string
  channel: string
  notificationType: string
  title: string
  message: string
  status: string
  createdAt: string
}

type Streak = { currentCount: number; bestCount: number; lastDate: string | null }
type Badge = { badgeCode: string; earnedAt: string }

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [a, n, s, b] = await Promise.all([
        fetch('/api/alerts', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/notifications', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/streaks', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/badges', { credentials: 'include' }).then(r => r.json())
      ]) as [ApiResp<{ alerts: Alert[] }>, ApiResp<{ notifications: Notif[] }>, ApiResp<Streak>, ApiResp<{ badges: Badge[] }>]
      if (a.success) setAlerts(a.data?.alerts || [])
      if (n.success) setNotifs(n.data?.notifications || [])
      if (s.success) setStreak(s.data || null)
      if (b.success) setBadges(b.data?.badges || [])
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  useEffect(() => { void load() }, [])

  async function acknowledge(id: string) {
    try {
      await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST', credentials: 'include' })
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="alerts-title">
      <h2 id="alerts-title">Peringatan &amp; Notifikasi</h2>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <h3>Streak Harian</h3>
      <p>Sekarang: <strong>{streak?.currentCount ?? 0}</strong> hari | Terbaik: <strong>{streak?.bestCount ?? 0}</strong></p>
      <h3>Lencana</h3>
      {badges.length === 0 ? <p>Belum ada lencana.</p> : (
        <ul>{badges.map(b => <li key={b.badgeCode}>{b.badgeCode} ({b.earnedAt})</li>)}</ul>
      )}
      <h3>Peringatan ({alerts.length})</h3>
      {alerts.length === 0 ? <p>Tidak ada peringatan.</p> : (
        <table className="report-table">
          <thead><tr><th>Tanggal</th><th>Metrik</th><th>Nilai</th><th>Severity</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id}>
                <td>{a.createdAt}</td>
                <td>{a.metricCode}</td>
                <td>{a.finalValue} {a.unit}</td>
                <td>{a.severity}</td>
                <td>{a.acknowledged === 1 ? '✓ acknowledged' : 'Aktif'}</td>
                <td>{a.acknowledged === 1 ? '—' : <button onClick={() => acknowledge(a.id)} type="button">Ack</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Notifikasi</h3>
      {notifs.length === 0 ? <p>Tidak ada notifikasi.</p> : (
        <table className="report-table">
          <thead><tr><th>Tanggal</th><th>Kanal</th><th>Tipe</th><th>Judul</th><th>Status</th></tr></thead>
          <tbody>{notifs.map(n => (
            <tr key={n.id}><td>{n.createdAt}</td><td>{n.channel}</td><td>{n.notificationType}</td><td>{n.title}</td><td>{n.status}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}
