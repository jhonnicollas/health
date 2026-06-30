/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Modal } from '../Modal'
import { Section } from '../Section'

export function KnowledgeTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/knowledge-articles?limit=100')
  const toast = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const openEdit = (a: any) => {
    setForm({ ...a })
    setEditing(a)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload: any = {}
    for (const k of ['title', 'category', 'contentMarkdown', 'active']) {
      if (form[k] !== undefined) payload[k] = form[k]
    }
    const r = await apiMut('PUT', `/api/admin/knowledge-articles/${encodeURIComponent(form.slug)}`, payload)
    if (r.success) {
      toast.show(`${form.slug} tersimpan.`, 'success')
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
    <Section title="Knowledge Base">
      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Title</th>
            <th>Category</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((a: any) => (
            <tr key={a.slug}>
              <td>{a.slug}</td>
              <td>{a.title}</td>
              <td>{a.category}</td>
              <td style={{ color: a.active ? '#047857' : '#9ca3af' }}>{a.active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn-primary" onClick={() => openEdit(a)} style={{ fontSize: 12, padding: '2px 8px' }}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={`Edit ${form.slug}`} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Title:</label>{' '}
              <input className="input-field" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label>Category:</label>{' '}
              <input className="input-field" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label>Content (Markdown):</label>{' '}
              <textarea
                className="input-field"
                rows={6}
                value={form.contentMarkdown || ''}
                onChange={e => setForm({ ...form, contentMarkdown: e.target.value })}
              />
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
