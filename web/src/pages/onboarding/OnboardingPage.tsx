import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'

type OnboardingResponse = {
  success: boolean
  data?: {
    profileId: number
    completed: boolean
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

export function OnboardingPage() {
  const { user, refresh } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [sex, setSex] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [theme, setTheme] = useState('light')
  const [accessibilityMode, setAccessibilityMode] = useState('normal')
  const [aiConsent, setAiConsent] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setFieldErrors({})

    try {
      const response = await fetch('/api/profile/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          displayName,
          sex,
          birthDate,
          heightCm: Number(heightCm),
          timezone,
          theme,
          accessibilityMode,
          aiConsent
        })
      })
      const body = (await response.json()) as OnboardingResponse

      if (!response.ok || !body.success) {
        const nextErrors: Record<string, string> = {}
        body.error?.details?.forEach((detail) => {
          nextErrors[detail.field] = detail.message
        })
        setFieldErrors(nextErrors)
        setMessage(body.error?.message ?? 'Onboarding gagal diproses.')
        return
      }

      await refresh()
    } catch {
      setMessage('Tidak bisa terhubung ke server. Coba lagi sebentar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="onboarding-title">
        <div className="auth-copy">
          <p className="eyebrow">Profil kesehatan</p>
          <h1 id="onboarding-title">Lengkapi data dasar</h1>
          <p>
            Data ini dipakai untuk BMI dan aturan kesehatan berbasis umur atau jenis kelamin.
          </p>
          <div className="onboarding-steps" aria-label="Tahap onboarding">
            <span>1 Profil</span>
            <span>2 Antropometri</span>
            <span>3 Preferensi</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <h2>Clinical profile</h2>
            <p>Dipakai untuk evaluasi rule engine.</p>
          </div>
          <label>
            Nama tampilan
            <input
              autoComplete="name"
              minLength={2}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              type="text"
              value={displayName}
            />
            {fieldErrors.displayName ? <span className="field-error">{fieldErrors.displayName}</span> : null}
          </label>

          <label>
            Jenis kelamin
            <select onChange={(event) => setSex(event.target.value)} value={sex}>
              <option value="male">Pria</option>
              <option value="female">Wanita</option>
              <option value="other">Lainnya</option>
            </select>
            {fieldErrors.sex ? <span className="field-error">{fieldErrors.sex}</span> : null}
          </label>

          <label>
            Tanggal lahir
            <input
              onChange={(event) => setBirthDate(event.target.value)}
              required
              type="date"
              value={birthDate}
            />
            {fieldErrors.birthDate ? <span className="field-error">{fieldErrors.birthDate}</span> : null}
          </label>

          <label>
            Tinggi badan (cm)
            <input
              inputMode="decimal"
              max={250}
              min={50}
              onChange={(event) => setHeightCm(event.target.value)}
              required
              type="number"
              value={heightCm}
            />
            {fieldErrors.heightCm ? <span className="field-error">{fieldErrors.heightCm}</span> : null}
          </label>

          <label>
            Timezone
            <input
              onChange={(event) => setTimezone(event.target.value)}
              required
              type="text"
              value={timezone}
            />
            {fieldErrors.timezone ? <span className="field-error">{fieldErrors.timezone}</span> : null}
          </label>

          <label>
            Tema
            <select onChange={(event) => setTheme(event.target.value)} value={theme}>
              <option value="light">Light</option>
              <option value="warm">Warm</option>
              <option value="dark">Dark</option>
              <option value="highContrast">High contrast</option>
            </select>
          </label>

          <label>
            Mode tampilan
            <select
              onChange={(event) => setAccessibilityMode(event.target.value)}
              value={accessibilityMode}
            >
              <option value="normal">Normal</option>
              <option value="senior">Senior</option>
              <option value="highContrast">High contrast</option>
            </select>
          </label>

          <label className="checkbox-label">
            <input
              checked={aiConsent}
              onChange={(event) => setAiConsent(event.target.checked)}
              type="checkbox"
            />
            Izinkan AI membantu membaca foto dan membuat ringkasan aman.
          </label>

          <button disabled={submitting} type="submit">
            {submitting ? 'Menyimpan...' : 'Selesaikan onboarding'}
          </button>

          {message ? (
            <p className="form-message error" role="status">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  )
}
