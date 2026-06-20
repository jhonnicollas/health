import { useEffect, useState } from 'react'
import { TrendBadge, type TrendDirection } from '../../components/dashboard/TrendBadge'

type MetricSummary = { metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }
type DailyPoint = { day: string; metricCode: string; avgValue: number }

export function WeeklyDashboard() {
  const [metrics, setMetrics] = useState<MetricSummary[]>([])
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/weekly', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setMetrics(d.data.metrics); setDaily(d.data.daily) } else { setError(d.error?.message) } })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Memuat dashboard mingguan...</div>
  if (error) return <div>Error: {error}</div>
  if (metrics.length === 0) return <div>Belum ada data 7 hari terakhir.</div>

  const grouped = new Map<string, DailyPoint[]>()
  for (const p of daily) {
    if (!grouped.has(p.metricCode)) grouped.set(p.metricCode, [])
    grouped.get(p.metricCode)!.push(p)
  }

  return (
    <div className="weekly-dashboard">
      <h2>Dashboard 7 Hari</h2>
      {metrics.map(m => {
        const points = grouped.get(m.metricCode) || []
        const first = points[0]?.avgValue || 0
        const last = points[points.length - 1]?.avgValue || 0
        let direction: TrendDirection = 'insufficient'
        let percent = 0
        if (points.length >= 2 && first > 0) {
          percent = ((last - first) / first) * 100
          if (Math.abs(percent) < 2) direction = 'stable'
          else direction = percent > 0 ? 'up' : 'down'
        }
        return (
          <div key={m.metricCode} className="metric-summary">
            <div className="metric-header">
              <strong>{m.metricCode}</strong>
              <TrendBadge direction={direction} percent={percent} />
            </div>
            <div className="metric-stats">
              <span>Avg: {m.avgValue?.toFixed(1)}</span>
              <span>Min: {m.minValue}</span>
              <span>Max: {m.maxValue}</span>
              <span>Count: {m.cnt}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default WeeklyDashboard
