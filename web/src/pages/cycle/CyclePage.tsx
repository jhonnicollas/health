/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { translateErrorCode } from '../../api/translateError'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

// Guardrail message moved to locale file — medically approved text

const PHASE_COLORS: Record<string, string> = { period: '#e53e3e', fertile: '#dd6b20', ovulation: '#d53f8c', outsideFertile: '#48bb78', default: '#a0aec0' }
const PHASE_LABEL_KEYS: Record<string, string> = { period: 'cycle.phasePeriod', fertile: 'cycle.phaseFertile', ovulation: 'cycle.phaseOvulation', outsideFertile: 'cycle.phaseOutsideFertile', default: '' }

const MOOD_CHIPS = ['😊 Mood', 'Cramps ringan', 'Flow none', '😴 Lelah', '😢 Sedih', '😰 Cemas']

const WEEKDAY_KEYS = ['cycle.weekSen', 'cycle.weekSel', 'cycle.weekRab', 'cycle.weekKam', 'cycle.weekJum', 'cycle.weekSab', 'cycle.weekMin']

type DayInfo = {
  date: string
  phase: string
  label: string
  colorToken: string
  isPredicted: boolean
  hasLog: boolean
  needsContraceptionGuardrail: boolean
}

export function CyclePage() {
  const { t, locale } = useI18n()
  const guardrailMsg = t('cycle.guardrailMsg')
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [phaseLegend, setPhaseLegend] = useState<Record<string, string>>({})
  const [predictionPaused, setPredictionPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardrail, setGuardrail] = useState<{ type: string; message: string; relatedDate: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({ flowIntensity: '', mood: '', physicalSymptoms: '', notes: '' })
  const [eligible, setEligible] = useState(true)
  const [eduOpen, setEduOpen] = useState(false)
  const [fetchTick, setFetchTick] = useState(0)
  const [settingsForm, setSettingsForm] = useState({ cycleLengthDays: 28, periodLengthDays: 5, lastPeriodStart: '', isPregnant: false, isLactating: false, isMenopause: false })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetch('/api/cycle/access', { credentials: 'include' }).then(r => { if (!r.ok) { setLoading(false); return } return r.json() }).then(r => {
      if (!r) return
      if (!r.success || !r.data?.eligible) { setEligible(false); setLoading(false); return }
      setEligible(true)
      fetch(`/api/cycle/calendar?month=${month}`, { credentials: 'include' }).then(r => { if (!r.ok) { setLoading(false); return } return r.json() }).then(r => {
        if (!r) { setLoading(false); return }
        setLoading(false)
        if (r.success) {
          setPredictionPaused(r.data.predictionPaused || false)
          setPauseReason(r.data.pauseReason || null)
          setCalendarDays(r.data.days || [])
          setPhaseLegend(r.data.phaseLegend || {})
        }
      })
      fetch('/api/cycle/settings', { credentials: 'include' }).then(r => { if (!r.ok) return null; return r.json() }).then(r => {
        if (r && r.success && r.data?.settings) {
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
  }, [month, fetchTick])

  const todayInfo = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return calendarDays.find(d => d.date === today)
  }, [calendarDays])

  const handleSaveSettings = async () => {
    const res = await fetch('/api/cycle/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsForm) })
    if (!res.ok) return
    const r = await res.json()
    if (r.success) { setFetchTick(t => t + 1); setShowSettings(false) }
  }

  const handleDayClick = (day: DayInfo) => {
    if (day.needsContraceptionGuardrail) {
      setGuardrail({ type: 'calendarMethod', message: guardrailMsg, relatedDate: day.date })
      return
    }
    setSelectedDay(day.date)
    setLogForm({ flowIntensity: '', mood: '', physicalSymptoms: '', notes: '' })
  }

  const handleGuardrailAck = async () => {
    if (!guardrail) return
    try {
      const res = await fetch('/api/cycle/guardrails/acknowledge', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relatedDate: guardrail.relatedDate, guardrailType: guardrail.type }) })
      if (!res.ok) {      const r = await res.json(); alert(r.error?.message || t('cycle.ackFailed')); return }
    } catch { alert(t('cycle.connError')); return }
    setGuardrail(null)
    setSelectedDay(guardrail.relatedDate)
  }

  const handleLogSubmit = async () => {
    if (!selectedDay) return
    const body: any = { logDate: selectedDay, ...logForm, physicalSymptoms: logForm.physicalSymptoms ? logForm.physicalSymptoms.split(',').map((s: string) => s.trim()) : [] }
    const hasUnprotected = logForm.physicalSymptoms.toLowerCase().includes('tanpa proteksi')
    if (hasUnprotected) {
      setGuardrail({ type: 'unprotected', message: guardrailMsg, relatedDate: selectedDay })
      body.contraceptionGuardrailAcknowledged = false
      const res = await fetch('/api/cycle/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const r = await res.json()
      if (r.success && !r.data.saved && r.data.requiresContraceptionGuardrail) {
        setGuardrail({ type: r.data.guardrailType, message: r.data.guardrailMessage, relatedDate: selectedDay })
      }
      return
    }
    const res = await fetch('/api/cycle/logs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, contraceptionGuardrailAcknowledged: true }) })
    const r = await res.json()
    if (!res.ok || !r.success) { alert(r.error?.code ? translateErrorCode(r.error.code, locale, r.error?.message) : t('cycle.saveLogFailed')); return }
    setLogForm({ flowIntensity: '', mood: '', physicalSymptoms: '', notes: '' })
    setFetchTick(t => t + 1)
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }, [month])

  if (loading) return <section className="settings-panel"><h2>{t('cycle.title')}</h2><p>{t('cycle.loading')}</p></section>
  if (!eligible) return <section className="settings-panel"><h2>{t('cycle.title')}</h2><p>{t('cycle.notEligible')}</p></section>

  const firstDayOffset = new Date(month + '-01').getDay()

  return (
    <section className="settings-panel cycle-page">
      <div className="cycle-header">
        <div>
          <p className="eyebrow">{t('cycle.eyebrow')}</p>
          <h2>{t('cycle.title')}</h2>
          <p className="subtitle">{t('cycle.subtitle')}</p>
        </div>
        <span className="pill private-pill"><span className="material-symbols-outlined">lock</span>{t('cycle.private')}</span>
      </div>

      {predictionPaused && (
        <div className="cycle-pause-banner">
          <span className="material-symbols-outlined">info</span>
          <p>{t('cycle.predictionPaused')}{pauseReason ? `: ${pauseReason}` : ''}.</p>
        </div>
      )}

      <div className="cycle-grid">
        <div className="cycle-calendar-card">
          <div className="cycle-calendar-toolbar">
            <button onClick={() => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() - 1); setMonth(d.toISOString().slice(0, 7)) }}><span className="material-symbols-outlined">chevron_left</span></button>
            <div className="cycle-calendar-title">
              <p className="month-name">{monthLabel}</p>
              <p className="cycle-status">{t('cycle.cycleActive')} · {todayInfo ? t(PHASE_LABEL_KEYS[todayInfo.phase] || '') || todayInfo.label : '-'}</p>
            </div>
            <button onClick={() => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() + 1); setMonth(d.toISOString().slice(0, 7)) }}><span className="material-symbols-outlined">chevron_right</span></button>
          </div>

          <div className="cycle-weekdays">
            {WEEKDAY_KEYS.map(k => <div key={k}>{t(k)}</div>)}
          </div>

          <div className="cycle-days">
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} className="cycle-day empty" />)}
            {calendarDays.map(day => {
              const isToday = day.date === new Date().toISOString().slice(0, 10)
              const isSelected = selectedDay === day.date
              return (
                <button key={day.date} type="button" className={`cycle-day ${day.phase} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => handleDayClick(day)} title={day.label}>
                  <span className="day-number">{Number(day.date.slice(8))}</span>
                  <span className="day-dot" style={{ background: PHASE_COLORS[day.phase] || PHASE_COLORS.default }} />
                  <span className="day-label">{t(PHASE_LABEL_KEYS[day.phase] || '') || day.label}</span>
                </button>
              )
            })}
          </div>

          <div className="cycle-legend">
            {Object.entries(phaseLegend).map(([k, v]) => (
              <span key={k}><span className="legend-dot" style={{ background: PHASE_COLORS[k] || '#999' }} />{v}</span>
            ))}
          </div>
        </div>

        <div className="cycle-side-panel">
          <div className="cycle-status-card">
            <p className="status-label">{t('cycle.todayStatus')}</p>
            <p className="status-title">{todayInfo ? t(PHASE_LABEL_KEYS[todayInfo.phase] || '') || todayInfo.label : t('cycle.notAvailable')}</p>
            <p className="status-note">{t('cycle.statusNote')}</p>
            <button className="guardrail-btn" onClick={() => setGuardrail({ type: 'calendarMethod', message: guardrailMsg, relatedDate: selectedDay || new Date().toISOString().slice(0, 10) })}>
              {t('cycle.viewContraceptionWarning')}
            </button>
          </div>

          <div className="cycle-log-card">
            <h3>{t('cycle.dailyLog')}</h3>
            {selectedDay ? (
              <>
                <p className="selected-date">{selectedDay}</p>
                <label>{t('cycle.flow')}
                  <select value={logForm.flowIntensity} onChange={e => setLogForm({ ...logForm, flowIntensity: e.target.value })}>
                    <option value="">-</option>
                    <option value="spotting">Spotting</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </label>
                <label>{t('cycle.mood')}
                  <select value={logForm.mood} onChange={e => setLogForm({ ...logForm, mood: e.target.value })}>
                    <option value="">-</option>
                    <option value="normal">{t('cycle.moodNormal')}</option>
                    <option value="sad">{t('cycle.moodSad')}</option>
                    <option value="anxious">{t('cycle.moodAnxious')}</option>
                    <option value="happy">{t('cycle.moodHappy')}</option>
                    <option value="tired">{t('cycle.moodTired')}</option>
                  </select>
                </label>
                <div className="mood-chips">
                  {MOOD_CHIPS.map(m => <button key={m} type="button" className="chip" onClick={() => setLogForm(prev => ({ ...prev, physicalSymptoms: prev.physicalSymptoms ? `${prev.physicalSymptoms}, ${m}` : m }))}>{m}</button>)}
                </div>
                <textarea value={logForm.physicalSymptoms} onChange={e => setLogForm({ ...logForm, physicalSymptoms: e.target.value })} placeholder={t('cycle.physicalSymptomsPlaceholder')} rows={3} />
                <textarea value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} placeholder={t('cycle.notesPlaceholder')} rows={2} />
                <button className="save-log-btn" onClick={handleLogSubmit}>{t('cycle.saveLog')}</button>
              </>
            ) : (
              <p className="hint">{t('cycle.selectDateHint')}</p>
            )}
          </div>

          <div className="cycle-guardrail-card">
            <p className="guardrail-title">{t('cycle.guardrailBlocking')}</p>
            <p>{t('cycle.guardrailDesc')}</p>
            <button className="settings-link" onClick={() => setShowSettings(true)}>{t('cycle.cycleSettings')}</button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-panel cycle-settings" onClick={e => e.stopPropagation()}>
            <h3>{t('cycle.cycleSettings')}</h3>
            <label>{t('cycle.cycleLength')} <input type="number" min={1} max={120} value={settingsForm.cycleLengthDays} onChange={e => setSettingsForm({ ...settingsForm, cycleLengthDays: Number(e.target.value) })} /></label>
            <label>{t('cycle.periodLength')} <input type="number" min={1} max={15} value={settingsForm.periodLengthDays} onChange={e => setSettingsForm({ ...settingsForm, periodLengthDays: Number(e.target.value) })} /></label>
            <label>{t('cycle.lastPeriod')} <input type="date" value={settingsForm.lastPeriodStart} onChange={e => setSettingsForm({ ...settingsForm, lastPeriodStart: e.target.value })} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isPregnant} onChange={e => setSettingsForm({ ...settingsForm, isPregnant: e.target.checked })} /> {t('cycle.pregnant')}</label>
            <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isLactating} onChange={e => setSettingsForm({ ...settingsForm, isLactating: e.target.checked })} /> {t('cycle.lactating')}</label>
            <label className="checkbox-row"><input type="checkbox" checked={settingsForm.isMenopause} onChange={e => setSettingsForm({ ...settingsForm, isMenopause: e.target.checked })} /> {t('cycle.menopause')}</label>
            <div className="modal-actions">
              <button className="primary" onClick={handleSaveSettings}>{t('cycle.save')}</button>
              <button className="secondary" onClick={() => setShowSettings(false)}>{t('cycle.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {guardrail && (
        <div className="modal-backdrop" onClick={() => setGuardrail(null)}>
          <div className="modal-panel guardrail-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('cycle.guardrailTitle')}</h3>
            <p>{guardrail.message}</p>
            <div className="modal-actions">
              <button className="primary" onClick={handleGuardrailAck} style={{ background: '#e53e3e' }}>{t('cycle.iUnderstand')}</button>
              <button className="secondary" onClick={() => setGuardrail(null)}>{t('cycle.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <EducationBottomSheet topicType="cycle" visible={eduOpen} onClose={() => setEduOpen(false)} />
    </section>
  )
}
