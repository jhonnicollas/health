/* eslint-disable react-hooks/set-state-in-effect */
import { useState } from 'react'
import { useI18n } from '../i18n'

const STEPS = [
  { icon: 'dashboard', color: '#10b981' },
  { icon: 'monitor_heart', color: '#0061ff' },
  { icon: 'sick', color: '#f59e0b' },
  { icon: 'water_drop', color: '#0369a1' },
  { icon: 'assessment', color: '#7c3aed' },
  { icon: 'smart_toy', color: '#10b981' },
  { icon: 'school', color: '#0061ff' },
  { icon: 'settings', color: '#6b7280' },
]

export function WelcomeWizard({ onClose, onNavigate }: { onClose: () => void; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const stepTitles = [
    t('nav.wizardDashboardTitle'), t('nav.wizardMeasurementTitle'), t('nav.wizardSymptomTitle'),
    t('nav.wizardHydrationTitle'), t('nav.wizardReportsTitle'), t('nav.wizardAiTitle'),
    t('nav.wizardEduTitle'), t('nav.wizardSettingsTitle'),
  ]
  const stepDescs = [
    t('nav.wizardDashboardDesc'), t('nav.wizardMeasurementDesc'), t('nav.wizardSymptomDesc'),
    t('nav.wizardHydrationDesc'), t('nav.wizardReportsDesc'), t('nav.wizardAiDesc'),
    t('nav.wizardEduDesc'), t('nav.wizardSettingsDesc'),
  ]

  function handleNext() {
    if (isLast) {
      onClose()
      return
    }
    setStep(step + 1)
  }

  function handleSkip() {
    onClose()
  }

  function handleNavigate() {
    const paths = ['/dashboard', '/measurements/new', '/symptoms', '/hydration', '/reports/daily', '/ai-assistant', '/kb', '/settings/profile']
    onNavigate(paths[step])
    onClose()
  }

  return (
    <div className="wizard-overlay" onClick={handleSkip}>
      <div className="wizard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <div className="wizard-icon" style={{ background: `${current.color}15`, color: current.color }}>
            <span className="material-symbols-outlined fill-icon">{current.icon}</span>
          </div>        <button className="wizard-skip" onClick={handleSkip} type="button">{t('nav.wizardSkip')}</button>
      </div>

        <h2 className="wizard-title">{stepTitles[step]}</h2>
        <p className="wizard-desc">{stepDescs[step]}</p>

        <div className="wizard-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`wizard-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div className="wizard-actions">
          {step > 0 && (
            <button className="wizard-btn-secondary" onClick={() => setStep(step - 1)} type="button">{t('nav.wizardBack')}</button>
          )}
          <button className="wizard-btn-try" onClick={handleNavigate} type="button">{t('nav.wizardTryNow')}</button>
          <button className="wizard-btn-primary" onClick={handleNext} type="button">
            {isLast ? t('nav.wizardFinish') : t('nav.wizardNext')}
          </button>
        </div>

        <p className="wizard-progress">{t('nav.wizardStep')} {step + 1} {t('nav.wizardOf')} {STEPS.length}</p>
      </div>
    </div>
  )
}
