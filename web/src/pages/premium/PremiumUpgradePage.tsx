import { useEffect, useState } from 'react'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useI18n } from '../../i18n'
import { translateErrorCode } from '../../api/translateError'

type PlanInfo = {
  planCode: string
  planName: string
  billingInterval: string
  durationDays: number | null
  priceAmount: number
  currency: string
  description: string | null
  features?: Record<string, { enabled: boolean; quotaLimit: number | null; quotaWindow: string | null }>
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  premiumMonthly: 'Premium Bulanan',
  premiumQuarterly: 'Premium 3 Bulan',
  premiumYearly: 'Premium Tahunan',
  familyPremium: 'Family Premium'
}
const FEATURE_LABELS: Record<string, string> = {
  'feature.symptomLog.use': 'Catatan Keluhan',
  'feature.hydration.use': 'Pelacak Hidrasi',
  'feature.aiAssistant.use': 'AI Assistant',
  'feature.aiReport.use': 'AI Report',
  'feature.doctorPdf.generate': 'Laporan Dokter PDF',
  'feature.vectorMemory.use': 'Memori AI',
  'feature.telegramReminder.use': 'Reminder Telegram',
  'feature.familyDashboard.use': 'Dashboard Keluarga',
  'feature.cycleTracking.use': 'Pelacak Siklus',
  'feature.advancedHistory.use': 'Riwayat Lanjutan',
  'feature.exportFull.use': 'Ekspor Lengkap',
  'feature.medicationReminder.use': 'Reminder Obat',
  'feature.fastingInsight.use': 'Insight Puasa'
}

