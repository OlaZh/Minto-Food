-- ============================================================
-- Перенормалізація alias_normalized (Крок 4)
-- 2026-06-05
--
-- Наявні alias_normalized = просто lower(name) — з ДІАКРИТИКОЮ
-- ("mąka", "miód") і апострофами ("м'який"). А запит у рантаймі
-- проходить через JS normalizeKey, який діакритику транслітерує
-- (mąka→maka) і прибирає апострофи. Через цю розбіжність pl/en
-- пошук по аліасах НЕ матчиться.
--
-- Лагодимо симетрію: normalize_key() у SQL — ДЗЕРКАЛО js normalizeKey.
-- Робимо те саме й у тому ж порядку:
--   1) lower
--   2) транслітерація діакритики (translate; ß→ss окремо, бо 2 символи)
--   3) прибрати апострофи ' ’ ` ʼ
--   4) решта пунктуації/дужок → пробіл
--   5) стиснути пробіли, trim
--
-- ⚠️ Цей файл містить UPDATE наприкінці — він ЗАКОМЕНТОВАНИЙ.
-- Спочатку запусти лише функцію + PREVIEW (read-only), переглянь
-- diff, і лише потім розкоментуй UPDATE.
-- ============================================================

-- ── normalize_key: канонічна нормалізація, дзеркало js normalizeKey ──
CREATE OR REPLACE FUNCTION normalize_key(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    -- 5) стиснути пробіли + trim
    btrim(
      regexp_replace(
        -- 4) решта пунктуації/дужок (не латиниця/цифри/укр/пробіл) → пробіл
        regexp_replace(
          -- 3) прибрати апострофи
          translate(
            -- 2) транслітерація діакритики (одно-символьні)
            translate(
              -- ß → ss (двосимвольна заміна, окремо до translate)
              -- 1) lower
              replace(lower(coalesce(input, '')), 'ß', 'ss'),
              'ąćęłńóśźżáàâäãéèêëíìîïòôöõúùûüýÿçñ',
              'acelnoszzaaaaaeeeeiiiioooouuuuyycn'
            ),
            '''’`ʼ', ''
          ),
          '[^a-z0-9а-яіїєґ ]', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    );
$$;

-- ── PREVIEW (read-only): які рядки реально зміняться? ──
-- Запусти ЦЕЙ блок першим. Якщо diff виглядає правильно — переходь до UPDATE.
SELECT
  pa.id,
  pa.language,
  pa.alias_normalized                  AS before,
  normalize_key(pa.alias_normalized)   AS after
FROM product_aliases pa
WHERE normalize_key(pa.alias_normalized) <> pa.alias_normalized
ORDER BY pa.language, pa.alias_normalized
LIMIT 100;

-- Скільки всього рядків зміниться (по мовах):
-- SELECT pa.language, count(*) AS will_change
-- FROM product_aliases pa
-- WHERE normalize_key(pa.alias_normalized) <> pa.alias_normalized
-- GROUP BY pa.language ORDER BY pa.language;

-- ── UPDATE (ЗАКОМЕНТОВАНО — розкоментуй ПІСЛЯ перегляду preview) ──
-- UPDATE product_aliases
-- SET alias_normalized = normalize_key(alias_normalized)
-- WHERE normalize_key(alias_normalized) <> alias_normalized;


-- ============================================================
-- ТОКЕН-AWARE ПОШУК (масиви text[] + GIN + оператор @>)
-- ============================================================
-- Проблема: ilike '%5%' по alias_normalized ловить "сир 50" для запиту
-- "сир 5" (підрядок). Фільтрувати в JS ПІСЛЯ limit не можна — база обрізає
-- кандидатів ДО фільтра → сліпі зони.
--
-- Рішення: зберігати ключ як МАСИВ ТОКЕНІВ. {"сир","50"} НЕ містить "5",
-- тому колізій бути не може фізично. Запит у JS дає токени → шукаємо
-- перетин оператором @> (contains). Ідеально лягає на GIN-індекс.
--
-- alias_tokens — STORED GENERATED з alias_normalized → автоматично
-- перераховується після UPDATE вище. string_to_array безпечний, бо
-- normalize_key уже стиснув пробіли й зробив trim (порожніх токенів нема).

-- ⚠️ Створювати ПІСЛЯ розкоментованого UPDATE (щоб масив одразу будувався
-- з нормалізованих значень). Якщо UPDATE ще закоментований — спершу зроби його.

-- ALTER TABLE product_aliases
--   ADD COLUMN IF NOT EXISTS alias_tokens text[]
--   GENERATED ALWAYS AS (
--     string_to_array(normalize_key(alias_normalized), ' ')
--   ) STORED;

-- CREATE INDEX IF NOT EXISTS idx_product_aliases_tokens_gin
--   ON product_aliases USING gin (alias_tokens);

-- Перевірка (read-only, після створення колонки):
-- SELECT alias_normalized, alias_tokens FROM product_aliases
-- WHERE 'борошно' = ANY(alias_tokens) LIMIT 10;
