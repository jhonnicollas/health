import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'

export type ConfigRow = {
  configKey: string
  configValue: string
  dataType?: string
  description?: string | null
  updatedAt?: string
}

export type ConfigListResponse = {
  success: boolean
  data?: { configs: ConfigRow[] }
  error?: { message: string }
}

export type ConfigUpdateResponse = {
  success: boolean
  data?: { updated?: boolean; created?: boolean; deleted?: boolean; cacheInvalidated: boolean }
  error?: { message: string }
}

export type NewConfig = {
  configKey: string
  configValue: string
  dataType: string
  description: string
}

export function useAppearanceSettings({ setMessage }: { setMessage: (message: string) => void }) {
  const { profile, refresh, user, requiresOnboarding, setAuthenticated } = useAuth()
  const { t } = useI18n()

  const [theme, setTheme] = useState(profile?.theme ?? 'light')
  const [accessibilityMode, setAccessibilityMode] = useState(profile?.accessibilityMode ?? 'normal')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (profile) {
      setTheme(profile.theme ?? 'light')
      setAccessibilityMode(profile.accessibilityMode ?? 'normal')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile])

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

  return {
    theme,
    accessibilityMode,
    submitting,
    handleThemeChange,
    handleAccessibilityChange,
    handleSaveAppearance
  }
}

export function useSettingsCenter({ setMessage }: { setMessage: (message: string) => void }) {
  const { t } = useI18n()

  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  async function handleSeedTestData() {
    if (!confirm('This will create sample measurements, symptoms, and hydration data for the last 14 days. Continue?')) return
    setSeeding(true)
    setSeedMessage('')
    try {
      const res = await fetch('/api/dev/seed-test-data', { method: 'POST', credentials: 'include' })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setSeedMessage(body.error?.message || 'Failed to seed test data.')
        return
      }
      setSeedMessage(
        `Created: ${body.data?.seeded?.measurements || 0} measurements, ${body.data?.seeded?.symptoms || 0} symptoms, ${body.data?.seeded?.hydration || 0} hydration logs.`
      )
    } catch {
      setSeedMessage('Could not connect to server.')
    } finally {
      setSeeding(false)
    }
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

  return {
    exporting,
    exportMessage,
    seeding,
    seedMessage,
    handleExportCsv,
    handleSeedTestData
  }
}

export function useDataConsentSettings() {
  const { profile, refresh } = useAuth()
  const { t } = useI18n()

  const [aiConsent, setAiConsent] = useState(!!profile?.aiConsent)
  const [emergencyConsent, setEmergencyConsent] = useState(!!profile?.emergencyConsent)
  const [dataShareConsent, setDataShareConsent] = useState(!!profile?.dataShareConsent)
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentMsg, setConsentMsg] = useState('')

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (profile) {
      setAiConsent(!!profile.aiConsent)
      setEmergencyConsent(!!profile.emergencyConsent)
      setDataShareConsent(!!profile.dataShareConsent)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile])

  async function handleConsentSave() {
    setConsentSaving(true)
    setConsentMsg('')
    try {
      const res = await fetch('/api/settings/consent', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConsent, emergencyConsent, dataShareConsent })
      })
      const body = (await res.json()) as { success: boolean; error?: { message: string } }
      if (!body.success) {
        setConsentMsg(body.error?.message || t('settings.consentFailed'))
        return
      }
      setConsentMsg(t('settings.consentSaved'))
      void refresh()
    } catch {
      setConsentMsg(t('settings.connError'))
    } finally {
      setConsentSaving(false)
    }
  }

  return {
    aiConsent,
    setAiConsent,
    emergencyConsent,
    setEmergencyConsent,
    dataShareConsent,
    setDataShareConsent,
    consentSaving,
    consentMsg,
    handleConsentSave
  }
}

export function useSystemConfigSettings() {
  const { t } = useI18n()

  const [configPanelVisible, setConfigPanelVisible] = useState(false)
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [editingConfigs, setEditingConfigs] = useState<Record<string, string>>({})
  const [configsLoading, setConfigsLoading] = useState(true)
  const [configMessage, setConfigMessage] = useState('')
  const [configError, setConfigError] = useState('')
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null)
  const [deletingConfigKey, setDeletingConfigKey] = useState<string | null>(null)
  const [newConfig, setNewConfig] = useState<NewConfig>({
    configKey: '',
    configValue: '',
    dataType: 'string',
    description: ''
  })

  useEffect(() => {
    void loadConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return {
    configPanelVisible,
    configsLoading,
    configError,
    configMessage,
    configs,
    editingConfigs,
    savingConfigKey,
    deletingConfigKey,
    newConfig,
    setNewConfig,
    setEditingConfigs,
    handleConfigSave,
    handleConfigCreate,
    handleConfigDelete
  }
}

export function isSensitiveConfig(configKey: string) {
  return configKey.toLowerCase().includes('token') || configKey.toLowerCase().includes('secret')
}

export function isProtectedConfig(configKey: string) {
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
