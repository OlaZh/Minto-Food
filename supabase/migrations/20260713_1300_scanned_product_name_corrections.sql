-- Moderated, per-user name corrections for shared scanned products.
-- A user can keep a personal display name immediately, but only an admin can
-- promote it into scanned_products.

CREATE TABLE IF NOT EXISTS scanned_product_name_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('ua', 'pl', 'en')),
  proposed_name text NOT NULL CHECK (
    char_length(btrim(proposed_name)) BETWEEN 1 AND 200
  ),
  proposed_brand text CHECK (
    proposed_brand IS NULL OR char_length(btrim(proposed_brand)) BETWEEN 1 AND 200
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barcode, user_id, language)
);

CREATE INDEX IF NOT EXISTS idx_spnc_status_updated
  ON scanned_product_name_corrections (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spnc_barcode
  ON scanned_product_name_corrections (barcode);

ALTER TABLE scanned_product_name_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_name_corrections"
  ON scanned_product_name_corrections;

CREATE POLICY "own_select_name_corrections"
  ON scanned_product_name_corrections
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE scanned_product_name_corrections FROM public, anon, authenticated;
GRANT SELECT ON TABLE scanned_product_name_corrections TO authenticated;

-- Users cannot write to the table directly. This function fixes user_id to
-- auth.uid(), validates the product and language, and always resets a
-- resubmitted proposal to pending.
CREATE OR REPLACE FUNCTION submit_scanned_name_correction(
  p_barcode text,
  p_language text,
  p_proposed_name text,
  p_proposed_brand text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_name text := nullif(btrim(p_proposed_name), '');
  v_brand text := nullif(btrim(p_proposed_brand), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_language NOT IN ('ua', 'pl', 'en') THEN
    RAISE EXCEPTION 'unsupported language';
  END IF;

  IF v_name IS NULL OR char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'name must contain 1 to 200 characters';
  END IF;

  IF v_brand IS NOT NULL AND char_length(v_brand) > 200 THEN
    RAISE EXCEPTION 'brand must contain at most 200 characters';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM scanned_products WHERE barcode = p_barcode) THEN
    RAISE EXCEPTION 'scanned product not found';
  END IF;

  INSERT INTO scanned_product_name_corrections (
    barcode, user_id, language, proposed_name, proposed_brand
  )
  VALUES (
    p_barcode, v_user_id, p_language, v_name, v_brand
  )
  ON CONFLICT (barcode, user_id, language) DO UPDATE
  SET proposed_name = EXCLUDED.proposed_name,
      proposed_brand = EXCLUDED.proposed_brand,
      status = 'pending',
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_scanned_name_corrections(
  p_status text DEFAULT 'pending'
)
RETURNS TABLE (
  proposal_id uuid,
  barcode text,
  language text,
  proposed_name text,
  proposed_brand text,
  status text,
  submitted_by uuid,
  submitter_name text,
  current_name_ua text,
  current_name_pl text,
  current_name_en text,
  current_brand text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'unsupported status';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.barcode,
    c.language,
    c.proposed_name,
    c.proposed_brand,
    c.status,
    c.user_id,
    p.full_name,
    sp.name_ua,
    sp.name_pl,
    sp.name_en,
    sp.brand,
    c.created_at,
    c.updated_at
  FROM scanned_product_name_corrections c
  JOIN scanned_products sp ON sp.barcode = c.barcode
  LEFT JOIN profiles p ON p.id = c.user_id
  WHERE p_status IS NULL OR c.status = p_status
  ORDER BY c.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION approve_scanned_name_correction(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal scanned_product_name_corrections%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_proposal
  FROM scanned_product_name_corrections
  WHERE id = p_proposal_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending proposal not found';
  END IF;

  UPDATE scanned_products
  SET name_ua = CASE WHEN v_proposal.language = 'ua' THEN v_proposal.proposed_name ELSE name_ua END,
      name_pl = CASE WHEN v_proposal.language = 'pl' THEN v_proposal.proposed_name ELSE name_pl END,
      name_en = CASE WHEN v_proposal.language = 'en' THEN v_proposal.proposed_name ELSE name_en END,
      brand = COALESCE(v_proposal.proposed_brand, brand),
      updated_at = now()
  WHERE scanned_products.barcode = v_proposal.barcode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scanned product not found';
  END IF;

  UPDATE scanned_product_name_corrections
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_scanned_name_correction(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE scanned_product_name_corrections
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending proposal not found';
  END IF;
END;
$$;

-- Keep deletion of a shared scanned product complete after this table exists.
CREATE OR REPLACE FUNCTION admin_delete_scanned_product(p_barcode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM scanned_product_name_corrections WHERE barcode = p_barcode;
  DELETE FROM scanned_product_corrections WHERE barcode = p_barcode;
  DELETE FROM scanned_products WHERE barcode = p_barcode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scanned product not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION submit_scanned_name_correction(text, text, text, text)
  FROM public, anon;
REVOKE ALL ON FUNCTION get_scanned_name_corrections(text)
  FROM public, anon;
REVOKE ALL ON FUNCTION approve_scanned_name_correction(uuid)
  FROM public, anon;
REVOKE ALL ON FUNCTION reject_scanned_name_correction(uuid)
  FROM public, anon;

GRANT EXECUTE ON FUNCTION submit_scanned_name_correction(text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION get_scanned_name_corrections(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION approve_scanned_name_correction(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION reject_scanned_name_correction(uuid)
  TO authenticated;

