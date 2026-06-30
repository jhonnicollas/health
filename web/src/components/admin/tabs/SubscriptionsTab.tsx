/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function SubscriptionsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/subscriptions?limit=50')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const openEdit = (s: any) => {
    setForm({ ...s, cancelAtPeriodEnd: s.cancelAtPeriodEnd ? '1' : '0' })
    setEditing(s)
  }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut('PUT', `/api/admin/subscriptions/${editing.id}`, {
      planCode: form.planCode,
      status: form.status,
      cancelAtPeriodEnd: form.cancelAtPeriodEnd === '1',
    })
    if (r.success) {
      toast.show('Subscription diupdate.', 'success')
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
    <Section title="Subscriptions">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>UserID</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Provider</th>
            <th>Period Start</th>
            <th>Period End</th>
            <th>Cancel</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((s: any) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.userId}</td>
              <td>{s.planCode}</td>
              <td>{s.status}</td>
              <td>{s.provider}</td>
              <td>{s.currentPeriodStart?.slice(0, 10)}</td>
              <td>{s.currentPeriodEnd?.slice(0, 10)}</td>
              <td>{s.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(s)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Subscription #${editing.id}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Plan:</label>{' '}
              <input className="input-field" value={form.planCode || ''} onChange={e => setForm({ ...form, planCode: e.target.value })} />
            </div>
            <div>
              <label>Status:</label>{' '}
              <select value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">active</option>
                <option value="expired">expired</option>
                <option value="cancelled">cancelled</option>
                <option value="trial">trial</option>
              </select>
            </div>
            <div>
              <label>Cancel at period end:</label>{' '}
              <select value={form.cancelAtPeriodEnd || '0'} onChange={e => setForm({ ...form, cancelAtPeriodEnd: e.target.value })}>
                <option value="0">No</option>
                <option value="1">Yes</option>
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
