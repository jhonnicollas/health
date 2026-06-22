import { useEffect, useMemo, useState } from 'react'
import { formatIndonesianDate } from '../../utils/dateFormat'

type AlertItem = {
  id: number
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
  id: number
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
        setError(alertsBody.error?.message ?? 'Failed to load alerts.')
        return
      }
      if (!notificationsBody.success) {
        setError(notificationsBody.error?.message ?? 'Failed to load inbox.')
        return
      }
      setAlerts(alertsBody.data?.alerts ?? [])
      setNotifications(notificationsBody.data?.notifications ?? [])
    } catch {
      setError('Could not connect to server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  async function acknowledge(id: number) {
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
          <p>Rule-based alerts and notification delivery logs in one control center.</p>
        </div>
        <span className="status-chip">{visibleAlerts.length} alerts</span>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Filter notifications">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">All</button>
        <button className={filter === 'emergency' ? 'active' : ''} onClick={() => setFilter('emergency')} type="button">Emergency Alerts</button>
        <button className={filter === 'telegram' ? 'active' : ''} onClick={() => setFilter('telegram')} type="button">Telegram Log</button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}

      <div className="settings-card">
        <h3>Rule Alerts</h3>
        {visibleAlerts.length === 0 ? <p>No alerts for this filter.</p> : (
          <ul className="alerts-list">
            {visibleAlerts.map((alert) => (
              <li key={alert.id} className={`alert-item severity-${alert.severity}`}>
                <div>
                  <strong>{alert.metricCode}</strong>: {alert.message}
                  <div className="muted">
                    Value {alert.finalValue} {alert.unit} · {formatIndonesianDate(alert.createdAt)}
                  </div>
                </div>
                {alert.acknowledged === true || alert.acknowledged === 1 ? (
                  <span className="badge-status badge-normal"><span className="status-dot" />Acknowledged</span>
                ) : (
                  <button onClick={() => void acknowledge(alert.id)} type="button">Acknowledge</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card">
        <h3>Telegram Delivery Timeline</h3>
        {visibleNotifications.length === 0 ? <p>No notification logs yet.</p> : (
          <ol className="timeline-list">
            {visibleNotifications.map((notification) => (
              <li key={notification.id}>
                <span className={`badge-status ${notification.status === 'failed' ? 'badge-critical' : 'badge-normal'}`}>
                  <span className="status-dot" />{notification.status}
                </span>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{notification.channel} · {notification.notificationType} · {formatIndonesianDate(notification.createdAt)}</small>
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
