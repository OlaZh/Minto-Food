-- ============================================================
-- Автостворення profiles при реєстрації + INSERT-політика власника
-- + backfill для вже наявних користувачів без профілю
-- 2026-06-01
--
-- Передумови (підтверджено в БД):
--   * RLS на profiles увімкнено (deny-by-default).
--   * Політики: SELECT (public + власник/admin), UPDATE (власник/admin).
--   * INSERT-політики НЕ було → клієнтський INSERT падав з 403
--     "new row violates row-level security policy for table profiles".
--   * Тригера автостворення НЕ було → 4 з 5 auth.users без рядка в profiles.
--   * profiles.full_name — NOT NULL без DEFAULT → мусить бути заповнений.
--   * На profiles НЕ було PRIMARY KEY/UNIQUE на id (лише FK id→auth.users),
--     тому ON CONFLICT (id) не працював і профіль міг би дублюватися.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Відсутній первинний ключ на id. Потрібен і сам по собі
--    (унікальність профілю), і для ON CONFLICT нижче.
--    Дублів/NULL у profiles немає — ALTER пройде безпечно.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- ─────────────────────────────────────────────────────────────
-- 1. Функція + тригер: створюємо профіль при кожній реєстрації.
--    SECURITY DEFINER → виконується від власника функції й обходить
--    RLS, тому окрема INSERT-політика для тригера не потрібна.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1),
      'Користувач'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. INSERT-політика власника — запасний шлях для клієнта
--    (storage.js робить INSERT, якщо рядка ще немає).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill: створюємо профілі для наявних користувачів без рядка.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1),
    'Користувач'
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
