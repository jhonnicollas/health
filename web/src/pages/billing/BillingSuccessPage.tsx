import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

export function BillingSuccessPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending')
  const [planName, setPlanName] = useState('')
  const queryId = new URLSearchParams(window.location.search).get('checkoutId') || ''

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!queryId) { setStatus('failed'); return }
    let polls = 0
    const maxPolls = 15
    const timer = setInterval(async () => {
      polls++
      try {
        const res = await fetch(`/api/billing/checkout/${encodeURIComponent(queryId)}`, { credentials: 'include', headers: { Accept: 'application/json' } })
        const body = await res.json()
        if (res.ok && body.success && body.data) {
          if (body.data.status === 'paid') { setStatus('paid'); setPlanName(body.data.planCode || ''); clearInterval(timer) }
          else if (body.data.status === 'failed' || body.data.status === 'expired') { setStatus('failed'); clearInterval(timer) }
          else if (polls >= maxPolls) { setStatus('failed'); clearInterval(timer) }
        }
      } catch { if (polls >= maxPolls) { setStatus('failed'); clearInterval(timer) } }
    }, 3000)
    return () => clearInterval(timer)
  }, [queryId])

  if (!user) return <section className="settings-panel"><h2>{t('billing.pleaseLogin')}</h2></section>

  return (
    <section className="settings-panel" style={{ textAlign: 'center', padding: 48 }}>
      {status === 'pending' && (
        <div>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--warning)' }}>hourglass_top</span>
          <h2>{t('billing.pendingTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>{t('billing.pendingMessage')}</p>
        </div>
      )}
      {status === 'paid' && (
        <div>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--success)' }}>check_circle</span>
          <h2>{t('billing.successTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>
            {planName ? `${t('billing.successMessagePlan')} ${planName} ${t('billing.successActiveText')}` : t('billing.successMessage')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="primary-btn" onClick={() => onNavigate?.('/dashboard')} type="button">{t('billing.openDashboard')}</button>
            <button className="secondary-btn" onClick={() => onNavigate?.('/ai-assistant')} type="button">{t('billing.tryAi')}</button>
          </div>
        </div>
      )}
      {status === 'failed' && (
        <div>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-critical)' }}>error</span>
          <h2>{t('billing.failedTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>{t('billing.failedMessage')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="primary-btn" onClick={() => onNavigate?.('/premium/upgrade')} type="button">{t('billing.tryAgain')}</button>
            <button className="secondary-btn" onClick={() => onNavigate?.('/dashboard')} type="button">{t('billing.backToDashboard')}</button>
          </div>
        </div>
      )}
    </section>
  )
}
