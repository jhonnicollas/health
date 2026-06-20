export type BmiInput = {
  bodyWeight: number
  heightCm: number
}

export type BmiResult = {
  bmi: number
  category: 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'obese3'
  categoryLabel: string
}

export function calculateBmi(input: BmiInput): BmiResult | null {
  if (!Number.isFinite(input.bodyWeight) || !Number.isFinite(input.heightCm)) {
    return null
  }
  if (input.bodyWeight <= 0 || input.heightCm <= 0) {
    return null
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
