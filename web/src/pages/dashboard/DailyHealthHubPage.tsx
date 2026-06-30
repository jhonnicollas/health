/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n, useMetricLabels, useSeverityLabels } from '../../i18n/useI18n'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

function ProgressRing({ percent, size = 96, stroke = 8 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(percent, 100)
  const offset = circ - (clamped / 100) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e2e4" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0369a1" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

const METRIC_CONFIG: Record<string, { labelKey: string; unit: string; icon: string; color: string }> = {
  bloodPressure: { labelKey: 'dashboard.bloodPressure', unit: 'mmHg', icon: 'cardiology', color: '#10b981' },
  spO2: { labelKey: 'dashboard.spO2', unit: '%', icon: 'oxygen_saturation', color: '#10b981' },
  bloodGlucose: { labelKey: 'dashboard.bloodGlucose', unit: 'mg/dL', icon: 'glucose', color: '#10b981' },
  heartRate: { labelKey: 'dashboard.heartRate', unit: 'bpm', icon: 'monitor_heart', color: '#10b981' },
  bodyTemperature: { labelKey: 'dashboard.bodyTemperature', unit: '°C', icon: 'thermometer', color: '#f59e0b' },
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

export function DailyHealthHubPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const ml = useMetricLabels()
  const sl = useSeverityLabels()
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [hydration, setHydration] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eduVisible, setEduVisible] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const [hubRes, hydRes] = await Promise.all([
        fetch(`/api/dashboard/daily-health?date=${date}`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`/api/hydration/today?date=${date}`, { credentials: 'include', headers: { Accept: 'application/json' } }).catch(() => null)
      ])
      if (!hubRes.ok) { setError(t('dashboard.loadFailed')); return }
      const hubJson = await hubRes.json()
      if (hubJson.success) setData(hubJson.data)
      if (hydRes && hydRes.ok) {
        const hydJson = await hydRes.json()
        if (hydJson.success) setHydration(hydJson.data)
      }
    } catch { setError(t('dashboard.connError')) } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [user, date])

  const status = useMemo(() => {
    const redFlag = data?.symptoms?.some((s: any) => s.isRedFlag)
    const criticalMetric = data?.measurements?.some((m: any) => m.severity === 'critical' || m.status?.toLowerCase().includes('critical'))
    if (redFlag || criticalMetric) return { label: t('dashboard.critical'), tone: 'critical', color: '#ef4444', icon: 'warning' }
    const warningMetric = data?.measurements?.some((m: any) => m.severity === 'warning' || m.status?.toLowerCase().includes('warning'))
    if (warningMetric) return { label: t('dashboard.warning'), tone: 'warning', color: '#f59e0b', icon: 'error' }
    return { label: t('dashboard.normal'), tone: 'normal', color: '#10b981', icon: 'check_circle' }
  }, [data])

  const vitals = useMemo(() => {
    return (data?.measurements || []).map((m: any) => {
      const cfg = METRIC_CONFIG[m.metricCode] || { labelKey: '', unit: '', icon: 'monitor_heart', color: '#10b981' }
      return { ...m, ...cfg }
    })
  }, [data])

  const activeSymptom = useMemo(() => (data?.symptoms || [])[0] || null, [data])

  const hydPercent = Math.min(hydration?.percent || 0, 100)
  const hydRemaining = Math.max((hydration?.targetMl || 0) - (hydration?.totalMl || 0), 0)

  if (!user) return <section className="settings-panel"><h2>{t('dashboard.pleaseLogin')}</h2></section>

  return (
    <section className="settings-panel daily-hub-page">
      <div className="daily-hub-header">
        <div>
          <p className="eyebrow">{t('dashboard.eyebrow')}</p>
          <h2>{t('dashboard.title')}</h2>
          <p className="subtitle">{t('dashboard.subtitle')}</p>
        </div>
        <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
      </div>

      {error && <p className="form-message error">{error}</p>}
      {loading ? <p>{t('dashboard.loading')}</p> : (
        <>
          <div className="daily-status-banner" style={{ borderLeftColor: status.color }}>
            <div className="status-dot" style={{ background: status.color }} />
            <span className="status-label">{t('dashboard.statusToday')}</span>
            <span className="pill" style={{ background: `${status.color}15`, color: status.color, borderColor: `${status.color}40` }}>{status.label}</span>
            <span className="status-last">{date === todayStr() ? t('dashboard.today') : date}</span>
          </div>

          <div className="daily-bento-grid">
            {/* Vitals card */}
            <div className="bento-card vitals-card">
              <h3><span className="material-symbols-outlined fill-icon">monitor_heart</span> {t('dashboard.vitalSigns')}</h3>
              {vitals.length === 0 ? (
                <p className="empty">{t('dashboard.noMeasurements')}</p>
              ) : (
                <div className="vitals-list">
                  {vitals.map((m: any, i: number) => (
                    <div key={i} className="vital-row">
                      <div className="vital-info">
                        <span className="material-symbols-outlined" style={{ color: m.color }}>{m.icon}</span>
                        <div>
                          <p className="vital-label">{m.labelKey ? t(m.labelKey) : (ml[m.metricCode] || m.metricCode)}</p>
                          <p className="vital-value">{m.finalValue} <span>{m.unit}</span></p>
                        </div>
                      </div>
                      <span className="pill" style={{ background: `${m.color}15`, color: m.color, borderColor: `${m.color}40` }}>{sl[m.severity] || m.status || 'Normal'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Symptom card */}
            <div className="bento-card symptom-card">
              <div className="card-header">
                <div className="card-icon" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b' }}><span className="material-symbols-outlined fill-icon">sick</span></div>
                <div>
                  <h3>{t('dashboard.activeSymptom')}</h3>
                  <p className="subtitle">{activeSymptom ? `${activeSymptom.bodyArea || t('dashboard.activeSymptom')} ${t('dashboard.symptomSince')} ${activeSymptom.symptomDateTime?.slice(11, 16)}` : t('dashboard.noActiveSymptom')}</p>
                </div>
              </div>
              {activeSymptom ? (
                <>
                  <div className="vas-bar">
                    <div className="vas-track">
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <div key={idx} className={`vas-segment ${idx < (activeSymptom.painScale || 0) ? 'active' : ''}`} />
                      ))}
                    </div>
                    <div className="vas-labels"><span>0</span><span>10</span></div>
                  </div>
                  <div className="card-actions">
                    <a href="/symptoms" className="btn-secondary">{t('dashboard.viewDetail')}</a>
                    <a href="/symptoms" className="btn-warning">{t('dashboard.addSymptom')}</a>
                  </div>
                </>
              ) : (
                <div className="card-actions">
                  <a href="/symptoms" className="btn-secondary">{t('dashboard.logSymptom')}</a>
                </div>
              )}
            </div>

            {/* Hydration card */}
            <div className="bento-card hydration-card">
              <div className="card-header">
                <div className="card-icon" style={{ background: 'rgba(3,105,161,.12)', color: '#0369a1' }}><span className="material-symbols-outlined fill-icon">water_drop</span></div>
                <div>
                  <h3>{t('dashboard.hydrationToday')}</h3>
                  <p className="subtitle">{t('dashboard.hydrationTarget')}</p>
                </div>
                <span className="hyd-percent">{hydPercent}%</span>
              </div>
              <div className="hyd-row">
                <div className="hyd-ring">
                  <ProgressRing percent={hydPercent} />
                  <div className="hyd-ring-center">
                    <span className="material-symbols-outlined fill-icon">water_drop</span>
                    <p className="ring-value">{(hydration?.totalMl || 0).toLocaleString('id-ID')}</p>
                    <p className="ring-unit">ml</p>
                  </div>
                </div>
                <div className="hyd-info">
                  <p className="hyd-total">{hydration?.totalMl || 0} <span>ml</span></p>
                  <p className="hyd-remaining">{t('dashboard.remaining')} {hydRemaining.toLocaleString('id-ID')} ml</p>
                  <div className="hyd-progress"><div style={{ width: `${hydPercent}%` }} /></div>
                  <div className="hyd-quick">
                    <a href="/hydration" className="btn-outline">+200ml</a>
                    <a href="/hydration" className="btn-outline">+600ml</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="daily-quick-actions">
            <button onClick={() => setEduVisible(true)} className="action-tile"><span className="material-symbols-outlined fill-icon">help</span><span>{t('dashboard.whatDoesItMean')}</span></button>
            <a href="/measurements/new" className="action-tile"><span className="material-symbols-outlined fill-icon">add_circle</span><span>{t('dashboard.measureNow')}</span></a>
            <a href="/reports/doctor" className="action-tile"><span className="material-symbols-outlined fill-icon">assignment</span><span>{t('dashboard.doctorReport')}</span></a>
            <a href="/emergency" className="action-tile"><span className="material-symbols-outlined fill-icon">emergency</span><span>{t('dashboard.whenToSeekHelp')}</span></a>
          </div>
        </>
      )}
      <EducationBottomSheet topicType="dashboard" visible={eduVisible} onClose={() => setEduVisible(false)} />
    </section>
  )
}
