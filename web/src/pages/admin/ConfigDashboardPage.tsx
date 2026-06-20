import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/auth'

type ConfigRow = {
  configKey: string
  configValue: string
  dataType?: string
  description?: string | null
  updatedAt?: string
}

type ConfigListResponse = {
  success: boolean
  data?: { configs: ConfigRow[] }
  error?: { message: string }
}

type ConfigUpdateResponse = {
  success: boolean
  data?: { updated: boolean; cacheInvalidated: boolean }
  error?: { message: string }
}

export function ConfigDashboardPage() {
  const { user } = useAuth()
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/configs', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      const body = (await res.json()) as ConfigListResponse
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Gagal memuat konfigurasi.')
        return
      }
      const list = body.data?.configs || []
      setConfigs(list)
      const init: Record<string, string> = {}
      list.forEach((row) => { init[row.configKey] = row.configValue })
      setEditing(init)
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(key: string) {
    setSavingKey(key)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/configs/${encodeURIComponent(key)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ configValue: editing[key] ?? '' })
      })
      const body = (await res.json()) as ConfigUpdateResponse
      if (!res.ok || !body.success) {
        setMessage(body.error?.message ?? 'Gagal menyimpan.')
        return
      }
      setMessage(`Konfigurasi ${key} tersimpan.`)
      await load()
    } catch {
      setMessage('Tidak bisa terhubung ke server.')
    } finally {
      setSavingKey(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>, key: string) {
    event.preventDefault()
    void handleSave(key)
  }

  if (!user) {
    return (
      <section className="settings-panel" aria-labelledby="admin-config-title">
        <h2 id="admin-config-title">Konfigurasi Sistem</h2>
        <p>Silakan login terlebih dahulu.</p>
      </section>
    )
  }

  return (
    <section className="settings-panel" aria-labelledby="admin-config-title">
      <div className="auth-copy">
        <p className="eyebrow">Admin</p>
        <h2 id="admin-config-title">Konfigurasi Sistem</h2>
        <p>Ubah nilai konfigurasi global (misal timeout AI Vision) tanpa deploy ulang.</p>
      </div>

      {loading ? <p>Memuat konfigurasi...</p> : null}
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {message ? <p className="form-message success" role="status">{message}</p> : null}

      {!loading && !error && configs.length === 0 ? (
        <p>Tidak ada konfigurasi yang tersedia.</p>
      ) : null}

      {!loading && !error ? (
        <table className="admin-config-table" aria-label="Daftar konfigurasi">
          <thead>
            <tr>
              <th>Key</th>
              <th>Deskripsi</th>
              <th>Value</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((row) => (
              <tr key={row.configKey}>
                <td><code>{row.configKey}</code></td>
                <td>{row.description || '—'}</td>
                <td>
                  <form
                    className="admin-config-form"
                    onSubmit={(event) => handleSubmit(event, row.configKey)}
                  >
                    <input
                      aria-label={`Value untuk ${row.configKey}`}
                      onChange={(event) =>
                        setEditing((prev) => ({ ...prev, [row.configKey]: event.target.value }))
                      }
                      type="text"
                      value={editing[row.configKey] ?? ''}
                    />
                    <button
                      disabled={savingKey === row.configKey}
                      type="submit"
                    >
                      {savingKey === row.configKey ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </form>
                </td>
                <td className="meta">{row.dataType || 'string'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
