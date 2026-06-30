import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import termsData from '../data/medical-terms.json'

type TermData = {
  label: string
  shortDef: string
  fullDef: string
  whyMeasure: string
  howToMeasure: string
  normalRange: string
  unitExplanation: string
  deviceName: string
  deviceTypeCode: string
  risksIfAbnormal: string
  whenToSeeDoctor: string
  preventionTip: string
  sourceName: string
  sourceUrl: string
}

const terms = termsData as Record<string, Record<string, TermData>>

export function MedicalTermPopup({ termCode, fallbackLabel }: { termCode: string; fallbackLabel?: string }) {
  const [open, setOpen] = useState(false)
  const { locale } = useI18n()

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const data = terms[termCode]?.[locale] || terms[termCode]?.['id-ID'] || null
  const displayLabel = data?.label || fallbackLabel || termCode

  return (
    <>
      <span className="medical-term">
        {displayLabel}
        <button type="button" className="medical-term-info" aria-label={locale === 'en-US' ? `What is ${displayLabel}?` : `Apa itu ${displayLabel}?`} onClick={() => setOpen(true)}>
          <span className="material-symbols-outlined">info</span>
        </button>
      </span>
      {open && (
        <div className="mtp-overlay" onClick={() => setOpen(false)}>
          <div className="mtp-panel" onClick={e => e.stopPropagation()}>
            <div className="mtp-topbar">
              <div className="mtp-title">
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--colorPrimary)' }}>school</span>
                <h2>{data?.label || displayLabel}</h2>
              </div>
              <button type="button" className="mtp-close" onClick={() => setOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="mtp-body">
              {data ? (
                <>
                  <p className="mtp-fulldef">{data.fullDef}</p>

                  <div className="mtp-grid">
                    <div className="mtp-card mtp-card-range">
                      <div className="mtp-card-icon"><span className="material-symbols-outlined">straighten</span></div>
                      <div className="mtp-card-body">
                        <span className="mtp-card-label">{locale === 'en-US' ? 'Normal Range' : 'Rentang Normal'}</span>
                        <span className="mtp-card-value">{data.normalRange}</span>
                        {data.unitExplanation ? <span className="mtp-card-sub">{data.unitExplanation}</span> : null}
                      </div>
                    </div>
                    <div className="mtp-card mtp-card-device">
                      <div className="mtp-card-icon"><span className="material-symbols-outlined">smart_toy</span></div>
                      <div className="mtp-card-body">
                        <span className="mtp-card-label">{locale === 'en-US' ? 'Device' : 'Alat Ukur'}</span>
                        <span className="mtp-card-value">{data.deviceName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mtp-block">
                    <h3><span className="material-symbols-outlined">target</span> {locale === 'en-US' ? 'Why Measure' : 'Kenapa Diukur'}</h3>
                    <p>{data.whyMeasure}</p>
                  </div>

                  <div className="mtp-block">
                    <h3><span className="material-symbols-outlined">checklist</span> {locale === 'en-US' ? 'How to Measure' : 'Cara Mengukur'}</h3>
                    <p>{data.howToMeasure}</p>
                  </div>

                  <div className="mtp-block mtp-block-risk">
                    <h3><span className="material-symbols-outlined">warning</span> {locale === 'en-US' ? 'Risks If Abnormal' : 'Risiko Jika Abnormal'}</h3>
                    <p>{data.risksIfAbnormal}</p>
                  </div>

                  <div className="mtp-block mtp-block-doctor">
                    <h3><span className="material-symbols-outlined">medical_services</span> {locale === 'en-US' ? 'When to See a Doctor' : 'Kapan ke Dokter'}</h3>
                    <p>{data.whenToSeeDoctor}</p>
                  </div>

                  <div className="mtp-block mtp-block-tip">
                    <h3><span className="material-symbols-outlined">tips_and_updates</span> {locale === 'en-US' ? 'Health Tip' : 'Tips Kesehatan'}</h3>
                    <p>{data.preventionTip}</p>
                  </div>

                  <div className="mtp-source">
                    <span className="material-symbols-outlined">verified</span>
                    {data.sourceUrl
                      ? <>{locale === 'en-US' ? 'Source' : 'Sumber'}: <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">{data.sourceName}</a></>
                      : <>{locale === 'en-US' ? 'Source' : 'Sumber'}: {data.sourceName}</>}
                  </div>
                </>
              ) : (
                <p className="mtp-unavailable">{locale === 'en-US' ? 'Information not yet available.' : 'Informasi belum tersedia.'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