export function PremiumUpgradePage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { entitlements } = useEntitlements()
  const { t, locale } = useI18n()
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/plans', { credentials: 'include', headers: { Accept: 'application/json' } })
        const body = await res.json()
        if (res.ok && body.success && body.data?.plans) {
          setPlans(body.data.plans)
        } else {
          const numericPlans: PlanInfo[] = [
            { planCode: 'free', planName: 'Free', billingInterval: 'free', durationDays: null, priceAmount: 0, currency: 'IDR', description: 'Akses dasar' },
            { planCode: 'premiumMonthly', planName: 'Premium Bulanan', billingInterval: 'monthly', durationDays: 30, priceAmount: 49000, currency: 'IDR', description: 'Fitur premium lengkap' },
            { planCode: 'premiumQuarterly', planName: 'Premium 3 Bulan', billingInterval: 'quarterly', durationDays: 90, priceAmount: 129000, currency: 'IDR', description: 'Hemat dengan paket 3 bulan' },
            { planCode: 'premiumYearly', planName: 'Premium Tahunan', billingInterval: 'yearly', durationDays: 365, priceAmount: 399000, currency: 'IDR', description: 'Harga terbaik per bulan' },
            { planCode: 'familyPremium', planName: 'Family Premium', billingInterval: 'monthly', durationDays: 30, priceAmount: 79000, currency: 'IDR', description: 'Premium + monitoring keluarga' }
          ]
          setPlans(numericPlans)
        }
      } catch {
        setError(t('billing.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const currentPlanCode = entitlements?.planCode || 'free'

  const handleSubscribe = async (planCode: string) => {
    if (planCode === 'free' || planCode === currentPlanCode) return
    setSubscribing(planCode)
    setSuccessMsg('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ planCode })
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setSuccessMsg(body.error?.code ? translateErrorCode(body.error.code, locale, body.error.message) : t('billing.checkoutFailed'))
        return
      }
      if (body.data?.checkoutUrl) {
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = body.data.checkoutUrl
      } else {
        setSuccessMsg(t('billing.noCheckoutUrl'))
      }
    } catch {
      setSuccessMsg(t('billing.connError'))
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) return <section className="settings-panel"><div className="page-heading"><h2>{t('billing.upgradeTitle')}</h2></div><p>{t('billing.loadingPlans')}</p></section>
  if (error) return <section className="settings-panel"><div className="page-heading"><h2>{t('billing.upgradeTitle')}</h2></div><p className="form-message error">{error}</p></section>

  const allFeatureCodes = [...new Set(plans.flatMap(p => Object.keys(p.features || {})))].filter(Boolean)

  const freePlan = plans.find(p => p.planCode === 'free')
  const premiumPlan = plans.find(p => p.planCode === 'premiumMonthly') || plans.find(p => p.planCode !== 'free')
  const freeFeatures = freePlan?.features || {}
  const premiumFeatures = premiumPlan?.features || {}

  return (
    <section className="settings-panel premium-page">
      <div className="page-heading">
        <p className="eyebrow">{t('billing.eyebrow')}</p>
        <h2>{t('billing.upgradeTitle')}</h2>
        <p>{t('billing.upgradeSubtitle')} <strong>{PLAN_LABELS[currentPlanCode] || currentPlanCode}</strong></p>
      </div>

      {successMsg && <p className="form-message success" role="status">{successMsg}</p>}

      {/* Free vs Premium comparison */}
      <div style={{ marginTop: 24, overflowX: 'auto' }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>{t('billing.compareTitle')}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid var(--border)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{t('billing.featureLabel')}</th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{t('billing.freeLabel')}</th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{t('billing.premiumLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {allFeatureCodes.map(fc => {
              const free = freeFeatures[fc]
              const premium = premiumFeatures[fc]
              const freeEnabled = free?.enabled
              const premiumEnabled = premium?.enabled
              const isPaidOnly = !freeEnabled && premiumEnabled
              return (
                <tr key={fc} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12 }}>
                    {FEATURE_LABELS[fc] || fc}
                    {free?.quotaLimit ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> (max {free.quotaLimit}/{free.quotaWindow || 'period'})</span> : null}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {freeEnabled ? <span style={{ color: 'var(--success)' }}>{t('billing.freeAvail')}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {premiumEnabled
                      ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{isPaidOnly ? t('billing.paidOnly') : '✅ ' + t('billing.premiumLabel')}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Plan cards */}
      <div className="premium-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
        {plans.map(plan => {
          const isCurrent = plan.planCode === currentPlanCode
          const isSubscribing = subscribing === plan.planCode
          const priceDisplay = plan.billingInterval === 'free' ? t('billing.freeText') : `Rp ${(plan.priceAmount || 0).toLocaleString('id-ID')}/${plan.billingInterval === 'yearly' ? t('billing.perYear') : plan.billingInterval === 'quarterly' ? t('billing.perQuarter') : t('billing.perMonth')}`
          const isPaidPlan = plan.planCode !== 'free'
          
          return (
            <div key={plan.planCode} className={`premium-plan-card ${isCurrent ? 'current' : ''}`}
              style={{
                padding: 24, borderRadius: 16, background: 'var(--surface-2)',
                border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 12
              }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{plan.planName}</h3>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('billing.priceLabel')} {priceDisplay}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{plan.description || ''}</p>
              
              {plan.features && allFeatureCodes.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', fontSize: 13 }}>
                  {allFeatureCodes.map(fc => {
                    const f = plan.features![fc]
                    if (!f) return null
                    return (
                      <li key={fc} style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: f.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                          {f.enabled ? '✅' : '—'}
                        </span>
                        {FEATURE_LABELS[fc] || fc}
                      </li>
                    )
                  })}
                </ul>
              )}

              <button
                className={isCurrent ? 'secondary-btn' : 'primary-btn'}
                disabled={isCurrent || isSubscribing}
                onClick={() => isPaidPlan ? handleSubscribe(plan.planCode) : onNavigate?.('/dashboard')}
                type="button"
                style={{ marginTop: 'auto' }}>
                {isCurrent ? t('billing.planActive') : isSubscribing ? t('billing.processing') : isPaidPlan ? t('billing.upgradeNow') : t('billing.planFreeActive')}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <button className="secondary-btn" onClick={() => onNavigate?.('/dashboard')} type="button">{t('billing.backToDashboard')}</button>
        <button className="secondary-btn" onClick={() => onNavigate?.('/settings/profile')} type="button">{t('billing.profileSettings')}</button>
      </div>
    </section>
  )
}
