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
  const badges = [metric.isCalculated ? 'otomatis' : metric.unit]

  if (metric.requiresAttachment) {
    badges.push('foto')
  }

  if (metric.requiresFasting) {
    badges.push('puasa')
  }

  if (metric.requiresSex) {
    badges.push('profil sex')
  }

  if (!metric.requiredMetric) {
    badges.push('opsional')
  }

  return badges.join(' | ')
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
          setMessage(body.error?.message ?? 'Katalog pengukuran gagal dimuat.')
          return
        }

        setDevices(body.data.devices)
      } catch {
        if (!cancelled) {
          setMessage('Tidak bisa memuat katalog pengukuran.')
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tambah pengukuran</p>
          <h2 id="metric-select-title">Pilih jenis pengukuran</h2>
          <p>Checklist dimuat dari katalog metrik aktif.</p>
        </div>
        <span className="status-chip">{selectedMetrics.length} dipilih</span>
      </div>

      {loading ? <p className="loading-text">Memuat katalog...</p> : null}

      {message ? (
        <p className="form-message error" role="status">
          {message}
        </p>
      ) : null}

      {!loading && !message ? (
        <div className="metric-device-list">
          {devices.map((device) => (
            <fieldset className="metric-device" key={device.deviceCode}>
              <legend>
                {device.deviceName}
                <span>
                  {device.brand} {device.model}
                </span>
              </legend>

              <div className="metric-checklist">
                {device.metrics.map((metric) => {
                  const selectionId = metricSelectionId(device.deviceCode, metric.metricCode)

                  return (
                    <label className="metric-option" key={selectionId}>
                      <input
                        checked={selectedMetricIds.includes(selectionId)}
                        onChange={() => toggleMetric(selectionId)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{metric.metricName}</strong>
                        <small>{metricBadges(metric)}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      <div className="selection-summary" aria-live="polite">
        <div className="selection-summary-header">
          <strong>{selectedMetrics.length} metrik dipilih</strong>
          <span>{devices.length} alat/input</span>
        </div>
        {selectedMetrics.length > 0 ? (
          <div className="selected-field-list">
            {selectedMetrics.map(({ id, device, metric }: SelectedMetric) => (
              <section key={id}>
                <h3>{metric.metricName}</h3>
                <p>
                  {device.deviceName} | {metricBadges(metric)}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p>Belum ada metrik dipilih.</p>
        )}
      </div>

      <DynamicMetricForm selectedMetrics={selectedMetrics} />
    </section>
  )
}
