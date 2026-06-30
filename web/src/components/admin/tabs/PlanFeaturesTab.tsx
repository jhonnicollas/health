/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useToast } from '../../Toast'
import { apiGet, apiMut } from '../../../pages/admin/api'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function PlanFeaturesTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState('')
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    apiGet('/api/admin/plans').then(r => {
      if (r.success) setPlans(r.data?.plans || r.data || [])
    })
  }, [])

  const activePlan = selectedPlan || plans[0]?.planCode || ''
  useEffect(() => {
    if (!activePlan) return
    apiGet(`/api/admin/plans/${encodeURIComponent(activePlan)}/features`).then(r => {
      setLoading(false)
      if (r.success) {
        const map: Record<string, any> = {}
        ;(r.data?.features || r.data || []).forEach((f: any) => {
          map[f.featureCode] = f
        })
        setFeatures(map)
      } else {
        setError(r.error?.message || 'Failed')
      }
    })
  }, [activePlan])

  const toggle = (fc: string) =>
    setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), enabled: prev[fc]?.enabled ? 0 : 1 } }))
  const setQ = (fc: string, v: string) =>
    setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), quotaLimit: v === '' ? null : Number(v) } }))
  const setW = (fc: string, v: string) =>
    setFeatures(prev => ({ ...prev, [fc]: { ...(prev[fc] || { featureCode: fc }), quotaWindow: v || null } }))

  const handleSave = async () => {
    setSaving(true)
    const payload = Object.values(features).map((f: any) => ({
      featureCode: f.featureCode,
      enabled: f.enabled ? 1 : 0,
      quotaLimit: f.quotaLimit ?? null,
      quotaWindow: f.quotaWindow || null,
    }))
    const r = await apiMut('PUT', `/api/admin/plans/${encodeURIComponent(activePlan)}/features`, { features: payload })
    if (r.success) toast.show('Features tersimpan.', 'success')
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }

  return (
    <Section title="Plan Features">
      <div style={{ marginBottom: 16 }}>
        <label>Plan: </label>
        <select value={activePlan} onChange={e => { setLoading(true); setSelectedPlan(e.target.value) }}>
          {plans.map((p: any) => (
            <option key={p.planCode} value={p.planCode}>
              {p.planName}
            </option>
          ))}
        </select>
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {Object.keys(features).length > 0 && (
        <>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Enabled</th>
                <th>Quota</th>
                <th>Window</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(features).map((f: any) => (
                <tr key={f.featureCode}>
                  <td>{f.featureCode}</td>
                  <td>
                    <input type="checkbox" checked={!!f.enabled} onChange={() => toggle(f.featureCode)} />
                  </td>
                  <td>
                    <input type="number" value={f.quotaLimit ?? ''} onChange={e => setQ(f.featureCode, e.target.value)} style={{ width: 80 }} />
                  </td>
                  <td>
                    <select value={f.quotaWindow || ''} onChange={e => setW(f.featureCode, e.target.value)}>
                      <option value="">-</option>
                      <option value="day">day</option>
                      <option value="month">month</option>
                      <option value="quarter">quarter</option>
                      <option value="year">year</option>
                      <option value="lifetime">lifetime</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Features'}
          </button>
        </>
      )}
    </Section>
  )
}
