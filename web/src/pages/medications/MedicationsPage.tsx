import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Medication = {
  id: string
  medicationName: string
  dosageText: string
  scheduleText: string
  active: boolean
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [schedule, setSchedule] = useState('Pagi setelah makan')

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/medications', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<Medication[]>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat obat.')
        return
      }
      setMeds(body.data ?? [])
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
      const res = await fetch('/api/medications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationName: name,
          dosageText: dosage,
          scheduleText: schedule,
          active: true
        })
      })
      const body = (await res.json()) as ApiResp<{ medicationId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Gagal menambah obat.')
        return
      }
      setName('')
      setDosage('')
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function logTaken(med: Medication) {
    await fetch(`/api/medications/${med.id}/log`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'taken' })
    })
  }

  async function remove(id: string) {
    const res = await fetch(`/api/medications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="meds-title">
      <div className="auth-copy">
        <p className="eyebrow">Pengaturan</p>
        <h2 id="meds-title">Obat & kepatuhan</h2>
        <p>Catat obat yang diminum rutin untuk melihat pola kepatuhan di dashboard.</p>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          Nama obat
          <input onChange={(e) => setName(e.target.value)} required type="text" value={name} />
        </label>
        <label>
          Dosis (mis. 5 mg)
          <input onChange={(e) => setDosage(e.target.value)} required type="text" value={dosage} />
        </label>
        <label>
          Jadwal (mis. Pagi setelah makan)
          <input onChange={(e) => setSchedule(e.target.value)} required type="text" value={schedule} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Menyimpan...' : 'Tambah obat'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <h3>Daftar obat</h3>
      {meds.length === 0 ? <p>Belum ada obat tercatat.</p> : (
        <ul className="medication-list">
          {meds.map((m) => (
            <li key={m.id} className="medication-item">
              <div>
                <strong>{m.medicationName}</strong> · {m.dosageText}
                <div className="muted">{m.scheduleText}</div>
              </div>
              <div>
                <button onClick={() => logTaken(m)} type="button">Tandai diminum</button>
                <button className="danger" onClick={() => remove(m.id)} type="button">Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MedicationsPage
