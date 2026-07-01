import { useI18n } from '../../i18n/useI18n'

export function SafetyDisclaimerBox() {
  const { t } = useI18n()
  return (
    <div className="ai-safety-note clinical-disclaimer" role="alert" aria-live="polite">
      <span className="material-symbols-outlined" aria-hidden="true">health_and_safety</span>
      <p>{t('ai.clinicalDisclaimer')}</p>
    </div>
  )
}
