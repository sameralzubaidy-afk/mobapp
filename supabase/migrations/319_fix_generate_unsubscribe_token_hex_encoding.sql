-- File: supabase/migrations/319_fix_generate_unsubscribe_token_hex_encoding.sql
-- Mode B: idempotent rerunnable migration (CREATE OR REPLACE FUNCTION is safe to re-run).
--
-- FIX (HIGH, follow-up to 318): after 318 fixed the gen_random_bytes search_path
-- defect, generate_unsubscribe_token still failed at seed time with
--   unrecognized encoding: "base64url"
--
-- Root cause: `encode(bytea, 'base64url')` is a PostgreSQL 17+ encoding option.
-- The staging database runs an older PostgreSQL, so the literal 'base64url' is
-- not a recognized encoding. This is a SECOND latent bug in the same function
-- (the original 209 migration used 'base64url', which was never exercised because
-- the gen_random_bytes call failed first).
--
-- Fix: encode the token as `hex` instead. Hex is:
--   - supported on every PostgreSQL version,
--   - fully URL-safe (only 0-9a-f — no +, /, = padding), which matters because
--     send-email/index.ts embeds the token raw in `${APP_URL}/unsubscribe?token=…`
--     with no URL-encoding, and the token must round-trip through the deep link
--     p2pkidsmarketplace://unsubscribe?token=…
--   - same 256-bit entropy (64 hex chars from 32 random bytes).
--
-- Signature unchanged (no DROP required per BP-12); existing EXECUTE grants are
-- preserved by CREATE OR REPLACE.

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
  -- Generate a secure random token. pgcrypto lives in the extensions schema
  -- (MUST be schema-qualified under the public, pg_temp search_path), and the
  -- token is hex-encoded so it is URL-safe (send-email embeds it raw in a link).
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- Insert token
  INSERT INTO unsubscribe_tokens (user_id, token, category)
  VALUES (p_user_id, v_token, p_category);

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.generate_unsubscribe_token IS
'Creates a 365-day unsubscribe token for a notification category. SECURITY DEFINER with restrictive search_path (public, pg_temp); pgcrypto call schema-qualified (extensions.gen_random_bytes); token hex-encoded for URL safety.';

-- ===== VERIFICATION QUERY =====
-- SELECT public.generate_unsubscribe_token(
--   '<a standing persona user id, e.g. test-buyer>',
--   'subscription'::notification_category
-- );
-- Expected: returns a 64-char hex string AND a row appears in `unsubscribe_tokens`
-- (previously: 42883 function does not exist, then unrecognized encoding "base64url").
