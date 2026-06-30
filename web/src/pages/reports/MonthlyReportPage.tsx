import { useEffect, useState, Fragment } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { downloadCsv } from '../../utils/csv'
import { useMetricLabels, useMetricGlossary } from '../../i18n/useI18n'

type MonthlyMetric = {
  metricCode: string
  avg: number | null
  min: number | null
  max: number | null
  latest: number | null
  cnt: number
}

type DailyMetricDetail = {
  day: string
  metricCode: string
  avg: number
  min: number
  max: number
  cnt: number
}

type MonthlyData = {
  days: number
  sessionCount: number
  daysWithData: number
  alertCount: number
  aiMonthlySummary: string | null
  metrics: MonthlyMetric[]
  dailyMetrics: DailyMetricDetail[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

function hLabel(day: string): string {
  const d = new Date(day + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  return diff === 0 ? 'H-0 (Hari ini)' : `H-${diff}`
}

function SparkLine({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const mn = Math.min(...values), mx = Math.max(...values), range = mx - mn || 1
  const w = 120, h = 28, pad = 4
  const pts = values.map((v, i) => `${pad + (i / (values.length - 1)) * (w - 2 * pad)},${h - pad - ((v - mn) / range) * (h - 2 * pad)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, verticalAlign: 'middle' }}>
      <polyline points={pts} fill="none" stroke="var(--colorPrimary)" strokeWidth={1.5} />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - 2 * pad)
        const y = h - pad - ((v - mn) / range) * (h - 2 * pad)
        return <circle key={i} cx={x} cy={y} r={2} fill="var(--colorPrimary)" />
      })}
    </svg>
  )
}

export function MonthlyReportPage() {
  const ml = useMetricLabels()
  const mg = useMetricGlossary()
  const [data, setData] = useState<MonthlyData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [daysFilter, setDaysFilter] = useState(30)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/monthly?days=${daysFilter}`, { credentials: 'include' })
      .then((r) => { if (!r.ok) return null; return r.json() as Promise<ApiResp<MonthlyData>> })
      .then((d) => { if (!cancelled && d && d.success && d.data) setData(d.data) })
    return () => { cancelled = true }
  }, [daysFilter])

  async function analyzeWithAi() {
    if (!data) return
    setAiLoading(true); setAiError(null)
    try {
      const res = await fetch('/api/ai/report-analysis', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'monthly', context: JSON.stringify(data, null, 2).slice(0, 1500) })
      })
      const body = await res.json() as { success: boolean; data?: { analysis: string; model: string }; error?: { message: string } }
      if (body.success && body.data) setAiAnalysis(body.data.analysis)
      else setAiError(body.error?.message ?? 'AI tidak merespon.')
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Gagal terhubung ke AI.') }
    finally { setAiLoading(false) }
  }

  if (!data) return <div className="clinical-empty">Memuat...</div>

  const dailyByMetric = (metricCode: string) => (data.dailyMetrics || []).filter(d => d.metricCode === metricCode).sort((a, b) => a.day.localeCompare(b.day))

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Laporan Bulanan</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
              style={{ fontSize: 14, padding: '4px 8px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusSm)', background: 'var(--colorSurface)' }}
            >
              <option value={30}>30 Hari Terakhir</option>
              <option value={7}>7 Hari</option>
              <option value={14}>14 Hari</option>
              <option value={60}>2 Bulan</option>
              <option value={90}>3 Bulan</option>
            </select>
          </div>
        </div>
        <div className="page-heading-actions">
          <button onClick={() => downloadCsv(`laporan-bulanan-${daysFilter}hari.csv`, data.metrics.map(m => ({ Metrik: m.metricCode, Rata_rata: m.avg, Minimum: m.min, Maksimum: m.max, Terbaru: m.latest, Jumlah_Data: m.cnt })), ['Metrik', 'Rata_rata', 'Minimum', 'Maksimum', 'Terbaru', 'Jumlah_Data'])} className="btn-secondary">
            <span className="material-symbols-outlined">download</span> Unduh CSV
          </button>
          <button onClick={analyzeWithAi} disabled={aiLoading} className="btn-primary">
            {aiLoading ? <><span className="spinner" /> Menganalisis...</> : <><span className="material-symbols-outlined">auto_awesome</span> Analisis dengan AI</>}
          </button>
          <span className="status-chip">{data.metrics.length} metrik</span>
        </div>
      </div>
      {aiError ? <div className="ai-summary ai-summary-error"><p>{aiError}</p></div> : null}
      {aiAnalysis ? (
        <div className="ai-summary">
          <h3>Analisis AI</h3>
          <p>{aiAnalysis}</p>
        </div>
      ) : null}
      <div className="summary-cards">
        <div className="summary-card"><span className="stat-kicker">Sesi</span><div className="big-value">{data.sessionCount}</div><p>Total sesi pengukuran</p></div>
        <div className="summary-card"><span className="stat-kicker">Hari</span><div className="big-value">{data.daysWithData}</div><p>Hari dengan data</p></div>
        <div className="summary-card"><span className="stat-kicker">Peringatan</span><div className="big-value">{data.alertCount}</div><p>Peringatan terpicu</p></div>
      </div>
      {data.metrics.length === 0 ? <p className="clinical-empty">Belum ada data pengukuran untuk periode ini.</p> : (
        <table className="report-table">
          <thead>
            <tr><th>Metrik</th><th>Rata-rata</th><th>Min</th><th>Max</th><th>Terakhir</th><th>Tren</th><th>N</th><th></th></tr>
          </thead>
          <tbody>
            {data.metrics.map((m) => {
              const isExpanded = expandedMetric === m.metricCode
              const dailyRows = dailyByMetric(m.metricCode)
              const trendVals = dailyRows.map(d => d.avg)
              return (
                <Fragment key={m.metricCode}>
                  <tr onClick={() => setExpandedMetric(isExpanded ? null : m.metricCode)} style={{ cursor: 'pointer' }}>
                    <td><MedicalTerm term={ml[m.metricCode] || m.metricCode} shortDef={mg[m.metricCode] || MEDICAL_GLOSSARY[m.metricCode] || ''} termCode={m.metricCode} /></td>
                    <td>{m.avg?.toFixed(1) ?? '-'}</td>
                    <td>{m.min ?? '-'}</td>
                    <td>{m.max ?? '-'}</td>
                    <td>{m.latest ?? '-'}</td>
                    <td><SparkLine values={trendVals} /></td>
                    <td>{m.cnt}</td>
                    <td><span className="material-symbols-outlined" style={{ fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span></td>
                  </tr>
                  {isExpanded && dailyRows.length > 0 ? (
                    <tr key={`${m.metricCode}-daily`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <table className="report-table" style={{ margin: 0, border: 'none', background: 'var(--colorBgSecondary)' }}>
                          <thead>
                            <tr><th>Hari</th><th>Tanggal</th><th>Rata-rata</th><th>Min</th><th>Max</th><th>N</th></tr>
                          </thead>
                          <tbody>
                            {dailyRows.map(d => (
                              <tr key={`${d.day}-${d.metricCode}`}>
                                <td><strong>{hLabel(d.day)}</strong></td>
                                <td>{d.day}</td>
                                <td>{d.avg.toFixed(1)}</td>
                                <td>{d.min}</td>
                                <td>{d.max}</td>
                                <td>{d.cnt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : isExpanded ? (
                    <tr key={`${m.metricCode}-empty`}>
                      <td colSpan={8} style={{ padding: '8px 16px', color: 'var(--colorTextSecondary)', fontStyle: 'italic', fontSize: 13, background: 'var(--colorBgSecondary)' }}>
                        Tidak ada data harian untuk metrik ini.
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default MonthlyReportPage
