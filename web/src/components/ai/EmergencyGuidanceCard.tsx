import { useI18n } from '../../i18n/useI18n'

export function EmergencyGuidanceCard({ text }: { text: string }) {
  const { locale } = useI18n()
  const isEn = locale === 'en-US'
  const callLabel = isEn ? 'Call Emergency' : 'Panggil Darurat'
  const caregiverLabel = isEn ? 'Contact Caregiver' : 'Hubungi Caregiver'

  return (
    <article
      className="chat-bubble assistant emergency-guidance"
      role="alert"
      aria-live="assertive"
      style={{
        borderColor: 'var(--colorStatusCritical, #d32f2f)',
        background: 'color-mix(in srgb, var(--colorStatusCritical, #d32f2f) 8%, var(--colorSurfaceElevated))',
      }}
    >
      <div className="chat-meta">
        <span className="material-symbols-outlined" aria-hidden="true" style={{ color: 'var(--colorStatusCritical, #d32f2f)' }}>
          emergency
        </span>
        <span style={{ color: 'var(--colorStatusCritical, #d32f2f)', fontWeight: 700 }}>
          {isEn ? 'EMERGENCY WARNING' : 'PERINGATAN DARURAT'}
        </span>
      </div>
      <p style={{ color: 'var(--colorTextPrimary)' }}>{text}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <a
          href="tel:119"
          className="btn-primary"
          style={{
            background: 'var(--colorStatusCritical, #d32f2f)',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">phone</span>
          {callLabel} 119 / 112
        </a>
        <a
          href="/family"
          className="btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          {caregiverLabel}
        </a>
      </div>
      <p className="ai-disclaimer" style={{ fontSize: '0.85rem', color: 'var(--colorTextSecondary)', marginTop: 8 }}>
        {isEn
          ? '⚕️ AI can be wrong. This is not a diagnosis. Call emergency services if in doubt.'
          : '⚕️ AI bisa salah. Ini bukan diagnosis. Hubungi layanan darurat jika ragu.'}
      </p>
    </article>
  )
}
