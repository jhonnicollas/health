/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'
import { translateErrorCode } from '../../api/translateError'
import { useToast } from '../../components/Toast'
import { EducationBottomSheet } from '../../components/EducationBottomSheet'

const SYMPTOM_PRESETS = [
  { id: 'headache', labelKey: 'symptom.headache', emoji: '🤕', bodyArea: 'head' },
  { id: 'chest_pain', labelKey: 'symptom.chestPain', emoji: '💔', bodyArea: 'chest' },
  { id: 'shortness_breath', labelKey: 'symptom.shortnessBreath', emoji: '😮‍💨', bodyArea: 'chest' },
  { id: 'nausea', labelKey: 'symptom.nausea', emoji: '🤢', bodyArea: 'abdomen' },
  { id: 'dizziness', labelKey: 'symptom.dizziness', emoji: '😵‍💫', bodyArea: 'head' },
  { id: 'neck_heavy', labelKey: 'symptom.neckHeavy', emoji: '🧣', bodyArea: 'head' },
  { id: 'blurred_vision', labelKey: 'symptom.blurredVision', emoji: '👁️', bodyArea: 'head' },
  { id: 'other', labelKey: 'symptom.other', emoji: '➕', bodyArea: 'other' },
]

const VAS_SEGMENTS = [
  { max: 3, labelKey: 'symptom.mild', color: '#2ecc71' },
  { max: 6, labelKey: 'symptom.moderate', color: '#f39c12' },
  { max: 9, labelKey: 'symptom.severe', color: '#e67e22' },
  { max: 10, labelKey: 'symptom.verySevere', color: '#e74c3c' },
]

