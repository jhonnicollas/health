import { useEffect, useState } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { formatDateID } from '../../utils/dateFormat'

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
}

type DailyData = {
  date: string
  sessionCount: number
  values: DailyValue[]
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function DailyReportPage() {
  const [data, setData] = useState<DailyData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/daily', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<DailyData>>)
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

  if (!data) return <div className="clinical-empty">Loading...</div>

  return (
    <div className="report-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Reports</p>
            <h2>Daily Report</h2>
            <p>{formatDateID(data.date)}</p>
          </div>
        <div className="page-heading-actions">
          <button onClick={analyzeWithAi} disabled={aiLoading} className="btn-primary">
            {aiLoading ? <><span className="spinner" /> Menganalisa...</> : <><span className="material-symbols-outlined">auto_awesome</span> Analisa dengan AI</>}
          </button>
          <span className="status-chip">{data.values.length} values</span>
        </div>
      </div>
      {aiError ? <div className="ai-summary ai-summary-error"><p>{aiError}</p></div> : null}
      {aiAnalysis ? (
        <div className="ai-summary">
          <h3>AI Analysis{aiModel ? ` (${aiModel})` : ''}</h3>
          <p>{aiAnalysis}</p>
        </div>
      ) : null}
      {data.values.length === 0 ? <p className="clinical-empty">Belum ada data pengukuran.</p> : (
        <div className="report-card-grid">
          {[...data.values].sort((a, b) => (METRIC_SORT_ORDER[a.metricCode] || 99) - (METRIC_SORT_ORDER[b.metricCode] || 99)).map((v, i) => (
            <article key={`${v.metricCode}-${i}`} className="report-detail-card">
              <div className="report-detail-header">
                <div>
                  <h3><MedicalTerm term={METRIC_LABEL_DEF[v.metricCode]?.label || v.metricCode} shortDef={METRIC_LABEL_DEF[v.metricCode]?.def || ''} /></h3>
                  <p>{v.finalValue} {v.unit}</p>
                </div>
                <span className={`badge-status badge-${v.severity}`}><span className="status-dot" />{v.severity}</span>
              </div>
              <div className="report-rule-box">
                <strong>{v.popupTitle ?? v.status}</strong>
                <p>{v.popupMessage ?? 'Interpretasi rule engine belum tersedia untuk nilai ini.'}</p>
              </div>
              {v.recommendation ? <p className="report-recommendation">{v.recommendation}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default DailyReportPage
