/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiMut } from '../../../pages/admin/api'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function ConfigsTab() {
  const { data, loading, error, refresh } = useList<any>('/api/admin/configs')
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const toast = useToast()

  const currentValue = (key: string) => edit[key] ?? data.find((x: any) => x.configKey === key)?.configValue ?? ''

  const handleSave = async (key: string) => {
    setSaving(key)
    const r = await apiMut('PUT', `/api/admin/configs/${encodeURIComponent(key)}`, { configValue: currentValue(key) })
    if (r.success) toast.show(`${key} tersimpan.`, 'success')
    else toast.show(r.error?.message || `Gagal menyimpan ${key}.`, 'error')
    setSaving(null)
    refresh()
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="System Configs">
      {data.length === 0 ? (
        <p>No configs.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.configKey}>
                <td>{r.configKey}</td>
                <td>
                  <input
                    className="input-field"
                    value={currentValue(r.configKey)}
                    onChange={e => setEdit({ ...edit, [r.configKey]: e.target.value })}
                    style={{ width: 300 }}
                  />
                </td>
                <td>
                  <button className="btn-primary" onClick={() => handleSave(r.configKey)} disabled={saving === r.configKey}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
