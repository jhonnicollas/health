export const MEDICAL_GLOSSARY: Record<string, string> = {
  spo2: 'Saturasi oksigen dalam darah (%)',
  heartRate: 'Detak jantung per menit (bpm)',
  systolic: 'Tekanan darah saat jantung memompa (mmHg)',
  diastolic: 'Tekanan darah saat jantung istirahat (mmHg)',
  bloodPressurePulse: 'Nadi yang terbaca tensimeter (bpm)',
  glucoseFasting: 'Gula darah setelah puasa 8-12 jam (mg/dL)',
  glucosePostMeal: 'Gula darah 2 jam setelah makan (mg/dL)',
  cholesterolTotal: 'Jumlah kolesterol dalam darah (mg/dL)',
  uricAcid: 'Asam urat hasil metabolisme purin (mg/dL)',
  bodyWeight: 'Berat badan (kg)',
  bmi: 'Body Mass Index = berat / tinggi² (kg/m²)',
  waistCircumference: 'Lingkar perut (cm)',
  bodyTemperature: 'Suhu tubuh (°C)',
  sleepDuration: 'Durasi tidur (jam)'
}

export type MedicalTermProps = {
  term: string
  shortDef: string
}

export function MedicalTerm({ term, shortDef }: MedicalTermProps) {
  return (
    <span className="medical-term">
      {term}
      <button
        type="button"
        className="medical-term-info"
        aria-label={`Apa itu ${term}?`}
        title={shortDef}
      >
        <span className="material-symbols-outlined">help</span>
      </button>
    </span>
  )
}
