import type { IngredientRow } from './types'

interface TagRule {
  slug: string
  test: (ctx: TagContext) => boolean
}

interface TagContext {
  ingredientNames: string[]
  category: string
  type: string
  cookingMethod: string
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
  { slug: 'chicken',    test: c => hasIngredient(c.ingredientNames, ['chicken','курка','куряч','kurcak','kurczak','broiler']) },
  { slug: 'beef',       test: c => hasIngredient(c.ingredientNames, ['beef','яловичина','wołowina','фарш яловичий']) },
  { slug: 'pork',       test: c => hasIngredient(c.ingredientNames, ['pork','свинина','wieprzowina','бекон','шинка']) },
  { slug: 'turkey',     test: c => hasIngredient(c.ingredientNames, ['turkey','індичка','indyk']) },
  { slug: 'lamb',       test: c => hasIngredient(c.ingredientNames, ['lamb','баранина','jagnięcina']) },
  { slug: 'fish',       test: c => hasIngredient(c.ingredientNames, ['fish','риба','лосось','тунець','тріска','salmon','tuna','cod','ryba','łosoś']) },
  { slug: 'seafood',    test: c => hasIngredient(c.ingredientNames, ['shrimp','креветк','кальмар','мідія','squid','mussel','морепродукт','owoce morza']) },
  { slug: 'egg',        test: c => hasIngredient(c.ingredientNames, ['egg','яйц','яйк','jajk','jajco']) },
  { slug: 'dairy',      test: c => hasIngredient(c.ingredientNames, ['milk','молоко','сир','йогурт','сметана','вершки','cheese','yogurt','cream','mleko','ser']) },
  { slug: 'legumes',    test: c => hasIngredient(c.ingredientNames, ['chickpea','нут','lentil','сочевиця','bean','квасоля','pea','горох','soy','соя','бобов','soczewica','fasola','ciecierzyca']) },
  { slug: 'mushroom',   test: c => hasIngredient(c.ingredientNames, ['mushroom','гриб','печериця','шампіньон','pieczarka','grzyb']) },
  { slug: 'pasta',      test: c => hasIngredient(c.ingredientNames, ['pasta','макарон','penne','spaghetti','fusilli','fettuccine','макарони','noodle','локшина']) },

  // Diet flags
  {
    slug: 'vegetarian',
    test: c => !hasIngredient(c.ingredientNames, MEAT_KEYWORDS) &&
               !hasIngredient(c.ingredientNames, ['fish','риба','salmon','тунець','seafood','морепродукт']),
  },
  {
    slug: 'vegan',
    test: c => !hasIngredient(c.ingredientNames, MEAT_KEYWORDS) &&
               !hasIngredient(c.ingredientNames, ['fish','риба','salmon']) &&
               !hasIngredient(c.ingredientNames, ['egg','яйц','milk','молоко','cheese','сир','yogurt','йогурт','cream','вершки','butter','масло вершкове','honey','мед']),
  },

  // Cooking method
  { slug: 'baked',    test: c => c.cookingMethod === 'baked' },
  { slug: 'fried',    test: c => c.cookingMethod === 'fried' },
  { slug: 'steamed',  test: c => c.cookingMethod === 'steamed' },
  { slug: 'raw',      test: c => c.cookingMethod === 'raw' },

  // Meal type
  { slug: 'breakfast', test: c => ['breakfast'].includes(c.type) || hasIngredient(c.ingredientNames, ['pancake','млинц','oatmeal','вівсянка','вівсян','granola','гранол','waffle','вафл']) },
  { slug: 'soup',      test: c => c.type === 'soup' },
  { slug: 'salad',     test: c => c.type === 'salad' },
  { slug: 'dessert',   test: c => c.type === 'dessert' || hasIngredient(c.ingredientNames, ['chocolate','шоколад','cacao','какао','sugar','цукор','vanilla','ваніль']) },

  // Nutrition flags (decided by ingredient types — simple heuristics)
  { slug: 'high-protein', test: c => hasIngredient(c.ingredientNames, ['chicken','курка','beef','яловичина','turkey','індичка','tuna','тунець','protein','протеїн','whey','яйц','egg','сир кисломолочний','cottage']) },
  { slug: 'low-carb',     test: c => !hasIngredient(c.ingredientNames, ['rice','рис','bread','хліб','pasta','макарон','potato','картопл','flour','борошн','oats','вівс','corn','кукурудз']) },
  { slug: 'gluten-free',  test: c => !hasIngredient(c.ingredientNames, ['flour','борошн','wheat','пшениц','bread','хліб','pasta','макарон','barley','ячмінь','rye','жито','oat','вівс']) },

  // Quick meals
  { slug: 'quick', test: c => hasIngredient(c.ingredientNames, ['egg','яйц','tuna','тунець','cottage','сир кисломолочний']) && !hasIngredient(c.ingredientNames, ['beef','яловичина','pork','свинина','chicken leg','куряча нога']) },
]

export function generateRecipeTags(
  ingredients: IngredientRow[],
  category: string,
  type: string,
  cookingMethod: string
): string[] {
  const ingredientNames = ingredients.map(i => i.product_name)
  const ctx: TagContext = { ingredientNames, category, type, cookingMethod }
  return RULES.filter(r => r.test(ctx)).map(r => r.slug)
}
