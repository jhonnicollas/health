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

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactRelation, setContactRelation] = useState('Pasangan')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [consent, setConsent] = useState(false)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/emergency/contacts', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<EmergencyContact[]>
      if (!body.success) {
        setError(body.error?.message ?? 'Gagal memuat kontak darurat.')
        return
      }
      setContacts(body.data ?? [])
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
        setError(body.error?.message ?? 'Gagal menambah kontak.')
        return
      }
      setContactName('')
      setContactPhone('')
      await load()
    } catch {
      setError('Tidak bisa terhubung ke server.')
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
      <div className="auth-copy">
        <p className="eyebrow">Darurat</p>
        <h2 id="emergency-title">Kontak darurat</h2>
        <p>Daftarkan kontak yang akan menerima notifikasi saat kondisi darurat.</p>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          Nama
          <input onChange={(e) => setContactName(e.target.value)} required type="text" value={contactName} />
        </label>
        <label>
          Hubungan
          <input onChange={(e) => setContactRelation(e.target.value)} required type="text" value={contactRelation} />
        </label>
        <label>
          Nomor telepon
          <input onChange={(e) => setContactPhone(e.target.value)} required type="tel" value={contactPhone} />
        </label>
        <label>
          Email (opsional)
          <input onChange={(e) => setContactEmail(e.target.value)} type="email" value={contactEmail} />
        </label>
        <label>
          Telegram chat ID (opsional)
          <input onChange={(e) => setTelegramChatId(e.target.value)} type="text" value={telegramChatId} />
        </label>
        <label className="checkbox-row">
          <input checked={consent} onChange={(e) => setConsent(e.target.checked)} type="checkbox" />
          Saya telah mendapat persetujuan kontak untuk menerima notifikasi darurat.
        </label>
        <button disabled={submitting || !consent} type="submit">
          {submitting ? 'Menyimpan...' : 'Tambah kontak'}
        </button>
        {error ? <p className="form-message error" role="status">{error}</p> : null}
      </form>

      <h3>Kontak terdaftar</h3>
      {contacts.length === 0 ? <p>Belum ada kontak darurat.</p> : (
        <ul className="emergency-list">
          {contacts.map((c) => (
            <li key={c.id} className="emergency-item">
              <div>
                <strong>{c.contactName}</strong> · {c.contactRelation} · {c.contactPhone}
                {c.telegramChatId ? <div className="muted">Telegram: {c.telegramChatId}</div> : null}
              </div>
              <button className="danger" onClick={() => remove(c.id)} type="button">Hapus</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default EmergencyContactsPage
