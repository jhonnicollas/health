/* eslint-disable @typescript-eslint/no-explicit-any */
import { useList } from '../../../pages/admin/adminHooks'
import { ErrorMsg } from '../ErrorMsg'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function SafetyEventsTab() {
  const { data, loading, error } = useList<any>('/api/admin/safety-events?limit=50')
  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} />
  return (
    <Section title="Safety Events">
      <table style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Title</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {data.map((e: any) => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.userId}</td>
              <td>{e.eventType}</td>
              <td>{e.severity}</td>
              <td>{e.title}</td>
              <td>{e.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}
