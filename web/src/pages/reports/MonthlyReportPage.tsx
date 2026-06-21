import { useEffect, useState } from 'react'

type MonthlyMetric = {
  metricCode: string
  avg: number | null
  min: number | null
  max: number | null
  latest: number | null
  cnt: number
}

type MonthlyData = {
  sessionCount: number
  daysWithData: number
  alertCount: number
  aiMonthlySummary: string | null
  metrics: MonthlyMetric[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function MonthlyReportPage() {
  const [data, setData] = useState<MonthlyData | null>(null)

  useEffect(() => {
    fetch('/api/reports/monthly', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<MonthlyData>>)
      .then((d) => { if (d.success && d.data) setData(d.data) })
  }, [])

  if (!data) return <div className="clinical-empty">Loading...</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Monthly Report</h2>
          <p>Period summary for routine evaluation.</p>
        </div>
        <span className="status-chip">{data.metrics.length} metrics</span>
      </div>
      <div className="summary-cards">
        <div className="summary-card"><span className="stat-kicker">Sessions</span><div className="big-value">{data.sessionCount}</div><p>Total sessions</p></div>
        <div className="summary-card"><span className="stat-kicker">Days</span><div className="big-value">{data.daysWithData}</div><p>Days with data</p></div>
        <div className="summary-card"><span className="stat-kicker">Alerts</span><div className="big-value">{data.alertCount}</div><p>Alerts triggered</p></div>
      </div>
      {data.aiMonthlySummary ? (
        <div className="ai-summary">
          <h3>AI Summary</h3>
          <p>{data.aiMonthlySummary}</p>
        </div>
      ) : null}
      <table className="report-table">
        <thead>
          <tr><th>Metric</th><th>Avg</th><th>Min</th><th>Max</th><th>Latest</th><th>N</th></tr>
        </thead>
        <tbody>
          {data.metrics.map((m, i) => (
            <tr key={`${m.metricCode}-${i}`}>
              <td>{m.metricCode}</td>
              <td>{m.avg?.toFixed(1) ?? '—'}</td>
              <td>{m.min ?? '—'}</td>
              <td>{m.max ?? '—'}</td>
              <td>{m.latest ?? '—'}</td>
              <td>{m.cnt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MonthlyReportPage
