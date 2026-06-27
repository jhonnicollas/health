import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { EmailOtpVerificationStep } from '../../components/auth/EmailOtpVerificationStep'

type LoginState = 'idle' | 'submitting' | 'error'

type LoginResponse = {
  success: boolean
  data?: {
    otpRequired?: boolean
    challengeId?: number
    maskedEmail?: string
    expiresInSeconds?: number
    user: {
      id: number
      email: string
      displayName: string
      telegramEnabled: boolean
      browserPushEnabled: boolean
    }
    profile: {
      id: number
      sex: string
      birthDate: string
      heightCm: number
      timezone: string
      accessibilityMode: string
      theme: string
    } | null
    requiresOnboarding: boolean
  }
  error?: {
    code: string
    message: string
    details?: Array<{
      field: string
      message: string
    }>
  }
}

export function LoginPage({ onShowRegister }: { onShowRegister: () => void }) {
  const { setAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<LoginState>('idle')
  const [message, setMessage] = useState('')
  const [otpChallenge, setOtpChallenge] = useState<{ challengeId: number; maskedEmail: string; expiresInSeconds: number } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      })
      const body = (await response.json()) as LoginResponse

      if (!response.ok || !body.success || !body.data) {
        const detail = body.error?.details?.[0]?.message
        setStatus('error')
        setMessage(detail ?? body.error?.message ?? 'Login gagal.')
        return
      }

      if (body.data?.otpRequired) {
        setOtpChallenge({
          challengeId: body.data.challengeId!,
          maskedEmail: body.data.maskedEmail!,
          expiresInSeconds: body.data.expiresInSeconds!
        })
        return
      }

      setAuthenticated(body.data)
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server. Coba lagi sebentar.')
    }
  }

  const submitting = status === 'submitting'

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-copy">
          <p className="eyebrow">HL Health Companion</p>
          <h1 id="login-title">Masuk ke catatan kesehatan</h1>
          <p>
            Gunakan email dan password untuk membuka dashboard pribadi Anda. Sesi
            disimpan lewat cookie aman, bukan token yang bisa dibaca halaman.
          </p>
          <div className="auth-feature-grid" aria-label="Ringkasan keamanan">
            <span>Rule-first</span>
            <span>Manual override</span>
            <span>Private session</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} style={otpChallenge ? { display: 'none' } : undefined}>
          <div className="form-heading">
            <h2>Sign in</h2>
            <p>Clinical workspace</p>
          </div>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <a href="/api/auth/google" className="btn-secondary" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}>
            <span className="material-symbols-outlined">login</span>Login dengan Google
          </a>
          <button disabled={submitting} type="submit">
            {submitting ? 'Memeriksa...' : 'Login'}
          </button>

          <button className="secondary-action" onClick={onShowRegister} type="button">
            Buat akun baru
          </button>

          {message ? (
            <p className="form-message error" role="status">
              {message}
            </p>
          ) : null}
        </form>

        {otpChallenge && (
          <>
            <EmailOtpVerificationStep
              challengeId={otpChallenge.challengeId}
              maskedEmail={otpChallenge.maskedEmail}
              expiresInSeconds={otpChallenge.expiresInSeconds}
              purpose="login"
              verifyUrl="/api/auth/login/verify"
              onVerified={(data) => {
                const d = data as { user: { id: number; email: string; displayName: string; telegramEnabled: boolean; browserPushEnabled: boolean }; profile: Record<string, unknown> | null; requiresOnboarding: boolean }
                setAuthenticated({ user: d.user, profile: d.profile as any, requiresOnboarding: d.requiresOnboarding })
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/api/auth/google" className="btn-secondary" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:'10px 20px',textDecoration:'none'}}>
                <span className="material-symbols-outlined">login</span>Login dengan Google
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
