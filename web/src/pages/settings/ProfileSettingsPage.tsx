import { useEffect, useState } from 'react'
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

type ConfigRow = {
  configKey: string
  configValue: string
  dataType?: string
  description?: string | null
  updatedAt?: string
}

type ConfigListResponse = {
  success: boolean
  data?: { configs: ConfigRow[] }
  error?: { message: string }
}

type ConfigUpdateResponse = {
  success: boolean
  data?: { updated: boolean; cacheInvalidated: boolean }
  error?: { message: string }
}

export function ProfileSettingsPage() {
  const { profile, refresh, user, requiresOnboarding, setAuthenticated } = useAuth()
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Jakarta')
  const [theme, setTheme] = useState(profile?.theme ?? 'light')
  const [accessibilityMode, setAccessibilityMode] = useState(
    profile?.accessibilityMode ?? 'normal'
  )
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [configPanelVisible, setConfigPanelVisible] = useState(false)
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({})
  const [configsLoading, setConfigsLoading] = useState(true)
  const [configMessage, setConfigMessage] = useState('')
  const [configError, setConfigError] = useState('')
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null)

  useEffect(() => {
    void loadConfigs()
  }, [])

  async function loadConfigs() {
    setConfigsLoading(true)
    setConfigError('')
    try {
      const response = await fetch('/api/admin/configs', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      const body = (await response.json()) as ConfigListResponse
      if (response.status === 401 || response.status === 403) {
        setConfigPanelVisible(false)
        return
      }
      if (!response.ok || !body.success) {
        setConfigPanelVisible(true)
        setConfigError(body.error?.message ?? 'Unable to load system config.')
        return
      }
      const list = body.data?.configs || []
      setConfigPanelVisible(true)
      setConfigs(list)
      const nextEditing: Record<string, string> = {}
      list.forEach((row) => {
        nextEditing[row.configKey] = row.configValue
      })
      setEditingConfigs(nextEditing)
    } catch {
      setConfigPanelVisible(false)
    } finally {
      setConfigsLoading(false)
    }
  }

  function applyUiMode(nextTheme: string, nextAccessibilityMode: string) {
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.dataset.accessibility = nextAccessibilityMode
  }

  function handleThemeChange(nextTheme: string) {
    setTheme(nextTheme)
    applyUiMode(nextTheme, accessibilityMode)
  }

  function handleAccessibilityChange(nextAccessibilityMode: string) {
    setAccessibilityMode(nextAccessibilityMode)
    applyUiMode(theme, nextAccessibilityMode)
  }

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

      applyUiMode(theme, accessibilityMode)
      if (profile) {
        setAuthenticated({
          user,
          requiresOnboarding,
          profile: {
            ...profile,
            heightCm: Number(heightCm),
            timezone,
            theme,
            accessibilityMode
          }
        })
      }
      void refresh()
      setMessage('Profile settings saved.')
    } catch {
      setMessage('Could not connect to server. Try again shortly.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfigSave(event: FormEvent<HTMLFormElement>, configKey: string) {
    event.preventDefault()
    setSavingConfigKey(configKey)
    setConfigMessage('')
    setConfigError('')
    try {
      const response = await fetch(`/api/admin/configs/${encodeURIComponent(configKey)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ configValue: editingConfigs[configKey] ?? '' })
      })
      const body = (await response.json()) as ConfigUpdateResponse
      if (!response.ok || !body.success) {
        setConfigError(body.error?.message ?? 'Unable to save system config.')
        return
      }
      setConfigMessage(`${configKey} saved.`)
      await loadConfigs()
    } catch {
      setConfigError('Could not connect to server.')
    } finally {
      setSavingConfigKey(null)
    }
  }

  function isSensitiveConfig(configKey: string) {
    return configKey.toLowerCase().includes('token') || configKey.toLowerCase().includes('secret')
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
          <select onChange={(event) => handleThemeChange(event.target.value)} value={theme}>
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
            onChange={(event) => handleAccessibilityChange(event.target.value)}
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

      {configPanelVisible ? (
        <section className="settings-config-section" aria-labelledby="system-config-title">
          <div className="page-heading compact">
            <div>
              <p className="eyebrow">Admin</p>
              <h3 id="system-config-title">System Config</h3>
              <p>Edit global DB-backed settings without redeploying the app.</p>
            </div>
            <span className="status-chip">{configs.length} keys</span>
          </div>

          {configsLoading ? <p>Loading system config...</p> : null}
          {configError ? <p className="form-message error" role="alert">{configError}</p> : null}
          {configMessage ? <p className="form-message success" role="status">{configMessage}</p> : null}

          {!configsLoading && !configError ? (
            <table className="admin-config-table" aria-label="System configuration">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Description</th>
                  <th>Value</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((row) => (
                  <tr key={row.configKey}>
                    <td><code>{row.configKey}</code></td>
                    <td>{row.description || '-'}</td>
                    <td>
                      <form
                        className="admin-config-form"
                        onSubmit={(event) => handleConfigSave(event, row.configKey)}
                      >
                        <input
                          aria-label={`Value for ${row.configKey}`}
                          onChange={(event) =>
                            setEditingConfigs((prev) => ({
                              ...prev,
                              [row.configKey]: event.target.value
                            }))
                          }
                          placeholder={row.configKey === 'telegramBotToken' ? 'Paste regenerated BotFather token' : undefined}
                          type={isSensitiveConfig(row.configKey) ? 'password' : 'text'}
                          value={editingConfigs[row.configKey] ?? ''}
                        />
                        <button disabled={savingConfigKey === row.configKey} type="submit">
                          {savingConfigKey === row.configKey ? 'Saving...' : 'Save'}
                        </button>
                      </form>
                    </td>
                    <td className="meta">{row.dataType || 'string'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
