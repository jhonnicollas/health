import { useEffect, useState } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'

type Comparison = {
  avg3day: number | null
  avg7day: number | null
}

type MetricValue = {
  id: number
  sessionId: number
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
  createdAt: string
  comparisons?: Comparison
}

type Alert = {
  id: number
  metricCode: string
  finalValue: number
  unit: string
  severity: string
  message: string
  createdAt: string
}

type DashboardData = {
  date: string
  metricCount: number
  sessionCount: number
  emergencyCount: number
  hasData: boolean
  values: MetricValue[]
  alerts: Alert[]
  streak?: number
  bestStreak?: number
  aiInsight?: string
}

const METRIC_LABELS: Record<string, string> = {
  spo2: 'SpO2',
  heartRate: 'Heart Rate',
  systolic: 'Systolic',
  diastolic: 'Diastolic',
  bloodPressurePulse: 'Pulse',
  glucoseFasting: 'Fasting Glucose',
  glucosePostMeal: 'Post-Meal Glucose',
  cholesterolTotal: 'Total Cholesterol',
  uricAcid: 'Uric Acid',
  bodyWeight: 'Body Weight',
  bmi: 'BMI',
  waistCircumference: 'Waist',
  bodyTemperature: 'Body Temp',
  sleepDuration: 'Sleep',
  height: 'Height'
}

const METRIC_ICONS: Record<string, string> = {
  spo2: 'air',
  heartRate: 'favorite',
  systolic: 'favorite',
  diastolic: 'favorite',
  bloodPressurePulse: 'monitor_heart',
  glucoseFasting: 'water_drop',
  glucosePostMeal: 'water_drop',
  cholesterolTotal: 'biotech',
  uricAcid: 'science',
  bodyWeight: 'monitor_weight',
  bmi: 'straighten',
  waistCircumference: 'straighten',
  bodyTemperature: 'thermostat',
  sleepDuration: 'bedtime',
  height: 'height'
}

const SEVERITY_BADGE: Record<string, { label: string, className: string }> = {
  normal: { label: 'Normal', className: 'badge-normal' },
  info: { label: 'Info', className: 'badge-info' },
  warning: { label: 'Warning', className: 'badge-warning' },
  high: { label: 'High', className: 'badge-high' },
  critical: { label: 'Critical', className: 'badge-critical' },
  emergency: { label: 'Emergency', className: 'badge-emergency' }
}

