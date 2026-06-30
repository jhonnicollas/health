import { useEffect, useMemo, useState } from 'react'
import { DynamicMetricForm } from '../../components/measurement/DynamicMetricForm'
import type { DynamicMetricSelection } from '../../components/measurement/DynamicMetricForm'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

type Metric = {
  metricCode: string
  metricName: string
  category: string
  unit: string
  inputType: string
  requiresAttachment: boolean
  requiresSex: boolean
  requiresFasting: boolean
  isCalculated: boolean
  requiredMetric: boolean
  physicalMin: number | null
  physicalMax: number | null
}

type Device = {
  deviceCode: string
  deviceName: string
  deviceType: string
  brand: string
  model: string
  metrics: Metric[]
}

type CatalogResponse = {
  success: boolean
  data?: {
    devices: Device[]
    metrics: Metric[]
  }
  error?: {
    message: string
  }
}

type TodaySession = {
  sessionId: number
  measuredAt: string
  deviceCodes: string[]
  valueCount: number
}

const DEVICE_ICONS: Record<string, string> = {
  oximeter: 'oxygen_saturation',
  bloodPressure: 'blood_pressure',
  gcu: 'bloodtype',
  thermometer: 'thermostat',
  bodyScale: 'monitor_weight',
  sleepTracker: 'bedtime',
  manual: 'edit_note'
}

async function fetchTodaySessions(): Promise<TodaySession[]> {
  try {
    const res = await fetch('/api/measurements/today', { credentials: 'include' })
    if (!res.ok) return []
    const body = await res.json() as { success: boolean; data?: { sessions: TodaySession[] } }
    if (!body.success) return []
    return Array.isArray(body.data?.sessions) ? body.data.sessions : []
  } catch {
    return []
  }
}

