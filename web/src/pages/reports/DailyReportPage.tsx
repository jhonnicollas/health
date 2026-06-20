import { useEffect, useState } from 'react'
export function DailyReportPage() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/reports/daily', { credentials: 'include' }).then(r => r.json()).then(d => d.success && setData(d.data)) }, [])
  if (!data) return <div>Memuat...</div>
  return (
    <div className="report-page">
      <h2>Laporan Harian ({data.date})</h2>
      {data.values.length === 0 ? <p>Tidak ada data.</p> : (
        <table className="report-table">
          <thead><tr><th>Metrik</th><th>Nilai</th><th>Status</th><th>Severity</th></tr></thead>
          <tbody>{data.values.map((v: any, i: number) => (
            <tr key={i}><td>{v.metricCode}</td><td>{v.finalValue} {v.unit}</td><td>{v.status}</td><td>{v.severity}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
export default DailyReportPage
