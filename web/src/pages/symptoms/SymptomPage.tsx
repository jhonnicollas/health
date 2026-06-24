/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useAuth } from '../../context/auth'

const PAIN_LABELS = ['1','2','3','4','5','6','7','8','9','10']
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

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  const handleSubmit = async (e: any) => {
    e.preventDefault(); setSaving(true); setResult(null)
    try {
      const r = await fetch('/api/symptoms', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyArea: bodyArea || null, painScale: painScale || null, mood: mood || null, description, symptomDateTime: new Date().toISOString() }) })
      const j = await r.json(); setResult(j)
      if (j.success && j.data?.redFlags?.length) alert(`⚠️ ${j.data.redFlags[0].title}: ${j.data.redFlags[0].message}`)
    } catch {} finally { setSaving(false) }
  }
  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>Catat Keluhan</h2></div>
      <form onSubmit={handleSubmit}>
        <div className="admin-field"><label>Area Tubuh</label><select value={bodyArea} onChange={e => setBodyArea(e.target.value)}><option value="">Pilih area</option>{BODY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
        <div className="admin-field"><label>Nyeri (1-10)</label><div className="vas-row">{PAIN_LABELS.map(n => <button key={n} type="button" className={painScale === Number(n) ? 'btn-primary' : 'btn-secondary'} onClick={() => setPainScale(Number(n))}>{n}</button>)}</div></div>
        <div className="admin-field"><label>Suasana Hati</label><select value={mood} onChange={e => setMood(e.target.value)}><option value="">Pilih</option>{Object.entries(MOODS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="admin-field"><label>Deskripsi</label><textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan keluhan secara detail..." /></div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan Keluhan'}</button>
      </form>
      {result?.data?.redFlags?.length > 0 && <p className="form-message error">Red flag: {result.data.redFlags.map((f: any) => f.title).join(', ')}</p>}
    </section>
  )
}
