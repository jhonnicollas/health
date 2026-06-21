import { useState } from 'react'

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function PatternsPage() {
  const [wbResult, setWbResult] = useState<string | null>(null)
  const [medResult, setMedResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'weight-bp' | 'medication' | null>(null)

  async function generate(kind: 'weight-bp' | 'medication') {
    setLoading(kind); setError(null)
    try {
      const res = await fetch(`/api/patterns/generate/${kind}`, { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as ApiResp<{ insight?: string; hasEnoughData?: boolean; adherence?: number }>
      if (!body.success) { setError(body.error?.message || 'Gagal.'); return }
      const msg = body.data?.hasEnoughData === false
        ? 'Data belum cukup (minimal 14 hari).'
        : body.data?.insight || 'Selesai.'
      if (kind === 'weight-bp') setWbResult(msg)
      else setMedResult(msg + (body.data?.adherence !== undefined ? ` (Kepatuhan: ${body.data.adherence}%)` : ''))
    } catch { setError('Tidak bisa terhubung ke server.') }
    finally { setLoading(null) }
  }

  return (
    <section className="settings-panel" aria-labelledby="patterns-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Insights</p>
          <h2 id="patterns-title">Pola Kesehatan</h2>
          <p>Insight otomatis dari data Anda (bukan diagnosis, hanya ringkasan).</p>
        </div>
        <span className="status-chip">14 hari minimum</span>
      </div>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div className="settings-card">
        <h3>Pola Berat Badan vs Tekanan Darah (14 hari)</h3>
        <button disabled={loading !== null} onClick={() => generate('weight-bp')} type="button">{loading === 'weight-bp' ? 'Membuat...' : 'Buat Insight'}</button>
        {wbResult ? <p>{wbResult}</p> : null}
      </div>
      <div className="settings-card">
        <h3>Pola Kepatuhan Obat (14 hari)</h3>
        <button disabled={loading !== null} onClick={() => generate('medication')} type="button">{loading === 'medication' ? 'Membuat...' : 'Buat Insight'}</button>
        {medResult ? <p>{medResult}</p> : null}
      </div>
    </section>
  )
}
