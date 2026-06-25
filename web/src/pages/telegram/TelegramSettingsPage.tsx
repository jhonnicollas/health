import { useState, useEffect } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }
type ConnData = { verificationCode: string; expiresInMinutes: number }
type LinkStatus = { linked: boolean; telegramChatId?: string; enabled?: boolean }

export function TelegramSettingsPage() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [verification, setVerification] = useState<ConnData | null>(null)
  const [chatId, setChatId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/telegram/status', { credentials: 'include' }).then(r => r.json()).then(j => {
      if (j.success) setLinkStatus(j.data)
    }).catch(() => {})
  }, [])

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

  return (
    <section className="settings-panel" aria-labelledby="tg-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Integration</p>
          <h2 id="tg-title">Telegram</h2>
          <p>Manage your Telegram connection.</p>
        </div>
        <span className="status-chip">{linkStatus?.linked ? 'Linked' : 'Not linked'}</span>
      </div>
      {!linkStatus?.linked ? (
        <>
          <div className="settings-card">
            <h3>1. Create Connection</h3>
            <button onClick={connect} type="button">Generate Verification Code</button>
          </div>
          {verification ? (
            <div className="result-card">
              <p>Your verification code (valid for {verification.expiresInMinutes} minutes): <code>{verification.verificationCode}</code></p>
              <p>Method 1: Open our Telegram bot and send this code.</p>
              <p>Method 2 (if bot access is unavailable): Enter your Telegram chat ID below.</p>
            </div>
          ) : null}
          <div className="settings-card">
            <h3>2. Manual Verification (Chat ID)</h3>
            <label>Your Telegram Chat ID<input onChange={(e) => setChatId(e.target.value)} placeholder="e.g. 8727919072" value={chatId} /></label>
            <button disabled={!verification || !chatId} onClick={verify} type="button">Verify</button>
          </div>
        </>
      ) : (
        <div className="settings-card">
          <h3>Linked</h3>
          <p>Telegram terhubung. Atur preferensi quick add dan pengingat di <a href="/hydration/settings">Pengaturan Hidrasi</a>.</p>
        </div>
      )}
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
    </section>
  )
}
