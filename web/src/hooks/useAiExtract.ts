import { useState } from 'react'

export type AiExtractMetrics = {
  metricCode: string
  rawAiValue: number
  unit: string
  confidence: number
}

export type AiExtractResult = {
  timeout: boolean
  durationMs: number
  deviceCode: string
  metricGroup: string
  metrics?: AiExtractMetrics[]
  needsManualReview?: boolean
}

export type AiExtractError = {
  success: false
  error: {
    code: 'AI_TIMEOUT' | 'AI_EXTRACTION_FAILED' | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'INTERNAL_ERROR'
    message: string
  }
  data?: {
    timeout: boolean
    durationMs: number
    deviceCode: string
    metricGroup: string
  }
}

export function useAiExtract() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiExtractResult | null>(null)

  const extract = async (
    file: File,
    deviceCode: string,
    metricGroup: string,
    selectedMetricCodes: string[],
    sessionDraftId?: string
  ): Promise<{ result?: AiExtractResult; error?: AiExtractError }> => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('deviceCode', deviceCode)
      formData.append('metricGroup', metricGroup)
      formData.append('selectedMetricCodes', JSON.stringify(selectedMetricCodes))
      if (sessionDraftId) {
        formData.append('sessionDraftId', sessionDraftId)
      }

      const response = await fetch('/api/measurements/extract', {
        credentials: 'include',
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        return { result: data.data }
      } else {
        setError(data.error?.message || 'AI extraction failed')
        return { error: data }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      return {
        error: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: errorMessage
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setLoading(false)
    setError(null)
    setResult(null)
  }

  return {
    extract,
    loading,
    error,
    result,
    reset
  }
}
