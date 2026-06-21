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

  if (!data) return <div className="clinical-empty">Memuat...</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Laporan Bulanan</h2>
          <p>Ringkasan periode untuk evaluasi rutin.</p>
        </div>
        <span className="status-chip">{data.metrics.length} metrik</span>
      </div>
      <div className="summary-cards">
        <div className="summary-card"><span className="stat-kicker">Sesi</span><div className="big-value">{data.sessionCount}</div><p>Total sesi</p></div>
        <div className="summary-card"><span className="stat-kicker">Hari</span><div className="big-value">{data.daysWithData}</div><p>Hari dengan data</p></div>
        <div className="summary-card"><span className="stat-kicker">Alert</span><div className="big-value">{data.alertCount}</div><p>Peringatan</p></div>
      </div>
      {data.aiMonthlySummary ? (
        <div className="ai-summary">
          <h3>Ringkasan AI</h3>
          <p>{data.aiMonthlySummary}</p>
        </div>
      ) : null}
      <table className="report-table">
        <thead>
          <tr><th>Metrik</th><th>Avg</th><th>Min</th><th>Max</th><th>Terakhir</th><th>N</th></tr>
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
