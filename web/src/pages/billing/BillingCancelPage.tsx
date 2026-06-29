import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'

export function BillingCancelPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user } = useAuth()
  const { t } = useI18n()

  if (!user) return <section className="settings-panel"><h2>{t('billing.pleaseLogin')}</h2></section>

  return (
    <section className="settings-panel" style={{ textAlign: 'center', padding: 48 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--warning)' }}>cancel</span>
      <h2>{t('billing.cancelTitle')}</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>{t('billing.cancelMessage')}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
        <button className="primary-btn" onClick={() => onNavigate?.('/premium/upgrade')} type="button">{t('billing.backToUpgrade')}</button>
        <button className="secondary-btn" onClick={() => onNavigate?.('/dashboard')} type="button">{t('billing.backToDashboard')}</button>
      </div>
    </section>
  )
}
