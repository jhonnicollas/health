type NotificationSettingsProps = {
  onNavigate?: (path: string) => void
}

export function NotificationSettings({ onNavigate }: NotificationSettingsProps) {
  return (
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
  )
}
