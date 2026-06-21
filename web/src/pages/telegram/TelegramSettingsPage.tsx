import { useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type ConnData = { verificationCode: string; expiresInMinutes: number }

export function TelegramSettingsPage() {
  const [verification, setVerification] = useState<ConnData | null>(null)
  const [chatId, setChatId] = useState('')
  const [submitEnabled, setSubmitEnabled] = useState(true)
  const [emergencyEnabled, setEmergencyEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

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
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: verification?.verificationCode, telegramChatId: chatId })
      })
      const body = (await res.json()) as ApiResp<{ verified: boolean }>
      if (!body.success) { setError(body.error?.message || 'Verification failed.'); return }
      setMessage('Telegram connected.')
    } catch { setError('Could not connect to server.') }
  }

  async function saveSettings() {
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/telegram/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramSubmitSummary: submitEnabled, telegramEmergencyAlert: emergencyEnabled })
      })
      const body = (await res.json()) as ApiResp<{ updated: boolean }>
      if (!body.success) { setError(body.error?.message || 'Failed.'); return }
      setMessage('Settings saved.')
    } catch { setError('Could not connect to server.') }
  }

  async function test() {
    setError(null); setTestResult(null)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ sent: boolean; error?: string }>
      if (!body.success) { setError(body.error?.message || 'Test failed.'); return }
      setTestResult(body.data?.sent ? 'Sent!' : `Not sent: ${body.data?.error}`)
    } catch { setError('Could not connect to server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="tg-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Integration</p>
          <h2 id="tg-title">Telegram</h2>
          <p>Manage your Telegram connection and notification preferences.</p>
        </div>
        <span className="status-chip">{verification ? 'Code active' : 'Not verified'}</span>
      </div>
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
      <div className="settings-card">
        <h3>3. Test Notification</h3>
        <button onClick={test} type="button">Send Test</button>
      </div>
      {testResult ? <p>{testResult}</p> : null}
      <div className="settings-card">
        <h3>4. Notification Preferences</h3>
        <label className="checkbox-row"><input checked={submitEnabled} onChange={(e) => setSubmitEnabled(e.target.checked)} type="checkbox" /> Send measurement summary</label>
        <label className="checkbox-row"><input checked={emergencyEnabled} onChange={(e) => setEmergencyEnabled(e.target.checked)} type="checkbox" /> Send emergency alerts</label>
        <button onClick={saveSettings} type="button">Save Preferences</button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
    </section>
  )
}
