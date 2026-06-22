import { useEffect, useMemo, useState } from 'react'
import { DynamicMetricForm } from '../../components/measurement/DynamicMetricForm'
import type { DynamicMetricSelection } from '../../components/measurement/DynamicMetricForm'

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

const DEVICE_ICONS: Record<string, string> = {
  oximeter: 'oxygen_saturation',
  bloodPressure: 'blood_pressure',
  gcu: 'bloodtype',
  thermometer: 'thermostat',
  bodyScale: 'monitor_weight',
  manual: 'edit_note'
}

export function SelectMetricPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceCodes, setSelectedDeviceCodes] = useState<string[]>([])
  const [sinocareMode, setSinocareMode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
          setMessage(body.error?.message ?? 'Failed to load catalog.')
          return
        }

        setDevices(body.data.devices)
      } catch {
        if (!cancelled) setMessage('Failed to load measurement catalog.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCatalog()
    return () => { cancelled = true }
  }, [])

  const selectedMetrics = useMemo<DynamicMetricSelection[]>(() => {
    const result: DynamicMetricSelection[] = []
    for (const device of devices) {
      if (!selectedDeviceCodes.includes(device.deviceCode)) continue
      for (const metric of device.metrics) {
        // Sinocare: only include the selected mode metric
        if (device.deviceType === 'gcu' && sinocareMode && metric.metricCode !== sinocareMode) continue
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
  }, [devices, selectedDeviceCodes, sinocareMode])

  function toggleDevice(deviceCode: string) {
    setSelectedDeviceCodes((current) =>
      current.includes(deviceCode)
        ? current.filter((code) => code !== deviceCode)
        : [...current, deviceCode]
    )
  }

  const sinocareDevice = devices.find((d) => d.deviceType === 'gcu' && selectedDeviceCodes.includes(d.deviceCode))

  return (
    <section className="measurement-panel" aria-labelledby="device-select-title">
      <div className="measurement-step-header">
        <span className="step-number">1</span>
        <h2 id="device-select-title">Select Device</h2>
      </div>

      {loading ? <p className="loading-text">Loading catalog...</p> : null}

      {message ? (
        <p className="form-message error" role="status">{message}</p>
      ) : null}

      {!loading && !message ? (
        <div className="device-selector-grid">
          {devices.map((device) => {
            const isSelected = selectedDeviceCodes.includes(device.deviceCode)
            const icon = DEVICE_ICONS[device.deviceType] || 'medical_services'
            const metricCount = device.metrics.length
            return (
              <button
                key={device.deviceCode}
                className={`device-selector-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleDevice(device.deviceCode)}
                type="button"
              >
                <span className="material-symbols-outlined device-icon">{icon}</span>
                <div className="device-info">
                  <strong>{device.deviceName}</strong>
                  <small>{device.brand} {device.model} &middot; {metricCount} values</small>
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
          <p><strong>{sinocareDevice.deviceName}</strong> &mdash; Select test mode:</p>
          <div className="sinocare-mode-buttons">
            {sinocareDevice.metrics.map((metric) => (
              <button
                key={metric.metricCode}
                className={`sinocare-mode-btn ${sinocareMode === metric.metricCode ? 'selected' : ''}`}
                onClick={() => setSinocareMode(metric.metricCode)}
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
            <h2>Record Data</h2>
            <button
              className="btn-secondary"
              onClick={() => { setSelectedDeviceCodes([]); setSinocareMode(null) }}
              type="button"
              style={{ marginLeft: 'auto', padding: '8px 16px', border: '1px solid var(--colorBorder)', borderRadius: 'var(--radiusMd)', background: 'var(--colorSurface)', cursor: 'pointer', fontSize: 14 }}
            >
              Clear Selection
            </button>
          </div>

          <div className="selection-summary" aria-live="polite">
            <div className="selection-summary-header">
              <strong>{selectedDeviceCodes.length} device(s) selected</strong>
              <span>{selectedMetrics.length} value(s) to record</span>
            </div>
          </div>

          <DynamicMetricForm
            selectedMetrics={selectedMetrics}
            onClearSelection={() => { setSelectedDeviceCodes([]); setSinocareMode(null) }}
          />
        </>
      )}
    </section>
  )
}
