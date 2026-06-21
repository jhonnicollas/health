import { useState } from 'react'
import { useAuth } from '../../context/auth'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function ProfileDeletePage() {
  const { refresh } = useAuth()
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (confirm !== 'DELETE ACCOUNT') { setError('Type "DELETE ACCOUNT" to confirm.'); return }
    setError(null); setMessage(null); setLoading(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ deleted: boolean }>
      if (!body.success) { setError(body.error?.message || 'Failed.'); return }
      setMessage('Account deleted. You will be logged out.')
      await refresh()
    } catch { setError('Could not connect to server.') }
    finally { setLoading(false) }
  }

  return (
    <section className="settings-panel" aria-labelledby="delete-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Privacy</p>
          <h2 id="delete-title">Delete Account</h2>
          <p>This action is permanent. All personal data will be removed (clinical data already shared with doctors remains for audit).</p>
        </div>
        <span className="status-chip danger-chip">Permanent</span>
      </div>
      <div className="danger-zone">
        <label>Type "DELETE ACCOUNT" to confirm
          <input onChange={(e) => setConfirm(e.target.value)} value={confirm} />
        </label>
        <button disabled={loading || confirm !== 'DELETE ACCOUNT'} onClick={handleDelete} type="button">
          {loading ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
    </section>
  )
}
