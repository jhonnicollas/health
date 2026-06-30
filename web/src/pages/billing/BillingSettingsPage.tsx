import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

type SubscriptionInfo = {
  planCode: string
  status: string
  provider: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

type Invoice = {
  checkoutId: string
  planCode: string
  amount: number
  currency: string
  status: string
  provider: string
  createdAt: string
  paidAt: string | null
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  premiumMonthly: 'Premium Bulanan',
  premiumQuarterly: 'Premium 3 Bulan',
  premiumYearly: 'Premium Tahunan',
  familyPremium: 'Family Premium'
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: 'color-mix(in srgb, #22c55e 15%, transparent)', color: '#16a34a', label: 'Aktif' },
  trialing: { bg: 'color-mix(in srgb, #3b82f6 15%, transparent)', color: '#2563eb', label: 'Trial' },
  past_due: { bg: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#d97706', label: 'Menunggu' },
  canceled: { bg: 'color-mix(in srgb, #ef4444 15%, transparent)', color: '#dc2626', label: 'Dibatalkan' },
  inactive: { bg: 'color-mix(in srgb, #6b7280 15%, transparent)', color: '#4b5563', label: 'Nonaktif' }
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.inactive
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: style.bg, color: style.color, display: 'inline-block'
    }}>
      {style.label}
    </span>
  )
}

function SkeletonLine({ width }: { width: number }) {
  return <div className="skeleton" style={{ width, height: 16, borderRadius: 4, marginBottom: 8 }} />
}

