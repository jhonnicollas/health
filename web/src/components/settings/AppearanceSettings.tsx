type AppearanceSettingsProps = {
  theme: string
  accessibilityMode: string
  submitting: boolean
  message: string
  onThemeChange: (theme: string) => void
  onAccessibilityChange: (mode: string) => void
  onSave: () => void
}

export function AppearanceSettings({
  theme,
  accessibilityMode,
  submitting,
  message,
  onThemeChange,
  onAccessibilityChange,
  onSave
}: AppearanceSettingsProps) {
  return (
    <section className="card">
      <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>palette</span>
        Appearance
      </h3>
      <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 20 }}>Choose your preferred theme and display mode.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
        <div>
          <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Theme</label>
          <select className="input-field" value={theme} onChange={(e) => onThemeChange(e.target.value)}>
            <option value="light">Light</option>
            <option value="warm">Warm</option>
            <option value="dark">Dark</option>
            <option value="highContrast">High contrast</option>
          </select>
        </div>
        <div>
          <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Display mode</label>
          <select className="input-field" value={accessibilityMode} onChange={(e) => onAccessibilityChange(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="senior">Senior</option>
            <option value="highContrast">High contrast</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--colorBorderSoft)' }}>
        <button className="btn-primary" disabled={submitting} onClick={() => void onSave()} type="button">
          {submitting ? 'Saving...' : 'Save Appearance'}
        </button>
      </div>
      {message ? (
        <p
          className={`form-message ${message.toLowerCase().includes('saved') || message.toLowerCase().includes('berhasil') ? 'success' : 'error'}`}
          role="status"
          style={{ marginTop: 12 }}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
