import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'

type RegisterState = 'idle' | 'submitting' | 'success' | 'error'

type RegisterResponse = {
  success: boolean
  data?: {
    user: {
      id: string
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

export function RegisterPage({ onShowLogin }: { onShowLogin: () => void }) {
  const { setAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<RegisterState>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
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
        const detail = body.error?.details?.[0]?.message
        setStatus('error')
        setMessage(detail ?? body.error?.message ?? 'Registrasi gagal diproses.')
        return
      }

      setStatus('success')
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
      }
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server. Coba lagi sebentar.')
    }
  }

  const submitting = status === 'submitting'

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="register-title">
        <div className="auth-copy">
          <p className="eyebrow">HL Health Companion</p>
          <h1 id="register-title">Buat akun kesehatan pribadi</h1>
          <p>
            Simpan catatan pengukuran dengan akun terpisah dan lanjutkan ke profil kesehatan
            untuk mengaktifkan interpretasi berbasis aturan.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nama tampilan
            <input
              autoComplete="name"
              minLength={2}
              name="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              required
              type="text"
              value={displayName}
            />
          </label>

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
              autoComplete="new-password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <button disabled={submitting} type="submit">
            {submitting ? 'Membuat akun...' : 'Daftar'}
          </button>

          <button className="secondary-action" onClick={onShowLogin} type="button">
            Sudah punya akun
          </button>

          {message ? (
            <p className={`form-message ${status === 'error' ? 'error' : 'success'}`} role="status">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  )
}
