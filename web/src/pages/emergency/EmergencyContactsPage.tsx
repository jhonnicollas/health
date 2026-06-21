import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type EmergencyContact = {
  id: string
  contactName: string
  contactRelation: string
  contactPhone: string
  contactEmail?: string
  telegramChatId?: string
  consentGiven: boolean
  enabled: boolean
}

type ApiResp<T> = {
  success: boolean
  data?: T
  error?: { message: string }
}

type RawEmergencyContact = EmergencyContact & { name?: string; relationship?: string; phone?: string }

type EmergencyContactsPayload = RawEmergencyContact[] | { contacts?: RawEmergencyContact[] }

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactRelation, setContactRelation] = useState('Spouse')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [consent, setConsent] = useState(false)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/emergency/contacts', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<EmergencyContactsPayload>
      if (!body.success) {
        setError(body.error?.message ?? 'Failed to load emergency contacts.')
        return
      }
      const rows: RawEmergencyContact[] = Array.isArray(body.data) ? body.data : body.data?.contacts ?? []
      setContacts(rows.map((contact) => ({
        ...contact,
        contactName: contact.contactName ?? contact.name ?? '',
        contactRelation: contact.contactRelation ?? contact.relationship ?? '',
        contactPhone: contact.contactPhone ?? contact.phone ?? '',
        consentGiven: Boolean(contact.consentGiven),
        enabled: contact.enabled ?? true
      })))
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
      const res = await fetch('/api/emergency/contacts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName,
          contactRelation,
          contactPhone,
          contactEmail,
          telegramChatId,
          consentGiven: consent,
          enabled: true
        })
      })
      const body = (await res.json()) as ApiResp<{ contactId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Failed to add contact.')
        return
      }
      setContactName('')
      setContactPhone('')
      await load()
    } catch {
      setError('Could not connect to server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/emergency/contacts/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) await load()
  }

  return (
    <section className="settings-panel" aria-labelledby="emergency-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Emergency</p>
          <h2 id="emergency-title">Emergency Contacts</h2>
          <p>Register contacts who will receive notifications during emergency conditions.</p>
        </div>
        <span className="status-chip">{contacts.length} contacts</span>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-heading">
          <h3>New Contact</h3>
          <p>Emergency notifications are only sent when consent is active.</p>
        </div>
        <label>
          Name
          <input onChange={(e) => setContactName(e.target.value)} required type="text" value={contactName} />
        </label>
        <label>
          Relationship
          <input onChange={(e) => setContactRelation(e.target.value)} required type="text" value={contactRelation} />
        </label>
        <label>
          Phone number
          <input onChange={(e) => setContactPhone(e.target.value)} required type="tel" value={contactPhone} />
        </label>
        <label>
          Email (optional)
          <input onChange={(e) => setContactEmail(e.target.value)} type="email" value={contactEmail} />
        </label>
        <label>
          Telegram chat ID (optional)
          <input onChange={(e) => setTelegramChatId(e.target.value)} type="text" value={telegramChatId} />
        </label>
        <label className="checkbox-row">
          <input checked={consent} onChange={(e) => setConsent(e.target.checked)} type="checkbox" />
          I have obtained this contact's consent to receive emergency notifications.
        </label>
        <button disabled={submitting || !consent} type="submit">
          {submitting ? 'Saving...' : 'Add Contact'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <div className="settings-card">
        <h3>Registered Contacts</h3>
        {contacts.length === 0 ? <p>No emergency contacts yet.</p> : (
          <ul className="emergency-list">
            {contacts.map((c) => (
              <li key={c.id} className="emergency-item">
                <div>
                  <strong>{c.contactName}</strong> · {c.contactRelation} · {c.contactPhone}
                  {c.telegramChatId ? <div className="muted">Telegram: {c.telegramChatId}</div> : null}
                </div>
                <button className="danger" onClick={() => remove(c.id)} type="button">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default EmergencyContactsPage