export function SelectMetricPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceCodes, setSelectedDeviceCodes] = useState<string[]>([])
  const [sinocareModes, setSinocareModes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [now] = useState(() => new Date())
  const isPastNoon = now.getHours() >= 12
  const birthDate = profile?.birthDate ?? null

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setLoading(true)
      setMessage('')
      try {
        const response = await fetch('/api/metrics/catalog', {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })
        const body = (await response.json()) as CatalogResponse
        if (cancelled) return
        if (!response.ok || !body.success || !body.data) {
          setMessage(body.error?.message ?? t('measurement.catalogFailed'))
          return
        }
        setDevices(body.data.devices)
      } catch {
        if (!cancelled) setMessage(t('measurement.catalogLoadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadCatalog()
    void fetchTodaySessions().then(setTodaySessions)
    return () => { cancelled = true }
  }, [t])

  const selectedMetrics = useMemo<DynamicMetricSelection[]>(() => {
    const result: DynamicMetricSelection[] = []
    for (const device of devices) {
      if (!selectedDeviceCodes.includes(device.deviceCode)) continue
      for (const metric of device.metrics) {
        if (device.deviceType === 'gcu' && sinocareModes.size > 0 && !sinocareModes.has(metric.metricCode)) continue
        result.push({
          id: `${device.deviceCode}:${metric.metricCode}`,
          device: { deviceCode: device.deviceCode, deviceName: device.deviceName, deviceType: device.deviceType },
          metric: {
            metricCode: metric.metricCode,
            metricName: metric.metricName,
            unit: metric.unit,
            requiresAttachment: metric.requiresAttachment,
            physicalMin: metric.physicalMin,
            physicalMax: metric.physicalMax
          }
        })
      }
    }
    return result
  }, [devices, selectedDeviceCodes, sinocareModes])

  const ageInfo = useMemo(() => {
    if (!birthDate) return null
    const birth = new Date(`${birthDate}T00:00:00`)
    if (Number.isNaN(birth.getTime())) return null
    const today = new Date()
    let years = today.getFullYear() - birth.getFullYear()
    let months = today.getMonth() - birth.getMonth()
    let days = today.getDate() - birth.getDate()
    if (days < 0) {
      months -= 1
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate()
    }
    if (months < 0) {
      years -= 1
      months += 12
    }
    return { years, months, days }
  }, [birthDate])

  function isDeviceRecordedToday(deviceCode: string): boolean {
    return todaySessions.some(s => s.deviceCodes.includes(deviceCode))
  }

  function toggleDevice(deviceCode: string) {
    setSelectedDeviceCodes((current) =>
      current.includes(deviceCode)
        ? current.filter((code) => code !== deviceCode)
        : [...current, deviceCode]
    )
  }

  const sinocareDevice = devices.find((d) => d.deviceType === 'gcu' && selectedDeviceCodes.includes(d.deviceCode))
  function toggleSinocareMode(code: string) {
    setSinocareModes(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  return (
    <section className="measurement-panel" aria-labelledby="device-select-title">
      <div className="measurement-step-header">
        <span className="step-number">1</span>
        <h2 id="device-select-title">{t('measurement.selectDeviceTitle')}</h2>
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 8 }}>
        {t('measurement.selectDeviceDesc')}
      </p>

      {loading ? <p className="loading-text">{t('measurement.loadingCatalog')}</p> : null}
      {message ? <p className="form-message error" role="status">{message}</p> : null}

      {!loading && !message ? (
        <div className="device-selector-grid">
          {devices.map((device) => {
            const isSelected = selectedDeviceCodes.includes(device.deviceCode)
            const isRecordedToday = isDeviceRecordedToday(device.deviceCode)
            const isLateWarning = isPastNoon && !isRecordedToday
            const icon = DEVICE_ICONS[device.deviceType] || 'medical_services'
            const cardState = isRecordedToday
              ? 'recorded-today'
              : isLateWarning
                ? 'late-warning'
                : ''
            return (
              <button
                key={device.deviceCode}
                className={`device-selector-card ${isSelected ? 'selected' : ''} ${cardState}`}
                onClick={() => toggleDevice(device.deviceCode)}
                type="button"
              >
                <span className="material-symbols-outlined device-icon">{icon}</span>
                <div className="device-info">
                  <strong>{device.deviceName}</strong>
                  {isRecordedToday ? (
                    <small className="device-status-today">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                      {t('measurement.recordedToday')}
                    </small>
                  ) : isLateWarning ? (
                    <small className="device-status-late">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                      {t('measurement.notRecordedLate')}
                    </small>
                  ) : null}
                </div>
                {isSelected ? (
                  <span className="material-symbols-outlined device-check">check_circle</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {sinocareDevice ? (
        <div className="sinocare-mode-selector">
          <p><strong>{sinocareDevice.deviceName}</strong> &mdash; {t('measurement.selectTestType')}</p>
          <div className="sinocare-mode-buttons">
            {sinocareDevice.metrics.map((metric) => (
              <button
                key={metric.metricCode}
                className={`sinocare-mode-btn ${sinocareModes.has(metric.metricCode) ? 'selected' : ''}`}
                onClick={() => toggleSinocareMode(metric.metricCode)}
                type="button"
              >
                {metric.metricName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedMetrics.length > 0 && (
        <>
          <div className="measurement-step-header">
            <span className="step-number">2</span>
            <h2>{t('measurement.recordTitle')}</h2>
            <a href="/reports/daily" className="btn-secondary" style={{ marginLeft: 8, padding: '8px 12px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', background: 'var(--colorSurface)', cursor: 'pointer', fontSize: 13, textDecoration: 'none', color: 'inherit', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>today</span>
              {t('reports.dayResults')}
            </a>
            {ageInfo ? (
              <div className="user-info-banner user-info-banner-inline">
                <span className="material-symbols-outlined">cake</span>
                <span>{t('measurement.ageInfo')} <strong>{ageInfo.years} {t('measurement.ageYears')} {ageInfo.months} {t('measurement.ageMonths')} {ageInfo.days} {t('measurement.ageDays')}</strong></span>
              </div>
            ) : null}
            <button
              className="btn-secondary"
              onClick={() => { setSelectedDeviceCodes([]); setSinocareModes(new Set()) }}
              type="button"
              style={{ marginLeft: 'auto', padding: '8px 16px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', background: 'var(--colorSurface)', cursor: 'pointer', fontSize: 14 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>close</span>
              {t('measurement.clearSelection')}
            </button>
          </div>

          <DynamicMetricForm
            selectedMetrics={selectedMetrics}
            onClearSelection={() => { setSelectedDeviceCodes([]); setSinocareModes(new Set()) }}
            onSubmitted={() => { void fetchTodaySessions().then(setTodaySessions) }}
          />
        </>
      )}
    </section>
  )
}
