-- =============================================================================
-- FIX-Task-16 item 4 — admin_config data-type hygiene: charge_one_fee_per_bundle
-- =============================================================================
-- WHY
--   The admin portal declares this key as a `boolean` flag
--   (p2p-kids-admin/src/types/config.ts, admin Settings → Trade Timing →
--   "Charge One Fee Per Bundle"), and migration 316 seeds
--   data_type = 'boolean' — every sibling feature flag is 'boolean'. The staging
--   row was observed carrying data_type = 'string'.
--
--   `data_type` drives the client's value parsing
--   (p2p-kids-marketplace/src/services/adminConfig.ts — getAdminConfig),
--   so a 'string' row makes the raw text land in a boolean-typed field, and the
--   string 'false' is truthy. This is a metadata-only correction, but it keeps the
--   bundle fee mode from ever being misread.
--
-- SCOPE / SAFETY
--   * Touches ONE key's data_type only. The `value` column is TEXT, so 'true'
--     stays 'true' and the clients that compare against 'true' are unaffected.
--   * Idempotent + rerun-safe: the WHERE clause turns a second run into a no-op.
--   * No app behaviour change is required for this to be safe — FIX-Task-16 item 4
--     also hardened the two client read paths to accept BOTH the string form
--     ("true") and a real boolean. (BP-80: this file is written but NOT applied
--     until Samer approves the Supabase MCP call.)
--
-- ROLLBACK
--   UPDATE public.admin_config SET data_type = 'string'
--   WHERE key = 'charge_one_fee_per_bundle';
--   (Safe — no client depends on the 'string' form; the value itself is untouched.)
-- =============================================================================

UPDATE public.admin_config
SET data_type  = 'boolean',
    updated_at = NOW()
WHERE key = 'charge_one_fee_per_bundle'
  AND data_type IS DISTINCT FROM 'boolean';

-- ---------------------------------------------------------------------------
-- VERIFY (run after applying — expected: value = 'true', data_type = 'boolean')
-- ---------------------------------------------------------------------------
-- SELECT key, value, data_type, is_active, updated_at
-- FROM public.admin_config
-- WHERE key = 'charge_one_fee_per_bundle';
--
-- Sibling flags must remain untouched (all 'boolean'):
-- SELECT key, data_type FROM public.admin_config
-- WHERE data_type = 'string' AND key LIKE '%enabled%' ORDER BY key;
