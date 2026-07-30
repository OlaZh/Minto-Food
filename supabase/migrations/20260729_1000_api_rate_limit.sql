-- ============================================================
-- Generic per-user API rate limiting (Roadmap Фаза 17)
-- 2026-07-29
--
-- Reusable rolling-window limiter for our own /api/* endpoints, following
-- the same atomic pattern as reserve_moderation_slot (Фаза 18): count-then-
-- insert under a transaction-scoped advisory lock per (user, bucket), so a
-- concurrent burst cannot all read the same "under limit" count.
--
-- Scope: only endpoints that actually run on our Vercel functions
-- (/api/save-recipe today). Login/signup go straight to Supabase Auth from
-- the browser and recipe_reports is inserted client-side under RLS — neither
-- passes through our domain, so this table cannot and does not limit them.
-- Auth-side throttling belongs to Supabase's own Auth rate limits
-- (Dashboard → Auth → Rate Limits), not this migration.
--
-- GDPR: user_id has ON DELETE CASCADE (same as recipe_ratings), so this
-- table self-cleans when auth.users is deleted, independent of whether
-- hard_delete_user_data() remembers this table. hard_delete_user_data() also
-- deletes explicitly (belt-and-braces, matching its existing style for
-- CASCADE-backed tables like scanned_product_corrections).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket      TEXT        NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_rate_limits IS
  'Rolling-window hit log for our own /api/* endpoints. bucket names one limited action (e.g. recipe_create). Old rows are disposable — pruned by cleanup_api_rate_limits(), not tied to the same user returning.';

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup
  ON public.api_rate_limits (user_id, bucket, occurred_at);

-- Supports cleanup_api_rate_limits()'s global age scan without a full table
-- scan, independent of user_id/bucket.
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_occurred_at
  ON public.api_rate_limits (occurred_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.api_rate_limits_id_seq TO service_role;

-- Atomically check-and-record one hit for (p_user_id, p_bucket) in a rolling
-- p_window_seconds window. Returns true if this hit is admitted (count,
-- including this hit, is <= p_limit), false if the caller is over the limit
-- (the hit is still NOT recorded in that case — rejected calls don't count).
--
-- Note on what this counts: every ADMITTED attempt reaching this RPC, not
-- successfully created recipes. save-recipe.js calls this before its own
-- validation, so invalid/rejected creation attempts still spend a slot. For
-- anti-spam this is the correct and typical behaviour — the limit is "10
-- creation attempts per minute", not "10 recipes per minute" — but rely on
-- that framing, not the latter, when reasoning about it.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id        uuid,
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Serialise this user+bucket's check+insert so a concurrent burst cannot
  -- all read the same pre-insert count.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_bucket, 0));

  SELECT count(*) INTO v_count
  FROM api_rate_limits
  WHERE user_id = p_user_id
    AND bucket = p_bucket
    AND occurred_at >= now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO api_rate_limits (user_id, bucket) VALUES (p_user_id, p_bucket);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  TO service_role;

-- Global cleanup, independent of any user returning to trigger it (the
-- previous per-user-on-hit cleanup left inactive users' rows forever). Keeps
-- a generous 1-day floor regardless of caller-supplied window sizes, so a
-- short window (e.g. 60s) can't immediately prune rows a slower caller still
-- needs for its own count. Intended to run on a daily cron alongside
-- gdpr-hard-delete (see api/cron/gdpr-hard-delete.js) — not wired to a cron
-- entry yet; call manually or add a vercel.json cron when scheduling this.
CREATE OR REPLACE FUNCTION public.cleanup_api_rate_limits()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM api_rate_limits WHERE occurred_at < now() - interval '1 day';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_api_rate_limits()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_api_rate_limits()
  TO service_role;
