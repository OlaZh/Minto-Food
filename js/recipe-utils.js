import { getLang } from './storage.js';

export function getRecipeDisplayName(recipe, lang = getLang()) {
  if (!recipe) return '';

  if (lang === 'pl' && recipe.name_pl) return recipe.name_pl;
  if (lang === 'en' && recipe.name_en) return recipe.name_en;

  return recipe.name_ua || recipe.name_en || recipe.name_pl || recipe.name || '';
}

export function getRecipeName(recipe, lang = getLang()) {
  const name = getRecipeDisplayName(recipe, lang);
  if (!name) return '';

  return name
    .replace(/рецепт:?/gi, '')
    .replace(/recipe:?/gi, '')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}
