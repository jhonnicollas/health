/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function FeatureFlagsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/feature-flags')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (f: any) => {
    setForm({ ...f, enabled: !!f.enabled })
    setEditing(f)
  }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/feature-flags/${encodeURIComponent(form.flagCode)}`, {
      enabled: form.enabled,
      targetPlanCode: form.targetPlanCode || null,
      targetRoleCode: form.targetRoleCode || null,
    })
    if (r.success) {
      toast.show(`${form.flagCode} diupdate.`, 'success')
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
    <Section title="Feature Flags">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Enabled</th>
            <th>Target Plan</th>
            <th>Target Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((f: any) => (
            <tr key={f.flagCode}>
              <td>{f.flagCode}</td>
              <td>{f.flagName}</td>
              <td style={{ color: f.enabled ? '#047857' : '#9ca3af' }}>{f.enabled ? 'Yes' : 'No'}</td>
              <td>{f.targetPlanCode || '-'}</td>
              <td>{f.targetRoleCode || '-'}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(f)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.flagCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Enabled:</label>{' '}
              <select value={form.enabled ? 'true' : 'false'} onChange={e => setForm({ ...form, enabled: e.target.value === 'true' })}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label>Target Plan:</label>{' '}
              <input
                className="input-field"
                value={form.targetPlanCode || ''}
                onChange={e => setForm({ ...form, targetPlanCode: e.target.value || null })}
              />
            </div>
            <div>
              <label>Target Role:</label>{' '}
              <input
                className="input-field"
                value={form.targetRoleCode || ''}
                onChange={e => setForm({ ...form, targetRoleCode: e.target.value || null })}
              />
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
