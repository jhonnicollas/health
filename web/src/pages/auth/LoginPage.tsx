import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { EmailOtpVerificationStep } from '../../components/auth/EmailOtpVerificationStep'
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher'
import { useI18n } from '../../i18n/useI18n'

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
  const { setAuthenticated, refresh } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function getOAuthError() {
    try {
      const params = new URLSearchParams(window.location.search)
      const errorCode = params.get('error')
      const errorMessage = params.get('message')
      if (errorCode && errorMessage) {
        window.history.replaceState(null, '', window.location.pathname)
        return { status: 'error' as LoginState, message: errorMessage }
      }
    } catch { /* ignore */ }
    return { status: 'idle' as LoginState, message: '' }
  }
  const oauthError = getOAuthError()
  const [status, setStatus] = useState<LoginState>(oauthError.status)
  const [message, setMessage] = useState(oauthError.message)
  const [otpChallenge, setOtpChallenge] = useState<{ challengeId: number; maskedEmail: string; expiresInSeconds: number } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/auth/login/start', {
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
      void refresh()
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server. Coba lagi sebentar.')
    }
  }

  const submitting = status === 'submitting'

  return (
    <main className="auth-page">
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}><LanguageSwitcher compact /></div>
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-copy">
          <p className="eyebrow">iSehat</p>
          <h1 id="login-title">{t('auth.loginTitle')}</h1>
          <p>{t('auth.loginSubtitle')}</p>
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
            {t('auth.emailLabel')}
            <input
              autoComplete="email"
              name="email"
              placeholder={t('auth.emailPlaceholder')}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            {t('auth.passwordLabel')}
            <input
              autoComplete="current-password"
              name="password"
              placeholder={t('auth.passwordPlaceholder')}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <a href="/api/auth/google" className="btn-secondary" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}>
            <span className="material-symbols-outlined">login</span>{t('auth.googleButton')}
          </a>
          <button disabled={submitting} type="submit">
            {submitting ? t('auth.submittingLogin') : t('auth.submitLogin')}
          </button>

          <button className="secondary-action" onClick={onShowRegister} type="button">
            {t('auth.registerTitle')}
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setAuthenticated({ user: d.user, profile: d.profile as any, requiresOnboarding: d.requiresOnboarding })
                void refresh()
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/api/auth/google" className="btn-secondary" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:'10px 20px',textDecoration:'none'}}>
                <span className="material-symbols-outlined">login</span>{t('auth.googleButton')}
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
