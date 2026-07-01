import { useI18n } from '../../i18n/useI18n'

export type ContextTraceItem = {
  sourceType: string
  contentPreview?: string
  source?: string
  metricCode?: string
  measuredAt?: string
}

type Props = {
  open: boolean
  onClose: () => void
  trace: ContextTraceItem[]
}

export function ContextTraceDrawer({ open, onClose, trace }: Props) {
  const { t } = useI18n()
  if (!open) return null
  return (
    <div className="context-trace-overlay" onClick={onClose} role="presentation">
      <aside className="context-trace-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('ai.clinicalContextTrace')}>
        <div className="context-trace-header">
          <h3>{t('ai.clinicalContextTrace')}</h3>
          <button onClick={onClose} type="button" aria-label={t('common.close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="context-trace-body">
          {trace.length === 0 ? (
            <p className="muted">{t('ai.clinicalNoTrace')}</p>
          ) : (
            <ul>
              {trace.map((item, idx) => (
                <li key={idx} className="context-trace-item">
                  <span className="trace-source">{item.sourceType}</span>
                  <p className="trace-preview">{item.contentPreview ?? item.metricCode ?? t('ai.clinicalNoTrace')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
