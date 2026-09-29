// Shared options for recipe filters and the manual recipe form.
import {
  iconSunrise, iconSun, iconMoon, iconApple, iconCakeSlice, iconMug, iconBread,
  iconPorridge, iconSoup, iconSalad, iconSideDish, iconPlate, iconPasta, iconSauce,
  iconSandwich, iconCasserole, iconPancakes, iconOmelet, iconSmoothie, iconBoil,
  iconOven, iconSteam, iconGrill, iconStew, iconSoak, iconLeafRaw,
} from './icons.js';

export const RECIPE_FILTER_GROUPS = [
  {
    id: 'category',
    dbColumn: 'category',
    labelKey: 'filterGroupCategory',
    options: [
      { value: 'breakfast',  ua: 'Сніданок',   en: 'Breakfast', pl: 'Śniadanie',  icon: iconSunrise },
      { value: 'lunch',      ua: 'Обід',        en: 'Lunch',     pl: 'Obiad',      icon: iconSun },
      { value: 'dinner',     ua: 'Вечеря',      en: 'Dinner',    pl: 'Kolacja',    icon: iconMoon },
      { value: 'snack',      ua: 'Перекус',     en: 'Snack',     pl: 'Przekąska',  icon: iconApple },
      { value: 'dessert',    ua: 'Десерт',      en: 'Dessert',   pl: 'Deser',      icon: iconCakeSlice },
      { value: 'drinks',     ua: 'Напої',       en: 'Drinks',    pl: 'Napoje',     icon: iconMug },
      { value: 'bakery',     ua: 'Випічка',     en: 'Bakery',    pl: 'Pieczywo',   icon: iconBread },
    ],
  },
  {
    id: 'dish_type',
    dbColumn: 'type',
    labelKey: 'filterGroupDishType',
    options: [
      { value: 'porridge',    ua: 'Каша',           en: 'Porridge',   pl: 'Kasza',        icon: iconPorridge },
      { value: 'soup',        ua: 'Суп',            en: 'Soup',       pl: 'Zupa',         icon: iconSoup },
      { value: 'salad',       ua: 'Салат',          en: 'Salad',      pl: 'Sałatka',      icon: iconSalad },
      { value: 'side_dish',   ua: 'Гарнір',         en: 'Side dish',  pl: 'Dodatek',      icon: iconSideDish },
      { value: 'main_course', ua: 'Основна страва', en: 'Main course',pl: 'Danie główne', icon: iconPlate },
      { value: 'pasta',       ua: 'Паста',          en: 'Pasta',      pl: 'Makaron',      icon: iconPasta },
      { value: 'sauce',       ua: 'Соус',           en: 'Sauce',      pl: 'Sos',          icon: iconSauce },
      { value: 'sandwich',    ua: 'Сендвіч',        en: 'Sandwich',   pl: 'Kanapka',      icon: iconSandwich },
      { value: 'casserole',   ua: 'Запіканка',      en: 'Casserole',  pl: 'Zapiekanka',   icon: iconCasserole },
      { value: 'pancakes',    ua: 'Млинці',         en: 'Pancakes',   pl: 'Naleśniki',    icon: iconPancakes },
      { value: 'omelet',      ua: 'Омлет',          en: 'Omelet',     pl: 'Omlet',        icon: iconOmelet },
      { value: 'smoothie',    ua: 'Смузі',          en: 'Smoothie',   pl: 'Smoothie',     icon: iconSmoothie },
    ],
  },
  {
    id: 'cooking_method',
    dbColumn: 'cooking_method',
    labelKey: 'filterGroupCookingMethod',
    options: [
      { value: 'boiling',  ua: 'Варіння',          en: 'Boiling',    pl: 'Gotowanie',   icon: iconBoil },
      { value: 'frying',   ua: 'Смаження',         en: 'Frying',     pl: 'Smażenie',    icon: iconOmelet },
      { value: 'baking',   ua: 'Запікання',        en: 'Baking',     pl: 'Pieczenie',   icon: iconOven },
      { value: 'steaming', ua: 'На парі',          en: 'Steaming',   pl: 'Na parze',    icon: iconSteam },
      { value: 'grilling', ua: 'Гриль',            en: 'Grilling',   pl: 'Grillowanie', icon: iconGrill },
      { value: 'stewing',  ua: 'Тушкування',       en: 'Stewing',    pl: 'Duszenie',    icon: iconStew },
      { value: 'soaking',  ua: 'Замочування',      en: 'Soaking',    pl: 'Namaczanie',  icon: iconSoak },
      { value: 'fresh',    ua: 'Без термообробки', en: 'Fresh/Raw',  pl: 'Bez obróbki', icon: iconLeafRaw },
    ],
  },
];
