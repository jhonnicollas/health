/* eslint-disable no-empty */
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/auth'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }
type ConnData = { verificationCode: string; expiresInMinutes: number }
type LinkStatus = { linked: boolean; telegramChatId?: string; enabled?: boolean }

export function TelegramSettingsPage() {
  const { user } = useAuth()
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [verification, setVerification] = useState<ConnData | null>(null)
  const [chatId, setChatId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/telegram/status', { credentials: 'include' }).then(r => r.json()).then(j => {
      if (j.success) setLinkStatus(j.data)
    }).catch(() => {})
  }, [user])

  async function connect() {
    setError(null); setMessage(null); setVerification(null)
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<ConnData>
      if (!body.success) { setError(body.error?.message || 'Failed.'); return }
      setVerification(body.data || null)
    } catch { setError('Could not connect to server.') }
  }

  async function verify() {
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/telegram/verify', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: verification?.verificationCode, telegramChatId: chatId })
      })
      const body = (await res.json()) as ApiResp<{ verified: boolean }>
      if (!body.success) { setError(body.error?.message || 'Verification failed.'); return }
      setMessage('Telegram connected.')
      setLinkStatus({ linked: true })
    } catch { setError('Could not connect to server.') }
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>

  return (
    <section className="settings-panel telegram-page" aria-labelledby="tg-title">
      <div className="telegram-header">
        <div>
          <p className="eyebrow">Sprint 5E</p>
          <h2 id="tg-title">Telegram Inline Hydration</h2>
          <p className="subtitle">Reminder + quick add hidrasi via Telegram setelah 5B stabil.</p>
        </div>
        <span className={`pill ${linkStatus?.linked ? 'success' : 'muted'}`}>{linkStatus?.linked ? 'Linked' : 'Not linked'}</span>
      </div>

      {(error || message) && (
        <p className={error ? 'form-message error' : 'form-message success'} role={error ? 'alert' : 'status'}>
          {error || message}
        </p>
      )}

      {!linkStatus?.linked ? (
        <div className="telegram-connect-grid">
          <div className="tg-card">
            <h3>1. Buat Koneksi</h3>
            <p>Klik tombol di bawah untuk menghasilkan kode verifikasi yang berlaku {verification ? verification.expiresInMinutes : 10} menit.</p>
            <button onClick={connect} type="button" className="tg-primary">Generate Verification Code</button>
          </div>

          {verification ? (
            <div className="tg-card result">
              <h3>Kode Verifikasi</h3>
              <code className="tg-code">{verification.verificationCode}</code>
              <p>Valid selama {verification.expiresInMinutes} menit.</p>
              <p className="tg-hint">Kirim kode ke bot Telegram, atau masukkan Chat ID Anda jika tidak bisa mengakses bot.</p>
            </div>
          ) : null}

          <div className="tg-card">
            <h3>2. Verifikasi Manual (Chat ID)</h3>
            <label className="tg-field">
              <span>Telegram Chat ID</span>
              <input onChange={(e) => setChatId(e.target.value)} placeholder="e.g. 8727919072" value={chatId} />
            </label>
            <button disabled={!verification || !chatId} onClick={verify} type="button" className="tg-primary">Verify</button>
          </div>
        </div>
      ) : (
        <div className="telegram-linked">
          <div className="tg-card">
            <h3>Telegram terhubung</h3>
            <p>Telegram terhubung. Atur preferensi quick add dan pengingat di <a href="/hydration/settings">Pengaturan Hidrasi</a>.</p>
          </div>
        </div>
      )}

      <div className="telegram-demo-grid">
        <div className="tg-card demo">
          <h3>Telegram Message Mock</h3>
          <div className="tg-message">
            <p className="tg-msg-title">💧 Reminder Hidrasi</p>
            <p className="tg-msg-body">Target hari ini: 2.100ml. Saat ini: 1.400ml. Mau tambah log?</p>
            <div className="tg-msg-actions">
              <button type="button" className="tg-action primary">+200ml</button>
              <button type="button" className="tg-action primary">+600ml</button>
              <button type="button" className="tg-action secondary">Buka App</button>
            </div>
          </div>
        </div>

        <div className="tg-card security">
          <h3>Security &amp; Idempotency</h3>
          <div className="tg-security-grid">
            <div className="tg-security-item"><p className="tg-s-title">Secret validation</p><p className="tg-s-body">Webhook secret tidak pernah tampil di UI.</p></div>
            <div className="tg-security-item"><p className="tg-s-title">Duplicate callback safe</p><p className="tg-s-body">Callback idempotency key mencegah double log.</p></div>
            <div className="tg-security-item"><p className="tg-s-title">Water log stored</p><p className="tg-s-body">+200/+600 masuk hydration history.</p></div>
            <div className="tg-security-item"><p className="tg-s-title">Message edit/failure</p><p className="tg-s-body">Edit berhasil atau failure tercatat audit.</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
