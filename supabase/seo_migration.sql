-- ============================================================
-- ФАЗА 15: SEO — публічні URL рецептів (slug)
-- Запустити в Supabase SQL Editor
-- ============================================================

-- 1. Додаємо slug-колонку
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS slug TEXT;

-- Унікальний індекс тільки де slug заповнений
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_slug
  ON recipes(slug) WHERE slug IS NOT NULL;

-- ============================================================
-- 2. Функція транслітерації + генерації slug
-- ============================================================

DROP FUNCTION IF EXISTS generate_recipe_slug(TEXT, UUID);

CREATE OR REPLACE FUNCTION generate_recipe_slug(p_name TEXT, p_id INT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  s         TEXT;
  candidate TEXT;
  n         INT := 0;
BEGIN
  s := lower(COALESCE(p_name, 'recipe'));

  -- Багатосимвольні заміни (порядок важливий — довші першими)
  s := replace(s, 'щ', 'shch');
  s := replace(s, 'ш', 'sh');
  s := replace(s, 'ч', 'ch');
  s := replace(s, 'ж', 'zh');
  s := replace(s, 'х', 'kh');
  s := replace(s, 'ц', 'ts');
  s := replace(s, 'є', 'ie');
  s := replace(s, 'ї', 'i');
  s := replace(s, 'ю', 'yu');
  s := replace(s, 'я', 'ya');

  -- Однобуквені заміни через translate
  -- а→a б→b в→v г→g ґ→g д→d е→e з→z и→i й→y к→k л→l м→m н→n о→o п→p р→r с→s т→t у→u ф→f
  s := translate(s, 'абвгґдезийклмнопрстуф', 'abvggdeziyklmnoprstuf');

  -- Окремі символи
  s := replace(s, 'і', 'i');  -- Ukrainian і
  s := replace(s, 'ь', '');   -- м'який знак — прибираємо
  s := replace(s, 'ъ', '');   -- твердий знак — прибираємо

  -- Будь-які не-ASCII → дефіс
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');

  -- Обрізаємо дефіси по краях та обмежуємо довжину
  s := trim(both '-' from s);
  s := left(s, 80);
  s := trim(both '-' from s);

  IF s = '' OR s IS NULL THEN
    s := 'recipe';
  END IF;

  -- Забезпечуємо унікальність числовим суфіксом
  candidate := s;
  WHILE EXISTS (
    SELECT 1 FROM recipes WHERE slug = candidate AND id <> p_id
  ) LOOP
    n := n + 1;
    candidate := s || '-' || n;
  END LOOP;

  RETURN candidate;
END;
$$;

-- ============================================================
-- 3. Тригер: автоматично генерує slug при публікації
-- ============================================================

CREATE OR REPLACE FUNCTION trg_set_recipe_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Встановлюємо slug тільки якщо рецепт стає published і slug ще немає
  IF NEW.status = 'published' AND (NEW.slug IS NULL OR NEW.slug = '') THEN
    NEW.slug := generate_recipe_slug(
      COALESCE(NEW.name_ua, NEW.name_en, 'recipe'),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_slug ON recipes;
CREATE TRIGGER trg_recipe_slug
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION trg_set_recipe_slug();

-- ============================================================
-- 4. Бекфіл — генеруємо slug для всіх опублікованих рецептів
-- ============================================================

UPDATE recipes
SET slug = generate_recipe_slug(COALESCE(name_ua, name_en, 'recipe'), id)
WHERE status = 'published'
  AND deleted_at IS NULL
  AND (slug IS NULL OR slug = '');

-- ============================================================
-- 5. RLS — публічний read для SEO-сторінки рецепту
-- ============================================================

-- Опублікований не-видалений рецепт читає будь-хто (anon включно)
DROP POLICY IF EXISTS "public_read_published_recipes" ON recipes;
CREATE POLICY "public_read_published_recipes"
  ON recipes FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Profiles: full_name публічне (вже видно в рецептах спільноти)
DROP POLICY IF EXISTS "public_read_profiles_basic" ON profiles;
CREATE POLICY "public_read_profiles_basic"
  ON profiles FOR SELECT
  USING (true);

-- Інгредієнти рецептів: публічний read
DROP POLICY IF EXISTS "public_read_product_recipe" ON product_recipe;
CREATE POLICY "public_read_product_recipe"
  ON product_recipe FOR SELECT USING (true);

-- Продукти: публічний read (назви інгредієнтів)
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products"
  ON products FOR SELECT USING (true);
