import { useState, useEffect } from 'react'
import "./ManualOverrideInput.css"

export type MetricValue = {
  metricCode: string
  rawAiValue?: number
  finalValue?: number
  unit: string
  confidence?: number
  manualOverride: boolean
}

type ManualOverrideInputProps = {
  metrics: MetricValue[]
  onMetricsChange: (metrics: MetricValue[]) => void
  disabled?: boolean
}

export function ManualOverrideInput({
  metrics,
  onMetricsChange,
  disabled = false
}: ManualOverrideInputProps) {
  const [localMetrics, setLocalMetrics] = useState<MetricValue[]>(metrics)

  useEffect(() => {
    setLocalMetrics(metrics)
  }, [metrics])

  const handleValueChange = (metricCode: string, newValue: string) => {
    const numValue = parseFloat(newValue)
    const updatedMetrics = localMetrics.map(metric => {
      if (metric.metricCode === metricCode) {
        const hasChanged = metric.rawAiValue !== undefined && 
                          numValue !== metric.rawAiValue
        return {
          ...metric,
          finalValue: isNaN(numValue) ? undefined : numValue,
          manualOverride: hasChanged
        }
      }
      return metric
    })
    setLocalMetrics(updatedMetrics)
    onMetricsChange(updatedMetrics)
  }

  const handleReset = (metricCode: string) => {
    const updatedMetrics = localMetrics.map(metric => {
      if (metric.metricCode === metricCode) {
        return {
          ...metric,
          finalValue: metric.rawAiValue,
          manualOverride: false
        }
      }
      return metric
    })
    setLocalMetrics(updatedMetrics)
    onMetricsChange(updatedMetrics)
  }

  const getMetricLabel = (metricCode: string): string => {
    const labels: Record<string, string> = {
      spo2: 'SpO2',
      heartRate: 'Heart Rate',
      systolic: 'Systolic',
      diastolic: 'Diastolic',
      bloodPressurePulse: 'Pulse',
      glucoseFasting: 'Glucose Fasting',
      glucosePostMeal: 'Glucose Post Meal',
      cholesterolTotal: 'Total Cholesterol',
      uricAcid: 'Uric Acid',
      bodyWeight: 'Body Weight',
      bmi: 'BMI',
      waistCircumference: 'Waist Circumference',
      bodyTemperature: 'Body Temperature',
      sleepDuration: 'Sleep Duration'
    }
    return labels[metricCode] || metricCode
  }

  return (
    <div className="manual-override-input">
      {localMetrics.map(metric => (
        <div key={metric.metricCode} className="metric-row">
          <label className="metric-label">
            {getMetricLabel(metric.metricCode)} ({metric.unit})
          </label>
          
          <div className="metric-input-group">
            <input
              type="number"
              value={metric.finalValue !== undefined ? metric.finalValue : ''}
              onChange={(e) => handleValueChange(metric.metricCode, e.target.value)}
              disabled={disabled}
              className={`metric-input ${metric.manualOverride ? 'manual-override' : ''}`}
              placeholder={metric.rawAiValue !== undefined ? `AI: ${metric.rawAiValue}` : 'Enter value'}
            />
            
            {metric.manualOverride && (
              <button
                type="button"
                onClick={() => handleReset(metric.metricCode)}
                disabled={disabled}
                className="reset-button"
                title="Reset to AI value"
              >
                ↺
              </button>
            )}
          </div>

          {metric.confidence !== undefined && (
            <div className="confidence-indicator">
              Confidence: {Math.round(metric.confidence * 100)}%
            </div>
          )}

          {metric.manualOverride && (
            <div className="override-badge">
              Manual Override
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
