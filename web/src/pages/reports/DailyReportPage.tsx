import { useEffect, useState } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { downloadCsv } from '../../utils/csv'
import { useI18n, useMetricLabels, useMetricGlossary, useSeverityLabels, useDeviceLabels, useMetricRanges, useMetricUnitInfos } from '../../i18n/useI18n'

const METRIC_SORT_ORDER: Record<string, number> = {
  spo2: 1,
  heartRate: 2,
  bloodPressurePulse: 3,
  systolic: 4,
  diastolic: 5,
  bodyTemperature: 6,
  bodyWeight: 7,
  bmi: 8,
  waistCircumference: 9,
  sleepDuration: 10
}

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
  measuredAt?: string
  deviceCode?: string | null
}

type Session = {
  id: number
  source: string
  hasEmergency: number
  hasAttachment: number
  notes: string | null
  measuredAt: string
}

type DailyData = {
  date: string
  sessionCount: number
  hasData: boolean
  values: DailyValue[]
  sessions: Session[]
  emptyMessage: string | null
}



type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

function extractTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}


export function DailyReportPage() {
  const { t } = useI18n()
  const ml = useMetricLabels()
  const mg = useMetricGlossary()
  const sl = useSeverityLabels()
  const dl = useDeviceLabels()
  const mr = useMetricRanges()
  const mu = useMetricUnitInfos()
  const [data, setData] = useState<DailyData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [apiDate, setApiDate] = useState<string | null>(null)
  const localTodayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const [dateInput, setDateInput] = useState(localTodayStr)
  const displayDate = dateInput || localTodayStr()

  useEffect(() => {
    const qs = apiDate ? `?date=${apiDate}` : ''
    fetch(`/api/reports/daily${qs}`, { credentials: 'include' })
      .then((r) => { if (!r.ok) return null; return r.json() as Promise<ApiResp<DailyData>> })
      .then((d) => { if (d && d.success && d.data) setData(d.data) })
  }, [apiDate])

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
          reportType: 'daily',
          context: JSON.stringify(data, null, 2).slice(0, 1500)
        })
      })
      const body = await res.json() as { success: boolean; data?: { analysis: string; model: string; usedFallback: boolean }; error?: { message: string } }
      if (body.success && body.data) {
        setAiAnalysis(body.data.analysis)
        setAiModel(body.data.model)
      } else {
        setAiError(body.error?.message ?? 'AI tidak merespon.')
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Gagal terhubung ke AI.')
    } finally {
      setAiLoading(false)
    }
  }

  if (!data) return <div className="clinical-empty">Memuat...</div>

  return (
    <div className="report-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">{t('reports.eyebrow')}</p>
            <h2>{t('reports.dailyTitle')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => { setDateInput(e.target.value); setApiDate(e.target.value) }}
                style={{ fontSize: 14, padding: '4px 8px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusSm)', background: 'var(--colorSurface)' }}
              />
            </div>
          </div>
        <div className="page-heading-actions">
          <button onClick={() => downloadCsv(`laporan-harian-${displayDate}.csv`, data.values.map(v => ({
            Tanggal: displayDate,
            Waktu: extractTime(v.measuredAt),
            Metrik: v.metricCode,
            Nilai: v.finalValue,
            Unit: v.unit,
            Status: v.status,
            Severity: v.severity,
            Rentang: mg[v.metricCode] || MEDICAL_GLOSSARY[v.metricCode] || '',
            Saran: v.recommendation || '',
            Sumber: v.sourceLabel || ''
          })), ['Tanggal', 'Waktu', 'Metrik', 'Nilai', 'Unit', 'Status', 'Severity', 'Rentang', 'Saran', 'Sumber'])} className="btn-secondary">
            <span className="material-symbols-outlined">download</span> {t('reports.downloadCsv')}
          </button>
          <button onClick={analyzeWithAi} disabled={aiLoading} className="btn-primary">
            {aiLoading ? <><span className="spinner" /> {t('reports.analyzing')}</> : <><span className="material-symbols-outlined">auto_awesome</span> {t('reports.analyzeWithAi')}</>}
          </button>
          <span className="status-chip">{data.values.length} {t('reports.values')}</span>
        </div>
      </div>
      {data.emptyMessage && data.values.length === 0 ? <p className="clinical-empty">{data.emptyMessage}</p> : null}
      {aiError ? <div className="ai-summary ai-summary-error"><p>{aiError}</p></div> : null}
      {aiAnalysis ? (
        <div className="ai-summary">
          <h3>Analisis AI{aiModel ? ` (${aiModel})` : ''}</h3>
          <p>{aiAnalysis}</p>
        </div>
      ) : null}
      {data.values.length === 0 ? null : (
        <div className="report-card-grid">
          {[...data.values].sort((a, b) => (METRIC_SORT_ORDER[a.metricCode] || 99) - (METRIC_SORT_ORDER[b.metricCode] || 99)).map((v, i) => {
            const deviceDisplay = v.deviceCode ? dl[v.deviceCode] || v.deviceCode : null
            const label = ml[v.metricCode] || v.metricCode
            return (
              <article key={`${i}-${v.metricCode}-${v.measuredAt || ''}`} className="report-detail-card">
                <div className="report-detail-header">
                  <div>
                    {deviceDisplay ? <p style={{ fontSize: 13, color: 'var(--colorPrimary)', fontWeight: 600, marginBottom: 2 }}>{deviceDisplay}</p> : null}
                    <h3><MedicalTerm term={label} shortDef={mg[v.metricCode] || MEDICAL_GLOSSARY[v.metricCode] || ''} termCode={v.metricCode} /></h3>
                    {mr[v.metricCode] ? <p style={{ fontSize: 11, color: 'var(--colorTextMuted)', marginBottom: 4 }}>Rentang normal: {mr[v.metricCode]}</p> : null}
                    <p style={{ fontSize: 22, fontWeight: 700 }}>{v.finalValue} {v.unit}</p>
                    {mu[v.metricCode] ? <p style={{ fontSize: 11, color: 'var(--colorTextMuted)', marginTop: 2 }}>{mu[v.metricCode]}</p> : null}
                    <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {extractTime(v.measuredAt) ? <><span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle' }}>schedule</span> {extractTime(v.measuredAt)}</> : null}
                    </p>
                  </div>
                  <span className={`badge-status badge-${v.severity}`}><span className="status-dot" />{sl[v.severity] || v.severity}</span>
                </div>
                <div className="report-rule-box">
                  <strong>{v.popupTitle ?? v.status}</strong>
                  <p>{v.popupMessage ?? 'Interpretasi rule engine belum tersedia untuk nilai ini.'}</p>
                </div>
                {v.recommendation ? <p className="report-recommendation">{v.recommendation}</p> : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DailyReportPage
