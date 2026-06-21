import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'

type ProfileSettingsResponse = {
  success: boolean
  data?: {
    updated: boolean
  }
  error?: {
    message: string
    details?: Array<{
      field: string
      message: string
    }>
  }
}

export function ProfileSettingsPage() {
  const { profile, refresh } = useAuth()
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Jakarta')
  const [theme, setTheme] = useState(profile?.theme ?? 'light')
  const [accessibilityMode, setAccessibilityMode] = useState(
    profile?.accessibilityMode ?? 'normal'
  )
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setFieldErrors({})

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          heightCm: Number(heightCm),
          timezone,
          theme,
          accessibilityMode
        })
      })
      const body = (await response.json()) as ProfileSettingsResponse

      if (!response.ok || !body.success) {
        const nextErrors: Record<string, string> = {}
        body.error?.details?.forEach((detail) => {
          nextErrors[detail.field] = detail.message
        })
        setFieldErrors(nextErrors)
        setMessage(body.error?.message ?? 'Settings failed to save.')
        return
      }

      await refresh()
      setMessage('Profile settings saved.')
    } catch {
      setMessage('Could not connect to server. Try again shortly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="profile-settings-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 id="profile-settings-title">Basic Profile</h2>
          <p>Configure height, timezone, theme, and display mode for the app.</p>
        </div>
        <span className="status-chip">{accessibilityMode}</span>
      </div>

      <form className="auth-form settings-form" onSubmit={handleSubmit}>
        <div className="form-heading">
          <h3>Health Profile</h3>
          <p>Changes are applied after the profile is saved.</p>
        </div>
        <label>
          Height (cm)
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
          Theme
          <select onChange={(event) => setTheme(event.target.value)} value={theme}>
            <option value="light">Light</option>
            <option value="warm">Warm</option>
            <option value="dark">Dark</option>
            <option value="highContrast">High contrast</option>
          </select>
          {fieldErrors.theme ? <span className="field-error">{fieldErrors.theme}</span> : null}
        </label>

        <label>
          Display mode
          <select
            onChange={(event) => setAccessibilityMode(event.target.value)}
            value={accessibilityMode}
          >
            <option value="normal">Normal</option>
            <option value="senior">Senior</option>
            <option value="highContrast">High contrast</option>
          </select>
          {fieldErrors.accessibilityMode ? (
            <span className="field-error">{fieldErrors.accessibilityMode}</span>
          ) : null}
        </label>

        <button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : 'Save Settings'}
        </button>

        {message ? (
          <p
            className={`form-message ${message.includes('saved') ? 'success' : 'error'}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </form>
    </section>
  )
}
