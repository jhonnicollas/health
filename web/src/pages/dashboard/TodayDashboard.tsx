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
}

const METRIC_LABELS: Record<string, string> = {
  spo2: 'SpO2',
  heartRate: 'Detak Jantung',
  systolic: 'Sistolik',
  diastolic: 'Diastolik',
  bloodPressurePulse: 'Nadi',
  glucoseFasting: 'Gula Darah Puasa',
  glucosePostMeal: 'Gula Darah Setelah Makan',
  cholesterolTotal: 'Kolesterol Total',
  uricAcid: 'Asam Urat',
  bodyWeight: 'Berat Badan',
  bmi: 'BMI',
  waistCircumference: 'Lingkar Pinggang',
  bodyTemperature: 'Suhu Tubuh',
  sleepDuration: 'Durasi Tidur',
  height: 'Tinggi Badan'
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
          setError(result.error?.message || 'Gagal memuat dashboard')
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
    return <div className="dashboard-loading clinical-empty">Memuat dashboard...</div>
  }

  if (error) {
    return <div className="dashboard-error clinical-empty">Error: {error}</div>
  }

  if (!data || !data.hasData) {
    return (
      <div className="dashboard-empty clinical-empty">
        <p className="eyebrow">Dashboard</p>
        <h2>Hari Ini</h2>
        <p>Belum ada pengukuran hari ini.</p>
        <p>Mulai catat pengukuran kesehatan Anda.</p>
      </div>
    )
  }

  return (
    <div className="today-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Dashboard Hari Ini</h2>
          <p className="dashboard-date">{data.date}</p>
        </div>
        <span className="status-chip">Rule Engine Active</span>
      </div>
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-kicker">Terukur</span>
          <div className="stat-value">{data.metricCount}</div>
          <div className="stat-label">Metrik Tercatat</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Sesi</span>
          <div className="stat-value">{data.sessionCount}</div>
          <div className="stat-label">Sesi</div>
        </div>
        {data.emergencyCount > 0 && (
          <div className="stat-card emergency">
            <span className="stat-kicker">Darurat</span>
            <div className="stat-value">{data.emergencyCount}</div>
            <div className="stat-label">Peringatan</div>
          </div>
        )}
      </div>

      {data.alerts.length > 0 && (
        <div className="dashboard-alerts">
          <h3>Peringatan Hari Ini</h3>
          {data.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.severity}`}>
              <strong>{METRIC_LABELS[alert.metricCode] || alert.metricCode}</strong>: {alert.finalValue} {alert.unit}
              <p>{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-values">
        <h3>Nilai Metrik</h3>
        {data.values.map(v => (
          <div key={v.id} className={`value-card severity-${v.severity}`}>
            <div className="value-name">{METRIC_LABELS[v.metricCode] || v.metricCode}</div>
            <div className="value-reading">
              {v.finalValue} <span className="value-unit">{v.unit}</span>
            </div>
            <div className="value-meta">
              {v.manualOverride === 1 && <span className="badge-override">Manual</span>}
              <span className={`badge-status status-${v.status}`}>{v.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TodayDashboard
