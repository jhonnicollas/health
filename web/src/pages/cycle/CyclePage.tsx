/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

const GUARDRAIL_MSG = 'Peringatan: Metode kalender tidak memberikan perlindungan 100% terhadap kehamilan. Sperma dapat bertahan hidup hingga 5 hari. Prediksi masa aman bisa meleset karena stres, sakit, obat, perubahan tidur, menyusui, atau siklus yang tidak teratur. Selalu gunakan kontrasepsi tambahan bila ingin mencegah kehamilan.'

type DayInfo = { date: string; phase: string; label: string; colorToken: string; isPredicted: boolean; hasLog: boolean; needsContraceptionGuardrail: boolean }

export function CyclePage() {
  const [tab, setTab] = useState<'calendar'|'settings'|'log'>('calendar')
  const [_settings, setSettings] = useState<any>(null)
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [phaseLegend, setPhaseLegend] = useState<Record<string, string>>({})
  const [predictionPaused, setPredictionPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [guardrail, setGuardrail] = useState<{ type: string; message: string; relatedDate: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [logForm, setLogForm] = useState({ flowIntensity: '', mood: '', physicalSymptoms: '' as string, unprotected: false, notes: '' })
  const [eligible, setEligible] = useState(true)
  const [eduOpen, setEduOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ cycleLengthDays: 28, periodLengthDays: 5, lastPeriodStart: '', isPregnant: false, isLactating: false, isMenopause: false })

  useEffect(() => {
    fetch('/api/cycle/access', { credentials: 'include' }).then(r => r.json()).then(r => {
      if (!r.success || !r.data?.eligible) { setEligible(false); setLoading(false); return }
      setEligible(true)
      fetch(`/api/cycle/calendar?month=${month}`, { credentials: 'include' }).then(r => r.json()).then(r => {
        setLoading(false)
        if (r.success) {
          setPredictionPaused(r.data.predictionPaused || false)
          setPauseReason(r.data.pauseReason || null)
          setCalendarDays(r.data.days || [])
          setPhaseLegend(r.data.phaseLegend || {})
          if (r.data.predictionPaused && !r.data.days?.length) setSettings(null)
        }
      })
      fetch('/api/cycle/settings', { credentials: 'include' }).then(r => r.json()).then(r => {
        if (r.success && r.data?.settings) {
          setSettings(r.data.settings)
          setSettingsForm({
            cycleLengthDays: r.data.settings.cycleLengthDays || 28,
            periodLengthDays: r.data.settings.periodLengthDays || 5,
            lastPeriodStart: r.data.settings.lastPeriodStart || '',
            isPregnant: !!r.data.settings.isPregnant,
            isLactating: !!r.data.settings.isLactating,
            isMenopause: !!r.data.settings.isMenopause
          })
        }
      })
    })
  }, [month])

  if (loading) return <section className="settings-panel"><h2>Siklus</h2><p>Memuat...</p></section>
  if (!eligible) return <section className="settings-panel"><h2>Siklus</h2><p>Fitur cycle tracking hanya tersedia untuk pengguna perempuan usia 15–48 tahun.</p></section>

  const handleSaveSettings = async () => {
    const res = await fetch('/api/cycle/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsForm) })
    const r = await res.json()
    if (r.success) { setSettings(r.data); setMonth(month) }
  }

  const handleDayClick = (day: DayInfo) => {
    if (day.needsContraceptionGuardrail) {
      setGuardrail({ type: 'calendarMethod', message: GUARDRAIL_MSG, relatedDate: day.date })
      return
    }
    setSelectedDay(day.date)
    setLogForm({ flowIntensity: '', mood: '', physicalSymptoms: '', unprotected: false, notes: '' })
  }

  const handleGuardrailAck = async () => {
    if (!guardrail) return
    await fetch('/api/cycle/guardrails/acknowledge', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relatedDate: guardrail.relatedDate, guardrailType: guardrail.type }) })
    setGuardrail(null)
    setSelectedDay(guardrail.relatedDate)
  }

  const handleLogSubmit = async () => {
    if (!selectedDay) return
    const body: any = { logDate: selectedDay, ...logForm, physicalSymptoms: logForm.physicalSymptoms ? logForm.physicalSymptoms.split(',').map(s => s.trim()) : [] }
    if (logForm.unprotected) {
      setGuardrail({ type: 'unprotected', message: GUARDRAIL_MSG, relatedDate: selectedDay })
      body.contraceptionGuardrailAcknowledged = false
      const res = await fetch('/api/cycle/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const r = await res.json()
      if (r.success && !r.data.saved && r.data.requiresContraceptionGuardrail) {
        setGuardrail({ type: r.data.guardrailType, message: r.data.guardrailMessage, relatedDate: selectedDay })
      }
      return
    }
    await fetch('/api/cycle/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, contraceptionGuardrailAcknowledged: true }) })
    setSelectedDay(null)
  }

  const PHASE_COLORS: Record<string, string> = { period: '#e53e3e', fertile: '#dd6b20', ovulation: '#d53f8c', outsideFertile: '#48bb78', default: '#a0aec0' }

  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>Siklus</h2><span className="status-chip">{predictionPaused ? 'Dijeda' : 'Aktif'}</span></div>
      <nav className="admin-tabs">
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>Kalender</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Pengaturan</button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Log Harian</button>
      </nav>

      {predictionPaused && <div className="settings-card warning"><p>Prediksi dijeda{pauseReason ? `: ${pauseReason}` : ''}.</p></div>}

      {tab === 'calendar' && (
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() - 1); setMonth(d.toISOString().slice(0, 7)) }}>&larr;</button>
            <h3>{month}</h3>
            <button onClick={() => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() + 1); setMonth(d.toISOString().slice(0, 7)) }}>&rarr;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginTop: 8, textAlign: 'center' }}>
            {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => <div key={d} style={{ fontSize: 12, fontWeight: 600 }}>{d}</div>)}
            {(() => { const first = new Date(month + '-01').getDay(); return Array.from({ length: first }, (_, i) => <div key={`e${i}`} />) })()}
            {calendarDays.map(day => (
              <button key={day.date} onClick={() => handleDayClick(day)} style={{
                padding: 4, borderRadius: 6, border: selectedDay === day.date ? '2px solid #3182ce' : '1px solid transparent',
                background: PHASE_COLORS[day.phase] || PHASE_COLORS.default, color: '#fff', fontSize: 13, cursor: 'pointer',
                opacity: day.isPredicted ? 0.7 : 1
              }} title={day.label}>
                {day.date.slice(8)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(phaseLegend).map(([k, v]) => <span key={k} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: PHASE_COLORS[k] || '#999', display: 'inline-block' }} />{v}</span>)}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="settings-card">
          <h3>Pengaturan Siklus</h3>
          <label>Panjang Siklus (hari): <input type="number" min={1} max={120} value={settingsForm.cycleLengthDays} onChange={e => setSettingsForm({...settingsForm, cycleLengthDays: Number(e.target.value)})} /></label>
          <label>Panjang Periode (hari): <input type="number" min={1} max={15} value={settingsForm.periodLengthDays} onChange={e => setSettingsForm({...settingsForm, periodLengthDays: Number(e.target.value)})} /></label>
          <label>Haid Terakhir: <input type="date" value={settingsForm.lastPeriodStart} onChange={e => setSettingsForm({...settingsForm, lastPeriodStart: e.target.value})} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isPregnant} onChange={e => setSettingsForm({...settingsForm, isPregnant: e.target.checked})} /> Hamil</label>
          <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isLactating} onChange={e => setSettingsForm({...settingsForm, isLactating: e.target.checked})} /> Menyusui</label>
          <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isMenopause} onChange={e => setSettingsForm({...settingsForm, isMenopause: e.target.checked})} /> Menopause</label>
          <button onClick={handleSaveSettings}>Simpan</button>
        </div>
      )}

      {tab === 'log' && (
        <div className="settings-card">
          <h3>Log Harian</h3>
          {!selectedDay && <p>Pilih tanggal di kalender untuk mengisi log.</p>}
          {selectedDay && (
            <>
              <p><strong>{selectedDay}</strong></p>
              <label>Flow: <select value={logForm.flowIntensity} onChange={e => setLogForm({...logForm, flowIntensity: e.target.value})}>
                <option value="">-</option><option value="spotting">Spotting</option><option value="medium">Medium</option><option value="heavy">Heavy</option>
              </select></label>
              <label>Mood: <select value={logForm.mood} onChange={e => setLogForm({...logForm, mood: e.target.value})}>
                <option value="">-</option><option value="normal">Normal</option><option value="sad">Sedih</option><option value="anxious">Cemas</option><option value="happy">Senang</option><option value="tired">Lelah</option>
              </select></label>
              <label>Gejala (pisah koma): <input value={logForm.physicalSymptoms} onChange={e => setLogForm({...logForm, physicalSymptoms: e.target.value})} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={logForm.unprotected} onChange={e => setLogForm({...logForm, unprotected: e.target.checked})} /> Hubungan tanpa proteksi</label>
              <label>Catatan: <input value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} /></label>
              <button onClick={handleLogSubmit}>Simpan Log</button>
            </>
          )}
        </div>
      )}

      {guardrail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="settings-card" style={{ maxWidth: 420, background: '#fff', padding: 24, borderRadius: 12 }}>
            <h3 style={{ color: '#e53e3e' }}>Peringatan Kontrasepsi</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{guardrail.message}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleGuardrailAck} style={{ background: '#e53e3e', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none' }}>Saya Mengerti</button>
              <button onClick={() => setGuardrail(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc' }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      <EducationBottomSheet topicType="cycle" visible={eduOpen} onClose={() => setEduOpen(false)} />
      <button onClick={() => setEduOpen(true)} style={{ marginTop: 8 }}>Pelajari tentang Cycle Tracking</button>
    </section>
  )
}
