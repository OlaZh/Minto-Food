-- ============================================================
-- Самонавчання аліасів (Крок 3)
-- 2026-06-05
--
-- Коли користувач вручну обирає продукт у дропдауні для запиту,
-- який автомат не вгадав, ми пишемо його запит як аліас
-- (is_user_added=true). Словник синонімів/відмінкових форм росте
-- сам із реального вжитку — найцінніше джерело аліасів.
--
-- product_aliases досі мала ТІЛЬКИ SELECT-полісі (20260528_1000),
-- тож будь-який INSERT з клієнта блокувався RLS. Відкриваємо INSERT
-- ОБЕРЕЖНО:
--   • тільки authenticated (анонімам запис заборонено — менше спаму)
--   • тільки рядки з is_user_added = true (машинні аліаси лишаються
--     недоторканними для клієнта)
-- ============================================================

-- INSERT-полісі: лише залогований юзер і лише самонавчальні рядки.
DROP POLICY IF EXISTS "user_insert_learned_aliases" ON product_aliases;
CREATE POLICY "user_insert_learned_aliases"
  ON product_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (is_user_added = true);

-- Захист від дублів САМЕ для самонавчальних рядків (частковий індекс):
--   • не чіпає наявні машинні аліаси (там можуть бути легітимні повтори),
--   • дає ON CONFLICT DO NOTHING у клієнті працювати без помилок,
--   • is_user_added рядків зараз 0 → індекс гарантовано створиться.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_aliases_learned
  ON product_aliases (product_id, alias_normalized, language)
  WHERE is_user_added = true;
