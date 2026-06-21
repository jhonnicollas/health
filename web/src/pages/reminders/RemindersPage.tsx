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
  const [message, setMessage] = useState('Waktunya cek kesehatan pagi.')

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/reminders', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<Reminder[]>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat reminder.')
        return
      }
      setReminders(body.data ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
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
        setError(body.error?.message ?? 'Gagal menambah reminder.')
        return
      }
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
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
          <p className="eyebrow">Pengaturan</p>
          <h2 id="reminders-title">Reminder pengukuran</h2>
          <p>Atur pengingat harian untuk pengukuran atau minum obat.</p>
        </div>
        <span className="status-chip">{reminders.length} reminder</span>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>Reminder baru</h3>
          <p>Pilih jadwal, channel, dan pesan ringkas.</p>
        </div>
        <label>
          Jenis
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
          Waktu (HH:MM)
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
          Pesan
          <input onChange={(e) => setMessage(e.target.value)} required type="text" value={message} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Menyimpan...' : 'Tambah reminder'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <h3>Reminder aktif</h3>
      {reminders.length === 0 ? <p>Belum ada reminder.</p> : (
        <ul className="reminder-list">
          {reminders.map((r) => (
            <li key={r.id} className="reminder-item">
              <div>
                <strong>{r.reminderType}</strong> · {r.scheduleTime} ({r.timezone}) · {r.channel}
                <div className="muted">{r.message}</div>
              </div>
              <div>
                <button onClick={() => toggleEnabled(r)} type="button">
                  {r.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="danger" onClick={() => remove(r.id)} type="button">Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RemindersPage
