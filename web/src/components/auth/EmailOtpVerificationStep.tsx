import { useState, useEffect, type FormEvent } from 'react'
import { OtpInput } from './OtpInput'

type Props = {
  challengeId: number
  maskedEmail: string
  expiresInSeconds: number
  purpose: 'register' | 'login'
  onVerified: (data: Record<string, unknown>) => void
  verifyUrl: string
}

export function EmailOtpVerificationStep({ challengeId, maskedEmail, onVerified, verifyUrl }: Props) {
  const [otp, setOtp] = useState('')
  const [status, setStatus] = useState<'input' | 'verifying' | 'error'>('input')
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [resendsLeft, setResendsLeft] = useState(3)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setStatus('verifying')
    setMessage('')
    try {
      const res = await fetch(verifyUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ challengeId, otp })
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setStatus('error')
        setMessage(body.error?.message || 'Kode verifikasi tidak valid.')
        setOtp('')
        return
      }
      onVerified(body.data)
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server.')
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resendsLeft <= 0) return
    try {
      const res = await fetch('/api/auth/otp/resend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId })
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setMessage(body.error?.message || 'Gagal mengirim ulang.')
        return
      }
      setResendsLeft(r => r - 1)
      setCooldown(60)
      setMessage('')
    } catch {
      setMessage('Tidak bisa terhubung ke server.')
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Verifikasi Email</h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Masukkan kode 6 digit yang dikirim ke <strong>{maskedEmail}</strong>
      </p>
      <form onSubmit={handleVerify}>
        <OtpInput length={6} value={otp} onChange={setOtp} disabled={status === 'verifying'} autoFocus />
        {message && <p style={{ color: '#dc2626', marginTop: 12, fontSize: 14 }}>{message}</p>}
        <button
          type="submit"
          disabled={otp.length !== 6 || status === 'verifying'}
          style={{
            width: '100%', marginTop: 20, padding: '12px 0', borderRadius: 8,
            background: otp.length === 6 ? '#1a56db' : '#9ca3af', color: '#fff',
            fontWeight: 600, fontSize: 16, border: 'none', cursor: otp.length === 6 ? 'pointer' : 'default'
          }}
        >
          {status === 'verifying' ? 'Memverifikasi...' : 'Verifikasi'}
        </button>
      </form>
      <div style={{ marginTop: 16 }}>
        {cooldown > 0 ? (
          <span style={{ color: '#6b7280', fontSize: 14 }}>Kirim ulang dalam {cooldown}d</span>
        ) : resendsLeft > 0 ? (
          <button
            onClick={handleResend}
            style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
          >
            Kirim ulang kode ({resendsLeft} lagi)
          </button>
        ) : (
          <span style={{ color: '#6b7280', fontSize: 14 }}>Batas kirim ulang tercapai</span>
        )}
      </div>
    </div>
  )
}
