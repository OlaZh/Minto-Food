import { getLang } from './storage.js';

export function getRecipeDisplayName(recipe, lang = getLang()) {
  if (!recipe) return '';

  if (lang === 'pl' && recipe.name_pl) return recipe.name_pl;
  if (lang === 'en' && recipe.name_en) return recipe.name_en;

  return recipe.name_ua || recipe.name_en || recipe.name_pl || recipe.name || '';
}
