-- ============================================================
-- product_measure_weights — вага продуктів за мірою
-- 2026-06-03
--
-- Зберігає вагу (грами) однієї мірної одиниці для конкретного
-- продукту: склянка, ложки (ст.л./дес.л./ч.л.), дрібка, щіпка, жменя.
--
-- НАВІЩО ОКРЕМА ТАБЛИЦЯ (не product_units):
--   product_units — лише продукти, які міряють ШТУКАМИ (яйце, картоплина).
--   Тут — продукти, які міряють ОБ'ЄМОМ/МІРОЮ (борошно, молоко, цукор,
--   олія, мед). Вага однієї міри залежить від продукту:
--   склянка борошна ≈130 г, склянка молока ≈250 г — тому grams
--   зберігається по кожній парі (продукт × одиниця), без формул.
--
-- Парсер (js/parse-food.js) зводить введену одиницю до канонічного
-- unit_type; розрахунок (js/recipe-ingredients.js) шукає тут grams.
-- Нема рядка → інгредієнт нерозпізнаний (без вигаданих дефолтів).
-- ============================================================

CREATE TABLE IF NOT EXISTS product_measure_weights (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id     bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  unit_type      varchar(50) NOT NULL,          -- канон: склянка/стакан/ст.л./дес.л./ч.л./дрібка/щіпка/жменя/пачка
  volume_ml      numeric(8,2),                  -- об'єм однієї одиниці в мл (для об'ємних мір)
  grams          numeric(10,2) NOT NULL,        -- вага продукту в грамах для 1 одиниці
  state          varchar(100),                  -- стан/форма: сире/варене/нарізане/терте…
  note           varchar(255),                  -- уточнення: з гіркою/без гірки/щільно утрамбоване…
  source         varchar(100),                  -- джерело даних: USDA / власна база / книга…
  is_approximate boolean NOT NULL DEFAULT true,  -- чи значення приблизне
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Одна одиниця може важити по-різному залежно від стану й уточнення
  -- (склянка борошна "з гіркою" ≠ "без гірки") → ключ по 4 полях.
  UNIQUE (product_id, unit_type, state, note)
);

-- Швидкий lookup ваги за продуктом і типом одиниці (основний шлях розрахунку)
CREATE INDEX IF NOT EXISTS idx_pmw_product_unit
  ON product_measure_weights (product_id, unit_type);

-- ── RLS: спільний довідник — читання всім, запис лише через адмінку/сервіс ──
ALTER TABLE product_measure_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_product_measure_weights" ON product_measure_weights;
CREATE POLICY "public_read_product_measure_weights"
  ON product_measure_weights FOR SELECT USING (true);

-- Запис (INSERT/UPDATE/DELETE) політиками НЕ відкриваємо — лише service_role
-- (адмінка/сервер). Так клієнт не може псувати спільні довідкові ваги.
