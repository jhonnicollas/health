export type ValidationError = {
  field: string
  message: string
  code: 'OUT_OF_RANGE' | 'INVALID_PAIR' | 'REQUIRED' | 'INVALID_FORMAT'
}

export type MetricValueInput = {
  metricCode: string
  finalValue: number
  unit?: string
}

const PHYSICAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  spo2: { min: 50, max: 100, unit: '%' },
  heartRate: { min: 30, max: 220, unit: 'bpm' },
  systolic: { min: 50, max: 250, unit: 'mmHg' },
  diastolic: { min: 30, max: 180, unit: 'mmHg' },
  bloodPressurePulse: { min: 30, max: 220, unit: 'bpm' },
  glucoseFasting: { min: 20, max: 600, unit: 'mg/dL' },
  glucosePostMeal: { min: 20, max: 600, unit: 'mg/dL' },
  cholesterolTotal: { min: 50, max: 500, unit: 'mg/dL' },
  uricAcid: { min: 1, max: 20, unit: 'mg/dL' },
  bodyWeight: { min: 10, max: 400, unit: 'kg' },
  bmi: { min: 10, max: 80, unit: 'kg/m2' },
  waistCircumference: { min: 30, max: 250, unit: 'cm' },
  bodyTemperature: { min: 30, max: 45, unit: 'C' },
  sleepDuration: { min: 0, max: 24, unit: 'hours' },
  height: { min: 50, max: 250, unit: 'cm' }
}

export function validatePhysicalRange(metric: MetricValueInput): ValidationError | null {
  const range = PHYSICAL_RANGES[metric.metricCode]
  if (!range) {
    return null
  }

  if (!Number.isFinite(metric.finalValue)) {
    return {
      field: metric.metricCode,
      message: `${metric.metricCode} harus berupa angka valid.`,
      code: 'INVALID_FORMAT'
    }
  }

  if (metric.finalValue < range.min || metric.finalValue > range.max) {
    return {
      field: metric.metricCode,
      message: `${metric.metricCode} harus antara ${range.min} - ${range.max} ${range.unit}.`,
      code: 'OUT_OF_RANGE'
    }
  }

  return null
}

export function validateBloodPressurePair(metrics: MetricValueInput[]): ValidationError | null {
  const systolic = metrics.find(m => m.metricCode === 'systolic')
  const diastolic = metrics.find(m => m.metricCode === 'diastolic')

  if (systolic && diastolic) {
    if (diastolic.finalValue >= systolic.finalValue) {
      return {
        field: 'diastolic',
        message: 'Diastolic tidak boleh lebih besar atau sama dengan Systolic.',
        code: 'INVALID_PAIR'
      }
    }

    if (systolic.finalValue - diastolic.finalValue < 10) {
      return {
        field: 'systolic',
        message: 'Selisih Systolic dan Diastolic terlalu kecil (minimal 10 mmHg).',
        code: 'INVALID_PAIR'
      }
    }
  }

  return null
}

export function validateMetrics(metrics: MetricValueInput[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (const metric of metrics) {
    const error = validatePhysicalRange(metric)
    if (error) {
      errors.push(error)
    }
  }

  const bpError = validateBloodPressurePair(metrics)
  if (bpError) {
    errors.push(bpError)
  }

  return errors
}
