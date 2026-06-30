/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useToast } from '../../Toast'
import { apiGet, apiMut } from '../../../pages/admin/api'
import { Loading } from '../Loading'
import { Section } from '../Section'

export function AiMemoryTab() {
  const [targetUid, setTargetUid] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [msg, setMsg] = useState('')
  const toast = useToast()

  const loadStatus = async (uid: string) => {
    if (!uid) return
    setLoading(true)
    const r = await apiGet(`/api/admin/users/${uid}/ai-memory/status`)
    setLoading(false)
    if (r.success) setStatus(r.data)
    else setMsg(r.error?.message || 'Access denied')
  }
  const handleRebuild = async () => {
    if (!targetUid) return
    setRebuilding(true)
    setMsg('')
    const r = await apiMut('POST', `/api/admin/users/${targetUid}/ai-memory/rebuild`)
    if (r.success) {
      toast.show(`Rebuild queued. Job #${r.data.jobId}`, 'success')
    } else setMsg(r.error?.message || 'Failed')
    setRebuilding(false)
  }

  return (
    <Section title="AI Memory Admin">
      <div style={{ marginBottom: 16 }}>
        <label>
          User ID: <input className="input-field" value={targetUid} onChange={e => setTargetUid(e.target.value)} style={{ width: 120 }} />
        </label>
        <button className="btn-primary" onClick={() => loadStatus(targetUid)} style={{ marginLeft: 8 }}>
          Check Status
        </button>
      </div>
      {loading && <Loading />}
      {msg && <p>{msg}</p>}
      {status && (
        <div>
          <p>
            Namespace: <code>{status.namespace || '-'}</code>
          </p>
          <p>
            Documents: {status.documentCount ?? 0} | Indexed: {status.indexedCount ?? 0} | Pending: {status.pendingCount ?? 0}
          </p>
          <p>
            Sprint 6: <code>{status.sprint6ClinicalCopilot?.scopeStatus || 'deferred'}</code>
          </p>
          <button className="btn-primary" onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? 'Rebuilding...' : 'Rebuild Memory'}
          </button>
        </div>
      )}
    </Section>
  )
}
