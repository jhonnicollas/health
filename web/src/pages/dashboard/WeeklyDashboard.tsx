import { useEffect, useState } from 'react'
import { TrendBadge, type TrendDirection } from '../../components/dashboard/TrendBadge'
import { formatDateID } from '../../utils/dateFormat'
import { useI18n, useMetricLabels } from '../../i18n/useI18n'

type MetricSummary = { metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }
type DailyPoint = { day: string; metricCode: string; avgValue: number }
type DaySummary = { day: string; sessionCount: number }
type WeeklyPayload = {
  metrics: MetricSummary[]
  daily: DailyPoint[]
  measurementDays: number
  bestDay: DaySummary | null
  worstDay: DaySummary | null
  alertCount: number
  adherence: number | null
}

export function WeeklyDashboard() {
  const { t } = useI18n()
  const METRIC_LABELS = useMetricLabels()
  const [metrics, setMetrics] = useState<MetricSummary[]>([])
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [summary, setSummary] = useState<Omit<WeeklyPayload, 'metrics' | 'daily'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/weekly', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Gagal memuat dashboard mingguan.'); return r.json() })
      .then((d: { success: boolean; data?: WeeklyPayload; error?: { message?: string } }) => {
        if (d.success && d.data) {
          setMetrics(d.data.metrics)
          setDaily(d.data.daily)
          setSummary({
            measurementDays: d.data.measurementDays,
            bestDay: d.data.bestDay,
            worstDay: d.data.worstDay,
            alertCount: d.data.alertCount,
            adherence: d.data.adherence
          })
        } else {
          setError(d.error?.message ?? 'Gagal memuat dashboard mingguan.')
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="clinical-empty">{t('common.loading')}</div>
  if (error) return <div className="clinical-empty dashboard-error">{t('common.errorGeneric')}</div>
  if (metrics.length === 0) return <div className="clinical-empty">{t('dashboard.noMeasurements')}</div>

  const grouped = new Map<string, DailyPoint[]>()
  for (const p of daily) {
    if (!grouped.has(p.metricCode)) grouped.set(p.metricCode, [])
    grouped.get(p.metricCode)!.push(p)
  }

  return (
    <div className="weekly-dashboard">
      <div className="dashboard-tabs">
        <button className="tab-btn" type="button">Hari Ini</button>
        <button className="tab-btn active" type="button">Tampilan Mingguan</button>
        <button className="tab-btn" type="button">Ringkasan Bulanan</button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-kicker">Hari Pengukuran</span>
          <div className="stat-value">{summary?.measurementDays ?? 0}</div>
          <div className="stat-label">dari 7 hari terakhir</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Hari Terbaik</span>
          <div className="stat-value compact">{summary?.bestDay?.day ? formatDateID(summary.bestDay.day) : '-'}</div>
          <div className="stat-label">{summary?.bestDay?.sessionCount ?? 0} sesi</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">Hari Terburuk</span>
          <div className="stat-value compact">{summary?.worstDay?.day ? formatDateID(summary.worstDay.day) : '-'}</div>
          <div className="stat-label">{summary?.worstDay?.sessionCount ?? 0} sesi</div>
        </div>
        <div className="stat-card">
          <span className="stat-kicker">{t('dashboard.adherence')}</span>
          <div className="stat-value">{summary?.adherence ?? '-'}{summary?.adherence !== null && summary?.adherence !== undefined ? '%' : ''}</div>
          <div className="stat-label">{summary?.alertCount ?? 0} {t('dashboard.alertsToday').toLowerCase()}</div>
        </div>
      </div>

      {daily.length > 0 ? (
        <div className="weekly-bars" aria-label="Weekly daily trend chart">
          {daily.map((point) => {
            const maxVal = Math.max(...daily.map(p => p.avgValue), 1)
            const heightPct = Math.max(8, (point.avgValue / maxVal) * 100)
            return (
              <div key={`${point.day}-${point.metricCode}`} className="weekly-bar-item">
                <span className="weekly-bar" style={{ height: `${heightPct}%` }} title={`${METRIC_LABELS[point.metricCode] || point.metricCode}: ${point.avgValue?.toFixed(1)}`} />
                <small>{point.day.slice(5)}</small>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="vitals-grid">
        {metrics.map(m => {
          const points = grouped.get(m.metricCode) || []
          const first = points[0]?.avgValue || 0
          const last = points[points.length - 1]?.avgValue || 0
          let direction: TrendDirection = 'insufficient'
          let percent = 0
          if (points.length >= 2 && first > 0) {
            percent = ((last - first) / first) * 100
            if (Math.abs(percent) < 2) direction = 'stable'
            else direction = percent > 0 ? 'up' : 'down'
          }
          const label = METRIC_LABELS[m.metricCode] || m.metricCode
          return (
            <div key={m.metricCode} className="vital-card">
              <div className="vital-card-header">
                <div className="vital-card-label">
                  <span className="vital-label-text">{label}</span>
                </div>
                <TrendBadge direction={direction} percent={percent} />
              </div>
              <div className="vital-reading-row">
                <span className="vital-reading">{m.avgValue?.toFixed(1)}</span>
                <span className="vital-unit">rata-rata</span>
              </div>
              <div className="vital-comparison-rows">
                <div className="vital-comparison-row">
                  <span>Min</span>
                  <span>{m.minValue}</span>
                </div>
                <div className="vital-comparison-row">
                  <span>Maks</span>
                  <span>{m.maxValue}</span>
                </div>
                <div className="vital-comparison-row">
                  <span>Pembacaan</span>
                  <span>{m.cnt}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default WeeklyDashboard
