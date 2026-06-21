import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type FamilyLink = {
  id: string
  ownerUserId: string
  linkedUserId: string
  role: 'viewer' | 'caregiver'
  status: string
  canViewDashboard: boolean
  canInputMeasurement: boolean
  canReceiveAlert: boolean
  createdAt: string
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

export function FamilyPage() {
  const [owned, setOwned] = useState<FamilyLink[]>([])
  const [linkedToMe, setLinkedToMe] = useState<FamilyLink[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'caregiver'>('viewer')

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/family/links', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ ownedLinks: FamilyLink[]; linkedToMe: FamilyLink[] }>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat daftar keluarga.')
        return
      }
      setOwned(body.data?.ownedLinks ?? [])
      setLinkedToMe(body.data?.linkedToMe ?? [])
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteEmail: email,
          role,
          permissions: {
            canViewDashboard: true,
            canInputMeasurement: role === 'caregiver',
            canReceiveAlert: role === 'caregiver'
          },
          expiresInDays: 7
        })
      })
      const body = (await res.json()) as ApiResp<{ inviteId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Gagal mengirim undangan.')
        return
      }
      setEmail('')
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/family/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="family-title">
      <div className="auth-copy">
        <p className="eyebrow">Pengaturan</p>
        <h2 id="family-title">Keluarga & caregiver</h2>
        <p>Undang anggota keluarga atau caregiver untuk memantau kesehatan Anda.</p>
      </div>

      <form className="auth-form" onSubmit={handleInvite}>
        <label>
          Email undangan
          <input onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
        </label>
        <label>
          Role
          <select onChange={(e) => setRole(e.target.value as 'viewer' | 'caregiver')} value={role}>
            <option value="viewer">Viewer (keluarga)</option>
            <option value="caregiver">Caregiver</option>
          </select>
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Mengirim...' : 'Undang'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <h3>Daftar yang Anda undang</h3>
      {owned.length === 0 ? <p>Belum ada undangan terkirim.</p> : (
        <ul className="family-list">
          {owned.map((l) => (
            <li key={l.id} className="family-item">
              <div>
                <strong>{l.linkedUserId}</strong> · {l.role} · {l.status}
              </div>
              <button className="danger" onClick={() => remove(l.id)} type="button">Cabut</button>
            </li>
          ))}
        </ul>
      )}

      <h3>Yang merawat Anda</h3>
      {linkedToMe.length === 0 ? <p>Belum ada caregiver terhubung.</p> : (
        <ul className="family-list">
          {linkedToMe.map((l) => (
            <li key={l.id} className="family-item">
              <strong>{l.ownerUserId}</strong> · {l.role}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default FamilyPage
