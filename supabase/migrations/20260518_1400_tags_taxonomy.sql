-- ============================================================
-- Tags taxonomy — fix + add missing tags
-- 2026-05-18
--
-- category, type (dish_type), cooking_method — колонки в recipes, НЕ теги
-- tags таблиця = тільки dietary + lifestyle
--
-- Що робимо:
--   1. UNIQUE(code)
--   2. Виправляємо type: diet/nutrition/health → dietary
--   3. Додаємо відсутні теги: no_power, pp, low_fat, lactose_free, budget, no_cook, meal_prep
--   4. Оновлюємо name_en, name_pl для існуючих тегів
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS tags_code_unique ON tags (code);

-- Fix existing type names
UPDATE tags SET type = 'dietary'  WHERE type IN ('diet', 'nutrition', 'health');

-- Upsert all dietary + lifestyle tags
INSERT INTO tags (code, type, name_ua, name_en, name_pl, icon, is_active) VALUES

-- ── Dietary ──────────────────────────────────────────────────
('high_protein',  'dietary', 'Багато білка',     'High protein',  'Wysokobiałkowe',     '💪', true),
('low_carb',      'dietary', 'Мало вуглеводів',  'Low carb',      'Niskowęglowodanowe', '📉', true),
('low_calorie',   'dietary', 'Низькокалорійне',  'Low calorie',   'Niskokaloryczne',    '🔥', true),
('low_fat',       'dietary', 'Мало жирів',       'Low fat',       'Niskotłuszczowe',    '🫀', true),
('vegetarian',    'dietary', 'Вегетаріанське',   'Vegetarian',    'Wegetariańskie',     '🥦', true),
('vegan',         'dietary', 'Веганське',        'Vegan',         'Wegańskie',          '🌱', true),
('gluten_free',   'dietary', 'Без глютену',      'Gluten-free',   'Bezglutenowe',       '🌾', true),
('lactose_free',  'dietary', 'Без лактози',      'Lactose-free',  'Bez laktozy',        '🥛', true),
('keto',          'dietary', 'Кето',             'Keto',          'Keto',               '🥑', true),
('diabetic',      'dietary', 'Для діабетиків',   'Diabetic',      'Dla diabetyków',     '💉', true),
('pp',            'dietary', 'ПП',               'Healthy',       'Zdrowe',             '✅', true),

-- ── Lifestyle ─────────────────────────────────────────────────
('quick',     'lifestyle', 'Швидке',         'Quick',          'Szybkie',       '⚡', true),
('kids',      'lifestyle', 'Для дітей',      'Kids',           'Dla dzieci',    '👶', true),
('budget',    'lifestyle', 'Бюджетне',       'Budget',         'Budżetowe',     '💰', true),
('no_cook',   'lifestyle', 'Без готування',  'No-cook',        'Bez gotowania', '🥗', true),
('meal_prep', 'lifestyle', 'Мілпреп',        'Meal prep',      'Meal prep',     '📦', true),
('no_power',  'lifestyle', 'Без світла',     'No electricity', 'Bez prądu',     '🔋', true)

ON CONFLICT (code) DO UPDATE SET
  type      = EXCLUDED.type,
  name_ua   = EXCLUDED.name_ua,
  name_en   = EXCLUDED.name_en,
  name_pl   = EXCLUDED.name_pl,
  icon      = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;
