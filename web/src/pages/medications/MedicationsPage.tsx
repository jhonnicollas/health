import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type Medication = {
  id: number
  medicationName: string
  dosageText: string
  scheduleText: string
  active: boolean
}

type MedicationLog = {
  id: number
  medicationId: number
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
  const [schedule, setSchedule] = useState('Morning after meal')

  async function load() {
    setError(null)
    try {
      const [medRes, logRes] = await Promise.all([
        fetch('/api/medications', { credentials: 'include' }),
        fetch('/api/medications/logs', { credentials: 'include' })
      ])
      if (!medRes.ok) { setError('Gagal memuat obat.'); return }
      if (!logRes.ok) { setError('Gagal memuat log obat.'); return }
      const medBody = (await medRes.json()) as ApiResp<{ medications: Medication[] }>
      const logBody = (await logRes.json()) as ApiResp<{ logs: MedicationLog[] }>
      if (!medBody.success) {
        setError(medBody.error?.message ?? 'Failed to load medications.')
        return
      }
      if (!logBody.success) {
        setError(logBody.error?.message ?? 'Failed to load medication logs.')
        return
      }
      setMeds(medBody.data?.medications ?? [])
      setLogs(logBody.data?.logs ?? [])
    } catch {
      setError('Could not connect to server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const latestStatusByMedication = useMemo(() => {
    const map = new Map<number, MedicationLog>()
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
      const body = (await res.json()) as ApiResp<{ medicationId: number }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Failed to add medication.')
        return
      }
      setName('')
      setDosage('')
      await load()
    } catch {
      setError('Could not connect to server.')
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
      setError(body.error?.message ?? 'Failed to log medication status.')
      return
    }
    await load()
  }

  async function remove(id: number) {
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
          <h2 id="meds-title">Today's Medication Schedule</h2>
          <p>Log medication status without dosage advice or therapy changes.</p>
        </div>
        <span className="status-chip">{meds.length} meds</span>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>Add Medication</h3>
          <p>Name, dosage text, and schedule appear in the daily checklist.</p>
        </div>
        <label>
          Medication name
          <input onChange={(e) => setName(e.target.value)} required type="text" value={name} />
        </label>
        <label>
          Dosage
          <input onChange={(e) => setDosage(e.target.value)} required type="text" value={dosage} />
        </label>
        <label>
          Schedule
          <input onChange={(e) => setSchedule(e.target.value)} required type="text" value={schedule} />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : 'Add Medication'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>Today's Checklist</h3>
        {meds.length === 0 ? <p>No medications recorded yet.</p> : (
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
                    <span className={`badge-status ${latest?.status === 'taken' ? 'badge-normal' : latest?.status === 'skipped' ? 'badge-warning' : 'badge-info'}`}>
                      <span className="status-dot" />{statusLabel}
                    </span>
                  </div>
                  <div className="button-stack">
                    <button onClick={() => void logStatus(med, 'taken')} type="button">Take</button>
                    <button className="secondary-action" onClick={() => void logStatus(med, 'skipped')} type="button">Skip</button>
                    <button className="danger" onClick={() => void remove(med.id)} type="button">Remove</button>
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
