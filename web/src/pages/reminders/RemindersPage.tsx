import { useEffect, useState, type FormEvent } from 'react'

type Reminder = {
  id: string
  reminderType: string
  scheduleTime: string
  enabled: number
  payloadJson: string | null
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [metricCode, setMetricCode] = useState('general')
  const [time, setTime] = useState('08:00')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reminders', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ reminders: Reminder[] }>
      if (!body.success) { setError(body.error?.message || 'Gagal memuat.'); return }
      setItems(body.data?.reminders || [])
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setMessage(null); setError(null)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricCode, time, label: label || undefined })
      })
      const body = (await res.json()) as ApiResp<{ reminderId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal membuat.'); return }
      setMessage('Pengingat dibuat.')
      setLabel('')
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setSaving(false) }
  }

  async function toggle(item: Reminder) {
    setError(null)
    try {
      const res = await fetch(`/api/reminders/${item.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !(item.enabled === 1) })
      })
      const body = (await res.json()) as ApiResp<{ updated: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal update.'); return }
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function remove(id: string) {
    if (!confirm('Hapus pengingat ini?')) return
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ deleted: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal hapus.'); return }
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="reminders-title">
      <h2 id="reminders-title">Pengingat</h2>
      <p>Atur pengingat otomatis untuk pengukuran Anda.</p>
      <form className="auth-form settings-form" onSubmit={handleCreate}>
        <label>Tipe metrik
          <select onChange={(e) => setMetricCode(e.target.value)} value={metricCode}>
            <option value="general">Umum</option>
            <option value="bodyWeight">Berat badan</option>
            <option value="systolic">Tekanan darah</option>
            <option value="glucoseFasting">Gula darah puasa</option>
          </select>
        </label>
        <label>Waktu (HH:MM)
          <input onChange={(e) => setTime(e.target.value)} required type="time" value={time} />
        </label>
        <label>Label (opsional)
          <input onChange={(e) => setLabel(e.target.value)} type="text" value={label} />
        </label>
        <button disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Tambah Pengingat'}</button>
      </form>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
      {loading ? <p>Memuat...</p> : items.length === 0 ? <p>Belum ada pengingat.</p> : (
        <table className="report-table">
          <thead><tr><th>Tipe</th><th>Waktu</th><th>Label</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {items.map((r) => {
              let parsed: { label?: string } = {}
              try { parsed = r.payloadJson ? JSON.parse(r.payloadJson) : {} } catch { /* ignore */ }
              return (
                <tr key={r.id}>
                  <td>{r.reminderType}</td>
                  <td>{r.scheduleTime}</td>
                  <td>{parsed.label || '—'}</td>
                  <td>{r.enabled === 1 ? 'Aktif' : 'Nonaktif'}</td>
                  <td>
                    <button onClick={() => toggle(r)} type="button">{r.enabled === 1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onClick={() => remove(r.id)} type="button">Hapus</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
