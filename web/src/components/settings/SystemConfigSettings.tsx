import type { FormEvent } from 'react'
import type { ConfigRow, NewConfig } from './settingsHooks'
import { isProtectedConfig, isSensitiveConfig } from './settingsHooks'

type SystemConfigSettingsProps = {
  configPanelVisible: boolean
  configsLoading: boolean
  configError: string
  configMessage: string
  configs: ConfigRow[]
  editingConfigs: Record<string, string>
  savingConfigKey: string | null
  deletingConfigKey: string | null
  newConfig: NewConfig
  setNewConfig: (value: NewConfig | ((prev: NewConfig) => NewConfig)) => void
  setEditingConfigs: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  onConfigSave: (event: FormEvent<HTMLFormElement>, configKey: string) => void
  onConfigCreate: (event: FormEvent<HTMLFormElement>) => void
  onConfigDelete: (configKey: string) => void
}

export function SystemConfigSettings({
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
  onConfigSave,
  onConfigCreate,
  onConfigDelete
}: SystemConfigSettingsProps) {
  if (!configPanelVisible) return null

  return (
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
            onSubmit={onConfigCreate}
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
              <form style={{ display: 'flex', gap: 8 }} onSubmit={(event) => onConfigSave(event, row.configKey)}>
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
                  onClick={() => void onConfigDelete(row.configKey)}
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
  )
}
