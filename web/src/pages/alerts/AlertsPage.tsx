import { useEffect, useState } from 'react'
import { formatDateTimeShort } from '../../utils/dateFormat'

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

type AlertTab = 'alerts' | 'telegram'

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeTab, setActiveTab] = useState<AlertTab>('alerts')
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramLoaded, setTelegramLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAlerts() {
    setAlertsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/alerts', { credentials: 'include' })
      const body = (await res.json().catch(() => null)) as ApiResp<{ alerts: AlertItem[] }> | null
      if (!body || !body.success) {
        setError(body?.error?.message ?? 'Gagal memuat alert.')
        setAlerts([])
      } else {
        setAlerts(Array.isArray(body.data?.alerts) ? body.data!.alerts : [])
      }
    } catch {
      setError('Tidak bisa terhubung ke server.')
      setAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }

  async function loadTelegram() {
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50', { credentials: 'include' })
      const body = (await res.json().catch(() => null)) as ApiResp<{ notifications: NotificationItem[] }> | null
      if (!body || !body.success) {
        setNotifications([])
      } else {
        setNotifications(Array.isArray(body.data?.notifications) ? body.data!.notifications : [])
        setTelegramLoaded(true)
      }
    } catch {
      setNotifications([])
    } finally {
      setTelegramLoading(false)
    }
  }

  useEffect(() => {
    void loadAlerts()
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [])

  useEffect(() => {
    if (activeTab === 'telegram' && !telegramLoaded) {
      void loadTelegram()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [activeTab, telegramLoaded])

  async function acknowledge(id: number) {
    const res = await fetch(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if (res.ok) await loadAlerts()
  }

  return (
    <section className="settings-panel alerts-center" aria-labelledby="alerts-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Notifications</p>
          <h2 id="alerts-title">Inbox &amp; Alerts Center</h2>
          <p>Rule-based alerts and notification delivery logs in one control center.</p>
        </div>
        <span className="status-chip">{alerts.length} alerts</span>
      </div>

      <div className="alerts-tabs" role="tablist" aria-label="Alerts / Telegram">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'alerts'}
          className={`alerts-tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>notifications_active</span>
          Emergency Alerts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'telegram'}
          className={`alerts-tab ${activeTab === 'telegram' ? 'active' : ''}`}
          onClick={() => setActiveTab('telegram')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>send</span>
          Telegram Log
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}

      {activeTab === 'alerts' ? (
        <div className="settings-card">
          <h3>Rule Alerts</h3>
          {alertsLoading ? <p className="muted">Memuat alert...</p> : null}
          {!alertsLoading && alerts.length === 0 ? <p>Tidak ada alert untuk filter ini.</p> : null}
          {alerts.length > 0 ? (
            <ul className="alerts-list">
              {alerts.map((alert) => {
                const dt = formatDateTimeShort(alert.createdAt)
                return (
                  <li key={alert.id} className={`alert-item severity-${alert.severity}`}>
                    <div>
                      <strong>{alert.metricCode}</strong>: {alert.message}
                      <div className="muted">
                        Value {alert.finalValue} {alert.unit} · {dt.date} {dt.time}
                      </div>
                    </div>
                    {alert.acknowledged === true || alert.acknowledged === 1 ? (
                      <span className="badge-status badge-normal"><span className="status-dot" />Acknowledged</span>
                    ) : (
                      <button onClick={() => void acknowledge(alert.id)} type="button">Acknowledge</button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="settings-card">
          <h3>Telegram Delivery Timeline</h3>
          {telegramLoading ? <p className="muted">Memuat log Telegram...</p> : null}
          {!telegramLoading && notifications.length === 0 ? <p>Tidak ada log notifikasi Telegram.</p> : null}
          {notifications.length > 0 ? (
            <ol className="timeline-list">
              {notifications.map((notification) => {
                const dt = formatDateTimeShort(notification.createdAt)
                return (
                  <li key={notification.id}>
                    <span className={`badge-status ${notification.status === 'failed' ? 'badge-critical' : 'badge-normal'}`}>
                      <span className="status-dot" />{notification.status}
                    </span>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{notification.channel} · {notification.notificationType} · {dt.date} {dt.time}</small>
                    {notification.errorMessage ? <small className="form-message error">{notification.errorMessage}</small> : null}
                  </li>
                )
              })}
            </ol>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default AlertsPage
