import { useEffect, useMemo, useState } from 'react'
import { DynamicMetricForm } from '../../components/measurement/DynamicMetricForm'

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

type SelectedMetric = {
  id: string
  device: Device
  metric: Metric
}

function metricSelectionId(deviceCode: string, metricCode: string) {
  return `${deviceCode}:${metricCode}`
}

function metricBadges(metric: Metric) {
  const badges = [metric.isCalculated ? 'auto' : metric.unit]

  if (metric.requiresAttachment) {
    badges.push('photo')
  }

  if (metric.requiresFasting) {
    badges.push('fasting')
  }

  if (metric.requiresSex) {
    badges.push('sex req')
  }

  if (!metric.requiredMetric) {
    badges.push('optional')
  }

  return badges.join(' / ')
}

export function SelectMetricPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([])
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
          headers: {
            Accept: 'application/json'
          }
        })
        const body = (await response.json()) as CatalogResponse

        if (cancelled) {
          return
        }

        if (!response.ok || !body.success || !body.data) {
          setMessage(body.error?.message ?? 'Failed to load catalog.')
          return
        }

        setDevices(body.data.devices)
      } catch {
        if (!cancelled) {
          setMessage('Failed to load measurement catalog.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedMetrics = useMemo(
    () =>
      devices.flatMap((device) =>
        device.metrics
          .map((metric) => ({
            id: metricSelectionId(device.deviceCode, metric.metricCode),
            device,
            metric
          }))
          .filter((item) => selectedMetricIds.includes(item.id))
      ),
    [devices, selectedMetricIds]
  )

  function toggleMetric(selectionId: string) {
    setSelectedMetricIds((current) =>
      current.includes(selectionId)
        ? current.filter((selected) => selected !== selectionId)
        : [...current, selectionId]
    )
  }

  return (
    <section className="measurement-panel" aria-labelledby="metric-select-title">
      <div className="measurement-step-header">
        <span className="step-number">1</span>
        <h2 id="metric-select-title">Select Metrics</h2>
      </div>

      {loading ? <p className="loading-text">Loading catalog...</p> : null}

      {message ? (
        <p className="form-message error" role="status">
          {message}
        </p>
      ) : null}

      {!loading && !message ? (
        <div className="metric-checkbox-grid">
          {devices.flatMap((device) =>
            device.metrics.map((metric) => {
              const selectionId = metricSelectionId(device.deviceCode, metric.metricCode)
              const isSelected = selectedMetricIds.includes(selectionId)
              return (
                <label
                  className={`metric-checkbox-card ${isSelected ? 'selected' : ''}`}
                  key={selectionId}
                >
                  <input
                    checked={isSelected}
                    onChange={() => toggleMetric(selectionId)}
                    type="checkbox"
                    className="sr-only"
                  />
                  <span className={`checkbox-indicator ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? <span className="material-symbols-outlined">check</span> : ''}
                  </span>
                  <span className="checkbox-card-content">
                    <strong>{metric.metricName}</strong>
                    <small>{device.deviceName}</small>
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : null}

      {selectedMetrics.length > 0 && (
        <>
          <div className="measurement-step-header">
            <span className="step-number">2</span>
            <h2>Record Data</h2>
          </div>

          <div className="selection-summary" aria-live="polite">
            <div className="selection-summary-header">
              <strong>{selectedMetrics.length} metrics selected</strong>
              <span>{devices.length} device(s)</span>
            </div>
            <div className="selected-field-list">
              {selectedMetrics.map(({ id, device, metric }: SelectedMetric) => (
                <section key={id}>
                  <h3>{metric.metricName}</h3>
                  <p>
                    {device.deviceName} / {metricBadges(metric)}
                  </p>
                </section>
              ))}
            </div>
          </div>

          <DynamicMetricForm selectedMetrics={selectedMetrics} />
        </>
      )}
    </section>
  )
}
