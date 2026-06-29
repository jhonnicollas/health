import { useState } from 'react'
import { useAuth } from '../../context/auth'
import type { FormEvent } from 'react'

export function MockCheckoutPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const queryId = new URLSearchParams(window.location.search).get('checkoutId') || ''

  async function handleSimulate(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/billing/webhook/mock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId: queryId, status: 'paid' })
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setStatus('error')
        setMessage(body.error?.message || 'Gagal simulasi pembayaran.')
        return
      }
      setStatus('done')
      window.location.href = `/billing/success?checkoutId=${encodeURIComponent(queryId)}`
    } catch {
      setStatus('error')
      setMessage('Tidak bisa terhubung ke server.')
    }
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  if (!queryId) return <section className="settings-panel"><h2>Checkout ID diperlukan</h2></section>

  return (
    <section className="settings-panel" style={{ textAlign: 'center', padding: 48 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--primary)' }}>science</span>
      <h2>Mock Checkout</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>Mode pengujian — tidak ada pembayaran sungguhan.</p>
      <form onSubmit={handleSimulate} style={{ maxWidth: 320, margin: '24px auto' }}>
        <button className="primary-btn" disabled={status === 'loading' || status === 'done'} type="submit" style={{ width: '100%' }}>
          {status === 'loading' ? 'Memproses...' : 'Simulasi Pembayaran Berhasil'}
        </button>
      </form>
      {message && <p className="form-message error">{message}</p>}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
        Checkout ID: {queryId}
      </p>
    </section>
  )
}
