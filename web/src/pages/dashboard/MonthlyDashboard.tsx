import { useEffect, useState } from 'react'

type MetricSummary = { metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }

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

  if (loading) return <div className="clinical-empty">Memuat dashboard bulanan...</div>
  if (error) return <div className="clinical-empty dashboard-error">Error: {error}</div>
  if (metrics.length === 0) return <div className="clinical-empty">Belum ada data 30 hari terakhir.</div>

  return (
    <div className="monthly-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Dashboard 30 Hari</h2>
          <p>Ringkasan rata-rata, batas, dan jumlah data dalam satu bulan.</p>
        </div>
        <span className="status-chip">{metrics.length} metrik</span>
      </div>
      <div className="summary-cards">
        {metrics.map(m => (
          <div key={m.metricCode} className="summary-card">
            <span className="stat-kicker">Metric</span>
            <h3>{m.metricCode}</h3>
            <div className="big-value">{m.avgValue?.toFixed(1)}</div>
            <div className="meta">Avg | Min: {m.minValue} | Max: {m.maxValue} | N: {m.cnt}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
export default MonthlyDashboard
