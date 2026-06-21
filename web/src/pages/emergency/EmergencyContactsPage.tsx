import { useEffect, useState, type FormEvent } from 'react'

type Contact = {
  id: string
  name: string
  phone: string
  relationship: string | null
  createdAt: string
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function EmergencyContactsPage() {
  const [items, setItems] = useState<Contact[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/emergency/contacts', { credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ contacts: Contact[] }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setItems(body.data?.contacts || [])
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setMessage(null)
    try {
      const res = await fetch('/api/emergency/contacts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, relationship: relationship || undefined })
      })
      const body = (await res.json()) as ApiResp<{ contactId: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setName(''); setPhone(''); setRelationship('')
      setMessage('Kontak darurat ditambahkan.')
      await load()
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="emc-title">
      <h2 id="emc-title">Kontak Darurat</h2>
      <p>Kontak ini akan dinotifikasi saat terdeteksi nilai darurat (jika Anda memberikan persetujuan).</p>
      <form className="auth-form settings-form" onSubmit={handleCreate}>
        <label>Nama<input onChange={(e) => setName(e.target.value)} required value={name} /></label>
        <label>Telepon (mis. +6281234567890)<input onChange={(e) => setPhone(e.target.value)} required value={phone} /></label>
        <label>Hubungan (opsional)<input onChange={(e) => setRelationship(e.target.value)} value={relationship} /></label>
        <button type="submit">Tambah Kontak</button>
      </form>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
      {items.length === 0 ? <p>Belum ada kontak.</p> : (
        <table className="report-table">
          <thead><tr><th>Nama</th><th>Telepon</th><th>Hubungan</th><th>Dibuat</th></tr></thead>
          <tbody>{items.map(c => (
            <tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td>{c.relationship || '—'}</td><td>{c.createdAt}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}
