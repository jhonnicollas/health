import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type Medication = {
  id: string
  medicationName: string
  dosageText: string
  scheduleText: string
  active: boolean
}

type MedicationLog = {
  id: string
  medicationId: string
  medicationName: string
  takenAt: string
  status: 'taken' | 'skipped' | 'missed' | 'unknown'
  note?: string | null
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([])
  const [logs, setLogs] = useState<MedicationLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [schedule, setSchedule] = useState('Pagi setelah makan')

  async function load() {
    setError(null)
    try {
      const [medRes, logRes] = await Promise.all([
        fetch('/api/medications', { credentials: 'include' }),
        fetch('/api/medications/logs', { credentials: 'include' })
      ])
      const medBody = (await medRes.json()) as ApiResp<{ medications: Medication[] }>
      const logBody = (await logRes.json()) as ApiResp<{ logs: MedicationLog[] }>
      if (!medBody.success) {
        setError(medBody.error?.message ?? 'Gagal memuat obat.')
        return
      }
      if (!logBody.success) {
        setError(logBody.error?.message ?? 'Gagal memuat log obat.')
        return
      }
      setMeds(medBody.data?.medications ?? [])
      setLogs(logBody.data?.logs ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const latestStatusByMedication = useMemo(() => {
    const map = new Map<string, MedicationLog>()
    for (const log of logs) {
      if (!map.has(log.medicationId)) map.set(log.medicationId, log)
    }
    return map
  }, [logs])

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

  async function logStatus(med: Medication, status: 'taken' | 'skipped') {
    setError(null)
    const res = await fetch(`/api/medications/${med.id}/log`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, takenAt: new Date().toISOString() })
    })
    const body = (await res.json()) as ApiResp<{ logId: string }>
    if (!res.ok || !body.success) {
      setError(body.error?.message ?? 'Gagal mencatat status obat.')
      return
    }
    await load()
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tracker</p>
          <h2 id="meds-title">Jadwal obat hari ini</h2>
          <p>Catat status obat tanpa saran dosis atau perubahan terapi.</p>
        </div>
        <span className="status-chip">{meds.length} obat</span>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>Tambah obat</h3>
          <p>Nama, dosis teks, dan jadwal tampil di checklist harian.</p>
        </div>
        <label>
          Nama obat
          <input onChange={(e) => setName(e.target.value)} required type="text" value={name} />
        </label>
        <label>
          Dosis
          <input onChange={(e) => setDosage(e.target.value)} required type="text" value={dosage} />
        </label>
        <label>
          Jadwal
          <input onChange={(e) => setSchedule(e.target.value)} required type="text" value={schedule} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Menyimpan...' : 'Tambah obat'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>Checklist hari ini</h3>
        {meds.length === 0 ? <p>Belum ada obat tercatat.</p> : (
          <ul className="medication-list">
            {meds.map((med) => {
              const latest = latestStatusByMedication.get(med.id)
              const statusLabel =
                latest?.status === 'taken'
                  ? 'Completed'
                  : latest?.status === 'skipped'
                    ? 'Skipped'
                    : 'Pending'
              return (
                <li key={med.id} className="medication-item">
                  <div>
                    <strong>{med.medicationName}</strong> · {med.dosageText}
                    <div className="muted">{med.scheduleText}</div>
                    <div className={`status-chip ${latest?.status === 'skipped' ? 'warning' : ''}`}>{statusLabel}</div>
                  </div>
                  <div className="button-stack">
                    <button onClick={() => void logStatus(med, 'taken')} type="button">Take</button>
                    <button className="secondary-action" onClick={() => void logStatus(med, 'skipped')} type="button">Skip</button>
                    <button className="danger" onClick={() => void remove(med.id)} type="button">Hapus</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default MedicationsPage
