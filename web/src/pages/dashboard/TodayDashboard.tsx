import { useEffect, useState } from 'react'

type MetricValue = {
  id: string
  sessionId: string
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
  createdAt: string
}

type Alert = {
  id: string
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

export function TodayDashboard() {
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

  return (
    <div className="today-dashboard">
      <div className="dashboard-bento">
        <div className="bento-streak">
          <div className="streak-icon" aria-hidden="true">🔥</div>
          <div className="streak-info">
            <h3>Streak: {data.streak ?? data.sessionCount} Days!</h3>
            <p>Best Streak: {data.bestStreak ?? data.sessionCount} Days</p>
          </div>
        </div>
        <div className="bento-ai-insight">
          <div className="ai-insight-label">
            <span aria-hidden="true">⬡</span>
            <span>AI CLINICAL INSIGHT</span>
          </div>
          <p>{data.aiInsight ?? 'Your vitals are being tracked. Continue logging for personalized insights.'}</p>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className="tab-btn active" type="button">Today</button>
        <button className="tab-btn" type="button">Weekly View</button>
        <button className="tab-btn" type="button">Monthly Summary</button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-kicker">Measured</span>
          <div className="stat-value">{data.metricCount}</div>
          <div className="stat-label">Metrics Recorded</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Sessions</span>
          <div className="stat-value">{data.sessionCount}</div>
          <div className="stat-label">Sessions</div>
        </div>
        {data.emergencyCount > 0 && (
          <div className="stat-card emergency">
            <span className="stat-kicker">Emergency</span>
            <div className="stat-value">{data.emergencyCount}</div>
            <div className="stat-label">Alerts</div>
          </div>
        )}
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
          return (
            <div key={v.id} className={`vital-card severity-${v.severity}`}>
              <div className="vital-card-header">
                <div className="vital-card-label">
                  <span className="vital-icon" aria-hidden="true">{METRIC_ICONS[v.metricCode] ? '●' : '●'}</span>
                  <span className="vital-label-text">{METRIC_LABELS[v.metricCode] || v.metricCode}</span>
                </div>
                <span className={`vital-badge ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="vital-reading-row">
                <span className="vital-reading">{v.finalValue}</span>
                <span className="vital-unit">{v.unit}</span>
              </div>
              <div className="vital-meta">
                {v.manualOverride === 1 && <span className="badge-override">Manual</span>}
                <span className={`badge-status status-${v.status}`}>{v.status}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TodayDashboard
