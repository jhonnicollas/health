import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type FamilyLink = {
  id: number
  ownerUserId?: string
  linkedUserId?: string | null
  linkedDisplayName?: string | null
  ownerDisplayName?: string | null
  inviteEmail?: string | null
  role: 'viewer' | 'caregiver'
  status: string
  canViewDashboard: boolean
  canInputMeasurement: boolean
  canReceiveAlert: boolean
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
  const [canViewDashboard, setCanViewDashboard] = useState(true)
  const [canInputMeasurement, setCanInputMeasurement] = useState(false)
  const [canReceiveAlert, setCanReceiveAlert] = useState(true)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/family/links', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ ownedLinks: FamilyLink[]; linkedToMe: FamilyLink[] }>
      if (!body.success) {
        setError(body.error?.message ?? 'Failed to load family links.')
        return
      }
      setOwned(body.data?.ownedLinks ?? [])
      setLinkedToMe(body.data?.linkedToMe ?? [])
    } catch {
      setError('Could not connect to server.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const pendingInvites = useMemo(() => owned.filter((item) => item.status === 'pending'), [owned])
  const activeLinks = useMemo(() => owned.filter((item) => item.status !== 'pending'), [owned])

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
            canViewDashboard,
            canInputMeasurement,
            canReceiveAlert
          }
        })
      })
      const body = (await res.json()) as ApiResp<{ inviteId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Failed to send invitation.')
        return
      }
      setEmail('')
      await load()
    } catch {
      setError('Could not connect to server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function revoke(id: number) {
    const res = await fetch(`/api/family/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="family-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Care Network</p>
          <h2 id="family-title">Family & Caregivers</h2>
          <p>Manage granular permissions for dashboard access, data input, and alert delivery.</p>
        </div>
        <span className="status-chip">{owned.length + linkedToMe.length} links</span>
      </div>

      <form className="auth-form" onSubmit={handleInvite}>
        <div className="form-heading">
          <h3>Send Invitation</h3>
          <p>Send an invite with predefined permissions before it is accepted.</p>
        </div>
        <label>
          Invite email
          <input onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
        </label>
        <label>
          Role
          <select
            onChange={(e) => {
              const nextRole = e.target.value as 'viewer' | 'caregiver'
              setRole(nextRole)
              if (nextRole === 'viewer') setCanInputMeasurement(false)
            }}
            value={role}
          >
            <option value="viewer">Viewer</option>
            <option value="caregiver">Caregiver</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input checked={canViewDashboard} onChange={(e) => setCanViewDashboard(e.target.checked)} type="checkbox" />
          Allow dashboard access
        </label>
        <label className="checkbox-row">
          <input checked={canInputMeasurement} onChange={(e) => setCanInputMeasurement(e.target.checked)} type="checkbox" />
          Allow measurement input
        </label>
        <label className="checkbox-row">
          <input checked={canReceiveAlert} onChange={(e) => setCanReceiveAlert(e.target.checked)} type="checkbox" />
          Allow alert delivery
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? 'Sending...' : 'Send Invitation Link'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>Pending Invitations</h3>
        {pendingInvites.length === 0 ? <p>No pending invitations.</p> : (
          <ul className="family-list">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="family-item">
                <div>
                  <strong>{invite.inviteEmail || invite.linkedDisplayName || 'Pending invite'}</strong>
                  <div className="muted">{invite.role} · view {String(invite.canViewDashboard)} · input {String(invite.canInputMeasurement)}</div>
                </div>
                <div className="button-stack">
                  <span className="status-chip warning">Pending</span>
                  <button className="danger" onClick={() => void revoke(invite.id)} type="button">Revoke Invite</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card">
        <h3>Active Links</h3>
        {activeLinks.length === 0 ? <p>No active caregiver links.</p> : (
          <ul className="family-list">
            {activeLinks.map((link) => (
              <li key={link.id} className="family-item">
                <div>
                  <strong>{link.linkedDisplayName || link.linkedUserId || 'User'}</strong>
                  <div className="muted">{link.role} · {link.status}</div>
                </div>
                <button className="danger" onClick={() => void revoke(link.id)} type="button">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card">
        <h3>Who Cares for You</h3>
        {linkedToMe.length === 0 ? <p>No linked caregivers yet.</p> : (
          <ul className="family-list">
            {linkedToMe.map((link) => (
              <li key={link.id} className="family-item">
                <strong>{link.ownerDisplayName || link.ownerUserId || 'Account owner'}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default FamilyPage
