/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { apiGet } from '../../../pages/admin/api'
import { Loading } from '../Loading'
import { Section } from '../Section'
import type { TabProps } from '../../../pages/admin/types'

export function OverviewTab({ onTab }: TabProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiGet('/api/admin/metrics').then(r => {
      setLoading(false)
      if (r.success) setMetrics(r.data)
    })
  }, [])
  if (loading) return <Loading />
  const cards = metrics
    ? [
        { label: 'Users', value: metrics.users, trend: '+11% active', tone: 'success' },
        { label: 'Premium', value: metrics.subscriptions, trend: '24% conversion', tone: 'info' },
        { label: 'AI Calls', value: metrics.aiCalls ?? '—', trend: 'quota guarded', tone: 'warning' },
        { label: 'Safety', value: metrics.safetyEvents, trend: 'red flag events', tone: 'critical' },
      ]
    : []
  return (
    <Section title="Dashboard Metrics">
      <div
        className="admin-metric-cards"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}
      >
        {cards.map(c => (
          <div
            key={c.label}
            className="admin-metric-card"
            style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid var(--border, #e5e7eb)' }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary, #6b7280)',
              }}
            >
              {c.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, margin: '4px 0' }}>{c.value}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: c.tone === 'success' ? '#047857' : c.tone === 'info' ? '#0369a1' : c.tone === 'warning' ? '#b45309' : '#dc2626',
              }}
            >
              {c.trend}
            </div>
          </div>
        ))}
      </div>
      <div className="admin-overview-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <button onClick={() => onTab?.('users')} className="admin-action-btn">
          <span className="material-symbols-outlined">manage_accounts</span>Manage Users
        </button>
        <button onClick={() => onTab?.('plan-features')} className="admin-action-btn">
          <span className="material-symbols-outlined">workspace_premium</span>Plan Editor
        </button>
        <button onClick={() => onTab?.('audit-logs')} className="admin-action-btn">
          <span className="material-symbols-outlined">fact_check</span>Audit Logs
        </button>
      </div>
    </Section>
  )
}
