/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from './api'

export function useList<T = any>(url: string): { data: T[]; loading: boolean; error: string; refresh: () => void } {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    setLoading(true)
    apiGet(url).then(r => {
      setLoading(false)
      if (r.success) {
        const raw = r.data
        const arr = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.logs)
            ? raw.logs
            : Array.isArray(raw?.events)
              ? raw.events
              : Array.isArray(raw?.items)
                ? raw.items
                : Array.isArray(raw?.results)
                  ? raw.results
                  : []
        setData(arr)
        setError('')
      } else {
        setError(r.error?.message || 'Gagal memuat.')
      }
    })
  }, [url, tick])
  return { data, loading, error, refresh }
}
