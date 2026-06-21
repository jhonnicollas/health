import { useState } from 'react'

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
  manual: boolean
  onChange: (partial: { raw?: string; final?: string; manual?: boolean }) => void
}

export function ManualOverrideInput({ metric, raw, final, manual, onChange }: ManualOverrideInputProps) {
  const [editing, setEditing] = useState(false)

  function setRaw(value: string) {
    onChange({ raw: value, final: editing ? final : value, manual: editing ? true : false })
  }

  function startOverride() {
    setEditing(true)
    onChange({ manual: true })
  }

  function commitOverride(value: string) {
    onChange({ final: value, manual: value !== raw })
  }

  const min = metric.physicalMin ?? undefined
  const max = metric.physicalMax ?? undefined

  return (
    <div className="manual-override-input">
      <label>
        Nilai AI (raw)
        <input
          onChange={(e) => setRaw(e.target.value)}
          readOnly={!editing}
          type="number"
          value={raw}
        />
      </label>
      <label>
        Nilai final (dapat diedit)
        <input
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(e) => commitOverride(e.target.value)}
          type="number"
          value={final}
        />
      </label>
      <label className="checkbox-row">
        <input
          checked={manual || final !== raw}
          onChange={(e) => (e.target.checked ? startOverride() : commitOverride(raw))}
          type="checkbox"
        />
        Override manual (nilai diubah dari AI)
      </label>
    </div>
  )
}

export default ManualOverrideInput
