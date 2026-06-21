import { useEffect, useState, type FormEvent } from 'react'

type Medication = {
  id: string
  medicationName: string
  dosageText: string | null
  scheduleText: string | null
  active: number
}

type Log = {
  id: string
  medicationId: string
  medicationName: string
  takenAt: string
  status: string
  note: string | null
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [adherence, setAdherence] = useState<{ date: string; adherence: number; taken: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [schedule, setSchedule] = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const [m, l, a] = await Promise.all([
        fetch('/api/medications', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/medications/logs', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/medications/adherence', { credentials: 'include' }).then(r => r.json())
      ]) as [ApiResp<{ medications: Medication[] }>, ApiResp<{ logs: Log[] }>, ApiResp<{ date: string; adherence: number; taken: number; total: number }>]
      if (m.success) setMeds(m.data?.medications || [])
      if (l.success) setLogs(l.data?.logs || [])
      if (a.success) setAdherence(a.data || null)
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(null); setError(null)
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationName: name, dosageText: dosage || undefined, scheduleText: schedule || undefined, active: true })
      })
      const body = (await res.json()) as ApiResp<{ medicationId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setName(''); setDosage(''); setSchedule('')
      setMessage('Obat ditambahkan.')
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function toggleActive(m: Medication) {
    try {
      const res = await fetch(`/api/medications/${m.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !(m.active === 1) })
      })
      const body = (await res.json()) as ApiResp<{ updated: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function logDose(medicationId: string, status: 'taken' | 'skipped' | 'missed') {
    try {
      const res = await fetch(`/api/medications/${medicationId}/log`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const body = (await res.json()) as ApiResp<{ logId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage(`Status obat: ${status}.`)
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="meds-title">
      <h2 id="meds-title">Manajemen Obat</h2>
      <p>Catat obat Anda dan dosis harian untuk melihat kepatuhan.</p>
      <form className="auth-form settings-form" onSubmit={handleCreate}>
        <label>Nama obat<input onChange={(e) => setName(e.target.value)} required value={name} /></label>
        <label>Dosis (contoh: 500 mg)<input onChange={(e) => setDosage(e.target.value)} value={dosage} /></label>
        <label>Jadwal (contoh: 2x sehari)<input onChange={(e) => setSchedule(e.target.value)} value={schedule} /></label>
        <button type="submit">Tambah Obat</button>
      </form>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
      {adherence ? <p><strong>Kepatuhan 7 hari:</strong> {adherence.adherence}% ({adherence.taken}/{adherence.total})</p> : null}
      {loading ? <p>Memuat...</p> : meds.length === 0 ? <p>Belum ada obat.</p> : (
        <table className="report-table">
          <thead><tr><th>Nama</th><th>Dosis</th><th>Jadwal</th><th>Aksi</th></tr></thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id}>
                <td>{m.medicationName}</td>
                <td>{m.dosageText || '—'}</td>
                <td>{m.scheduleText || '—'}</td>
                <td>
                  <button onClick={() => logDose(m.id, 'taken')} type="button">Diminum</button>
                  <button onClick={() => logDose(m.id, 'skipped')} type="button">Dilewati</button>
                  <button onClick={() => logDose(m.id, 'missed')} type="button">Terlewat</button>
                  <button onClick={() => toggleActive(m)} type="button">{m.active === 1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Log 30 Hari Terakhir</h3>
      {logs.length === 0 ? <p>Belum ada log.</p> : (
        <table className="report-table">
          <thead><tr><th>Waktu</th><th>Obat</th><th>Status</th><th>Catatan</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.takenAt}</td>
                <td>{l.medicationName}</td>
                <td>{l.status}</td>
                <td>{l.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
