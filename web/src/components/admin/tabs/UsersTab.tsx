/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function UsersTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/users?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = search
    ? data.filter(
        (u: any) =>
          (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (u.displayName || '').toLowerCase().includes(search.toLowerCase()),
      )
    : data

  const handleEdit = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/users/${editing.userId}/status`, { active: editing.active })
    if (r.success) {
      toast.show('User berhasil diupdate.', 'success')
      setEditing(null)
      refresh()
    } else {
      toast.show(r.error?.message || 'Gagal update user.', 'error')
    }
    setSaving(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Users">
      <input
        className="input-field"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12, width: 280 }}
      />
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Name</th>
            <th>Active</th>
            <th>Roles</th>
            <th>Plan</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u: any) => (
            <tr key={u.userId}>
              <td>{u.userId}</td>
              <td>{u.email}</td>
              <td>{u.displayName}</td>
              <td style={{ color: u.active ? '#047857' : '#dc2626' }}>{u.active ? 'Active' : 'Inactive'}</td>
              <td>{(u.roles || []).join(', ')}</td>
              <td>{u.subscription?.planCode || 'none'}</td>
              <td>{u.createdAt?.slice(0, 10)}</td>
              <td>
                <button className="btn-primary" onClick={() => setEditing(u)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`User #${editing.userId}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Email:</label> <strong>{editing.email}</strong>
            </div>
            <div>
              <label>Roles:</label> <strong>{(editing.roles || []).join(', ') || 'none'}</strong>
            </div>
            <div>
              <label>Plan:</label> <strong>{editing.subscription?.planCode || 'none'}</strong>
            </div>
            <div>
              <label>Active:</label>{' '}
              <select
                value={editing.active ? 'active' : 'disabled'}
                onChange={e => setEditing({ ...editing, active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <button className="btn-primary" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </Modal>
      )}
    </Section>
  )
}
