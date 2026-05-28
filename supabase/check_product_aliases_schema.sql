-- Виконати в Supabase SQL Editor → скопіювати результат
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_aliases'
ORDER BY ordinal_position;
