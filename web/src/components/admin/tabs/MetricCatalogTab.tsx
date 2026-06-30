/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function MetricCatalogTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/metric-catalog?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (m: any) => {
    setForm({ ...m })
    setEditing(m)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of [
      'metricName',
      'category',
      'unit',
      'inputType',
      'requiresAttachment',
      'requiresSex',
      'requiresFasting',
      'isCalculated',
      'physicalMin',
      'physicalMax',
      'sortOrder',
      'active',
    ]) {
      if (form[k] !== undefined) payload[k] = form[k]
    }
    const r = await apiMut('PUT', `/api/admin/metric-catalog/${encodeURIComponent(form.metricCode)}`, payload)
    if (r.success) {
      toast.show(`${form.metricCode} tersimpan.`, 'success')
      setEditing(null)
      refresh()
    } else {
      toast.show(r.error?.message || 'Gagal.', 'error')
    }
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Metric Catalog">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((m: any) => (
            <tr key={m.metricCode}>
              <td>{m.metricCode}</td>
              <td>{m.metricName}</td>
              <td>{m.category}</td>
              <td>{m.unit}</td>
              <td style={{ color: m.active ? '#047857' : '#9ca3af' }}>{m.active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(m)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.metricCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['metricName', 'category', 'unit', 'inputType'].map(k => (
              <div key={k}>
                <label>{k}:</label>{' '}
                <input className="input-field" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            {['physicalMin', 'physicalMax', 'sortOrder'].map(k => (
              <div key={k}>
                <label>{k}:</label>{' '}
                <input
                  className="input-field"
                  type="number"
                  value={form[k] ?? ''}
                  onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
            ))}
            {['requiresAttachment', 'requiresSex', 'requiresFasting', 'isCalculated', 'active'].map(k => (
              <div key={k}>
                <label>{k}:</label>{' '}
                <select value={form[k] ? 'true' : 'false'} onChange={e => setForm({ ...form, [k]: e.target.value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            ))}
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </Section>
  )
}
