type SettingsCenterProps = {
  exporting: boolean
  exportMessage: string
  seeding: boolean
  seedMessage: string
  onExport: () => void
  onSeed: () => void
}

export function SettingsCenter({
  exporting,
  exportMessage,
  seeding,
  seedMessage,
  onExport,
  onSeed
}: SettingsCenterProps) {
  const settingsLinks = [
    { icon: 'alarm', label: 'Reminders', desc: 'Schedule measurement reminders', path: '/reminders' },
    { icon: 'send', label: 'Telegram', desc: 'Link Telegram for instant alerts', path: '/telegram' },
    { icon: 'medication', label: 'Medications', desc: 'Track medication schedule', path: '/medications' },
    { icon: 'group', label: 'Family / Caregiver', desc: 'Manage access permissions', path: '/family' },
    { icon: 'emergency', label: 'Emergency Contacts', desc: 'Configure emergency alerts', path: '/emergency' },
    { icon: 'delete_forever', label: 'Delete Account', desc: 'Remove all data permanently', path: '/settings/delete' }
  ]

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>tune</span>
        Settings Center
      </h3>
      <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 16 }}>Manage all app configurations and preferences.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {settingsLinks.map((item) => (
          <a
            key={item.path}
            href={item.path}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', textDecoration: 'none', color: 'var(--colorText)', transition: 'background 0.15s' }}
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
          onClick={() => void onExport()}
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
          onClick={() => void onSeed()}
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
        {seedMessage ? (
          <p
            className={`form-message ${seedMessage.toLowerCase().includes('created') || seedMessage.toLowerCase().includes('berhasil') ? 'success' : 'error'}`}
            role="status"
          >
            {seedMessage}
          </p>
        ) : null}
      </div>
    </section>
  )
}
