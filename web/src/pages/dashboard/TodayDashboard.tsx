import { useEffect, useState } from 'react'
import { MedicalTerm, MEDICAL_GLOSSARY } from '../../components/MedicalTerm'
import { useI18n, useMetricLabels, useSeverityLabels } from '../../i18n/useI18n'

type Comparison = {
  avg3day: number | null
  avg7day: number | null
}

type MetricValue = {
  id: number
  sessionId: number
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
  createdAt: string
  comparisons?: Comparison
}

type Alert = {
  id: number
  metricCode: string
  finalValue: number
  unit: string
  severity: string
  message: string
  createdAt: string
}

type DashboardData = {
  date: string
  metricCount: number
  sessionCount: number
  emergencyCount: number
  hasData: boolean
  values: MetricValue[]
  alerts: Alert[]
  streak?: number
  bestStreak?: number
  aiInsight?: string
}
const METRIC_ICONS: Record<string, string> = {
  spo2: 'air',
  heartRate: 'favorite',
  systolic: 'favorite',
  diastolic: 'favorite',
  bloodPressurePulse: 'monitor_heart',
  glucoseFasting: 'water_drop',
  glucosePostMeal: 'water_drop',
  cholesterolTotal: 'biotech',
  uricAcid: 'science',
  bodyWeight: 'monitor_weight',
  bmi: 'straighten',
  waistCircumference: 'straighten',
  bodyTemperature: 'thermostat',
  sleepDuration: 'bedtime',
  height: 'height'
}

type ComparisonData = {
  metricCode: string
  todayValue: number | null
  threeDayAverage: number | null
  sevenDayAverage: number | null
  delta3Day: number | null
  delta7Day: number | null
  status: string
  hasEnough3DayData: boolean
  hasEnough7DayData: boolean
}

