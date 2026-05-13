-- Додаємо display_name до profiles
-- Унікальний без урахування регістру (щоб "Ірина" і "ірина" не конфліктували)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Унікальний індекс по lower(display_name), NULL-значення не перевіряються
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_unique
  ON profiles (lower(display_name))
  WHERE display_name IS NOT NULL;
