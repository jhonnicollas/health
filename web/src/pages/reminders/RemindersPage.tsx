import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Reminder = {
  id: string
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

const REMINDER_TYPES = ['morningMeasurement', 'eveningMeasurement', 'medication'] as const
const CHANNELS = ['telegram', 'browser'] as const

export function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reminderType, setReminderType] = useState<(typeof REMINDER_TYPES)[number]>('morningMeasurement')
  const [scheduleTime, setScheduleTime] = useState('07:00')
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('telegram')
  const [message, setMessage] = useState('Time for your morning health check.')

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/reminders', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<Reminder[]>
      if (!body.success) {
        setError(body.error?.message ?? 'Failed to load reminders.')
        return
      }
      setReminders(body.data ?? [])
    } catch {
      setError('Could not connect to server.')
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

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
        setError(body.error?.message ?? 'Failed to add reminder.')
        return
      }
      await load()
    } catch {
      setError('Could not connect to server.')
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
    if (res.ok) await load()
  }

  async function remove(id: string) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="reminders-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 id="reminders-title">Measurement Reminders</h2>
          <p>Set daily reminders for measurements or medication intake.</p>
        </div>
        <span className="status-chip">{reminders.length} reminders</span>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>New Reminder</h3>
          <p>Choose schedule, channel, and a brief message.</p>
        </div>
        <label>
          Type
          <select
            onChange={(e) => setReminderType(e.target.value as (typeof REMINDER_TYPES)[number])}
            value={reminderType}
          >
            {REMINDER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Time (HH:MM)
          <input onChange={(e) => setScheduleTime(e.target.value)} required type="time" value={scheduleTime} />
        </label>
        <label>
          Timezone
          <input onChange={(e) => setTimezone(e.target.value)} required type="text" value={timezone} />
        </label>
        <label>
          Channel
          <select
            onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
            value={channel}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Message
          <input onChange={(e) => setMessage(e.target.value)} required type="text" value={message} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : 'Add Reminder'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>Active Reminders</h3>
        {reminders.length === 0 ? <p>No reminders yet.</p> : (
          <ul className="reminder-list">
            {reminders.map((r) => (
              <li key={r.id} className="reminder-item">
                <div>
                  <strong>{r.reminderType}</strong> · {r.scheduleTime} ({r.timezone}) · {r.channel}
                  <div className="muted">{r.message}</div>
                </div>
                <div>
                  <button onClick={() => toggleEnabled(r)} type="button">
                    {r.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="danger" onClick={() => remove(r.id)} type="button">Remove</button>
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
