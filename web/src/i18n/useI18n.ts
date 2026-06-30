import { useContext, useMemo } from 'react'
import { I18nContext } from './context'

export function useI18n() { return useContext(I18nContext) }

export function useTranslation() {
  const { t } = useI18n()
  return { t }
}

const METRIC_KEYS = [
  'spo2','heartRate','systolic','diastolic','bloodPressurePulse',
  'glucoseFasting','glucosePostMeal','cholesterolTotal','uricAcid',
  'bodyWeight','bmi','waistCircumference','bodyTemperature','sleepDuration',
  'height','bloodPressure','spO2','bloodGlucose'
] as const

const GLOSSARY_MAP: Record<string, string> = {
  spo2: 'gSpo2', heartRate: 'gHeartRate', systolic: 'gSystolic', diastolic: 'gDiastolic',
  bloodPressurePulse: 'gBloodPressurePulse', glucoseFasting: 'gGlucoseFasting',
  glucosePostMeal: 'gGlucosePostMeal', cholesterolTotal: 'gCholesterolTotal',
  uricAcid: 'gUricAcid', bodyWeight: 'gBodyWeight', bmi: 'gBmi',
  waistCircumference: 'gWaistCircumference', bodyTemperature: 'gBodyTemperature',
  sleepDuration: 'gSleepDuration'
}

const RANGE_MAP: Record<string, string> = {
  spo2: 'rangeSpo2', heartRate: 'rangeHeartRate', systolic: 'rangeSystolic',
  diastolic: 'rangeDiastolic', bloodPressurePulse: 'rangeBloodPressurePulse',
  glucoseFasting: 'rangeGlucoseFasting', glucosePostMeal: 'rangeGlucosePostMeal',
  cholesterolTotal: 'rangeCholesterolTotal', uricAcid: 'rangeUricAcid',
  bodyWeight: 'rangeBodyWeight', bmi: 'rangeBmi', waistCircumference: 'rangeWaistCircumference',
  bodyTemperature: 'rangeBodyTemperature', sleepDuration: 'rangeSleepDuration'
}

const UNIT_MAP: Record<string, string> = {
  spo2: 'unitSpo2', heartRate: 'unitHeartRate', systolic: 'unitSystolic',
  diastolic: 'unitDiastolic', bloodPressurePulse: 'unitBloodPressurePulse',
  glucoseFasting: 'unitGlucoseFasting', glucosePostMeal: 'unitGlucosePostMeal',
  cholesterolTotal: 'unitCholesterolTotal', uricAcid: 'unitUricAcid',
  bodyWeight: 'unitBodyWeight', bmi: 'unitBmi', waistCircumference: 'unitWaistCircumference',
  bodyTemperature: 'unitBodyTemperature', sleepDuration: 'unitSleepDuration'
}

const DEV_MAP: Record<string, string> = {
  oximeter: 'devOximeter', bloodPressure: 'devBloodPressure', bodyScale: 'devBodyScale',
  thermometer: 'devThermometer', sleepTracker: 'devSleepTracker', manual: 'devManual',
  sinocare: 'devSinocare', calculated: 'devCalculated', meteran: 'devMeteran'
}

const SEV_KEYS = ['normal','info','warning','high','critical','emergency'] as const
const SEV_I18N_KEYS: Record<string, string> = {
  normal: 'sevNormal', info: 'sevInfo', warning: 'sevWarning',
  high: 'sevHigh', critical: 'sevCritical', emergency: 'sevEmergency'
}

export function useMetricLabels() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const k of METRIC_KEYS) m[k] = t(`metrics.${k}`, k)
    return m
  }, [t])
}

export function useMetricGlossary() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const [k, ik] of Object.entries(GLOSSARY_MAP)) m[k] = t(`metrics.${ik}`, '')
    return m
  }, [t])
}

export function useMetricRanges() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const [k, ik] of Object.entries(RANGE_MAP)) m[k] = t(`metrics.${ik}`, '')
    return m
  }, [t])
}

export function useMetricUnitInfos() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const [k, ik] of Object.entries(UNIT_MAP)) m[k] = t(`metrics.${ik}`, '')
    return m
  }, [t])
}

export function useDeviceLabels() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const [k, ik] of Object.entries(DEV_MAP)) m[k] = t(`metrics.${ik}`, k)
    return m
  }, [t])
}

export function useSeverityLabels() {
  const { t } = useI18n()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const k of SEV_KEYS) m[k] = t(`metrics.${SEV_I18N_KEYS[k]}`, k)
    return m
  }, [t])
}
