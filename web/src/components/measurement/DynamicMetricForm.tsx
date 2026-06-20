import { AttachmentUploader } from './AttachmentUploader'

export type MetricFormMetric = {
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

export type MetricFormDevice = {
  deviceCode: string
  deviceName: string
  brand: string
  model: string
}

export type SelectedMetric = {
  id: string
  device: MetricFormDevice
  metric: MetricFormMetric
}

type DynamicMetricFormProps = {
  selectedMetrics: SelectedMetric[]
}

function metricHint(metric: MetricFormMetric) {
  const parts = []

  if (metric.physicalMin !== null && metric.physicalMax !== null) {
    parts.push(`${metric.physicalMin}-${metric.physicalMax} ${metric.unit}`)
  }

  if (metric.requiresAttachment) {
    parts.push('foto diperlukan')
  }

  if (metric.requiresFasting) {
    parts.push('puasa')
  }

  if (!metric.requiredMetric) {
    parts.push('opsional')
  }

  return parts.join(' | ')
}

export function DynamicMetricForm({ selectedMetrics }: DynamicMetricFormProps) {
  if (selectedMetrics.length === 0) {
    return (
      <section className="dynamic-metric-form empty" aria-label="Form metrik dinamis">
        <p>Pilih metrik untuk menampilkan form input.</p>
      </section>
    )
  }

  return (
    <section className="dynamic-metric-form" aria-label="Form metrik dinamis">
      {selectedMetrics.map(({ id, device, metric }) => (
        <article className="measurement-card" key={id}>
          <header>
            <div>
              <p className="eyebrow">{device.deviceName}</p>
              <h3>{metric.metricName}</h3>
            </div>
            <span className="source-pill">Belum diisi</span>
          </header>

          <label className="form-field" htmlFor={`${id}-value`}>
            Nilai {metric.metricName}
            <div className="number-input-row">
              <input
                disabled={metric.isCalculated}
                id={`${id}-value`}
                inputMode="decimal"
                placeholder={metric.isCalculated ? 'Dihitung otomatis' : '0'}
                type="number"
              />
              <span>{metric.unit}</span>
            </div>
          </label>

          {metric.requiresAttachment ? (
            <AttachmentUploader metricCode={metric.metricCode} required={metric.requiredMetric} />
          ) : null}

          <p className="metric-card-hint">{metricHint(metric) || metric.category}</p>
        </article>
      ))}
    </section>
  )
}
