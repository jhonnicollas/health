/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

export function HydrationSettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/hydration/settings', { credentials: 'include' })
        const j = await r.json()
        if (j.success) setSettings(j.data)
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  async function save(data: Record<string, unknown>) {
    setSaving(true); setMsg('')
    try {
      const r = await fetch('/api/hydration/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const j = await r.json()
      setMsg(j.success ? 'Pengaturan tersimpan.' : j.error?.message || 'Gagal.')
    } catch { setMsg('Tidak bisa terhubung.') }
    finally { setSaving(false) }
  }

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  if (loading) return <section className="settings-panel"><p>Memuat...</p></section>

  return (
    <section className="settings-panel">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>⚙️ Pengaturan Hidrasi</h2>
        <a href="/hydration" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>← Kembali</a>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <input type="checkbox" checked={!!settings?.isPregnant} onChange={e => { setSettings({ ...settings, isPregnant: e.target.checked ? 1 : 0 }); save({ isPregnant: e.target.checked ? 1 : 0 }) }} />
          <div><strong>Hamil</strong><br /><small style={{ color: 'var(--colorTextMuted)' }}>Target minimum 2400ml</small></div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <input type="checkbox" checked={!!settings?.isLactating} onChange={e => { setSettings({ ...settings, isLactating: e.target.checked ? 1 : 0 }); save({ isLactating: e.target.checked ? 1 : 0 }) }} />
          <div><strong>Menyusui</strong><br /><small style={{ color: 'var(--colorTextMuted)' }}>Target minimum 2800ml</small></div>
        </label>

        <div style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <strong>Jam Operasi Pengingat</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="time" value={settings?.operatingStart || '09:00'} onChange={e => setSettings({ ...settings, operatingStart: e.target.value })} style={{ flex: 1 }} />
            <span style={{ alignSelf: 'center' }}>—</span>
            <input type="time" value={settings?.operatingEnd || '18:00'} onChange={e => setSettings({ ...settings, operatingEnd: e.target.value })} style={{ flex: 1 }} />
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <strong>Pengingat Hidrasi</strong>
          <p style={{ fontSize: 13, color: 'var(--colorTextMuted)', margin: '4px 0 8px' }}>Kirim pengingat minum via Telegram.</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!settings?.reminderEnabled} onChange={e => save({ reminderEnabled: e.target.checked ? 1 : 0 })} />
            Pengingat aktif
          </label>
        </div>

        <div style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <strong>Telegram Quick Add</strong>
          <p style={{ fontSize: 13, color: 'var(--colorTextMuted)', margin: '4px 0 8px' }}>Izinkan tombol +200ml/+600ml dari notifikasi Telegram.</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!settings?.telegramQuickAddEnabled} onChange={e => save({ telegramQuickAddEnabled: e.target.checked ? 1 : 0 })} />
            Quick add via Telegram
          </label>
        </div>

        <div style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)' }}>
          <strong>Target Kustom (ml)</strong>
          <p style={{ fontSize: 13, color: 'var(--colorTextMuted)', margin: '4px 0 8px' }}>Biarkan 0 atau kosongkan untuk perhitungan otomatis.</p>
          <input type="number" placeholder="0 = otomatis" value={settings?.customBaseTargetMl || ''} onChange={e => setSettings({ ...settings, customBaseTargetMl: Number(e.target.value) || null })} min={0} max={10000} />
          <button className="btn-primary" disabled={saving} onClick={() => save({ customBaseTargetMl: settings?.customBaseTargetMl || null })} style={{ marginTop: 8 }}>
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>

        {msg && <p className={`form-message ${msg.includes('tersimpan') ? 'success' : 'error'}`}>{msg}</p>}
      </div>
    </section>
  )
}
