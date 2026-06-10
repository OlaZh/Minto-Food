import type { IngredientRow, Product } from './types'

interface ProductWithNutrition extends IngredientRow {
  product: Product
}

interface NutritionResult {
  kcal: number
  protein: number
  fat: number
  carbs: number
  total_weight: number
  yield_ratio: number
}

function normalizeToGrams(quantity: number, unit: string): number {
  const u = unit.toLowerCase().trim()
  const conversions: Record<string, number> = {
    'г': 1, 'g': 1,
    'кг': 1000, 'kg': 1000,
    'мл': 1, 'ml': 1,
    'л': 1000, 'l': 1000,
    'ст.л': 15, 'tbsp': 15,
    'ч.л': 5, 'tsp': 5,
    'склянка': 240, 'cup': 240,
    'шт': 60, 'pcs': 60,
    'щіпка': 1, 'pinch': 1,
  }
  return quantity * (conversions[u] ?? 1)
}

export function calculateNutrition(
  ingredients: ProductWithNutrition[],
  recipeYield: number
): NutritionResult {
  let totalWeight = 0
  let totalKcal = 0
  let totalProtein = 0
  let totalFat = 0
  let totalCarbs = 0

  for (const ing of ingredients) {
    if (!ing.product) continue
    const grams = normalizeToGrams(ing.quantity, ing.unit)
    totalWeight += grams

    const factor = grams / 100
    totalKcal += (ing.product.kcal ?? 0) * factor
    totalProtein += (ing.product.protein ?? 0) * factor
    totalFat += (ing.product.fat ?? 0) * factor
    totalCarbs += (ing.product.carbs ?? 0) * factor
  }

  const preparedWeight = totalWeight * recipeYield
  const per100Factor = preparedWeight > 0 ? 100 / preparedWeight : 0

  return {
    kcal: Math.round(totalKcal * per100Factor * 10) / 10,
    protein: Math.round(totalProtein * per100Factor * 10) / 10,
    fat: Math.round(totalFat * per100Factor * 10) / 10,
    carbs: Math.round(totalCarbs * per100Factor * 10) / 10,
    total_weight: Math.round(totalWeight),
    yield_ratio: recipeYield,
  }
}
