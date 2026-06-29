type DataConsentSettingsProps = {
  aiConsent: boolean
  emergencyConsent: boolean
  dataShareConsent: boolean
  consentSaving: boolean
  consentMsg: string
  setAiConsent: (value: boolean) => void
  setEmergencyConsent: (value: boolean) => void
  setDataShareConsent: (value: boolean) => void
  onSave: () => void
}

export function DataConsentSettings({
  aiConsent,
  emergencyConsent,
  dataShareConsent,
  consentSaving,
  consentMsg,
  setAiConsent,
  setEmergencyConsent,
  setDataShareConsent,
  onSave
}: DataConsentSettingsProps) {
  return (
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
        <button className="btn-primary" disabled={consentSaving} onClick={() => void onSave()} type="button" style={{ marginTop: 4 }}>
          {consentSaving ? 'Saving...' : 'Save Consent'}
        </button>
        {consentMsg ? (
          <p
            className={`form-message ${consentMsg.toLowerCase().includes('saved') || consentMsg.toLowerCase().includes('berhasil') ? 'success' : 'error'}`}
            role="status"
          >
            {consentMsg}
          </p>
        ) : null}
      </div>
    </section>
  )
}
