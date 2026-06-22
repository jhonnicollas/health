import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

const PHONE_RE = /^[\d+\-\s()]{6,20}$/
const TG_USER_RE = /^@?[A-Za-z0-9_]{4,32}$/
const TG_NUM_RE = /^-?\d{5,15}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type EmergencyContact = {
  id: number
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

function validatePhone(v: string): string | null {
  if (!v.trim()) return 'Nomor telepon wajib diisi.'
  if (!PHONE_RE.test(v.trim())) return 'Nomor telepon tidak valid. Hanya angka, +, -, spasi, tanda kurung.'
  return null
}

function validateTelegram(v: string): string | null {
  if (!v.trim()) return null
  const trimmed = v.trim()
  if (trimmed.startsWith('@')) {
    if (!TG_USER_RE.test(trimmed)) return 'Username Telegram harus 4-32 karakter (huruf, angka, underscore).'
  } else if (!TG_NUM_RE.test(trimmed)) {
    return 'ID Telegram harus angka 5-15 digit, atau mulai dengan @ untuk username.'
  }
  return null
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return null
  if (!EMAIL_RE.test(v.trim())) return 'Format email tidak valid.'
  return null
}

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactRelation, setContactRelation] = useState('Spouse')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [consent, setConsent] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; email?: string; telegram?: string }>({})
  const [touched, setTouched] = useState<{ phone?: boolean; email?: boolean; telegram?: boolean }>({})

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
    const phoneErr = validatePhone(contactPhone)
    const emailErr = validateEmail(contactEmail)
    const tgErr = validateTelegram(telegramChatId)
    setFieldErrors({ phone: phoneErr || undefined, email: emailErr || undefined, telegram: tgErr || undefined })
    setTouched({ phone: true, email: true, telegram: true })
    if (phoneErr || emailErr || tgErr) {
      setError('Perbaiki field yang ditandai sebelum menyimpan.')
      return
    }
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
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim() || undefined,
          telegramChatId: telegramChatId.trim() || undefined,
          consentGiven: consent,
          enabled: true
        })
      })
      const body = (await res.json()) as ApiResp<{ contactId: string }>
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Failed to add contact.')
        return
      }
      // Auto-send a test notification if telegramChatId present
      if (telegramChatId.trim()) {
        try {
          await fetch('/api/telegram/test', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: telegramChatId.trim(), message: 'Halo dari HL Health Companion. Kontak darurat Anda sudah terdaftar.' })
          })
          setTestStatus('Telegram test terkirim ke ' + telegramChatId.trim())
        } catch {
          setTestStatus('Kontak tersimpan, tapi test Telegram gagal.')
        }
      }
      setContactName('')
      setContactPhone('')
      setContactEmail('')
      setTelegramChatId('')
      setFieldErrors({})
      setTouched({})
      await load()
    } catch {
      setError('Could not connect to server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendTestNotification(contact: EmergencyContact) {
    setTestStatus(`Mengirim test ke ${contact.contactName}...`)
    try {
      if (contact.telegramChatId) {
        const res = await fetch('/api/telegram/test', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: contact.telegramChatId, message: 'Test notifikasi darurat dari HL Health Companion.' })
        })
        const body = (await res.json().catch(() => null)) as { success?: boolean; error?: { message: string } } | null
        setTestStatus(body?.success ? `Test Telegram ke ${contact.contactName} berhasil.` : `Gagal: ${body?.error?.message ?? 'Tidak bisa mengirim.'}`)
      } else {
        setTestStatus('Kontak ini belum punya Telegram chat ID. Isi dulu.')
      }
    } catch {
      setTestStatus('Tidak bisa terhubung ke server.')
    }
  }

  async function toggleConsent(id: number, consentGiven: boolean) {
    try {
      await fetch(`/api/emergency/contacts/${id}/consent`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentGiven })
      })
      await load()
    } catch { /* ignore */ }
  }

  async function remove(id: number) {
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
          <input
            onChange={(e) => { setContactPhone(e.target.value); if (touched.phone) setFieldErrors(prev => ({ ...prev, phone: validatePhone(e.target.value) || undefined })) }}
            onBlur={() => { setTouched(t => ({ ...t, phone: true })); setFieldErrors(prev => ({ ...prev, phone: validatePhone(contactPhone) || undefined })) }}
            required
            inputMode="tel"
            className={touched.phone && fieldErrors.phone ? 'field-error-input' : ''}
            type="tel"
            value={contactPhone}
          />
          {touched.phone && fieldErrors.phone ? <small className="form-message error">{fieldErrors.phone}</small> : null}
        </label>
        <label>
          Email (optional)
          <input
            onChange={(e) => { setContactEmail(e.target.value); if (touched.email) setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) || undefined })) }}
            onBlur={() => { setTouched(t => ({ ...t, email: true })); setFieldErrors(prev => ({ ...prev, email: validateEmail(contactEmail) || undefined })) }}
            inputMode="email"
            className={touched.email && fieldErrors.email ? 'field-error-input' : ''}
            type="email"
            value={contactEmail}
          />
          {touched.email && fieldErrors.email ? <small className="form-message error">{fieldErrors.email}</small> : null}
        </label>
        <label>
          Telegram chat ID (optional)
          <input
            onChange={(e) => { setTelegramChatId(e.target.value); if (touched.telegram) setFieldErrors(prev => ({ ...prev, telegram: validateTelegram(e.target.value) || undefined })) }}
            onBlur={() => { setTouched(t => ({ ...t, telegram: true })); setFieldErrors(prev => ({ ...prev, telegram: validateTelegram(telegramChatId) || undefined })) }}
            inputMode="numeric"
            placeholder="contoh: @username atau 8727919072"
            className={touched.telegram && fieldErrors.telegram ? 'field-error-input' : ''}
            type="text"
            value={telegramChatId}
          />
          {touched.telegram && fieldErrors.telegram ? <small className="form-message error">{fieldErrors.telegram}</small> : <small className="muted">Username (@...) atau numeric chat ID (5-15 digit).</small>}
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
                  {c.contactEmail ? <div className="muted">Email: {c.contactEmail}</div> : null}
                  {c.telegramChatId ? <div className="muted">Telegram: {c.telegramChatId}</div> : null}
                  <div className="consent-toggle-row">
                    <label className="checkbox-row compact">
                      <input checked={c.consentGiven} onChange={(e) => toggleConsent(c.id, e.target.checked)} type="checkbox" />
                      Alert consent active
                    </label>
                  </div>
                </div>
                <div className="action-row">
                  <button onClick={() => void sendTestNotification(c)} type="button">Test Send</button>
                  <button className="danger" onClick={() => remove(c.id)} type="button">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {testStatus ? <p className="form-message success" role="status">{testStatus}</p> : null}
    </section>
  )
}

export default EmergencyContactsPage
