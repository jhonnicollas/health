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

const METRIC_EXPLANATIONS: Record<string, { what: string; normalRange: string; tip: string }> = {
  systolic: { what: 'Tekanan darah saat jantung berkontraksi', normalRange: '<120 mmHg (normal)', tip: 'Duduk tenang 5 menit sebelum mengukur. Lengan setinggi jantung.' },
  diastolic: { what: 'Tekanan darah saat jantung beristirahat', normalRange: '<80 mmHg (normal)', tip: 'Jangan bicara saat pengukuran berlangsung.' },
  heartRate: { what: 'Jumlah detak jantung per menit', normalRange: '60-100 bpm (istirahat)', tip: 'Ukur saat bangun pagi untuk baseline akurat.' },
  spo2: { what: 'Persentase oksigen dalam darah', normalRange: '95-100% (normal)', tip: 'Pastikan tangan hangar dan jari bersih sebelum konsumsi.' },
  bloodPressurePulse: { what: 'Denut nadi saat pengukuran tekanan darah', normalRange: '60-100 bpm', tip: 'Sama dengan detak jantung, diukur via tensimeter.' },
  glucoseFasting: { what: 'Gula darah setelah puasa 8+ jam', normalRange: '70-100 mg/dL (normal)', tip: 'Puasa minimal 8 jam. Hanya minum air putih.' },
  glucosePostMeal: { what: 'Gula darah 2 jam setelah makan', normalRange: '<140 mg/dL (normal)', tip: 'Ukur tepat 2 jam setelah mulai makan.' },
  cholesterolTotal: { what: 'Total kolesterol dalam darah', normalRange: '<200 mg/dL (normal)', tip: 'Puasa 9-12 jam sebelum tes. Hindari olahraga berat.' },
  uricAcid: { what: 'Asam urat dalam darah', normalRange: '3.5-7.2 mg/dL', tip: 'Hindari makanan tinggi purin 24 jam sebelum tes.' },
  bodyWeight: { what: 'Berat badan total', normalRange: 'Sesuai BMI 18.5-24.9', tip: 'Ukur saat bangun pagi, sebelum makan, tanpa sepatu.' },
  bmi: { what: 'Indeks massa tubuh (otomatis dihitung)', normalRange: '18.5-24.9 (normal)', tip: 'Dihitung dari berat dan tinggi badan.' },
  waistCircumference: { what: 'Lingkar pinggang', normalRange: '<90 cm pria, <80 cm wanita', tip: 'Ukur di titik tersebar perut saat napas normal.' },
  bodyTemperature: { what: 'Suhu tubuh inti', normalRange: '36.1-37.2 C', tip: 'Ukur di pagi hari untuk baseline suhu normal.' },
  sleepDuration: { what: 'Durasi tidur dalam jam', normalRange: '7-9 jam (normal)', tip: 'Catat jam tidur dan bangun untuk akurasi.' },
  height: { what: 'Tinggi badan', normalRange: 'Tetap setelah dewasa', tip: 'Ukur tanpa sepatu, punggung menempel dinding.' }
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
                    {METRIC_EXPLANATIONS[metric.metricCode] ? (
                      <details className="metric-explanation">
                        <summary>What is this?</summary>
                        <p><strong>What:</strong> {METRIC_EXPLANATIONS[metric.metricCode].what}</p>
                        <p><strong>Normal:</strong> {METRIC_EXPLANATIONS[metric.metricCode].normalRange}</p>
                        <p><strong>Tip:</strong> {METRIC_EXPLANATIONS[metric.metricCode].tip}</p>
                      </details>
                    ) : null}
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
