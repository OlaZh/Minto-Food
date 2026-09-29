import type { IngredientRow } from './types'

interface TagRule {
  code: string
  test: (ctx: TagContext) => boolean
}

interface TagContext {
  ingredientNames: string[]
  category: string
  type: string
  cookingMethod: string
  hasIngredients: boolean
}

function hasIngredient(names: string[], keywords: string[]): boolean {
  return names.some(n =>
    keywords.some(k => n.toLowerCase().includes(k.toLowerCase()))
  )
}

const MEAT_KEYWORDS = [
  'chicken', 'курка', 'курятина', 'kurcak', 'kurczak',
  'beef', 'яловичина', 'wołowina',
  'pork', 'свинина', 'wieprzowina',
  'turkey', 'індичка', 'indyk',
  'lamb', 'баранина', 'jagnięcina',
  'veal', 'телятина',
  'duck', 'качка',
  'meat', 'мясо', 'мʼясо', 'фарш', 'mięso',
  'bacon', 'бекон',
  'sausage', 'ковбаса',
  'ham', 'шинка',
]

const RULES: TagRule[] = [
  // Protein sources
  { code: 'chicken',    test: c => hasIngredient(c.ingredientNames, ['chicken','курка','куряч','kurcak','kurczak','broiler']) },
  { code: 'beef',       test: c => hasIngredient(c.ingredientNames, ['beef','яловичина','wołowina','фарш яловичий']) },
  { code: 'pork',       test: c => hasIngredient(c.ingredientNames, ['pork','свинина','wieprzowina','бекон','шинка']) },
  { code: 'turkey',     test: c => hasIngredient(c.ingredientNames, ['turkey','індичка','indyk']) },
  { code: 'lamb',       test: c => hasIngredient(c.ingredientNames, ['lamb','баранина','jagnięcina']) },
  { code: 'fish',       test: c => hasIngredient(c.ingredientNames, ['fish','риба','лосось','тунець','тріска','salmon','tuna','cod','ryba','łosoś']) },
  { code: 'seafood',    test: c => hasIngredient(c.ingredientNames, ['shrimp','креветк','кальмар','мідія','squid','mussel','морепродукт','owoce morza']) },
  { code: 'egg',        test: c => hasIngredient(c.ingredientNames, ['egg','яйц','яйк','jajk','jajco']) },
  { code: 'dairy',      test: c => hasIngredient(c.ingredientNames, ['milk','молоко','сир','йогурт','сметана','вершки','cheese','yogurt','cream','mleko','ser']) },
  { code: 'legumes',    test: c => hasIngredient(c.ingredientNames, ['chickpea','нут','lentil','сочевиця','bean','квасоля','pea','горох','soy','соя','бобов','soczewica','fasola','ciecierzyca']) },
  { code: 'mushroom',   test: c => hasIngredient(c.ingredientNames, ['mushroom','гриб','печериця','шампіньон','pieczarka','grzyb']) },
  { code: 'pasta',      test: c => hasIngredient(c.ingredientNames, ['pasta','макарон','penne','spaghetti','fusilli','fettuccine','макарони','noodle','локшина']) },

  // Diet flags
  {
    code: 'vegetarian',
    test: c => c.hasIngredients &&
               !hasIngredient(c.ingredientNames, MEAT_KEYWORDS) &&
               !hasIngredient(c.ingredientNames, ['fish','риба','salmon','тунець','seafood','морепродукт']),
  },
  {
    code: 'vegan',
    test: c => c.hasIngredients &&
               !hasIngredient(c.ingredientNames, MEAT_KEYWORDS) &&
               !hasIngredient(c.ingredientNames, ['fish','риба','salmon']) &&
               !hasIngredient(c.ingredientNames, ['egg','яйц','milk','молоко','cheese','сир','yogurt','йогурт','cream','вершки','butter','масло вершкове','honey','мед']),
  },

  // Cooking method
  { code: 'baked',    test: c => c.cookingMethod === 'baking' },
  { code: 'fried',    test: c => c.cookingMethod === 'frying' },
  { code: 'steamed',  test: c => c.cookingMethod === 'steaming' },
  { code: 'raw',      test: c => c.cookingMethod === 'fresh' },

  // Meal type
  { code: 'breakfast', test: c => c.category === 'breakfast' || hasIngredient(c.ingredientNames, ['pancake','млинц','oatmeal','вівсянка','вівсян','granola','гранол','waffle','вафл']) },
  { code: 'soup',      test: c => c.type === 'soup' },
  { code: 'salad',     test: c => c.type === 'salad' },
  { code: 'dessert',   test: c => c.category === 'dessert' || hasIngredient(c.ingredientNames, ['chocolate','шоколад','cacao','какао','sugar','цукор','vanilla','ваніль']) },

  // Nutrition flags (decided by ingredient types — simple heuristics)
  { code: 'high_protein', test: c => hasIngredient(c.ingredientNames, ['chicken','курка','beef','яловичина','turkey','індичка','tuna','тунець','protein','протеїн','whey','яйц','egg','сир кисломолочний','cottage']) },
  { code: 'low_carb',     test: c => c.hasIngredients && !hasIngredient(c.ingredientNames, ['rice','рис','bread','хліб','pasta','макарон','potato','картопл','flour','борошн','oats','вівс','corn','кукурудз']) },
  { code: 'gluten_free',  test: c => c.hasIngredients && !hasIngredient(c.ingredientNames, ['flour','борошн','wheat','пшениц','bread','хліб','pasta','макарон','barley','ячмінь','rye','жито','oat','вівс']) },

  // Quick meals
  { code: 'quick', test: c => hasIngredient(c.ingredientNames, ['egg','яйц','tuna','тунець','cottage','сир кисломолочний']) && !hasIngredient(c.ingredientNames, ['beef','яловичина','pork','свинина','chicken leg','куряча нога']) },
]

export function generateRecipeTags(
  ingredients: IngredientRow[],
  category: string,
  type: string,
  cookingMethod: string
): string[] {
  const ingredientNames = ingredients.map(i => i.product_name).filter(name => name.trim().length > 0)
  const ctx: TagContext = {
    ingredientNames,
    category,
    type,
    cookingMethod,
    hasIngredients: ingredientNames.length > 0,
  }
  return RULES.filter(r => r.test(ctx)).map(r => r.code)
}
