import { useState } from 'react'
import { AppearanceSettings } from '../../components/settings/AppearanceSettings'
import { DataConsentSettings } from '../../components/settings/DataConsentSettings'
import { NotificationSettings } from '../../components/settings/NotificationSettings'
import { SettingsCenter } from '../../components/settings/SettingsCenter'
import { SystemConfigSettings } from '../../components/settings/SystemConfigSettings'
import {
  useAppearanceSettings,
  useDataConsentSettings,
  useSettingsCenter,
  useSystemConfigSettings
} from '../../components/settings/settingsHooks'

export function AppSettingsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [message, setMessage] = useState('')

  const appearance = useAppearanceSettings({ setMessage })
  const settingsCenter = useSettingsCenter({ setMessage })
  const dataConsent = useDataConsentSettings()
  const systemConfig = useSystemConfigSettings()

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
          <AppearanceSettings
            theme={appearance.theme}
            accessibilityMode={appearance.accessibilityMode}
            submitting={appearance.submitting}
            message={message}
            onThemeChange={appearance.handleThemeChange}
            onAccessibilityChange={appearance.handleAccessibilityChange}
            onSave={appearance.handleSaveAppearance}
          />

          <NotificationSettings onNavigate={onNavigate} />

          <SettingsCenter
            exporting={settingsCenter.exporting}
            exportMessage={settingsCenter.exportMessage}
            seeding={settingsCenter.seeding}
            seedMessage={settingsCenter.seedMessage}
            onExport={settingsCenter.handleExportCsv}
            onSeed={settingsCenter.handleSeedTestData}
          />

          <DataConsentSettings
            aiConsent={dataConsent.aiConsent}
            emergencyConsent={dataConsent.emergencyConsent}
            dataShareConsent={dataConsent.dataShareConsent}
            consentSaving={dataConsent.consentSaving}
            consentMsg={dataConsent.consentMsg}
            setAiConsent={dataConsent.setAiConsent}
            setEmergencyConsent={dataConsent.setEmergencyConsent}
            setDataShareConsent={dataConsent.setDataShareConsent}
            onSave={dataConsent.handleConsentSave}
          />

          <SystemConfigSettings
            configPanelVisible={systemConfig.configPanelVisible}
            configsLoading={systemConfig.configsLoading}
            configError={systemConfig.configError}
            configMessage={systemConfig.configMessage}
            configs={systemConfig.configs}
            editingConfigs={systemConfig.editingConfigs}
            savingConfigKey={systemConfig.savingConfigKey}
            deletingConfigKey={systemConfig.deletingConfigKey}
            newConfig={systemConfig.newConfig}
            setNewConfig={systemConfig.setNewConfig}
            setEditingConfigs={systemConfig.setEditingConfigs}
            onConfigSave={systemConfig.handleConfigSave}
            onConfigCreate={systemConfig.handleConfigCreate}
            onConfigDelete={systemConfig.handleConfigDelete}
          />
        </div>
      </div>
    </section>
  )
}
