import { useEffect, useState, Fragment } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { formatDateID } from '../../utils/dateFormat'
import { downloadCsv } from '../../utils/csv'
import { useI18n, useMetricLabels, useMetricGlossary } from '../../i18n/useI18n'


type WeeklyMetric = {
  metricCode: string
  avg: number | null
  min: number | null
  max: number | null
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

type WeeklyData = {
  adherence: number
  alertCount: number
  bestDay: string | null
  worstDay: string | null
  daysWithData: number
  metrics: WeeklyMetric[]
  dailyMetrics: DailyMetricDetail[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function WeeklyReportPage() {
  const { t } = useI18n()
  const ml = useMetricLabels()
  const mg = useMetricGlossary()
  const [data, setData] = useState<WeeklyData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/weekly', { credentials: 'include' })
      .then((r) => { if (!r.ok) return null; return r.json() as Promise<ApiResp<WeeklyData>> })
      .then((d) => { if (d && d.success && d.data) setData(d.data) })
  }, [])

  async function analyzeWithAi() {
    if (!data) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/report-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'weekly',
          context: JSON.stringify(data, null, 2).slice(0, 1500)
        })
      })
      const body = await res.json() as { success: boolean; data?: { analysis: string; model: string; usedFallback: boolean }; error?: { message: string } }
      if (body.success && body.data) {
        setAiAnalysis(body.data.analysis)
        setAiModel(body.data.model)
      } else {
        setAiError(body.error?.message ?? t('reports.aiFailed'))
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t('reports.aiConnError'))
    } finally {
      setAiLoading(false)
    }
  }

  if (!data) return <div className="clinical-empty">{t('common.loading')}</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h2>{t('reports.weeklyTitle')}</h2>
          <p>{t('reports.adherence')}: {data.adherence}%</p>
        </div>
        <div className="page-heading-actions">
          <button onClick={() => downloadCsv(`laporan-mingguan.csv`, data.metrics.map(m => ({ Metrik: m.metricCode, Rata_rata: m.avg, Minimum: m.min, Maksimum: m.max, Jumlah_Data: m.cnt })), ['Metrik', 'Rata_rata', 'Minimum', 'Maksimum', 'Jumlah_Data'])} className="btn-secondary">
            <span className="material-symbols-outlined">download</span> {t('reports.downloadCsv')}
          </button>
          <button onClick={analyzeWithAi} disabled={aiLoading} className="btn-primary">
            {aiLoading ? <><span className="spinner" /> {t('reports.analyzing')}</> : <><span className="material-symbols-outlined">auto_awesome</span> {t('reports.analyzeWithAi')}</>}
          </button>
          <span className="status-chip">{data.metrics.length} {t('reports.metrics')}</span>
        </div>
      </div>
      {aiError ? <div className="ai-summary ai-summary-error"><p>{aiError}</p></div> : null}
      {aiAnalysis ? (
        <div className="ai-summary">
          <h3>{t('metrics.aiAnalysis')}{aiModel ? ` (${aiModel})` : ''}</h3>
          <p>{aiAnalysis}</p>
        </div>
      ) : null}
        <div className="summary-cards">
          <div className="summary-card"><span className="stat-kicker">{t('metrics.bestDay')}</span><div className="big-value compact">{data.bestDay ? formatDateID(data.bestDay) : '-'}</div><p>{t('metrics.mostActive')}</p></div>
          <div className="summary-card"><span className="stat-kicker">{t('metrics.worstDay')}</span><div className="big-value compact">{data.worstDay ? formatDateID(data.worstDay) : '-'}</div><p>{t('metrics.leastActive')}</p></div>
        <div className="summary-card"><span className="stat-kicker">{t('metrics.alerts')}</span><div className="big-value">{data.alertCount}</div><p>{t('metrics.ruleAlerts')}</p></div>
        <div className="summary-card"><span className="stat-kicker">{t('metrics.days')}</span><div className="big-value">{data.daysWithData}</div><p>{t('metrics.daysWithData')}</p></div>
      </div>
      {data.metrics.length === 0 ? <p className="clinical-empty">{t('reports.noData')}</p> : (
        <table className="report-table">
          <thead>
            <tr><th>{t('reports.metricLabel')}</th><th>{t('reports.avgShort')}</th><th>{t('reports.minShort')}</th><th>{t('reports.maxShort')}</th><th>{t('reports.cntShort')}</th><th></th></tr>
          </thead>
          <tbody>
            {data.metrics.map((m) => {
              const isExpanded = expandedMetric === m.metricCode
              const dailyRows = (data.dailyMetrics || []).filter(d => d.metricCode === m.metricCode)
              return (
                <Fragment key={m.metricCode}>
                  <tr onClick={() => setExpandedMetric(isExpanded ? null : m.metricCode)} style={{ cursor: 'pointer' }}>
                    <td><MedicalTerm term={ml[m.metricCode] || m.metricCode} shortDef={mg[m.metricCode] || MEDICAL_GLOSSARY[m.metricCode] || ''} termCode={m.metricCode} /></td>
                    <td>{m.avg?.toFixed(1) ?? '-'}</td>
                    <td>{m.min ?? '-'}</td>
                    <td>{m.max ?? '-'}</td>
                    <td>{m.cnt}</td>
                    <td><span className="material-symbols-outlined" style={{ fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span></td>
                  </tr>
                  {isExpanded && dailyRows.length > 0 ? (
                    <tr key={`${m.metricCode}-daily`}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <table className="report-table" style={{ margin: 0, border: 'none', background: 'var(--colorBgSecondary)' }}>
          <thead>
            <tr><th>{t('reports.dayLabel')}</th><th>{t('reports.dateLabel')}</th><th>{t('reports.avgShort')}</th><th>{t('reports.minShort')}</th><th>{t('reports.maxShort')}</th><th>N</th></tr>
          </thead>
          <tbody>
            {dailyRows.map(d => {
              const dayDate = new Date(d.day + 'T00:00:00')
              const today = new Date(); today.setHours(0,0,0,0)
              const diff = Math.round((today.getTime() - dayDate.getTime()) / 86400000)
              const hLabel = diff === 0 ? `H-0 (${t('reports.todayLabel')})` : `H-${diff}`
              return (
                <tr key={`${d.day}-${d.metricCode}`}>
                  <td><strong>{hLabel}</strong></td>
                  <td>{formatDateID(d.day)}</td>
                  <td>{d.avg.toFixed(1)}</td>
                  <td>{d.min}</td>
                  <td>{d.max}</td>
                  <td>{d.cnt}</td>
                </tr>
              )
            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : isExpanded && dailyRows.length === 0 ? (
                    <tr key={`${m.metricCode}-empty`}>
                       <td colSpan={7} style={{ padding: '8px 16px', color: 'var(--colorTextSecondary)', fontStyle: 'italic', fontSize: 13, background: 'var(--colorBgSecondary)' }}>
                         {t('reports.noDailyDetail')}
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

export default WeeklyReportPage
