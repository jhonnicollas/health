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
      <table className="report-table">
        <thead>
          <tr><th>Metric</th><th>Avg</th><th>Min</th><th>Max</th><th>N</th></tr>
        </thead>
        <tbody>
          {data.metrics.map((m, i) => (
            <tr key={`${m.metricCode}-${i}`}>
              <td>{m.metricCode}</td>
              <td>{m.avg?.toFixed(1) ?? '—'}</td>
              <td>{m.min ?? '—'}</td>
              <td>{m.max ?? '—'}</td>
              <td>{m.cnt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default WeeklyReportPage
