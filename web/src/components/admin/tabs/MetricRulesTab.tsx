/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function MetricRulesTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/metric-rules?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (r: any) => {
    setForm({ ...r })
    setEditing(r)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of [
      'ruleName',
      'metricCode',
      'sex',
      'status',
      'severity',
      'minValue',
      'maxValue',
      'popupTitle',
      'popupMessage',
      'recommendation',
      'sourceLabel',
      'active',
    ]) {
      if (form[k] !== undefined) payload[k] = form[k]
    }
    const r = await apiMut('PUT', `/api/admin/metric-rules/${encodeURIComponent(form.ruleCode)}`, payload)
    if (r.success) {
      toast.show(`${form.ruleCode} tersimpan.`, 'success')
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
    <Section title="Metric Rules">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Metric</th>
            <th>Severity</th>
            <th>Range</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((r: any) => (
            <tr key={r.ruleCode}>
              <td>{r.ruleCode}</td>
              <td>{r.ruleName}</td>
              <td>{r.metricCode}</td>
              <td>{r.severity}</td>
              <td>
                {r.minValue} - {r.maxValue}
              </td>
              <td style={{ color: r.active ? '#047857' : '#9ca3af' }}>{r.active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(r)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.ruleCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflow: 'auto' }}>
            {['ruleName', 'metricCode', 'sex', 'status', 'severity', 'popupTitle', 'popupMessage', 'recommendation', 'sourceLabel'].map(k => (
              <div key={k}>
                <label>{k}:</label>{' '}
                <input className="input-field" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            {['minValue', 'maxValue'].map(k => (
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
            <div>
              <label>active:</label>{' '}
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
