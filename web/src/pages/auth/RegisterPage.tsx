import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { EmailOtpVerificationStep } from '../../components/auth/EmailOtpVerificationStep'
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher'
import { useI18n } from '../../i18n/useI18n'

type RegisterState = 'idle' | 'submitting' | 'success' | 'error'

type RegisterResponse = {
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
    }
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

function passwordStrength(pw: string): { level: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 2) return { level: 1, label: 'Weak', color: 'var(--colorDanger)' }
  if (score <= 4) return { level: 2, label: 'Fair', color: 'var(--colorWarning)' }
  return { level: 3, label: 'Strong', color: 'var(--colorSuccess)' }
}

export function RegisterPage({ onShowLogin }: { onShowLogin: () => void }) {
  const { setAuthenticated, refresh } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<RegisterState>('idle')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [otpChallenge, setOtpChallenge] = useState<{ challengeId: number; maskedEmail: string; expiresInSeconds: number } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')
    setFieldErrors({})

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          displayName
        })
      })
      const body = (await response.json()) as RegisterResponse

      if (!response.ok || !body.success) {
        const nextErrors: Record<string, string> = {}
        body.error?.details?.forEach((d) => { nextErrors[d.field] = d.message })
        setFieldErrors(nextErrors)
        setStatus('error')
        setMessage(body.error?.message ?? 'Registrasi gagal diproses.')
        return
      }

      setStatus('success')
      if (body.data?.otpRequired && body.data.challengeId != null) {
        setOtpChallenge({
          challengeId: body.data.challengeId,
          maskedEmail: body.data.maskedEmail ?? email,
          expiresInSeconds: body.data.expiresInSeconds ?? 300
        })
        return
      }
      setMessage(
        body.data?.requiresOnboarding
          ? 'Akun berhasil dibuat. Lanjutkan ke onboarding profil kesehatan.'
          : 'Akun berhasil dibuat.'
      )
      if (body.data) {
        setAuthenticated({
          user: {
            ...body.data.user,
            telegramEnabled: false,
            browserPushEnabled: false
          },
          profile: null,
          requiresOnboarding: body.data.requiresOnboarding
        })
        void refresh()
      }
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server. Coba lagi sebentar.')
    }
  }

  const submitting = status === 'submitting'
  const strength = password.length > 0 ? passwordStrength(password) : null

  return (
    <main className="auth-page">
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}><LanguageSwitcher compact /></div>
      <section className="auth-panel" aria-labelledby="register-title">
        <div className="auth-copy">
          <p className="eyebrow">iSehat</p>
          <h1 id="register-title">Buat akun kesehatan pribadi</h1>
          <p>
            Simpan catatan pengukuran dengan akun terpisah dan lanjutkan ke profil kesehatan
            untuk mengaktifkan interpretasi berbasis aturan.
          </p>
          <div className="auth-feature-grid" aria-label="Ringkasan onboarding">
            <span>Secure profile</span>
            <span>D1 private data</span>
            <span>Clinical rules</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} style={otpChallenge ? { display: 'none' } : undefined}>
          <div className="form-heading">
            <h2>Create account</h2>
            <p>Start personal workspace</p>
          </div>
          <label>
            {t('auth.displayNameLabel')}
            <input
              autoComplete="name"
              className={fieldErrors.displayName ? 'field-error-input' : ''}
              minLength={2}
              name="displayName"
              onChange={(event) => { setDisplayName(event.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.displayName; return n }) }}
              placeholder={t('auth.displayNamePlaceholder')}
              required
              type="text"
              value={displayName}
            />
            {fieldErrors.displayName ? <span className="field-error">{fieldErrors.displayName}</span> : null}
          </label>

          <label>
            Email
            <input
              autoComplete="email"
              className={fieldErrors.email ? 'field-error-input' : ''}
              name="email"
              onChange={(event) => { setEmail(event.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.email; return n }) }}
              placeholder="you@clinic.com"
              required
              type="email"
              value={email}
            />
            {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
          </label>

          <label>
            Password
            <div className="password-input-wrap">
              <input
                autoComplete="new-password"
                className={fieldErrors.password ? 'field-error-input' : ''}
                minLength={8}
                name="password"
                onChange={(event) => { setPassword(event.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.password; return n }) }}
                placeholder="Min 8 chars, upper + lower + number"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                type="button"
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {strength ? (
              <div className="password-strength">
                <div className="password-strength-bar">
                  <div className="password-strength-fill" style={{ width: `${(strength.level / 3) * 100}%`, background: strength.color }} />
                </div>
                <span style={{ color: strength.color, fontSize: 12, fontWeight: 500 }}>{strength.label}</span>
              </div>
            ) : null}
            {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
          </label>

          <button className="btn-primary" disabled={submitting} type="submit">
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" />
                Membuat akun...
              </span>
            ) : t('auth.submitRegister')}
          </button>

          <div style={{ textAlign: 'center', margin: '16px 0', color: 'var(--colorTextMuted)', fontSize: 13 }}>— {t('common.orDivider')} —</div>

          <a href="/api/auth/google?mode=login" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', textDecoration: 'none', marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.46.35 2.83.96 4.05l3-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
            {t('auth.googleButton')}
          </a>

          <button className="secondary-action" onClick={onShowLogin} type="button">
            {t('auth.alreadyHaveAccount')} {t('auth.loginHere')}
          </button>

          {message ? (
            <p className={`form-message ${status === 'error' ? 'error' : 'success'}`} role="status">
              {message}
            </p>
          ) : null}
        </form>

        {otpChallenge && (
          <div className="auth-form">
            <EmailOtpVerificationStep
              challengeId={otpChallenge.challengeId}
              maskedEmail={otpChallenge.maskedEmail}
              expiresInSeconds={otpChallenge.expiresInSeconds}
              purpose="register"
              verifyUrl="/api/auth/register/verify"
              onVerified={(data) => {
                const d = data as { user: Record<string, unknown>; requiresOnboarding: boolean }
                setAuthenticated({
                  user: {
                    id: d.user.id as number,
                    email: d.user.email as string,
                    displayName: d.user.displayName as string,
                    telegramEnabled: (d.user.telegramEnabled as boolean) ?? false,
                    browserPushEnabled: (d.user.browserPushEnabled as boolean) ?? false
                  },
                  profile: null,
                  requiresOnboarding: d.requiresOnboarding ?? true
                })
                void refresh()
              }}
            />
          </div>
        )}
      </section>
    </main>
  )
}
