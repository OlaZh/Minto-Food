-- ============================================================
-- Cookie consent у профілі
-- 2026-06-02
--
-- Раніше згода на cookies зберігалась лише в localStorage → при
-- зміні пристрою чи після чистки кешу/збою банер з'являвся знову.
-- Тепер для залогінених згода прив'язана до акаунта і їде за
-- користувачем на будь-який пристрій.
--
-- Гості (не залогінені) досі використовують localStorage — так
-- вимагає GDPR (до логіну немає де зберігати в БД).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS consent_analytics boolean,
  ADD COLUMN IF NOT EXISTS consent_marketing boolean,
  ADD COLUMN IF NOT EXISTS consent_version   text,
  ADD COLUMN IF NOT EXISTS consent_at        timestamptz;

COMMENT ON COLUMN profiles.consent_analytics IS 'Згода на аналітичні cookies (NULL = ще не відповідав)';
COMMENT ON COLUMN profiles.consent_marketing IS 'Згода на маркетингові cookies (NULL = ще не відповідав)';
COMMENT ON COLUMN profiles.consent_version   IS 'Версія банера, на яку дано згоду (CONSENT_VERSION у js/cookie-consent.js)';
COMMENT ON COLUMN profiles.consent_at         IS 'Коли востаннє збережено вибір cookies';

-- Примітка щодо RLS:
-- окремі політики не потрібні — ці колонки лежать у вже захищеній
-- таблиці profiles, де користувач читає/оновлює лише власний рядок
-- (auth.uid() = id). Жодних нових політик не додаємо.
