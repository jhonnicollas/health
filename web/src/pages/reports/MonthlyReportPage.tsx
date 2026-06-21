import { useEffect, useState } from 'react'
export function MonthlyReportPage() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/reports/monthly', { credentials: 'include' }).then(r => r.json()).then(d => d.success && setData(d.data)) }, [])
  if (!data) return <div>Memuat...</div>
  return (
    <div className="report-page">
      <h2>Laporan Bulanan</h2>
      <p>Total sesi: {data.sessionCount}</p>
      <p>Hari dengan data: {data.daysWithData}</p>
      <p>Peringatan: {data.alertCount}</p>
      {data.aiMonthlySummary ? <div className="ai-summary"><h3>Ringkasan AI</h3><p>{data.aiMonthlySummary}</p></div> : null}
      <table className="report-table">
        <thead><tr><th>Metrik</th><th>Avg</th><th>Min</th><th>Max</th><th>Terakhir</th><th>N</th></tr></thead>
        <tbody>{data.metrics.map((m: any, i: number) => (
          <tr key={i}><td>{m.metricCode}</td><td>{m.avg?.toFixed(1)}</td><td>{m.min}</td><td>{m.max}</td><td>{m.latest ?? '—'}</td><td>{m.cnt}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
export default MonthlyReportPage
