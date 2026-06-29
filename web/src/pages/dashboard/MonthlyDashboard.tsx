import { useEffect, useState } from 'react'
import { formatDateID } from '../../utils/dateFormat'

type MetricSummary = { metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }
type DaySummary = { day: string; sessionCount: number }
type LatestMetric = { metricCode: string; finalValue: number; unit: string; status: string; severity: string; measuredAt: string }
type MonthlyPayload = {
  metrics: MetricSummary[]
  measurementDays: number
  alertCount: number
  daily: DaySummary[]
  latest: LatestMetric[]
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

export function MonthlyDashboard() {
  const [metrics, setMetrics] = useState<MetricSummary[]>([])
  const [measurementDays, setMeasurementDays] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [daily, setDaily] = useState<DaySummary[]>([])
  const [latest, setLatest] = useState<LatestMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/monthly', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Gagal memuat dashboard bulanan.'); return r.json() })
      .then((d: { success: boolean; data?: MonthlyPayload; error?: { message?: string } }) => {
        if (d.success && d.data) {
          setMetrics(d.data.metrics)
          setMeasurementDays(d.data.measurementDays)
          setAlertCount(d.data.alertCount)
          setDaily(d.data.daily)
          setLatest(d.data.latest)
        } else {
          setError(d.error?.message ?? 'Failed to load monthly dashboard.')
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="clinical-empty">Loading monthly dashboard...</div>
  if (error) return <div className="clinical-empty dashboard-error">Error: {error}</div>
  if (metrics.length === 0) return <div className="clinical-empty">No data for the past 30 days.</div>

  return (
    <div className="monthly-dashboard">
      <div className="dashboard-tabs">
        <button className="tab-btn" type="button">Today</button>
        <button className="tab-btn" type="button">Weekly View</button>
        <button className="tab-btn active" type="button">Monthly Summary</button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-kicker">Measurement Days</span>
          <div className="stat-value">{measurementDays}</div>
          <div className="stat-label">days with data</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Alert Count</span>
          <div className="stat-value">{alertCount}</div>
          <div className="stat-label">last 30 days</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Latest Metrics</span>
          <div className="stat-value">{latest.length}</div>
          <div className="stat-label">recent entries</div>
        </div>
      </div>

      {daily.length > 0 ? (
        <div className="monthly-bars" aria-label="Monthly measurement days chart">
          {daily.map((day) => (
            <div key={day.day} className="monthly-bar-item">
              <span className="monthly-bar" style={{ height: `${Math.max(18, Math.min(100, day.sessionCount * 24))}%` }} />
              <small>{formatDateID(day.day)}</small>
            </div>
          ))}
        </div>
      ) : null}

      <div className="vitals-grid">
        {metrics.map(m => {
          const label = METRIC_LABELS[m.metricCode] || m.metricCode
          return (
            <div key={m.metricCode} className="vital-card">
              <div className="vital-card-header">
                <div className="vital-card-label">
                  <span className="vital-label-text">{label}</span>
                </div>
              </div>
              <div className="vital-reading-row">
                <span className="vital-reading">{m.avgValue?.toFixed(1)}</span>
                <span className="vital-unit">avg</span>
              </div>
              <div className="vital-comparison-rows">
                <div className="vital-comparison-row">
                  <span>Min</span>
                  <span>{m.minValue}</span>
                </div>
                <div className="vital-comparison-row">
                  <span>Max</span>
                  <span>{m.maxValue}</span>
                </div>
                <div className="vital-comparison-row">
                  <span>Readings</span>
                  <span>{m.cnt}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default MonthlyDashboard
