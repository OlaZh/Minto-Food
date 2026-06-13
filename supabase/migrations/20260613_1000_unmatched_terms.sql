-- ============================================================
-- Черга нерозпізнаних інгредієнтів/продуктів
-- 2026-06-13
--
-- Коли користувач вводить інгредієнт у рецепті або товар у списку
-- покупок, який система НЕ змогла зіставити з products/product_aliases,
-- ми тихо пишемо нормалізовану назву сюди (по одному рядку на
-- term_normalized) і інкрементуємо лічильник.
--
-- Це дає адміну список "що люди шукали, але не знайшли", відсортований
-- за популярністю — щоб додати найхідовіші продукти в БД (або аліас),
-- а не вгадувати наосліп. Сценарій: українка в Іспанії щодня вписує
-- місцевий продукт → за тиждень він спливає нагорі черги.
--
-- Логіка/RLS за зразком scanned_product_corrections.
-- ============================================================

CREATE TABLE IF NOT EXISTS unmatched_terms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_normalized text NOT NULL,
  term_raw        text NOT NULL,            -- останній приклад як писали
  lang            text DEFAULT 'ua',
  source          text DEFAULT 'recipe',    -- 'recipe' | 'shopping'
  times_seen      integer NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'ignored'
  first_seen_at   timestamptz DEFAULT now(),
  last_seen_at    timestamptz DEFAULT now(),
  UNIQUE (term_normalized)
);

CREATE INDEX IF NOT EXISTS idx_unmatched_status   ON unmatched_terms (status);
CREATE INDEX IF NOT EXISTS idx_unmatched_seen     ON unmatched_terms (times_seen DESC);

-- ── RLS ────────────────────────────────────────────────────────
-- Запис іде ВИКЛЮЧНО через RPC log_unmatched_term (SECURITY DEFINER),
-- тож прямих table-полісей на INSERT/UPDATE не даємо. SELECT/керування —
-- лише адмінам, теж через SECURITY DEFINER функції. Вмикаємо RLS і не
-- створюємо дозвільних полісей → пряма таблиця закрита для клієнтів.
ALTER TABLE unmatched_terms ENABLE ROW LEVEL SECURITY;

-- ── Запис: тихий upsert нерозпізнаного терміну ─────────────────
-- Дозволено лише authenticated (анонімам — ні, менше спаму).
-- Якщо term_normalized уже є: times_seen++, оновлюємо last_seen_at,
-- term_raw і source (нехай відображає найсвіжіший контекст).
-- Не чіпаємо рядки зі статусом 'ignored' — щоб відхилене сміття не
-- спливало знову (лише оновлюємо лічильник для статистики).
CREATE OR REPLACE FUNCTION log_unmatched_term(
  p_raw    text,
  p_lang   text DEFAULT 'ua',
  p_source text DEFAULT 'recipe'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN; -- тільки залоговані
  END IF;

  -- Нормалізація (близько до normalizeKey() у JS): lower, прибрати апострофи,
  -- решту пунктуації → пробіл, стиснути пробіли. Дозволяємо латиницю з
  -- діакритикою й польські літери, щоб "łosoś"/"café" не з'їдалися (для
  -- дедупу в межах черги важлива стабільність, а не точна транслітерація).
  v_norm := lower(coalesce(p_raw, ''));
  v_norm := regexp_replace(v_norm, '[''’`ʼ]', '', 'g');
  v_norm := regexp_replace(v_norm, '[^a-z0-9à-ÿąćęłńóśźżа-яіїєґ]+', ' ', 'g');
  v_norm := btrim(regexp_replace(v_norm, '\s+', ' ', 'g'));

  IF length(v_norm) < 2 THEN
    RETURN;
  END IF;

  INSERT INTO unmatched_terms (term_normalized, term_raw, lang, source)
  VALUES (v_norm, btrim(p_raw), coalesce(p_lang, 'ua'), coalesce(p_source, 'recipe'))
  ON CONFLICT (term_normalized) DO UPDATE
    SET times_seen   = unmatched_terms.times_seen + 1,
        last_seen_at = now(),
        term_raw     = btrim(p_raw),
        source       = coalesce(p_source, unmatched_terms.source),
        -- повторна поява раніше відхиленого → повертаємо в pending? Ні:
        -- лишаємо status як є, щоб ignored не "воскресало".
        status       = unmatched_terms.status;
END;
$$;

-- ── Адмін: список черги (за популярністю) ──────────────────────
CREATE OR REPLACE FUNCTION get_unmatched_terms(
  p_status   text DEFAULT 'pending',
  p_min_seen int  DEFAULT 1
)
RETURNS SETOF unmatched_terms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT *
  FROM unmatched_terms u
  WHERE (p_status IS NULL OR u.status = p_status)
    AND u.times_seen >= p_min_seen
  ORDER BY u.times_seen DESC, u.last_seen_at DESC;
END;
$$;

-- ── Адмін: позначити статус (resolved/ignored/pending) ─────────
CREATE OR REPLACE FUNCTION set_unmatched_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_status NOT IN ('pending', 'resolved', 'ignored') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  UPDATE unmatched_terms SET status = p_status WHERE id = p_id;
END;
$$;

-- ── Гранти ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION log_unmatched_term(text, text, text)  FROM public, anon;
REVOKE ALL ON FUNCTION get_unmatched_terms(text, int)         FROM public, anon;
REVOKE ALL ON FUNCTION set_unmatched_status(uuid, text)       FROM public, anon;
GRANT EXECUTE ON FUNCTION log_unmatched_term(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unmatched_terms(text, int)       TO authenticated;
GRANT EXECUTE ON FUNCTION set_unmatched_status(uuid, text)     TO authenticated;