export function TodayDashboard({ onNavigateTab }: { onNavigateTab?: (path: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard/today', { credentials: 'include' })
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error?.message || 'Failed to load dashboard')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  if (loading) {
    return <div className="dashboard-loading clinical-empty">Loading dashboard...</div>
  }

  if (error) {
    return <div className="dashboard-error clinical-empty">Error: {error}</div>
  }

  if (!data || !data.hasData) {
    return (
      <div className="dashboard-empty clinical-empty">
        <h2>Today</h2>
        <p>No measurements recorded today.</p>
        <p>Start logging your health measurements.</p>
      </div>
    )
  }

  function pctDiff(current: number, avg: number | null): { pct: string; icon: string; cls: string } | null {
    if (avg === null || avg === 0) return null
    const diff = ((current - avg) / avg) * 100
    const abs = Math.abs(diff)
    const pct = (diff >= 0 ? '+' : '') + diff.toFixed(0) + '%'
    if (abs < 1) return { pct: '0%', icon: 'trending_flat', cls: 'text-tertiary' }
    if (diff > 0) return { pct, icon: 'trending_up', cls: 'text-error' }
    return { pct, icon: 'trending_down', cls: '' }
  }

  function TrendRow({ label, current, avg }: { label: string; current: number; avg: number | null }) {
    const trend = pctDiff(current, avg)
    if (!trend) return null
    return (
      <div className="vital-comparison-row">
        <span>{label}</span>
        <span className={trend.cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{trend.icon}</span>
          {trend.pct}
        </span>
      </div>
    )
  }

  return (
    <div className="today-dashboard">
      <div className="dashboard-bento">
        <div className="bento-streak">
          <div className="streak-icon" aria-hidden="true">
            <span className="material-symbols-outlined fill">local_fire_department</span>
          </div>
          <div className="streak-info">
            <h3>Streak: {data.streak ?? data.sessionCount} Days!</h3>
            <p>Best Streak: {data.bestStreak ?? data.sessionCount} Days</p>
          </div>
        </div>
        <div className="bento-ai-insight">
          <div className="ai-insight-label">
            <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
            <span>AI CLINICAL INSIGHT</span>
          </div>
          <p>{data.aiInsight ?? 'Your vitals are being tracked. Continue logging for personalized insights.'}</p>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className="tab-btn active" type="button" onClick={() => onNavigateTab?.('/dashboard')}>Today</button>
        <button className="tab-btn" type="button" onClick={() => onNavigateTab?.('/dashboard/week')}>Weekly View</button>
        <button className="tab-btn" type="button" onClick={() => onNavigateTab?.('/dashboard/month')}>Monthly Summary</button>
      </div>

      {data.alerts.length > 0 && (
        <div className="dashboard-alerts">
          <h3>Alerts Today</h3>
          {data.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.severity}`}>
              <strong>{METRIC_LABELS[alert.metricCode] || alert.metricCode}</strong>: {alert.finalValue} {alert.unit}
              <p>{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="vitals-grid">
        {data.values.map(v => {
          const badge = SEVERITY_BADGE[v.severity] || SEVERITY_BADGE[v.status] || { label: v.status, className: 'badge-info' }
          const comp = v.comparisons
          return (
            <div key={v.id} className={`vital-card severity-${v.severity}`}>
              <div className="vital-card-header">
                <div className="vital-card-label">
                  <span className="material-symbols-outlined vital-icon" aria-hidden="true">
                    {METRIC_ICONS[v.metricCode] ?? 'monitor_heart'}
                  </span>
                  <span className="vital-label-text"><MedicalTerm term={METRIC_LABELS[v.metricCode] || v.metricCode} shortDef={MEDICAL_GLOSSARY[v.metricCode] || ''} /></span>
                </div>
                <span className={`vital-badge ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="vital-reading-row">
                <span className="vital-reading">{v.finalValue}</span>
                <span className="vital-unit">{v.unit}</span>
              </div>
              {comp && (
                <div className="vital-comparison-rows">
                  <TrendRow label="vs 3-day avg" current={v.finalValue} avg={comp.avg3day} />
                  <TrendRow label="vs 7-day avg" current={v.finalValue} avg={comp.avg7day} />
                </div>
              )}
              <div className="vital-meta">
                {v.manualOverride === 1 && <span className="badge-override">Manual</span>}
                <span className={`badge-status status-${v.status}`}>{v.status}</span>
              </div>
            </div>
          )
        })}
      </div>

      {data.values.length > 0 ? (
        <div className="dashboard-chart-card">
          <h3>Tren 7 Hari Terakhir</h3>
          <div className="dashboard-chart-grid">
            {['systolic','diastolic','spo2','heartRate','bodyWeight','bodyTemperature','sleepDuration'].map(code => {
              const v = data.values.find(x => x.metricCode === code)
              if (!v) return null
              const comp = v.comparisons?.avg7day ?? null
              const max = comp && comp > 0 ? Math.max(v.finalValue, comp) : v.finalValue * 1.2
              const min = comp && comp > 0 ? Math.min(v.finalValue, comp) * 0.8 : 0
              const range = max - min
              const heightPct = range > 0 ? Math.min(100, Math.max(5, ((v.finalValue - min) / range) * 100)) : 50
              const sev = v.severity || 'normal'
              return (
                <div key={code} className="dashboard-chart-col">
                  <div className="dashboard-chart-bar-wrap">
                    <div className={`dashboard-chart-bar ${sev}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="dashboard-chart-label">{METRIC_LABELS[code] || code}</span>
                  <strong className="dashboard-chart-value">{v.finalValue} {v.unit}</strong>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default TodayDashboard
