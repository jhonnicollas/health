import { useEffect, useState } from 'react'

type DailyValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
}

type DailyData = {
  date: string
  values: DailyValue[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function DailyReportPage() {
  const [data, setData] = useState<DailyData | null>(null)

  useEffect(() => {
    fetch('/api/reports/daily', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<DailyData>>)
      .then((d) => { if (d.success && d.data) setData(d.data) })
  }, [])

  if (!data) return <div className="clinical-empty">Loading...</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Daily Report</h2>
          <p>{data.date}</p>
        </div>
        <span className="status-chip">{data.values.length} values</span>
      </div>
      {data.values.length === 0 ? <p>No data.</p> : (
        <table className="report-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Status</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {data.values.map((v, i) => (
              <tr key={`${v.metricCode}-${i}`}>
                <td>{v.metricCode}</td>
                <td>{v.finalValue} {v.unit}</td>
                <td><span className={`badge-status badge-${v.status}`}><span className="status-dot" />{v.status}</span></td>
                <td><span className={`badge-status badge-${v.severity}`}><span className="status-dot" />{v.severity}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default DailyReportPage
