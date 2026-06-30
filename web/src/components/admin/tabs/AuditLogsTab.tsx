/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function AuditLogsTab() {
  const { data, loading, error } = useList<any>('/api/admin/audit-logs?limit=100')
  const [search, setSearch] = useState('')
  const filtered = search
    ? data.filter(
        (l: any) =>
          (l.action || '').toLowerCase().includes(search) || (l.entityType || '').toLowerCase().includes(search),
      )
    : data
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Audit Logs">
      <input
        className="input-field"
        placeholder="Search action/entity..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12, width: 280 }}
      />
      <table style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l: any) => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.userId}</td>
              <td>{l.action}</td>
              <td>
                {l.entityType}:{l.entityId}
              </td>
              <td>{l.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}
