import { useEffect, useState } from 'react'

export type EntitlementFeature = {
  enabled: boolean
  quotaLimit: number | null
  quotaWindow: string | null
  usedCount: number
  remaining: number
  resetAt: string | null
  metadata: Record<string, unknown> | null
}

export type Entitlements = {
  planCode: string
  subscriptionStatus: string
  features: Record<string, EntitlementFeature>
}

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/me/entitlements', { credentials: 'include' })
        const body = await res.json()
        if (!cancelled && res.ok && body.success && body.data) {
          setEntitlements(body.data as Entitlements)
        }
      } catch {
        // Fail open: navigation shows all items if entitlements cannot be loaded.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const isEnabled = (featureCode?: string) => {
    if (!featureCode) return true
    if (loading || !entitlements) return true
    return entitlements.features[featureCode]?.enabled === true
  }

  return { entitlements, loading, isEnabled }
}
