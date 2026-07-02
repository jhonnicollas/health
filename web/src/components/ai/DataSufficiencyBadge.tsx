import { useI18n } from '../../i18n/useI18n'

type Props = {
  score?: number | null
  label?: string | null
}

export function DataSufficiencyBadge({ score, label }: Props) {
  const { t } = useI18n()
  if (score == null && !label) return null
  const displayLabel = label && score != null ? `${score}/100 (${label})` : label ?? (score == null ? '' : `${score}/100`)
  return (
    <div className="data-sufficiency-badge" aria-label={t('ai.clinicalDataSufficiency')}>
      <span className="material-symbols-outlined" aria-hidden="true">bar_chart</span>
      <span>{t('ai.clinicalDataSufficiency')} <strong>{displayLabel}</strong></span>
    </div>
  )
}
