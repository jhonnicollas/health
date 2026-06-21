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
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setVerification(body.data || null)
    } catch { setError('Tidak bisa terhubung ke server.') }
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
      if (!body.success) { setError(body.error?.message || 'Gagal verifikasi.'); return }
      setMessage('Telegram terhubung.')
    } catch { setError('Tidak bisa terhubung ke server.') }
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
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage('Pengaturan disimpan.')
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  async function test() {
    setError(null); setTestResult(null)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ sent: boolean; error?: string }>
      if (!body.success) { setError(body.error?.message || 'Gagal test.'); return }
      setTestResult(body.data?.sent ? 'Terkirim!' : `Tidak terkirim: ${body.data?.error}`)
    } catch { setError('Tidak bisa terhubung ke server.') }
  }

  return (
    <section className="settings-panel" aria-labelledby="tg-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Integrasi</p>
          <h2 id="tg-title">Telegram</h2>
          <p>Kelola koneksi dan preferensi notifikasi Telegram.</p>
        </div>
        <span className="status-chip">{verification ? 'Kode aktif' : 'Belum verifikasi'}</span>
      </div>
      <div className="settings-card">
        <h3>1. Buat Koneksi</h3>
        <button onClick={connect} type="button">Buat Kode Verifikasi</button>
      </div>
      {verification ? (
        <div className="result-card">
          <p>Kode verifikasi Anda (berlaku {verification.expiresInMinutes} menit): <code>{verification.verificationCode}</code></p>
          <p>Cara 1: Buka bot Telegram kami dan kirim kode ini.</p>
          <p>Cara 2 (jika tidak bisa akses bot): Masukkan chat ID Telegram Anda di bawah.</p>
        </div>
      ) : null}
      <div className="settings-card">
        <h3>2. Verifikasi Manual (Chat ID)</h3>
        <label>Chat ID Telegram Anda<input onChange={(e) => setChatId(e.target.value)} placeholder="contoh: 8727919072" value={chatId} /></label>
        <button disabled={!verification || !chatId} onClick={verify} type="button">Verifikasi</button>
      </div>
      <div className="settings-card">
        <h3>3. Test Notifikasi</h3>
        <button onClick={test} type="button">Kirim Test</button>
      </div>
      {testResult ? <p>{testResult}</p> : null}
      <div className="settings-card">
        <h3>4. Pengaturan Notifikasi</h3>
        <label className="checkbox-row"><input checked={submitEnabled} onChange={(e) => setSubmitEnabled(e.target.checked)} type="checkbox" /> Kirim ringkasan pengukuran</label>
        <label className="checkbox-row"><input checked={emergencyEnabled} onChange={(e) => setEmergencyEnabled(e.target.checked)} type="checkbox" /> Kirim peringatan darurat</label>
        <button onClick={saveSettings} type="button">Simpan Pengaturan</button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
    </section>
  )
}
