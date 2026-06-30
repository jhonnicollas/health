/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { MedicalTermPopup } from './MedicalTermPopup'

export const MEDICAL_GLOSSARY: Record<string, string> = {
  spo2: 'Mengukur kadar oksigen dalam darah. Penting untuk memantau fungsi paru dan jantung — nilai rendah bisa tandanya sesak napas atau gangguan pernapasan.',
  heartRate: 'Mengukur jumlah detak jantung per menit. Membantu mendeteksi aritmia, bradikardia, atau takikardia.',
  systolic: 'Tekanan darah saat jantung memompa. Nilai tinggi = risiko hipertensi, stroke, serangan jantung.',
  diastolic: 'Tekanan darah saat jantung beristirahat antar detik. Nilai tinggi = risiko hipertensi kronis.',
  bloodPressurePulse: 'Denyut nadi terbaca tensimeter saat ukur tekanan darah. Membantu cross-check denyut jantung.',
  glucoseFasting: 'Gula darah setelah puasa 8-12 jam. Untuk skrining diabetes dan prediabetes.',
  glucosePostMeal: 'Gula darah 2 jam setelah makan. Membantu evaluasi respons gula darah terhadap makanan.',
  cholesterolTotal: 'Total kolesterol darah. Nilai tinggi = risiko penyakit jantung koroner dan aterosklerosis.',
  uricAcid: 'Asam urat dari metabolisme purin. Nilai tinggi = risiko gout/gas dan batu ginjal.',
  bodyWeight: 'Berat badan. Untuk hitung BMI dan pantau tren berat — obesitas = risiko banyak penyakit kronis.',
  bmi: 'Body Mass Index (berat/tinggi²). Indikator risiko: kurus, normal, kelebihan berat, obesitas.',
  waistCircumference: 'Lingkar perut. Indikator lemak viseral — lepas dari BMI, perut besar = risiko metabolik tinggi.',
  bodyTemperature: 'Suhu inti tubuh. Demam >37.5°C = tanda infeksi/inflamasi, hipotermia <35°C = darurat.',
  sleepDuration: 'Durasi tidur per malam. Kurang <7 jam = risiko kardiovaskular, imun turun, mental health.'
}

const GLOSSARY_KEYS = new Set(Object.keys(MEDICAL_GLOSSARY))

export type MedicalTermProps = {
  term: string
  shortDef: string
  termCode?: string
}

export function MedicalTerm({ term, shortDef, termCode }: MedicalTermProps) {
  const code = termCode || [...GLOSSARY_KEYS].find(k => MEDICAL_GLOSSARY[k] === shortDef)
  if (code) return <MedicalTermPopup termCode={code} fallbackLabel={term || code} />
  return <MedicalTermSimple term={term} shortDef={shortDef} />
}

function MedicalTermSimple({ term, shortDef }: { term: string; shortDef: string }) {
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const { locale } = useI18n()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent | TouchEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('touchstart', handleClick) }
  }, [open])

  return (
    <span className="medical-term">
      {term}
      <button ref={btnRef} type="button" className="medical-term-info" aria-label={locale === 'en-US' ? `What is ${term}?` : `Apa itu ${term}?`} onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined">info</span>
      </button>
      {open && (
        <div ref={popupRef} className="medical-term-popup">
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--colorPrimary)', verticalAlign: 'middle', marginRight: 4 }}>info</span>
          {shortDef}
        </div>
      )}
    </span>
  )
}

export { MedicalTermPopup }
