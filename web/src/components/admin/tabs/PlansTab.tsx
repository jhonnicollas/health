/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useToast } from '../../Toast'
import { apiGet, apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function PlansTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/plans')
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    if (data.length === 0) return
    const fm: Record<string, any> = {}
    Promise.all(
      data.map(async (p: any) => {
        const fr = await apiGet(`/api/admin/plans/${encodeURIComponent(p.planCode)}/features`)
        if (fr.success)
          fm[p.planCode] = (fr.data?.features || fr.data || []).reduce((acc: any, f: any) => {
            acc[f.featureCode] = f
            return acc
          }, {})
      }),
    ).then(() => {
      setFeatures(fm)
      setFeaturesLoading(false)
    })
  }, [data])

  const openNew = () => {
    setForm({ planCode: '', planName: '', billingInterval: 'monthly', priceAmount: 0, currency: 'IDR', active: true, trialDays: 0, sortOrder: 0 })
    setMode('add')
    setEditing({})
  }
  const openEdit = (p: any) => {
    setForm({ ...p, priceAmount: p.priceAmount ?? 0, trialDays: p.trialDays ?? 0, sortOrder: p.sortOrder ?? 0 })
    setMode('edit')
    setEditing(p)
  }

  const handleSave = async () => {
    setSaving(true)
    const url = mode === 'add' ? '/api/admin/plans' : `/api/admin/plans/${encodeURIComponent(form.planCode)}`
    const r = await apiMut(mode === 'add' ? 'POST' : 'PUT', url, {
      planName: form.planName,
      billingInterval: form.billingInterval,
      priceAmount: Number(form.priceAmount),
      currency: form.currency,
      active: form.active,
      trialDays: Number(form.trialDays),
      sortOrder: Number(form.sortOrder),
    })
    if (r.success) {
      toast.show(mode === 'add' ? 'Plan dibuat.' : 'Plan diupdate.', 'success')
      setMode(null)
      setEditing(null)
      setFeaturesLoading(true)
      refresh()
    } else {
      toast.show(r.error?.message || 'Gagal.', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (planCode: string) => {
    if (!confirm(`Hapus plan ${planCode}? Plan akan dinonaktifkan.`)) return
    const r = await apiMut('DELETE', `/api/admin/plans/${encodeURIComponent(planCode)}`)
    if (r.success) {
      toast.show(`${planCode} dihapus.`, 'success')
      setFeaturesLoading(true)
      refresh()
    } else {
      toast.show(r.error?.message || 'Gagal menghapus.', 'error')
    }
  }

  const activePlans = data
    .filter((p: any) => p.active)
    .sort((a: any, b: any) => (a.planCode === 'free' ? -1 : b.planCode === 'free' ? 1 : 0))
  const featureCodes = [...new Set(Object.values(features).flatMap((m: any) => Object.keys(m || {})))]

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Plans, Features & Entitlement">
      <button className="btn-primary" onClick={openNew} style={{ marginBottom: 12 }}>
        + Add Plan
      </button>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Interval</th>
              <th>Price</th>
              <th>Active</th>
              <th>Sort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.planCode}>
                <td>{p.planCode}</td>
                <td>{p.planName}</td>
                <td>{p.billingInterval}</td>
                <td>
                  {p.priceAmount} {p.currency}
                </td>
                <td style={{ color: p.active ? '#047857' : '#9ca3af' }}>{p.active ? 'Yes' : 'No'}</td>
                <td>{p.sortOrder}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-primary" onClick={() => openEdit(p)} style={{ fontSize: 12, padding: '2px 8px' }}>
                    Edit
                  </button>
                  {p.planCode !== 'free' && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleDelete(p.planCode)}
                      style={{ fontSize: 12, padding: '2px 8px', color: '#dc2626' }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {featuresLoading ? (
        <Loading />
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border, #e5e7eb)', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Feature</th>
                {activePlans.map((p: any) => (
                  <th key={p.planCode} style={{ padding: 12, textAlign: 'center' }}>
                    {p.planName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureCodes.map(fc => (
                <tr key={fc} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                  <td style={{ padding: 12, fontWeight: 800 }}>{fc}</td>
                  {activePlans.map((p: any) => {
                    const f = features[p.planCode]?.[fc]
                    return (
                      <td key={p.planCode} style={{ padding: 12, textAlign: 'center' }}>
                        {!f || !f.enabled ? (
                          <span style={{ color: '#9ca3af' }}>Off</span>
                        ) : f.quotaLimit ? (
                          <span>
                            {f.quotaLimit}/{f.quotaWindow || 'period'}
                          </span>
                        ) : (
                          <span style={{ color: '#047857', fontWeight: 800 }}>On</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          title={mode === 'add' ? 'New Plan' : `Edit ${form.planCode}`}
          onClose={() => {
            setMode(null)
            setEditing(null)
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Code:</label>{' '}
              <input
                className="input-field"
                value={form.planCode}
                onChange={e => setForm({ ...form, planCode: e.target.value })}
                disabled={mode === 'edit'}
              />
            </div>
            <div>
              <label>Name:</label>{' '}
              <input className="input-field" value={form.planName || ''} onChange={e => setForm({ ...form, planName: e.target.value })} />
            </div>
            <div>
              <label>Interval:</label>{' '}
              <select value={form.billingInterval} onChange={e => setForm({ ...form, billingInterval: e.target.value })}>
                <option value="free">free</option>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
                <option value="yearly">yearly</option>
                <option value="manual">manual</option>
              </select>
            </div>
            <div>
              <label>Price:</label>{' '}
              <input className="input-field" type="number" value={form.priceAmount} onChange={e => setForm({ ...form, priceAmount: e.target.value })} />
            </div>
            <div>
              <label>Trial Days:</label>{' '}
              <input className="input-field" type="number" value={form.trialDays} onChange={e => setForm({ ...form, trialDays: e.target.value })} />
            </div>
            <div>
              <label>Sort Order:</label>{' '}
              <input className="input-field" type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div>
              <label>Active:</label>{' '}
              <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </Section>
  )
}
