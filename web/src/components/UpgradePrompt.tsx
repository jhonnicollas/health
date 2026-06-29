import { useI18n } from '../i18n'

export function UpgradePrompt({ feature, onNavigate }: { feature: string; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  return (
    <section className="app-content-area">
      <div className="app-header"><h1>{t('billing.upgradeRequired')}</h1></div>
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 32, borderRadius: 16, background: 'var(--surface-2)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--warning)' }}>lock</span>
          <h2 style={{ marginTop: 16 }}>{feature}</h2>
          <p style={{ margin: '16px 0', color: 'var(--text-secondary)' }}>
            {t('billing.upgradePromptMsg')}
          </p>
          <button className="primary-btn" onClick={() => onNavigate('/premium/upgrade')} type="button">
            {t('billing.viewPlans')}
          </button>
          <button className="secondary-btn" onClick={() => onNavigate('/dashboard')} type="button" style={{ marginLeft: 12 }}>
            {t('billing.backToDashboard')}
          </button>
        </div>
      </div>
    </section>
  )
}
