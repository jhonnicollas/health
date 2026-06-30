/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function EducationTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/education/cards?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (e: any) => {
    setForm({ ...e })
    setEditing(e)
  }

  const handleSave = async () => {
    setSaving(true)
    const r = await apiMut(
      'PUT',
      `/api/admin/education/cards/${encodeURIComponent(form.topicType)}/${encodeURIComponent(form.topicCode)}`,
      { title: form.title, shortText: form.shortText, active: form.active },
    )
    if (r.success) {
      toast.show('Education card tersimpan.', 'success')
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
    <Section title="Education Cards">
      <table>
        <thead>
          <tr>
            <th>Topic Type</th>
            <th>Topic Code</th>
            <th>Title</th>
            <th>Active</th>
            <th>Sort</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((e: any) => (
            <tr key={e.id}>
              <td>{e.topicType}</td>
              <td>{e.topicCode}</td>
              <td>{e.title}</td>
              <td style={{ color: e.active ? '#047857' : '#9ca3af' }}>{e.active ? 'Yes' : 'No'}</td>
              <td>{e.sortOrder}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(e)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${editing.topicType}/${editing.topicCode}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Title:</label>{' '}
              <input className="input-field" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label>Short Text:</label>{' '}
              <textarea className="input-field" rows={3} value={form.shortText || ''} onChange={e => setForm({ ...form, shortText: e.target.value })} />
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
