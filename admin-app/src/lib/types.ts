export type RecipeStatus = 'draft' | 'scheduled' | 'published' | 'pending' | 'rejected'

export interface RecipeAuthorProfile {
  id: string
  display_name: string
  slug: string
  avatar: string | null
  bio: string | null
  country: string | null
  is_virtual: boolean
  is_editorial: boolean
  created_at: string
}

export interface Tag {
  id: number
  slug: string
  name_ua: string
  name_en: string | null
  name_pl: string | null
}

export interface Product {
  id: number
  name_ua: string
  name_en: string | null
  name_pl: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
}

export interface RecipeIngredientRaw {
  id?: number
  recipe_id: string
  product_id: number
  quantity: number
  unit: string
  normalized_unit: string | null
  input_text: string
  parsed_success: boolean
  product?: Product
}

export interface Recipe {
  id: string
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  short_desc: string | null
  short_desc_en: string | null
  short_desc_pl: string | null
  steps: string | null
  steps_en: string | null
  steps_pl: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  total_weight: number | null
  yield_ratio: number | null
  recipe_yield: number | null
  type: string | null
  category: string | null
  cooking_method: string | null
  difficulty: string | null
  prep_time_min: number | null
  cook_time_min: number | null
  status: RecipeStatus
  is_public: boolean
  image: string | null
  available_locales: string[]
  publish_at: string | null
  author_profile_id: string | null
  slug: string | null
  created_at: string
  author_profile?: RecipeAuthorProfile
  tags?: Tag[]
}

export interface IngredientRow {
  product_id: number
  product_name: string
  quantity: number
  unit: string
}

export const UNITS = [
  'г', 'кг', 'мл', 'л', 'шт', 'ст.л', 'ч.л', 'склянка', 'щіпка',
  'g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup', 'pinch',
]

export const RECIPE_TYPES = [
  { value: 'breakfast', label: 'Сніданок' },
  { value: 'lunch', label: 'Обід' },
  { value: 'dinner', label: 'Вечеря' },
  { value: 'snack', label: 'Перекус' },
  { value: 'dessert', label: 'Десерт' },
  { value: 'soup', label: 'Суп' },
  { value: 'salad', label: 'Салат' },
  { value: 'drink', label: 'Напій' },
  { value: 'sauce', label: 'Соус' },
  { value: 'baking', label: 'Випічка' },
]

export const RECIPE_CATEGORIES = [
  { value: 'european', label: 'Європейська' },
  { value: 'ukrainian', label: 'Українська' },
  { value: 'asian', label: 'Азійська' },
  { value: 'mediterranean', label: 'Середземноморська' },
  { value: 'american', label: 'Американська' },
  { value: 'middle_eastern', label: 'Близькосхідна' },
  { value: 'fit', label: 'Фітнес / ПП' },
  { value: 'vegan', label: 'Веганське' },
]

export const COOKING_METHODS = [
  { value: 'baked', label: 'Запечено' },
  { value: 'fried', label: 'Смажено' },
  { value: 'steamed', label: 'На парі' },
  { value: 'boiled', label: 'Варено' },
  { value: 'grilled', label: 'Гриль' },
  { value: 'raw', label: 'Без термообробки' },
  { value: 'stewed', label: 'Тушковано' },
  { value: 'slow_cooked', label: 'Повільне приготування' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Легко' },
  { value: 'medium', label: 'Середньо' },
  { value: 'hard', label: 'Складно' },
]

export const LOCALES = [
  { value: 'ua', label: 'Українська' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
]
