import type { RecipeAuthorProfile } from './types'

export type RecipeAuthorOption = Pick<RecipeAuthorProfile, 'id' | 'display_name' | 'slug'>

export const MINTO_FOOD_TEAM_AUTHOR = {
  slug: 'minto-food-team',
  display_name: 'Команда Minto Food',
} as const
