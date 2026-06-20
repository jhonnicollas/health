export type BmiInput = {
  bodyWeight: number
  heightCm: number | null | undefined
}

export type BmiResult = {
  bmi: number
  category: 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'obese3'
  categoryLabel: string
}

export class HeightMissingError extends Error {
  constructor() {
    super('Tinggi badan belum tersedia. Lengkapi profil terlebih dahulu.')
    this.name = 'HeightMissingError'
  }
}

export function calculateBmi(input: BmiInput): BmiResult {
  if (!Number.isFinite(input.bodyWeight) || input.bodyWeight <= 0) {
    throw new Error('Berat badan tidak valid.')
  }
  if (input.heightCm === null || input.heightCm === undefined || !Number.isFinite(input.heightCm) || input.heightCm <= 0) {
    throw new HeightMissingError()
  }
  const heightM = input.heightCm / 100
  const bmi = input.bodyWeight / (heightM * heightM)
  const rounded = Math.round(bmi * 10) / 10

  let category: BmiResult['category']
  let categoryLabel: string
  if (rounded < 18.5) {
    category = 'underweight'
    categoryLabel = 'Kurus'
  } else if (rounded < 25) {
    category = 'normal'
    categoryLabel = 'Normal'
  } else if (rounded < 30) {
    category = 'overweight'
    categoryLabel = 'Gemuk'
  } else if (rounded < 35) {
    category = 'obese1'
    categoryLabel = 'Obesitas I'
  } else if (rounded < 40) {
    category = 'obese2'
    categoryLabel = 'Obesitas II'
  } else {
    category = 'obese3'
    categoryLabel = 'Obesitas III'
  }

  return { bmi: rounded, category, categoryLabel }
}
