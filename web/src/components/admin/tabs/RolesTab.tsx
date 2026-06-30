/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function RolesTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/roles')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<any>({})

  const openNew = () => {
    setForm({ roleCode: '', roleName: '', systemRole: false, active: true })
    setMode('add')
    setEditing({})
  }
  const openEdit = (r: any) => {
    setForm({ ...r })
    setMode('edit')
    setEditing(r)
  }

  const handleSave = async () => {
    setSaving(true)
    const url = mode === 'add' ? '/api/admin/roles' : `/api/admin/roles/${encodeURIComponent(form.roleCode)}`
    const r = await apiMut(mode === 'add' ? 'POST' : 'PUT', url, { roleName: form.roleName, active: form.active ? 1 : 0 })
    if (r.success) {
      toast.show(mode === 'add' ? 'Role dibuat.' : 'Role diupdate.', 'success')
      setMode(null)
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
    <Section title="Roles">
      <button className="btn-primary" onClick={openNew} style={{ marginBottom: 12 }}>
        + Add Role
      </button>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>System</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((r: any) => (
            <tr key={r.roleCode}>
              <td>{r.roleCode}</td>
              <td>{r.roleName}</td>
              <td>{r.systemRole ? 'Yes' : 'No'}</td>
              <td style={{ color: r.active ? '#047857' : '#dc2626' }}>{r.active ? 'Yes' : 'No'}</td>
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
        <Modal
          title={mode === 'add' ? 'New Role' : `Edit ${form.roleCode}`}
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
                value={form.roleCode}
                onChange={e => setForm({ ...form, roleCode: e.target.value })}
                disabled={mode === 'edit'}
              />
            </div>
            <div>
              <label>Name:</label>{' '}
              <input className="input-field" value={form.roleName || ''} onChange={e => setForm({ ...form, roleName: e.target.value })} />
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
