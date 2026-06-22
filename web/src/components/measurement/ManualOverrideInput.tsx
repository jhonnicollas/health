type Metric = {
  metricCode: string
  metricName: string
  unit: string
  physicalMin?: number | null
  physicalMax?: number | null
}

type ManualOverrideInputProps = {
  metric: Metric
  raw: string
  final: string
  onChange: (partial: { raw?: string; final?: string; manual?: boolean }) => void
}

export function ManualOverrideInput({ metric, raw, final, onChange }: ManualOverrideInputProps) {
  const min = metric.physicalMin ?? undefined
  const max = metric.physicalMax ?? undefined
  const isEdited = final !== raw && raw !== ''

  return (
    <div className="manual-override-group">
      <label htmlFor={`input-${metric.metricCode}`}>
        {metric.metricName} ({metric.unit})
      </label>
      <input
        id={`input-${metric.metricCode}`}
        className={isEdited ? 'manual-edited' : ''}
        inputMode="decimal"
        max={max}
        min={min}
        onChange={(e) => onChange({ final: e.target.value, manual: e.target.value !== raw })}
        placeholder={min != null && max != null ? `${min} – ${max}` : 'Enter value'}
        step="any"
        type="number"
        value={final}
      />
      {raw && raw !== final ? (
        <small className="ai-reference">
          AI: {raw} {metric.unit}
          {isEdited ? ' · edited' : ''}
        </small>
      ) : null}
      {min != null || max != null ? (
        <small className="physical-range">
          Normal: {min ?? '?'} – {max ?? '?'} {metric.unit}
        </small>
      ) : null}
    </div>
  )
}

export default ManualOverrideInput