export function TodayDashboard({ onNavigateTab }: { onNavigateTab?: (path: string) => void }) {
  const { t } = useI18n()
  const metricLabels = useMetricLabels()
  const severityLabels = useSeverityLabels()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<ComparisonData[]>([])

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard/today', { credentials: 'include' })
        if (!response.ok) { setError(t('dashboard.loadFailed')); return }
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error?.message || 'Gagal memuat dashboard')
        }
      } catch {
        setError(t('dashboard.connError'))
      } finally {
        setLoading(false)
      }
    }
    const loadComparisons = async () => {
      try {
        const codes = ['systolic','diastolic','spo2','heartRate','bodyWeight','sleepDuration']
        const results: ComparisonData[] = []
        for (const code of codes) {
          const res = await fetch(`/api/dashboard/comparison?metricCode=${code}`, { credentials: 'include' })
          if (!res.ok) continue
          const body = await res.json()
          if (body.success && body.data) results.push(body.data)
        }
        setComparisons(results.filter(c => c.todayValue !== null))
      } catch {
        setError(t('dashboard.connError'))
        setComparisons([])
      }
    }
    void loadDashboard()
    void loadComparisons()
  }, [t])

  if (loading) {
    return <div className="dashboard-loading clinical-empty">{t('dashboard.loadingDashboard')}</div>
  }

  if (error) {
    return <div className="dashboard-error clinical-empty">{t('dashboard.errorPrefix')} {error}</div>
  }

  if (!data || !data.hasData) {
    return (
      <div className="dashboard-empty clinical-empty">
        <h2>{t('nav.today')}</h2>
        <p>{t('dashboard.noMeasurementsToday')}</p>
        <p>{t('dashboard.startLogging')}</p>
      </div>
    )
  }

  function pctDiff(current: number, avg: number | null): { pct: string; icon: string; cls: string } | null {
    if (avg === null || avg === 0) return null
    const diff = ((current - avg) / avg) * 100
    const abs = Math.abs(diff)
    const pct = (diff >= 0 ? '+' : '') + diff.toFixed(0) + '%'
    if (abs < 1) return { pct: '0%', icon: 'trending_flat', cls: 'text-tertiary' }
    if (diff > 0) return { pct, icon: 'trending_up', cls: 'text-error' }
    return { pct, icon: 'trending_down', cls: '' }
  }

  function TrendRow({ label, current, avg }: { label: string; current: number; avg: number | null }) {
    const trend = pctDiff(current, avg)
    if (!trend) return null
    return (
      <div className="vital-comparison-row">
        <span>{label}</span>
        <span className={trend.cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{trend.icon}</span>
          {trend.pct}
        </span>
      </div>
    )
  }

  return (
    <div className="today-dashboard">
      <div className="dashboard-bento">
        <div className="bento-streak">
          <div className="streak-icon" aria-hidden="true">
            <span className="material-symbols-outlined fill">local_fire_department</span>
          </div>
          <div className="streak-info">
            <h3>{t('dashboard.streakPrefix')} {data.streak ?? data.sessionCount} {t('dashboard.streakDays')}</h3>
            <p>{t('dashboard.bestStreak')} {data.bestStreak ?? data.sessionCount} {t('dashboard.bestStreakDays')}</p>
          </div>
        </div>
        <div className="bento-ai-insight">
          <div className="ai-insight-label">
            <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
            <span>{t('dashboard.aiClinicalInsight')}</span>
          </div>
          <p>{data.aiInsight ?? t('dashboard.aiInsightDefault')}</p>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className="tab-btn active" type="button" onClick={() => onNavigateTab?.('/dashboard')}>{t('nav.today')}</button>
        <button className="tab-btn" type="button" onClick={() => onNavigateTab?.('/dashboard/week')}>{t('nav.weeklyView')}</button>
        <button className="tab-btn" type="button" onClick={() => onNavigateTab?.('/dashboard/month')}>{t('nav.monthlySummary')}</button>
      </div>

      {data.alerts.length > 0 && (
        <div className="dashboard-alerts">
          <h3>{t('dashboard.alertsToday')}</h3>
          {data.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.severity}`}>
              <strong>{metricLabels[alert.metricCode] || alert.metricCode}</strong>: {alert.finalValue} {alert.unit}
              <p>{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="vitals-grid">
        {data.values.map(v => {
          const badge = { label: severityLabels[v.severity] || severityLabels[v.status] || v.status, className: `badge-${v.severity || v.status || 'info'}` }
          const comp = v.comparisons
          return (
            <div key={v.id} className={`vital-card severity-${v.severity}`}>
              <div className="vital-card-header">
                <div className="vital-card-label">
                  <span className="material-symbols-outlined vital-icon" aria-hidden="true">
                    {METRIC_ICONS[v.metricCode] ?? 'monitor_heart'}
                  </span>
                  <span className="vital-label-text"><MedicalTerm term={metricLabels[v.metricCode] || v.metricCode} shortDef={MEDICAL_GLOSSARY[v.metricCode] || ''} termCode={v.metricCode} /></span>
                </div>
                <span className={`vital-badge ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="vital-reading-row">
                <span className="vital-reading">{v.finalValue}</span>
                <span className="vital-unit">{v.unit}</span>
              </div>
              {comp && (
                <div className="vital-comparison-rows">
                  <TrendRow label={t('dashboard.vs3dayAvg')} current={v.finalValue} avg={comp.avg3day} />
                  <TrendRow label={t('dashboard.vs7dayAvg')} current={v.finalValue} avg={comp.avg7day} />
                </div>
              )}
              <div className="vital-meta">
                {v.manualOverride === 1 && <span className="badge-override">{t('dashboard.manual')}</span>}
                <span className={`badge-status status-${v.status}`}>{v.status}</span>
              </div>
            </div>
          )
        })}
      </div>

      {data.values.length > 0 ? (
        <div className="dashboard-chart-card">
          <h3>{t('dashboard.trend7day')}</h3>
          <div className="dashboard-chart-grid">
            {['systolic','diastolic','spo2','heartRate','bodyWeight','bodyTemperature','sleepDuration'].map(code => {
              const v = data.values.find(x => x.metricCode === code)
              if (!v) return null
              const comp = v.comparisons?.avg7day ?? null
              const max = comp && comp > 0 ? Math.max(v.finalValue, comp) : v.finalValue * 1.2
              const min = comp && comp > 0 ? Math.min(v.finalValue, comp) * 0.8 : 0
              const range = max - min
              const heightPct = range > 0 ? Math.min(100, Math.max(5, ((v.finalValue - min) / range) * 100)) : 50
              const sev = v.severity || 'normal'
              return (
                <div key={code} className="dashboard-chart-col">
                  <div className="dashboard-chart-bar-wrap">
                    <div className={`dashboard-chart-bar ${sev}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="dashboard-chart-label">{metricLabels[code] || code}</span>
                  <strong className="dashboard-chart-value">{v.finalValue} {v.unit}</strong>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {comparisons.length > 0 ? (
        <div className="dashboard-chart-card">
          <h3>{t('dashboard.trendComparison')}</h3>
          <table className="report-table">
            <thead>
              <tr><th>{t('dashboard.metric')}</th><th>{t('nav.today')}</th><th>{t('dashboard.avg3day')}</th><th>{t('dashboard.avg7day')}</th><th>{t('dashboard.trend')}</th></tr>
            </thead>
            <tbody>
              {comparisons.map(c => (
                <tr key={c.metricCode}>
                  <td>{metricLabels[c.metricCode] || c.metricCode}</td>
                  <td><strong>{c.todayValue}</strong></td>
                  <td>{c.hasEnough3DayData ? c.threeDayAverage : '—'}</td>
                  <td>{c.hasEnough7DayData ? c.sevenDayAverage : '—'}</td>
                  <td>
                    {c.delta3Day !== null ? (
                      <span style={{ color: c.delta3Day > 0 ? 'var(--colorStatusCritical, #dc2626)' : c.delta3Day < 0 ? 'var(--colorStatusGood, #16a34a)' : 'var(--colorTextMuted)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>
                          {c.status === 'up' ? 'trending_up' : c.status === 'down' ? 'trending_down' : 'trending_flat'}
                        </span>
                        {c.delta3Day > 0 ? '+' : ''}{c.delta3Day}
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export default TodayDashboard
