import { getLang } from './storage.js';

export function getRecipeDisplayName(recipe, lang = getLang()) {
  if (!recipe) return '';

  if (lang === 'pl' && recipe.name_pl) return recipe.name_pl;
  if (lang === 'en' && recipe.name_en) return recipe.name_en;

  return recipe.name_ua || recipe.name_en || recipe.name_pl || recipe.name || '';
}

export function getRecipeDisplayIngredients(recipe, lang = getLang()) {
  if (!recipe) return '';

  if (lang === 'pl' && recipe.ingredients_pl?.trim()) return recipe.ingredients_pl;
  if (lang === 'en' && recipe.ingredients_en?.trim()) return recipe.ingredients_en;

  return recipe.ingredients || '';
}

export function getRecipeDisplaySteps(recipe, lang = getLang()) {
  if (!recipe) return '';

  if (lang === 'pl' && recipe.steps_pl?.trim()) return recipe.steps_pl;
  if (lang === 'en' && recipe.steps_en?.trim()) return recipe.steps_en;

  return recipe.steps || '';
}
