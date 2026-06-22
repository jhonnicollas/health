import { useEffect, useState } from 'react'

type DailyValue = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  popupTitle?: string | null
  popupMessage?: string | null
  recommendation?: string | null
  sourceLabel?: string | null
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
      {data.values.length === 0 ? <p className="clinical-empty">Belum ada data pengukuran.</p> : (
        <div className="report-card-grid">
          {data.values.map((v, i) => (
            <article key={`${v.metricCode}-${i}`} className="report-detail-card">
              <div className="report-detail-header">
                <div>
                  <h3>{v.metricCode}</h3>
                  <p>{v.finalValue} {v.unit}</p>
                </div>
                <span className={`badge-status badge-${v.severity}`}><span className="status-dot" />{v.severity}</span>
              </div>
              <div className="report-rule-box">
                <strong>{v.popupTitle ?? v.status}</strong>
                <p>{v.popupMessage ?? 'Interpretasi rule engine belum tersedia untuk nilai ini.'}</p>
              </div>
              {v.recommendation ? <p className="report-recommendation">{v.recommendation}</p> : null}
              {v.sourceLabel ? <small className="muted">Source: {v.sourceLabel}</small> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default DailyReportPage
