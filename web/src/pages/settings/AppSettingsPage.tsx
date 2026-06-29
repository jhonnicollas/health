import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'

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
  data?: { updated?: boolean; created?: boolean; deleted?: boolean; cacheInvalidated: boolean }
  error?: { message: string }
}

export function AppSettingsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { profile, refresh, user, requiresOnboarding, setAuthenticated } = useAuth()
  const { t } = useI18n()

  const [theme, setTheme] = useState(profile?.theme ?? 'light')
  const [accessibilityMode, setAccessibilityMode] = useState(profile?.accessibilityMode ?? 'normal')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  const [configPanelVisible, setConfigPanelVisible] = useState(false)
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({})
  const [configsLoading, setConfigsLoading] = useState(true)
  const [configMessage, setConfigMessage] = useState('')
  const [configError, setConfigError] = useState('')
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null)
  const [deletingConfigKey, setDeletingConfigKey] = useState<string | null>(null)

  const [aiConsent, setAiConsent] = useState(!!profile?.aiConsent)
  const [emergencyConsent, setEmergencyConsent] = useState(!!profile?.emergencyConsent)
  const [dataShareConsent, setDataShareConsent] = useState(!!profile?.dataShareConsent)
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentMsg, setConsentMsg] = useState('')

  const [newConfig, setNewConfig] = useState({
    configKey: '',
    configValue: '',
    dataType: 'string',
    description: ''
  })

  useEffect(() => {
    void loadConfigs()
  }, [])

  useEffect(() => {
    if (profile) {
      setTheme(profile.theme ?? 'light')
      setAccessibilityMode(profile.accessibilityMode ?? 'normal')
      setAiConsent(!!profile.aiConsent)
      setEmergencyConsent(!!profile.emergencyConsent)
      setDataShareConsent(!!profile.dataShareConsent)
    }
  }, [profile])

  async function loadConfigs() {
    setConfigsLoading(true)
    setConfigError('')
    try {
      const response = await fetch('/api/admin/configs', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (response.status === 401 || response.status === 403) {
        setConfigPanelVisible(false)
        setConfigs([])
        return
      }
      if (!response.ok) {
        setConfigPanelVisible(false)
        return
      }
      const body = (await response.json()) as ConfigListResponse
      if (!body.success) {
        setConfigPanelVisible(true)
        setConfigError(body.error?.message ?? t('settings.unableToLoad'))
        setConfigs([])
        return
      }
      const list = Array.isArray(body.data?.configs) ? body.data.configs : []
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

  async function handleSeedTestData() {
    if (!confirm('This will create sample measurements, symptoms, and hydration data for the last 14 days. Continue?')) return
    setSeeding(true); setSeedMessage('')
    try {
      const res = await fetch('/api/dev/seed-test-data', { method: 'POST', credentials: 'include' })
      const body = await res.json()
      if (!res.ok || !body.success) { setSeedMessage(body.error?.message || 'Failed to seed test data.'); return }
      setSeedMessage(`Created: ${body.data?.seeded?.measurements || 0} measurements, ${body.data?.seeded?.symptoms || 0} symptoms, ${body.data?.seeded?.hydration || 0} hydration logs.`)
    } catch { setSeedMessage('Could not connect to server.') }
    finally { setSeeding(false) }
  }

  async function handleExportCsv() {
    setExporting(true)
    setExportMessage('')
    try {
      const res = await fetch('/api/export/csv', { credentials: 'include' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `measurement-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setExportMessage(t('settings.csvDownloaded'))
    } catch (err) {
      setExportMessage('')
      setMessage(err instanceof Error ? err.message : t('settings.csvFailed'))
    } finally {
      setExporting(false)
    }
  }

  function handleThemeChange(nextTheme: string) {
    setTheme(nextTheme)
    applyUiMode(nextTheme, accessibilityMode)
  }

  function handleAccessibilityChange(nextAccessibilityMode: string) {
    setAccessibilityMode(nextAccessibilityMode)
    applyUiMode(theme, nextAccessibilityMode)
  }

  async function handleSaveAppearance() {
    setSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          theme,
          accessibilityMode,
          timezone: profile?.timezone ?? 'Asia/Jakarta',
          heightCm: profile?.heightCm ?? 170
        })
      })
      const body = await response.json()
      if (!response.ok || !body.success) {
        setMessage(body.error?.message ?? t('settings.unableToSave'))
        return
      }
      applyUiMode(theme, accessibilityMode)
      if (profile) {
        setAuthenticated({
          user,
          requiresOnboarding,
          profile: {
            ...profile,
            theme,
            accessibilityMode
          }
        })
      }
      void refresh()
      setMessage(t('settings.settingsSaved'))
    } catch {
      setMessage(t('settings.connError'))
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
        setConfigError(body.error?.message ?? t('settings.unableToSave'))
        return
      }
      setConfigMessage(`${configKey} ${t('settings.saved')}`)
      await loadConfigs()
    } catch {
      setConfigError('Could not connect to server.')
    } finally {
      setSavingConfigKey(null)
    }
  }

  async function handleConfigCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingConfigKey('__new__')
    setConfigMessage('')
    setConfigError('')
    try {
      const response = await fetch('/api/admin/configs', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(newConfig)
      })
      const body = (await response.json()) as ConfigUpdateResponse
      if (!response.ok || !body.success) {
        setConfigError(body.error?.message ?? t('settings.unableToCreate'))
        return
      }
      setConfigMessage(`${newConfig.configKey} ${t('settings.created')}`)
      setNewConfig({ configKey: '', configValue: '', dataType: 'string', description: '' })
      await loadConfigs()
    } catch {
      setConfigError('Could not connect to server.')
    } finally {
      setSavingConfigKey(null)
    }
  }

  async function handleConfigDelete(configKey: string) {
    setDeletingConfigKey(configKey)
    setConfigMessage('')
    setConfigError('')
    try {
      const response = await fetch(`/api/admin/configs/${encodeURIComponent(configKey)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      const body = (await response.json()) as ConfigUpdateResponse
      if (!response.ok || !body.success) {
        setConfigError(body.error?.message ?? t('settings.unableToDelete'))
        return
      }
      setConfigMessage(`${configKey} ${t('settings.deleted')}`)
      await loadConfigs()
    } catch {
      setConfigError('Could not connect to server.')
    } finally {
      setDeletingConfigKey(null)
    }
  }

  function isSensitiveConfig(configKey: string) {
    return configKey.toLowerCase().includes('token') || configKey.toLowerCase().includes('secret')
  }

  function isProtectedConfig(configKey: string) {
    return [
      'aiExtractTimeoutMs',
      'aiVisionModel',
      'aiTextEndpoint',
      'aiTextModels',
      'aiTextDefaultModel',
      'aiTextApiKey',
      'maxUploadSizeBytes',
      'loginRateLimitMaxReq',
      'loginRateLimitWindowMin',
      'ocrRateLimitMax',
      'ocrRateLimitWindowMin',
      'telegramBotToken',
      'telegramBotActive'
    ].includes(configKey)
  }

  async function handleConsentSave() {
    setConsentSaving(true); setConsentMsg('')
    try {
      const res = await fetch('/api/settings/consent', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConsent, emergencyConsent, dataShareConsent })
      })
      const body = (await res.json()) as { success: boolean; error?: { message: string } }
      if (!body.success) { setConsentMsg(body.error?.message || t('settings.consentFailed')); return }
      setConsentMsg(t('settings.consentSaved'))
      void refresh()
    } catch { setConsentMsg(t('settings.connError')) }
    finally { setConsentSaving(false) }
  }

  const settingsLinks = [
    { icon: 'alarm', label: 'Reminders', desc: 'Schedule measurement reminders', path: '/reminders' },
    { icon: 'send', label: 'Telegram', desc: 'Link Telegram for instant alerts', path: '/telegram' },
    { icon: 'medication', label: 'Medications', desc: 'Track medication schedule', path: '/medications' },
    { icon: 'group', label: 'Family / Caregiver', desc: 'Manage access permissions', path: '/family' },
    { icon: 'emergency', label: 'Emergency Contacts', desc: 'Configure emergency alerts', path: '/emergency' },
    { icon: 'delete_forever', label: 'Delete Account', desc: 'Remove all data permanently', path: '/settings/delete' }
  ]

  return (
    <section className="settings-panel" aria-labelledby="app-settings-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 id="app-settings-title">App Settings</h2>
          <p>Customize your app experience, notifications, and privacy.</p>
        </div>
      </div>

      <div className="settings-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="settings-left">
          {/* Appearance */}
          <section className="card">
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>palette</span>
              Appearance
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 20 }}>Choose your preferred theme and display mode.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Theme</label>
                <select className="input-field" value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
                  <option value="light">Light</option>
                  <option value="warm">Warm</option>
                  <option value="dark">Dark</option>
                  <option value="highContrast">High contrast</option>
                </select>
              </div>
              <div>
                <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Display mode</label>
                <select className="input-field" value={accessibilityMode} onChange={(e) => handleAccessibilityChange(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="senior">Senior</option>
                  <option value="highContrast">High contrast</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--colorBorderSoft)' }}>
              <button className="btn-primary" disabled={submitting} onClick={() => void handleSaveAppearance()} type="button">
                {submitting ? 'Saving...' : 'Save Appearance'}
              </button>
            </div>
            {message ? <p className={`form-message ${message.toLowerCase().includes('saved') || message.toLowerCase().includes('berhasil') ? 'success' : 'error'}`} role="status" style={{ marginTop: 12 }}>{message}</p> : null}
          </section>

          {/* Notifications */}
          <section className="card" style={{ marginTop: 24 }}>
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>notifications_active</span>
              Notifications
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 20 }}>Configure delivery channels.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 'var(--radiusXl)', border: '1px solid var(--colorBorderSoft)', background: 'var(--colorSurfaceElevated)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, #0088cc 10%, transparent)', color: '#0088cc' }}>
                      <span className="material-symbols-outlined">send</span>
                    </div>
                    <div>
                      <p style={{ font: 'var(--typLabelMd)' }}>Telegram</p>
                      <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)' }}>Instant medical alerts</p>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => onNavigate?.('/telegram')}>Configure</button>
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 'var(--radiusXl)', border: '1px solid var(--colorBorderSoft)', background: 'var(--colorSurfaceElevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--colorSurfaceContainer)', color: 'var(--colorTextMuted)' }}>
                    <span className="material-symbols-outlined">desktop_windows</span>
                  </div>
                  <div>
                    <p style={{ font: 'var(--typLabelMd)' }}>Browser Push</p>
                    <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)' }}>Desktop notifications</p>
                  </div>
                </div>
                <span className="pill" style={{ fontSize: 12 }}>Coming soon</span>
              </div>
            </div>
          </section>

          {/* Settings Center */}
          <section className="card" style={{ marginTop: 24 }}>
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>tune</span>
              Settings Center
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 16 }}>Manage all app configurations and preferences.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {settingsLinks.map((item) => (
                <a key={item.path} href={item.path} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', textDecoration: 'none', color: 'var(--colorText)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--colorSurfaceHover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--colorTextMuted)' }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>{item.label}</strong>
                    <small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>{item.desc}</small>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--colorTextSubdued)' }}>chevron_right</span>
                </a>
              ))}
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', textDecoration: 'none', color: 'var(--colorText)', background: 'transparent', textAlign: 'left', cursor: exporting ? 'progress' : 'pointer', marginTop: 8, width: '100%' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--colorTextMuted)' }}>download</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>{exporting ? 'Downloading…' : 'Export Data'}</strong>
                  <small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>Download measurement CSV</small>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--colorTextSubdued)' }}>download</span>
              </button>
              {exportMessage ? <p className="form-message success" role="status">{exportMessage}</p> : null}
              <button
                type="button"
                onClick={() => void handleSeedTestData()}
                disabled={seeding}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', textDecoration: 'none', color: 'var(--colorText)', background: 'transparent', textAlign: 'left', cursor: seeding ? 'progress' : 'pointer', marginTop: 8, width: '100%' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--colorTextMuted)' }}>science</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>{seeding ? 'Seeding…' : 'Seed Test Data'}</strong>
                  <small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>Add sample data for dashboards & reports</small>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--colorTextSubdued)' }}>add</span>
              </button>
              {seedMessage ? <p className={`form-message ${seedMessage.toLowerCase().includes('created') || seedMessage.toLowerCase().includes('berhasil') ? 'success' : 'error'}`} role="status">{seedMessage}</p> : null}
            </div>
          </section>

          {/* Data & Consent */}
          <section className="card" style={{ marginTop: 24 }}>
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>shield</span>
              Data & Consent
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 16 }}>Manage your data sharing and AI preferences.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', cursor: 'pointer' }}>
                <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
                <div><strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>AI Analysis</strong><small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>Allow AI to generate health insights</small></div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', cursor: 'pointer' }}>
                <input type="checkbox" checked={emergencyConsent} onChange={(e) => setEmergencyConsent(e.target.checked)} />
                <div><strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>Emergency Alerts</strong><small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>Allow emergency contact notifications</small></div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', cursor: 'pointer' }}>
                <input type="checkbox" checked={dataShareConsent} onChange={(e) => setDataShareConsent(e.target.checked)} />
                <div><strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>Data Sharing</strong><small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>Share anonymized data for research</small></div>
              </label>
              <button className="btn-primary" disabled={consentSaving} onClick={() => void handleConsentSave()} type="button" style={{ marginTop: 4 }}>
                {consentSaving ? 'Saving...' : 'Save Consent'}
              </button>
              {consentMsg ? <p className={`form-message ${consentMsg.toLowerCase().includes('saved') || consentMsg.toLowerCase().includes('berhasil') ? 'success' : 'error'}`} role="status">{consentMsg}</p> : null}
            </div>
          </section>

          {/* System Config (admin only) */}
          {configPanelVisible ? (
            <section className="card" style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: 0 }}>System Config</h3>
                  <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginTop: 4 }}>{configs.length} keys — edit without redeploy</p>
                </div>
                <span className="status-chip">{configs.length} keys</span>
              </div>

              {configsLoading ? <p>Loading system config...</p> : null}
              {configError ? <p className="form-message error" role="alert">{configError}</p> : null}
              {configMessage ? <p className="form-message success" role="status">{configMessage}</p> : null}

              {!configsLoading && !configError ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <form
                    style={{ padding: 12, borderRadius: 'var(--radiusLg)', border: '1px solid var(--colorBorder)', background: 'var(--colorSurfaceElevated)', display: 'grid', gap: 10 }}
                    onSubmit={handleConfigCreate}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) minmax(90px, 120px)', gap: 8 }}>
                      <input
                        style={{ minHeight: 36, padding: '6px 10px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', font: 'var(--typBodySm)' }}
                        aria-label="New config key"
                        onChange={(event) => setNewConfig((prev) => ({ ...prev, configKey: event.target.value }))}
                        placeholder="configKey"
                        type="text"
                        value={newConfig.configKey}
                      />
                      <select
                        style={{ minHeight: 36, padding: '6px 10px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', font: 'var(--typBodySm)' }}
                        aria-label="New config data type"
                        onChange={(event) => setNewConfig((prev) => ({ ...prev, dataType: event.target.value }))}
                        value={newConfig.dataType}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="json">json</option>
                      </select>
                    </div>
                    <input
                      style={{ minHeight: 36, padding: '6px 10px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', font: 'var(--typBodySm)' }}
                      aria-label="New config value"
                      onChange={(event) => setNewConfig((prev) => ({ ...prev, configValue: event.target.value }))}
                      placeholder="Value"
                      type={isSensitiveConfig(newConfig.configKey) ? 'password' : 'text'}
                      value={newConfig.configValue}
                    />
                    <input
                      style={{ minHeight: 36, padding: '6px 10px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', font: 'var(--typBodySm)' }}
                      aria-label="New config description"
                      onChange={(event) => setNewConfig((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Description"
                      type="text"
                      value={newConfig.description}
                    />
                    <button className="btn-secondary" disabled={savingConfigKey === '__new__'} type="submit">
                      {savingConfigKey === '__new__' ? 'Creating...' : 'Create Config'}
                    </button>
                  </form>

                  {configs.map((row) => (
                    <div key={row.configKey} style={{ padding: 12, borderRadius: 'var(--radiusLg)', border: '1px solid var(--colorBorderSoft)', background: 'var(--colorSurface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <code style={{ font: 'var(--typBodySm)', fontWeight: 600 }}>{row.configKey}</code>
                        <span className="meta">{row.dataType || 'string'}</span>
                      </div>
                      {row.description ? <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)', marginBottom: 8 }}>{row.description}</p> : null}
                      <form style={{ display: 'flex', gap: 8 }} onSubmit={(event) => handleConfigSave(event, row.configKey)}>
                        <input
                          style={{ flex: 1, minHeight: 36, padding: '6px 10px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', font: 'var(--typBodySm)' }}
                          aria-label={`Value for ${row.configKey}`}
                          onChange={(event) =>
                            setEditingConfigs((prev) => ({ ...prev, [row.configKey]: event.target.value }))
                          }
                          placeholder={row.configKey === 'telegramBotToken' ? 'Paste regenerated BotFather token' : undefined}
                          type={isSensitiveConfig(row.configKey) ? 'password' : 'text'}
                          value={editingConfigs[row.configKey] ?? ''}
                        />
                        <button style={{ minHeight: 36, padding: '6px 14px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', background: 'var(--colorSurface)', cursor: 'pointer', font: 'var(--typLabelSm)' }} disabled={savingConfigKey === row.configKey} type="submit">
                          {savingConfigKey === row.configKey ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          style={{ minHeight: 36, padding: '6px 14px', border: '1px solid var(--colorStatusCritical)', borderRadius: 'var(--radiusMd)', background: 'var(--colorSurface)', color: 'var(--colorStatusCritical)', cursor: isProtectedConfig(row.configKey) ? 'not-allowed' : 'pointer', font: 'var(--typLabelSm)', opacity: isProtectedConfig(row.configKey) ? 0.55 : 1 }}
                          disabled={isProtectedConfig(row.configKey) || deletingConfigKey === row.configKey}
                          onClick={() => void handleConfigDelete(row.configKey)}
                          type="button"
                        >
                          {deletingConfigKey === row.configKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}
