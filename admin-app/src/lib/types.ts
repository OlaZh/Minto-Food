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
  code: string
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

export interface Recipe {
  id: string
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  short_desc: string | null
  short_desc_en: string | null
  short_desc_pl: string | null
  ingredients: string | null
  ingredients_en: string | null
  ingredients_pl: string | null
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
  cuisine: string | null
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
  { value: 'porridge', label: 'Каша' },
  { value: 'soup', label: 'Суп' },
  { value: 'salad', label: 'Салат' },
  { value: 'side_dish', label: 'Гарнір' },
  { value: 'main_course', label: 'Основна страва' },
  { value: 'pasta', label: 'Паста' },
  { value: 'sauce', label: 'Соус' },
  { value: 'sandwich', label: 'Сендвіч' },
  { value: 'casserole', label: 'Запіканка' },
  { value: 'pancakes', label: 'Млинці' },
  { value: 'omelet', label: 'Омлет' },
  { value: 'smoothie', label: 'Смузі' },
]

export const RECIPE_CATEGORIES = [
  { value: 'breakfast', label: 'Сніданок' },
  { value: 'lunch', label: 'Обід' },
  { value: 'dinner', label: 'Вечеря' },
  { value: 'snack', label: 'Перекус' },
  { value: 'dessert', label: 'Десерт' },
  { value: 'drinks', label: 'Напої' },
  { value: 'bakery', label: 'Випічка' },
  { value: 'fast', label: 'Швидкий' },
  { value: 'no_power', label: 'Без світла' },
]

export const RECIPE_CUISINES = [
  { value: 'european', label: 'Європейська' },
  { value: 'ukrainian', label: 'Українська' },
  { value: 'asian', label: 'Азійська' },
  { value: 'mediterranean', label: 'Середземноморська' },
  { value: 'american', label: 'Американська' },
  { value: 'middle_eastern', label: 'Близькосхідна' },
]

export const COOKING_METHODS = [
  { value: 'boiling', label: 'Варіння' },
  { value: 'frying', label: 'Смаження' },
  { value: 'baking', label: 'Запікання' },
  { value: 'steaming', label: 'На парі' },
  { value: 'grilling', label: 'Гриль' },
  { value: 'stewing', label: 'Тушкування' },
  { value: 'soaking', label: 'Замочування' },
  { value: 'fresh', label: 'Без термообробки' },
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
