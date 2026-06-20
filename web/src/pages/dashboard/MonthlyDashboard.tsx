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

  if (loading) return <div>Memuat dashboard bulanan...</div>
  if (error) return <div>Error: {error}</div>
  if (metrics.length === 0) return <div>Belum ada data 30 hari terakhir.</div>

  return (
    <div className="monthly-dashboard">
      <h2>Dashboard 30 Hari</h2>
      <div className="summary-cards">
        {metrics.map(m => (
          <div key={m.metricCode} className="summary-card">
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
