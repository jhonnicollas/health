import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useI18n } from '../../i18n'

type Reminder = {
  id: number
  reminderType: string
  enabled: boolean
  scheduleTime: string
  timezone: string
  channel: string
  message?: string
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string; details?: Array<{ field: string; message: string }> }
}

type RemindersListResponse = ApiResp<{ reminders: Reminder[] }>
type TelegramStatusResp = ApiResp<{ linked: boolean; enabled: boolean }>

const REMINDER_TYPES = ['morningMeasurement', 'eveningMeasurement', 'medication'] as const
const CHANNELS = ['telegram', 'browser', 'inApp'] as const

export function RemindersPage() {
  const { t } = useI18n()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reminderType, setReminderType] = useState<(typeof REMINDER_TYPES)[number]>('morningMeasurement')
  const [scheduleTime, setScheduleTime] = useState('07:00')
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('telegram')
  const [message, setMessage] = useState('Time for your morning health check.')

  // Telegram status
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramChecked, setTelegramChecked] = useState(false)

  // Push status
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushStatus, setPushStatus] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/reminders', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setReminders([])
        return
      }
      if (!res.ok) {
        setReminders([])
        setError(`${t('reminders.loadFailedStatus')} (${res.status}).`)
        return
      }
      const body = await res.json().catch(() => null) as RemindersListResponse | null
      if (!body || typeof body !== 'object') {
        setReminders([])
        setError(t('reminders.unexpectedResponse'))
        return
      }
      if (!body.success) {
        setError(body.error?.message ?? t('reminders.loadFailed'))
        setReminders([])
        return
      }
      const data = body.data
      const raw = data && typeof data === 'object' && 'reminders' in data ? data.reminders : undefined
      const list = Array.isArray(raw) ? raw : []
      setReminders(list)
    } catch {
      setError(t('reminders.connError'))
      setReminders([])
    }
  }

  async function loadTelegramStatus() {
    try {
      const res = await fetch('/api/telegram/status', { credentials: 'include' })
      if (res.ok) {
        const body = await res.json() as TelegramStatusResp
        if (body.success && body.data) {
          setTelegramLinked(body.data.linked)
        }
      }
    } catch {
      // Silently fail — not critical
    } finally {
      setTelegramChecked(true)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); void loadTelegramStatus() }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderType,
          enabled: true,
          scheduleTime,
          timezone,
          channel,
          payload: { message }
        })
      })
      const body = (await res.json()) as ApiResp<{ reminderId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? t('reminders.addFailed'))
        return
      }
      await load()
    } catch {
      setError(t('reminders.connError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleEnabled(reminder: Reminder) {
    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !reminder.enabled })
    })
    if (!res.ok) {
      setError(t('reminders.updateFailed'))
      return
    }
    await load()
  }

  async function remove(id: number) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!res.ok) {
      setError(t('reminders.removeFailed'))
      return
    }
    await load()
  }

  async function enableBrowserPush() {
    setPushStatus(null)
    try {
      if (!('Notification' in window)) {
        setPushStatus(t('reminders.browserNoSupport'))
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus(t('reminders.permissionDenied'))
        return
      }
      if (!('serviceWorker' in navigator)) {
        setPushStatus(t('reminders.swNotSupported'))
        return
      }

      // Fetch VAPID public key from server
      const vapidRes = await fetch('/api/push/vapid-key', { credentials: 'include' })
      if (!vapidRes.ok) {
        setPushStatus(t('reminders.pushEnableFailed'))
        return
      }
      const vapidBody = await vapidRes.json() as ApiResp<{ vapidPublicKey: string }>
      if (!vapidBody.success || !vapidBody.data?.vapidPublicKey) {
        setPushStatus(t('reminders.pushEnableFailed'))
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidBody.data.vapidPublicKey
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      })
      if (res.ok) {
        setPushEnabled(true)
        setPushStatus(t('reminders.pushSuccess'))
      } else {
        setPushStatus(t('reminders.pushSubscribeFailed'))
      }
    } catch {
      setPushStatus(t('reminders.pushEnableFailed'))
    }
  }

  async function testPush() {
    setPushStatus(null)
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'iSehat Test', body: 'Push test dari RemindersPage' })
      })
      const body = await res.json() as ApiResp<{ sent: number; failed: number }>
      if (res.ok && body.success) {
        setPushStatus(`Test push: ${body.data?.sent ?? 0} sent, ${body.data?.failed ?? 0} failed.`)
      } else {
        setPushStatus(body.error?.message ?? 'Test push gagal.')
      }
    } catch {
      setPushStatus(t('reminders.connError'))
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="reminders-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('reminders.eyebrow')}</p>
          <h2 id="reminders-title">{t('reminders.title')}</h2>
          <p>{t('reminders.subtitle')}</p>
        </div>
        <span className="status-chip">{reminders.length} {t('reminders.reminders')}</span>
      </div>

      {/* Telegram link status banner */}
      {telegramChecked && !telegramLinked && (
        <div className="settings-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <p style={{ margin: 0, color: '#92400e' }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: 20 }}>info</span>
            {' '}
            Telegram belum terhubung. Hubungkan di <a href="/telegram" style={{ fontWeight: 600 }}>halaman Telegram</a> untuk menerima pengingat via Telegram.
          </p>
        </div>
      )}

      <div className="settings-card">
        <h3>{t('reminders.pushTitle')}</h3>
        <p>{t('reminders.pushDesc')}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={pushEnabled} onClick={() => void enableBrowserPush()} type="button">
            {pushEnabled ? t('reminders.pushEnabled') : t('reminders.enablePush')}
          </button>
          {pushEnabled && (
            <button className="secondary" onClick={() => void testPush()} type="button">Test Push</button>
          )}
        </div>
        {pushStatus ? <p className={`form-message ${pushEnabled ? 'success' : 'error'}`} role="status">{pushStatus}</p> : null}
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>{t('reminders.newReminder')}</h3>
          <p>{t('reminders.newReminderDesc')}</p>
        </div>
        <label>
          {t('reminders.type')}
          <select
            onChange={(e) => setReminderType(e.target.value as (typeof REMINDER_TYPES)[number])}
            value={reminderType}
          >
            {REMINDER_TYPES.map((tp) => (
              <option key={tp} value={tp}>{tp}</option>
            ))}
          </select>
        </label>
        <label>
          {t('reminders.timeLabel')}
          <input onChange={(e) => setScheduleTime(e.target.value)} required type="time" value={scheduleTime} />
        </label>
        <label>
          {t('reminders.timezone')}
          <input onChange={(e) => setTimezone(e.target.value)} required type="text" value={timezone} />
        </label>
        <label>
          {t('reminders.channel')}
          <select
            onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
            value={channel}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch === 'telegram' ? `Telegram ${telegramLinked ? '✓' : '⚠'}` : ch === 'browser' ? 'Browser Push' : 'In-App'}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('reminders.messageLabel')}
          <input onChange={(e) => setMessage(e.target.value)} required type="text" value={message} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? t('reminders.saving') : t('reminders.addReminder')}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>{t('reminders.activeReminders')}</h3>
        {reminders.length === 0 ? <p>{t('reminders.noReminders')}</p> : (
          <ul className="reminder-list">
            {reminders.map((r) => (
              <li key={r.id} className="reminder-item">
                <div>
                  <strong>{r.reminderType}</strong> · {r.scheduleTime} ({r.timezone}) · {r.channel}
                  <div className="muted">{r.message}</div>
                </div>
                <div>
                  <button onClick={() => toggleEnabled(r)} type="button">
                    {r.enabled ? t('reminders.disable') : t('reminders.enable')}
                  </button>
                  <button className="danger" onClick={() => remove(r.id)} type="button">{t('reminders.remove')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default RemindersPage
