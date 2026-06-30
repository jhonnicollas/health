/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function AiConfigTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  useEffect(() => {
    fetch('/api/admin/ai-config', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(r => {
        setLoading(false)
        if (r.success) setData(r.data)
        else setError(r.error?.message || '')
      })
  }, [])
  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', '/api/admin/ai-config', data || {})
    if (r.success) toast.show('AI Config tersimpan.', 'success')
    else toast.show(r.error?.message || 'Gagal.', 'error')
    setSaving(false)
  }
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  const skip = new Set(['aiClinicalCopilotAllowedActions', 'aiClinicalCopilotForbiddenActions', 'aiClinicalCopilotScopeStatus', 'aiClinicalCopilotRuntimeEnabled'])
  return (
    <Section title="AI Configuration">
      <div className="admin-ai-form">
        {data
          ? Object.entries(data)
              .filter(([k]) => !skip.has(k))
              .map(([k, v]: [string, any]) => (
                <div key={k} className="admin-field">
                  <label>{k}</label>
                  <input
                    value={typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                    onChange={e => {
                      const nv: any = {}
                      Object.assign(nv, data, { [k]: e.target.value })
                      setData(nv)
                    }}
                  />
                </div>
              ))
          : null}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Section>
  )
}
