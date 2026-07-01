import { useI18n } from '../../i18n/useI18n'

export function FirstAidProtocolCard({
  title,
  redFlags,
  doSteps,
  dontSteps,
  seekHelp,
  reviewerStatus,
}: {
  title: string
  redFlags: string[]
  doSteps: string[]
  dontSteps: string[]
  seekHelp: string[]
  reviewerStatus: string
}) {
  const { locale } = useI18n()
  const isEn = locale === 'en-US'
  const labels = isEn
    ? { redFlags: 'Red Flags', do: 'DO', dont: "DON'T", seek: 'Seek Help Now', footer: 'Reviewer status' }
    : { redFlags: 'Tanda Bahaya', do: 'Lakukan', dont: 'Jangan Dilakukan', seek: 'Segera Cari Bantuan', footer: 'Status reviewer' }

  return (
    <article
      className="chat-bubble assistant first-aid-protocol"
      role="region"
      aria-label={isEn ? 'First aid guidance' : 'Panduan P3K'}
    >
      <div className="chat-meta">
        <span className="material-symbols-outlined" aria-hidden="true" style={{ color: 'var(--colorSuccess, #2e7d32)' }}>
          health_and_safety
        </span>
        <span style={{ fontWeight: 700 }}>{title}</span>
      </div>

      {redFlags.length > 0 && (
        <section style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'color-mix(in srgb, var(--colorStatusCritical, #d32f2f) 8%, var(--colorSurface))' }}>
          <strong style={{ color: 'var(--colorStatusCritical, #d32f2f)' }}>🔴 {labels.redFlags}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {redFlags.map((s, i) => <li key={`rf-${i}`}>{s}</li>)}
          </ul>
        </section>
      )}

      {doSteps.length > 0 && (
        <section style={{ marginTop: 10 }}>
          <strong style={{ color: 'var(--colorSuccess, #2e7d32)' }}>🟢 {labels.do}</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: 22 }}>
            {doSteps.map((s, i) => <li key={`do-${i}`}>{s}</li>)}
          </ol>
        </section>
      )}

      {dontSteps.length > 0 && (
        <section style={{ marginTop: 10 }}>
          <strong style={{ color: 'var(--colorStatusCritical, #d32f2f)' }}>🔴 {labels.dont}</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: 22 }}>
            {dontSteps.map((s, i) => <li key={`dont-${i}`}>{s}</li>)}
          </ol>
        </section>
      )}

      {seekHelp.length > 0 && (
        <section style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'color-mix(in srgb, var(--colorStatusWarning, #f57c00) 8%, var(--colorSurface))' }}>
          <strong style={{ color: 'var(--colorStatusWarning, #f57c00)' }}>🟠 {labels.seek}</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: 22 }}>
            {seekHelp.map((s, i) => <li key={`seek-${i}`}>{s}</li>)}
          </ol>
        </section>
      )}

      <p className="ai-disclaimer" style={{ fontSize: '0.8rem', color: 'var(--colorTextSecondary)', marginTop: 12 }}>
        {labels.footer}: {reviewerStatus}
      </p>
    </article>
  )
}
