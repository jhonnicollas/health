import { useEffect, useState } from 'react'

type MetricSummary = { metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/monthly', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setMetrics(d.data.metrics); else setError(d.error?.message) })
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