export function BillingSettingsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [subRes, invRes] = await Promise.all([
          fetch('/api/billing/my-subscription', { credentials: 'include', headers: { Accept: 'application/json' } }),
          fetch('/api/billing/invoices', { credentials: 'include', headers: { Accept: 'application/json' } })
        ])
        if (!subRes.ok || !invRes.ok) { setError(t('billing.loadBillingFailed')); return }
        const subBody = await subRes.json()
        const invBody = await invRes.json()
        if (subBody.success) setSub(subBody.data)
        if (invBody.success) setInvoices(invBody.data || [])
      } catch { setError(t('billing.connError')) }
      finally { setLoading(false) }
    }
    void load()
  }, [t])

  async function handleCancel() {
    if (!sub || !confirm('Yakin ingin membatalkan langganan? Akses premium akan tetap aktif sampai akhir periode.')) return
    setCanceling(true)
    try {
      const r = await fetch('/api/billing/cancel-subscription', { method: 'POST', credentials: 'include' })
      const j = await r.json()
      if (j.success) {
        setSub(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : null)
      } else {
        setError(j.error?.message || 'Gagal membatalkan.')
      }
    } catch { setError(t('billing.connError')) }
    finally { setCanceling(false) }
  }

  if (!user) return (
    <section className="settings-panel">
      <div className="empty-state">
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--colorTextMuted)' }}>login</span>
        <h2>{t('billing.pleaseLogin')}</h2>
      </div>
    </section>
  )

  if (loading) return (
    <section className="settings-panel">
      <div className="page-heading"><h2>{t('billing.billingSettingsTitle')}</h2></div>
      <div className="card" style={{ padding: 24 }}>
        <SkeletonLine width={200} />
        <SkeletonLine width={300} />
        <SkeletonLine width={250} />
        <SkeletonLine width={180} />
      </div>
    </section>
  )

  if (error) return (
    <section className="settings-panel">
      <div className="page-heading"><h2>{t('billing.billingSettingsTitle')}</h2></div>
      <div className="form-message error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    </section>
  )

  return (
    <section className="settings-panel">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Billing</p>
          <h2>{t('billing.billingSettingsTitle')}</h2>
          <p>Kelola langganan dan riwayat pembayaran Anda.</p>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>card_membership</span>
            {t('billing.currentSubscription')}
          </h3>
          {sub && <StatusBadge status={sub.status} />}
        </div>

        {sub ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div>
                <p style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)', margin: '0 0 4px' }}>{t('billing.plan')}</p>
                <p style={{ font: 'var(--typLabelMd)', margin: 0 }}>{PLAN_NAMES[sub.planCode] || sub.planCode}</p>
              </div>
              <div>
                <p style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)', margin: '0 0 4px' }}>{t('billing.provider')}</p>
                <p style={{ font: 'var(--typLabelMd)', margin: 0, textTransform: 'capitalize' }}>{sub.provider}</p>
              </div>
              {sub.currentPeriodStart && (
                <div>
                  <p style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)', margin: '0 0 4px' }}>{t('billing.startDate')}</p>
                  <p style={{ font: 'var(--typLabelMd)', margin: 0 }}>{sub.currentPeriodStart.slice(0, 10)}</p>
                </div>
              )}
              {sub.currentPeriodEnd && (
                <div>
                  <p style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)', margin: '0 0 4px' }}>{t('billing.endDate')}</p>
                  <p style={{ font: 'var(--typLabelMd)', margin: 0 }}>{sub.currentPeriodEnd.slice(0, 10)}</p>
                </div>
              )}
            </div>
            {sub.cancelAtPeriodEnd && (
              <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in srgb, var(--warning) 10%, transparent)', color: 'var(--warning)', fontSize: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>info</span>
                Langganan akan berakhir pada akhir periode saat ini.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-primary" onClick={() => onNavigate?.('/premium/upgrade')} type="button">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upgrade</span>
                {t('billing.upgradePlan')}
              </button>
              {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                <button className="btn-secondary" disabled={canceling} onClick={handleCancel} type="button">
                  {canceling ? 'Membatalkan...' : 'Batalkan Langganan'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--colorTextMuted)' }}>card_membership</span>
            <p style={{ color: 'var(--colorTextSecondary)' }}>{t('billing.noSubscription')}</p>
            <button className="btn-primary" onClick={() => onNavigate?.('/premium/upgrade')} type="button" style={{ marginTop: 12 }}>
              {t('billing.upgradePlan')}
            </button>
          </div>
        )}
      </div>

      {/* Invoice History */}
      {invoices.length > 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>receipt_long</span>
            {t('billing.invoiceHistory')}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--colorBorderSoft)' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'left', font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)' }}>{t('billing.invoicePlan')}</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)' }}>{t('billing.invoiceAmount')}</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)' }}>{t('billing.invoiceStatus')}</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', font: 'var(--typLabelSm)', color: 'var(--colorTextMuted)' }}>{t('billing.invoiceDate')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.checkoutId} style={{ borderBottom: '1px solid var(--colorBorderSoft)', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--colorSurfaceHover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 10px' }}>
                      <strong style={{ font: 'var(--typLabelMd)' }}>{PLAN_NAMES[inv.planCode] || inv.planCode}</strong>
                      <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)', margin: '2px 0 0' }}>{inv.provider}</p>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', font: 'var(--typLabelMd)' }}>
                      Rp {(inv.amount || 0).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                        background: inv.status === 'paid' ? 'color-mix(in srgb, #22c55e 15%, transparent)' :
                                     inv.status === 'failed' ? 'color-mix(in srgb, #ef4444 15%, transparent)' :
                                     'color-mix(in srgb, #f59e0b 15%, transparent)',
                        color: inv.status === 'paid' ? '#16a34a' : inv.status === 'failed' ? '#dc2626' : '#d97706'
                      }}>{inv.status}</span>
                    </td>
                    <td style={{ padding: '12px 10px', font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>
                      {inv.createdAt?.slice(0, 10)}
                      {inv.paidAt && <p style={{ margin: '2px 0 0', color: 'var(--colorTextMuted)' }}>Paid: {inv.paidAt.slice(0, 10)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--colorTextMuted)' }}>receipt</span>
          <p style={{ color: 'var(--colorTextSecondary)', marginTop: 8 }}>Belum ada riwayat pembayaran.</p>
        </div>
      )}
    </section>
  )
}
