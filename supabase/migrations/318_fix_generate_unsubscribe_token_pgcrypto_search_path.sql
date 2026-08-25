-- File: supabase/migrations/318_fix_generate_unsubscribe_token_pgcrypto_search_path.sql
-- Mode B: idempotent rerunnable migration (CREATE OR REPLACE FUNCTION is safe to re-run).
--
-- FIX (HIGH, QA ACC-TC-F02 valid leg): generate_unsubscribe_token throws
--   42883 function does not exist (public.gen_random_bytes)
-- when called (e.g. by the seed's seedUnsubscribeTokenFixture) -> `unsubscribe_tokens`
-- stays empty and the "You've Been Unsubscribed" success leg is untestable.
--
-- Root cause: the function is SECURITY DEFINER and carries
-- `SET search_path = public, pg_temp` (applied at deploy time by the 314
-- prod-p1 security sweep to every public SECURITY DEFINER function lacking an
-- explicit search_path). pgcrypto's gen_random_bytes() lives ONLY in the
-- `extensions` schema on Supabase, so the unqualified call cannot resolve under
-- a public-only search_path. Same defect class as the Phase 26 send-phone-otp
-- gen_salt bug (fixed in 20260820000001_fix_phone_otp_pgcrypto_search_path.sql).
--
-- Fix: qualify the call as extensions.gen_random_bytes(32) (least privilege -
-- search_path is NOT widened; signature unchanged, so no DROP required per BP-12).
-- Any existing EXECUTE grants on the function are preserved by CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(
  p_user_id UUID,
  p_category notification_category
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a secure random token. pgcrypto lives in the `extensions` schema on
  -- Supabase; it MUST be schema-qualified because the search_path is public, pg_temp.
  v_token := encode(extensions.gen_random_bytes(32), 'base64url');

  -- Insert token
  INSERT INTO unsubscribe_tokens (user_id, token, category)
  VALUES (p_user_id, v_token, p_category);

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.generate_unsubscribe_token IS
'Creates a 365-day unsubscribe token for a notification category. SECURITY DEFINER with restrictive search_path (public, pg_temp); the pgcrypto call is schema-qualified (extensions.gen_random_bytes).';

-- ===== VERIFICATION QUERY =====
-- SELECT public.generate_unsubscribe_token(
--   '<a standing persona user id, e.g. test-buyer>',
--   'subscription'::notification_category
-- );
-- Expected: returns a base64url token string AND a row appears in
-- `unsubscribe_tokens` (previously: 42883 function does not exist).
