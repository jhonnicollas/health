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
    if (confirm !== 'HAPUS AKUN') { setError('Ketik "HAPUS AKUN" untuk konfirmasi.'); return }
    setError(null); setMessage(null); setLoading(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ deleted: boolean }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      setMessage('Akun dihapus. Anda akan logout.')
      await refresh()
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(false) }
  }

  return (
    <section className="settings-panel" aria-labelledby="delete-title">
      <h2 id="delete-title">Hapus Akun</h2>
      <p>Tindakan ini permanen. Semua data pribadi akan dihapus (data klinis yang sudah di-share ke dokter tetap ada untuk audit).</p>
      <label>Ketik "HAPUS AKUN" untuk konfirmasi
        <input onChange={(e) => setConfirm(e.target.value)} value={confirm} />
      </label>
      <button disabled={loading || confirm !== 'HAPUS AKUN'} onClick={handleDelete} type="button">
        {loading ? 'Menghapus...' : 'Hapus Akun Saya'}
      </button>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}
    </section>
  )
}
