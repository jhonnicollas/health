import { useEffect, useState, type FormEvent } from 'react'

type Link = {
  id: string
  linkedUserId?: string
  linkedDisplayName?: string
  ownerUserId?: string
  ownerDisplayName?: string
  role: string
  status: string
  canViewDashboard: number
  canInputMeasurement: number
  canReceiveAlert: number
}

type Invite = { inviteId: string; inviteUrl: string; shareToken: string; expiresAt: string }

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function FamilyPage() {
  const [ownedLinks, setOwnedLinks] = useState<Link[]>([])
  const [linkedToMe, setLinkedToMe] = useState<Link[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('caregiver')
  const [lastInvite, setLastInvite] = useState<Invite | null>(null)
  const [acceptToken, setAcceptToken] = useState('')

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/family/links', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ ownedLinks: Link[]; linkedToMe: Link[] }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setOwnedLinks(body.data?.ownedLinks || [])
      setLinkedToMe(body.data?.linkedToMe || [])
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  useEffect(() => { void load() }, [])

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setMessage(null)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'unknown@example.com', role })
      })
      const body = (await res.json()) as ApiResp<Invite>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setLastInvite(body.data || null)
      setMessage('Invite dibuat. Bagikan tautan ke anggota keluarga.')
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function handleAccept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setMessage(null)
    try {
      const res = await fetch('/api/family/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: acceptToken })
      })
      const body = (await res.json()) as ApiResp<{ linkId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage('Anda sudah terhubung ke anggota keluarga.')
      setAcceptToken('')
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function updatePerms(id: string, canViewDashboard: number, canInputMeasurement: number, canReceiveAlert: number) {
    try {
      const res = await fetch(`/api/family/members/${id}/permissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canRead: canViewDashboard, canWrite: canInputMeasurement, canEmergency: canReceiveAlert })
      })
      const body = (await res.json()) as ApiResp<{ updated: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="family-title">
      <h2 id="family-title">Keluarga &amp; Caregiver</h2>
      <form className="auth-form settings-form" onSubmit={handleInvite}>
        <h3>Undang Anggota Keluarga</h3>
        <label>Email<input onChange={(e) => setEmail(e.target.value)} placeholder="opsional" value={email} /></label>
        <label>Peran
          <select onChange={(e) => setRole(e.target.value)} value={role}>
            <option value="caregiver">Caregiver</option>
            <option value="family">Keluarga</option>
          </select>
        </label>
        <button type="submit">Buat Invite</button>
      </form>
      {lastInvite ? (
        <p>Tautan invite (beri ke anggota keluarga): <code>{lastInvite.inviteUrl}</code><br />Token: <code>{lastInvite.shareToken}</code> (berlaku sampai {lastInvite.expiresAt})</p>
      ) : null}
      <form className="auth-form settings-form" onSubmit={handleAccept}>
        <h3>Terima Invite</h3>
        <label>Token<input onChange={(e) => setAcceptToken(e.target.value)} required value={acceptToken} /></label>
        <button type="submit">Terima</button>
      </form>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
      <h3>Anggota yang terhubung ke saya</h3>
      {ownedLinks.length === 0 ? <p>Belum ada anggota.</p> : (
        <table className="report-table">
          <thead><tr><th>Nama</th><th>Peran</th><th>View</th><th>Input</th><th>Alert</th></tr></thead>
          <tbody>
            {ownedLinks.map((l) => (
              <tr key={l.id}>
                <td>{l.linkedDisplayName || l.linkedUserId || '—'}</td>
                <td>{l.role}</td>
                <td><input checked={l.canViewDashboard === 1} onChange={(e) => updatePerms(l.id, e.target.checked ? 1 : 0, l.canInputMeasurement, l.canReceiveAlert)} type="checkbox" /></td>
                <td><input checked={l.canInputMeasurement === 1} onChange={(e) => updatePerms(l.id, l.canViewDashboard, e.target.checked ? 1 : 0, l.canReceiveAlert)} type="checkbox" /></td>
                <td><input checked={l.canReceiveAlert === 1} onChange={(e) => updatePerms(l.id, l.canViewDashboard, l.canInputMeasurement, e.target.checked ? 1 : 0)} type="checkbox" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Saya terhubung sebagai caregiver ke</h3>
      {linkedToMe.length === 0 ? <p>Belum ada.</p> : (
        <ul>{linkedToMe.map((l) => <li key={l.id}>{l.ownerDisplayName || l.ownerUserId} ({l.role})</li>)}</ul>
      )}
    </section>
  )
}