function vasLabelKey(v: number) { return VAS_SEGMENTS.find(s => v <= s.max)?.labelKey || '' }
function vasColor(v: number) { return VAS_SEGMENTS.find(s => v <= s.max)?.color || '#2ecc71' }

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function SymptomPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const { show: showToast } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [painScale, setPainScale] = useState(1)
  const [time, setTime] = useState(nowTime())
  const [mood, setMood] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [emergencyModal, setEmergencyModal] = useState<any>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [eduVisible, setEduVisible] = useState(true)

  if (!user) return <section className="settings-panel"><h2>{t('symptom.pleaseLogin')}</h2></section>

  const toggleSymptom = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setResult(null)
    setSubmitError(null)

    const quickSymptoms = Array.from(selected).map(id => {
      const s = SYMPTOM_PRESETS.find(p => p.id === id)
      return s ? t(s.labelKey) : ''
    }).filter(Boolean)

    const descriptionParts: string[] = []
    if (duration) descriptionParts.push(`Durasi: ${duration}`)
    if (notes) descriptionParts.push(notes)
    const description = descriptionParts.filter(Boolean).join('. ') || undefined

    const bodyArea = SYMPTOM_PRESETS.find(s => selected.has(s.id))?.bodyArea || 'other'
    const dateTime = new Date().toISOString().slice(0, 11) + time + ':00'

    try {
      const r = await fetch('/api/symptoms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyArea, painScale, description, symptomDateTime: dateTime, quickSymptoms, mood: mood || undefined })
      })
      const j = await r.json()
      setResult(j)
      if (!r.ok || !j.success) setSubmitError(j.error?.code ? translateErrorCode(j.error.code, locale, j.error?.message) : t('symptom.saveFailed'))
      else if (j.data?.redFlags?.length) {
        setEmergencyModal(j.data.redFlags[0])
        showToast(t('symptom.redFlagToast'), 'warning')
      }
      else {
        showToast(t('symptom.savedToast'), 'success')
        setSelected(new Set())
        setPainScale(1)
        setTime(nowTime())
        setMood('')
        setDuration('')
        setNotes('')
        setTimeout(() => onNavigate?.('/history'), 1500)
      }
    } catch { setSubmitError(t('symptom.connError')); showToast(t('symptom.saveFailedToast'), 'error') } finally { setSaving(false) }
  }

  return (
    <section className="settings-panel symptom-page">
      {emergencyModal && (
        <div className="modal-backdrop" onClick={() => setEmergencyModal(null)}>
          <div className="emergency-modal" onClick={e => e.stopPropagation()}>
            <div className="emergency-icon"><span className="material-symbols-outlined fill-icon">emergency</span></div>
            <h2>{emergencyModal.title}</h2>
            <p>{emergencyModal.message}</p>
            <div className="emergency-actions">
              <a href="tel:119" className="emergency-call">{t('symptom.emergencyCall')}</a>
              <button className="secondary" onClick={() => setEmergencyModal(null)}>{t('symptom.emergencyContinue')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="symptom-header">
        <div>
          <p className="eyebrow">{t('symptom.eyebrow')}</p>
          <h2>{t('symptom.title')}</h2>
          <p className="subtitle">{t('symptom.subtitle')}</p>
        </div>
        <span className="pill linked-pill">{t('symptom.linkedOptional')}</span>
      </div>

      {/* Linked measurement placeholder — app can wire real data later */}
      <div className="linked-measurement-card">
        <div className="lm-icon"><span className="material-symbols-outlined fill-icon">monitor_heart</span></div>
        <div>
          <p className="lm-label">{t('symptom.linkLabel')}</p>
          <p className="lm-value">Tekanan Darah 135/88 mmHg</p>
          <div className="lm-tags"><span className="pill elevated">Elevated</span><span className="pill">14:00 WIB</span></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="symptom-form">
        <div className="symptom-card">
          <div className="symptom-card-header">
            <div>
              <h3>{t('symptom.selectSymptom')}</h3>
              <p>{t('symptom.selectSymptomDesc')}</p>
            </div>
            <span className="pill count-pill">{selected.size} {t('symptom.selected')}</span>
          </div>
          <div className="symptom-chips">
            {SYMPTOM_PRESETS.map(s => {
              const isSelected = selected.has(s.id)
              return (
                <button key={s.id} type="button" className={isSelected ? 'symptom-chip selected' : 'symptom-chip'} onClick={() => toggleSymptom(s.id)}>
                  <span>{s.emoji} {t(s.labelKey)}</span>
                  {isSelected && <span className="material-symbols-outlined fill-icon">check_circle</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="symptom-grid">
          <div className="symptom-card vas-card">
            <h3>{t('symptom.vasTitle')}</h3>
            <p className="hint">{t('symptom.vasHint')}</p>
            <input
              type="range"
              min={1}
              max={10}
              value={painScale}
              onChange={e => setPainScale(Number(e.target.value))}
              className="vas-slider"
              style={{ '--vas-color': vasColor(painScale) } as React.CSSProperties}
            />
            <div className="vas-labels">
              <span>{t('symptom.vasMin')}</span>
              <span className="current" style={{ color: vasColor(painScale) }}>{painScale} {t(vasLabelKey(painScale))}</span>
              <span>{t('symptom.vasMax')}</span>
            </div>
          </div>

          <div className="symptom-card detail-card">
            <h3>{t('symptom.detail')}</h3>
            <div className="detail-row">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
              <input type="text" value={duration} onChange={e => setDuration(e.target.value)} placeholder={t('symptom.durationPlaceholder')} />
            </div>
            <select value={mood} onChange={e => setMood(e.target.value)} className="mood-select">
              <option value="">{t('symptom.moodPlaceholder')}</option>
              <option value="normal">{t('symptom.moodNormal')}</option>
              <option value="sad">{t('symptom.moodSad')}</option>
              <option value="anxious">{t('symptom.moodAnxious')}</option>
              <option value="happy">{t('symptom.moodHappy')}</option>
              <option value="tired">{t('symptom.moodTired')}</option>
              <option value="angry">{t('symptom.moodAngry')}</option>
              <option value="other">{t('symptom.moodOther')}</option>
            </select>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('symptom.notesPlaceholder')} />
            <button type="submit" disabled={saving || selected.size === 0} className="symptom-save-btn">
              {saving ? t('symptom.saving') : t('symptom.save')}
            </button>
          </div>
        </div>

        {submitError && <p className="form-message error" role="alert">{submitError}</p>}
        {result?.data?.redFlags?.length > 0 && !emergencyModal && <p className="form-message error">{t('symptom.redFlagPrefix')} {result.data.redFlags.map((f: any) => f.title).join(', ')}</p>}
      </form>

      <EducationBottomSheet topicType="symptom" visible={eduVisible} onClose={() => setEduVisible(false)} />
    </section>
  )
}
