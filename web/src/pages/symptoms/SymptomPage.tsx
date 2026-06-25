/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useState } from 'react'
import { useAuth } from '../../context/auth'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

const VAS_SEGMENTS: { max: number; label: string; color: string }[] = [
  { max: 3, label: 'Ringan', color: '#2ecc71' },
  { max: 6, label: 'Sedang', color: '#f39c12' },
  { max: 9, label: 'Berat', color: '#e67e22' },
  { max: 10, label: 'Sangat Berat', color: '#e74c3c' },
]
function vasLabel(v: number) { return VAS_SEGMENTS.find(s => v <= s.max)?.label || '' }
function vasColor(v: number) { return VAS_SEGMENTS.find(s => v <= s.max)?.color || '#2ecc71' }

const MOODS: Record<string,string> = { normal: 'Normal', sad: 'Sedih', angry: 'Marah', anxious: 'Cemas', happy: 'Senang', tired: 'Lelah' }
const BODY_AREAS = ['head','chest','abdomen','back','arms','legs','throat','other']

export function SymptomPage() {
  const { user } = useAuth()
  const [bodyArea, setBodyArea] = useState('')
  const [painScale, setPainScale] = useState(0)
  const [mood, setMood] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [emergencyModal, setEmergencyModal] = useState<any>(null)
  const [eduVisible, setEduVisible] = useState(true)

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>

  const handleSubmit = async (e: any) => {
    e.preventDefault(); setSaving(true); setResult(null)
    try {
      const r = await fetch('/api/symptoms', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyArea: bodyArea || null, painScale: painScale || null, mood: mood || null, description, symptomDateTime: new Date().toISOString() }) })
      const j = await r.json(); setResult(j)
      if (j.success && j.data?.redFlags?.length) setEmergencyModal(j.data.redFlags[0])
    } catch {} finally { setSaving(false) }
  }

  return (
    <section className="settings-panel">
      {emergencyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--colorSurfaceElevated, #fff)', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: 'var(--colorStatusCritical, #c0392b)', margin: '0 0 12px' }}>{emergencyModal.title}</h2>
            <p style={{ margin: '0 0 24px', lineHeight: 1.5 }}>{emergencyModal.message}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="tel:119" className="btn-primary" style={{ textDecoration: 'none', minWidth: 160 }}>📞 Hubungi Darurat</a>
              <button className="btn-secondary" onClick={() => setEmergencyModal(null)} style={{ minWidth: 160 }}>Saya mengerti, lanjutkan</button>
            </div>
          </div>
        </div>
      )}
      <div className="page-heading"><h2>Catat Keluhan</h2></div>
      <form onSubmit={handleSubmit}>
        <div className="admin-field"><label>Area Tubuh</label><select value={bodyArea} onChange={e => setBodyArea(e.target.value)}><option value="">Pilih area</option>{BODY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
        <div className="admin-field">
          <label>Nyeri (1-10) — <strong style={{ color: vasColor(painScale) }}>{vasLabel(painScale)}</strong></label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" className={painScale === n ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setPainScale(n)}
                style={{ width: 36, height: 36, fontSize: 14, padding: 0, borderColor: painScale === n ? vasColor(n) : undefined, background: painScale === n ? vasColor(n) : undefined, color: painScale === n ? '#fff' : undefined }}>
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'var(--colorTextMuted)' }}>
            {VAS_SEGMENTS.map(s => <span key={s.label} style={{ color: s.color }}>{s.label}</span>)}
          </div>
        </div>
        <div className="admin-field"><label>Suasana Hati</label><select value={mood} onChange={e => setMood(e.target.value)}><option value="">Pilih</option>{Object.entries(MOODS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="admin-field"><label>Deskripsi</label><textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan keluhan secara detail..." /></div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan Keluhan'}</button>
      </form>
      {result?.data?.redFlags?.length > 0 && !emergencyModal && <p className="form-message error">Red flag: {result.data.redFlags.map((f: any) => f.title).join(', ')}</p>}
      <EducationBottomSheet topicType="symptom" visible={eduVisible} onClose={() => setEduVisible(false)} />
    </section>
  )
}
