import { useEffect, useState } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'

const METRIC_LABEL_DEF: Record<string, { label: string; def: string }> = {
  spo2: { label: 'SpO2', def: MEDICAL_GLOSSARY.spo2 },
  heartRate: { label: 'Denyut Jantung', def: MEDICAL_GLOSSARY.heartRate },
  systolic: { label: 'Sistolik', def: MEDICAL_GLOSSARY.systolic },
  diastolic: { label: 'Diastolik', def: MEDICAL_GLOSSARY.diastolic },
  bloodPressurePulse: { label: 'Pulse Tensimeter', def: MEDICAL_GLOSSARY.bloodPressurePulse },
  glucoseFasting: { label: 'Gula Darah Puasa', def: MEDICAL_GLOSSARY.glucoseFasting },
  glucosePostMeal: { label: 'Gula Darah 2 Jam PP', def: MEDICAL_GLOSSARY.glucosePostMeal },
  cholesterolTotal: { label: 'Kolesterol Total', def: MEDICAL_GLOSSARY.cholesterolTotal },
  uricAcid: { label: 'Asam Urat', def: MEDICAL_GLOSSARY.uricAcid },
  bodyWeight: { label: 'Berat Badan', def: MEDICAL_GLOSSARY.bodyWeight },
  bmi: { label: 'BMI', def: MEDICAL_GLOSSARY.bmi },
  waistCircumference: { label: 'Lingkar Perut', def: MEDICAL_GLOSSARY.waistCircumference },
  bodyTemperature: { label: 'Suhu Tubuh', def: MEDICAL_GLOSSARY.bodyTemperature },
  sleepDuration: { label: 'Durasi Tidur', def: MEDICAL_GLOSSARY.sleepDuration }
}

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
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/monthly', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<MonthlyData>>)
      .then((d) => { if (d.success && d.data) setData(d.data) })
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
          reportType: 'monthly',
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

  if (!data) return <div className="clinical-empty">Loading...</div>

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Monthly Report</h2>
          <p>Period summary for routine evaluation.</p>
        </div>
        <div className="page-heading-actions">
          <button onClick={analyzeWithAi} disabled={aiLoading} className="btn-primary">
            {aiLoading ? <><span className="spinner" /> Menganalisa...</> : <><span className="material-symbols-outlined">auto_awesome</span> Analisa dengan AI</>}
          </button>
          <span className="status-chip">{data.metrics.length} metrics</span>
        </div>
      </div>
      {aiError ? <div className="ai-summary ai-summary-error"><p>{aiError}</p></div> : null}
      {aiAnalysis ? (
        <div className="ai-summary">
          <h3>AI Analysis{aiModel ? ` (${aiModel})` : ''}</h3>
          <p>{aiAnalysis}</p>
        </div>
      ) : null}
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
      {data.metrics.length === 0 ? <p className="clinical-empty">Belum ada data pengukuran untuk laporan bulanan.</p> : (
        <table className="report-table">
          <thead>
            <tr><th>Metric</th><th>Avg</th><th>Min</th><th>Max</th><th>Latest</th><th>N</th></tr>
          </thead>
          <tbody>
            {data.metrics.map((m, i) => (
              <tr key={`${m.metricCode}-${i}`}>
                <td><MedicalTerm term={METRIC_LABEL_DEF[m.metricCode]?.label || m.metricCode} shortDef={METRIC_LABEL_DEF[m.metricCode]?.def || ''} /></td>
                <td>{m.avg?.toFixed(1) ?? '-'}</td>
                <td>{m.min ?? '-'}</td>
                <td>{m.max ?? '-'}</td>
                <td>{m.latest ?? '-'}</td>
                <td>{m.cnt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default MonthlyReportPage
