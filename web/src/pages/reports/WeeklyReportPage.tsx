import { useEffect, useState } from 'react'

type WeeklyMetric = {
  metricCode: string
  avg: number | null
  min: number | null
  max: number | null
  cnt: number
}

type WeeklyData = {
  adherence: number
  alertCount: number
  bestDay: string | null
  worstDay: string | null
  daysWithData: number
  metrics: WeeklyMetric[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyData | null>(null)

  useEffect(() => {
    fetch('/api/reports/weekly', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<WeeklyData>>)
      .then((d) => { if (d.success && d.data) setData(d.data) })
  }, [])

  if (!data) return <div className="clinical-empty">Loading...</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Weekly Report</h2>
          <p>Adherence: {data.adherence}%</p>
        </div>
        <span className="status-chip">{data.metrics.length} metrics</span>
      </div>
      <div className="summary-cards">
        <div className="summary-card"><span className="stat-kicker">Best Day</span><div className="big-value compact">{data.bestDay ?? '-'}</div><p>Most active day</p></div>
        <div className="summary-card"><span className="stat-kicker">Worst Day</span><div className="big-value compact">{data.worstDay ?? '-'}</div><p>Least active day</p></div>
        <div className="summary-card"><span className="stat-kicker">Alerts</span><div className="big-value">{data.alertCount}</div><p>Rule-triggered alerts</p></div>
        <div className="summary-card"><span className="stat-kicker">Days</span><div className="big-value">{data.daysWithData}</div><p>Days with data</p></div>
      </div>
      {data.metrics.length === 0 ? <p className="clinical-empty">Belum ada data pengukuran untuk laporan mingguan.</p> : (
        <table className="report-table">
          <thead>
            <tr><th>Metric</th><th>Avg</th><th>Min</th><th>Max</th><th>N</th></tr>
          </thead>
          <tbody>
            {data.metrics.map((m, i) => (
              <tr key={`${m.metricCode}-${i}`}>
                <td>{m.metricCode}</td>
                <td>{m.avg?.toFixed(1) ?? '-'}</td>
                <td>{m.min ?? '-'}</td>
                <td>{m.max ?? '-'}</td>
                <td>{m.cnt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default WeeklyReportPage
