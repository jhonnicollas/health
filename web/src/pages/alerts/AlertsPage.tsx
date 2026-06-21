import { useEffect, useMemo, useState } from 'react'

type AlertItem = {
  id: string
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  alertType: string
  message: string
  acknowledged: boolean | number
  createdAt: string
}

type NotificationItem = {
  id: string
  channel: string
  notificationType: string
  title: string
  message: string
  status: string
  errorMessage?: string | null
  sentAt?: string | null
  createdAt: string
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

type AlertFilter = 'all' | 'emergency' | 'telegram'

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [filter, setFilter] = useState<AlertFilter>('all')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [alertsRes, notificationsRes] = await Promise.all([
        fetch('/api/alerts', { credentials: 'include' }),
        fetch('/api/notifications?limit=50', { credentials: 'include' })
      ])
      const alertsBody = (await alertsRes.json()) as ApiResp<{ alerts: AlertItem[] }>
      const notificationsBody = (await notificationsRes.json()) as ApiResp<{ notifications: NotificationItem[] }>
      if (!alertsBody.success) {
        setError(alertsBody.error?.message ?? 'Gagal memuat alerts.')
        return
      }
      if (!notificationsBody.success) {
        setError(notificationsBody.error?.message ?? 'Gagal memuat inbox.')
        return
      }
      setAlerts(alertsBody.data?.alerts ?? [])
      setNotifications(notificationsBody.data?.notifications ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  async function acknowledge(id: string) {
    const res = await fetch(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (res.ok) await load()
  }

  const visibleAlerts = useMemo(() => {
    if (filter === 'emergency') return alerts.filter((item) => item.severity === 'emergency' || item.alertType === 'emergency')
    return alerts
  }, [alerts, filter])

  const visibleNotifications = useMemo(() => {
    if (filter === 'telegram') return notifications.filter((item) => item.channel === 'telegram')
    if (filter === 'emergency') return notifications.filter((item) => item.notificationType.includes('emergency'))
    return notifications
  }, [filter, notifications])

  return (
    <section className="settings-panel alerts-center" aria-labelledby="alerts-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Notifications</p>
          <h2 id="alerts-title">Inbox & Alerts Center</h2>
          <p>Alert rule-based dan log pengiriman notifikasi tampil dalam satu pusat kontrol.</p>
        </div>
        <span className="status-chip">{visibleAlerts.length} alert</span>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Filter notifications">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">All</button>
        <button className={filter === 'emergency' ? 'active' : ''} onClick={() => setFilter('emergency')} type="button">Emergency Alerts</button>
        <button className={filter === 'telegram' ? 'active' : ''} onClick={() => setFilter('telegram')} type="button">Telegram Log</button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}

      <div className="settings-card">
        <h3>Rule alerts</h3>
        {visibleAlerts.length === 0 ? <p>Tidak ada alert untuk filter ini.</p> : (
          <ul className="alerts-list">
            {visibleAlerts.map((alert) => (
              <li key={alert.id} className={`alert-item severity-${alert.severity}`}>
                <div>
                  <strong>{alert.metricCode}</strong>: {alert.message}
                  <div className="muted">
                    Nilai {alert.finalValue} {alert.unit} · {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
                {alert.acknowledged === true || alert.acknowledged === 1 ? (
                  <span className="badge">Sudah dikonfirmasi</span>
                ) : (
                  <button onClick={() => void acknowledge(alert.id)} type="button">Konfirmasi</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card">
        <h3>Telegram delivery timeline</h3>
        {visibleNotifications.length === 0 ? <p>Belum ada log notifikasi.</p> : (
          <ol className="timeline-list">
            {visibleNotifications.map((notification) => (
              <li key={notification.id}>
                <span className={`status-chip ${notification.status === 'failed' ? 'warning' : ''}`}>{notification.status}</span>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{notification.channel} · {notification.notificationType} · {new Date(notification.createdAt).toLocaleString()}</small>
                {notification.errorMessage ? <small className="form-message error">{notification.errorMessage}</small> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

export default AlertsPage
