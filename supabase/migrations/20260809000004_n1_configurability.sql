-- ============================================================================
-- N1 — Configurability (Cross-Cutting) — Gap-fill + Consolidate
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Adds the two missing admin-tunable domains so the config layer covers all
--   six N1 domains, and adds ONE typed read helper that every future
--   requirement (R1–R13) should use instead of hardcoding values.
--
-- THE SIX N1 DOMAINS → WHERE EACH LIVES (single source of truth):
--   1. Countdown windows — offer  : admin_config.offer_timeout_hours (+
--        offer_notif_1/2_hours_before, auto_complete_hours, etc.)
--   2. Countdown windows — pickup : admin_config.pickup_window_hours  ← NEW
--   3. Grace period length        : admin_config.grace_period_days (canonical;
--        sp_config.grace_period_days is the legacy duplicate — see BP-11)
--   4. Payout buffer              : admin_config.payout_buffer_days   ← NEW
--   5. SP caps/multipliers/category: categories.sp_earning_multiplier /
--        sp_spending_cap_percent (per-category, admin-editable)
--   6. Tax rates per node/category: nodes.tax_rate / category_tax_rules
--        (+ admin_config.default_sales_tax_rate)
--   Buyer/seller fee parameters   : admin_config (fees category) —
--        platform_fee_* / transaction_fee_* / payout_fee_*
--
-- RULES applied:
--   - Read-Before-Write: never overwrite an existing admin_config row
--     (ON CONFLICT DO NOTHING) so admin edits are preserved across replays.
--   - Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
--   - One read helper (no duplicate of fn_admin_config_safe_int / sp_config_int).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: Seed the two missing N1 config keys
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  (
    'pickup_window_hours',
    '72',
    'Pickup countdown window (hours). Shared dependency for pickup-deadline requirements: how long a buyer has to confirm pickup/meetup once a trade is ready before auto-expiry or a reminder fires. Range 1–168. Currently a tunable config key; enforcement wiring lands with the R-requirement that introduces pickup deadlines.',
    'trade',
    'number',
    true
  ),
  (
    'payout_buffer_days',
    '2',
    'Payout buffer (days). Shared dependency for payout requirements: how long a completed trade payout sits as a buffer before it is released to the seller. Range 0–30 (0 = release immediately). Enforcement wiring lands with the payout R-requirement.',
    'fees',
    'number',
    true
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- BLOCK 2: Typed read helper — the canonical way R1–R13 read an integer
--          admin_config value. Returns p_default (or NULL) when the key is
--          missing/inactive/unparseable so the caller can fail loud (BP-28)
--          instead of silently using a hardcoded number.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_config_int(
  p_key TEXT,
  p_default INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
BEGIN
  SELECT ac.value INTO v_raw
  FROM public.admin_config ac
  WHERE ac.key = p_key
    AND ac.is_active = TRUE
  LIMIT 1;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN p_default;
  END IF;

  -- Reuse the existing sanitizer so we never double-own the parse logic.
  RETURN public.fn_admin_config_safe_int(v_raw, p_default);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_config_int(TEXT, INTEGER) TO anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION (run one statement at a time — result-granularity rule):
--
-- 1) New keys seeded:
--    SELECT key, value, category, data_type, is_active
--    FROM public.admin_config
--    WHERE key IN ('pickup_window_hours', 'payout_buffer_days');
--    -- Expected: 2 rows, category 'trade'/'fees', data_type 'number', active.
--
-- 2) Typed read helper works (active key):
--    SELECT public.fn_admin_config_int('offer_timeout_hours', 48);
--    -- Expected: 48 (or the admin-edited value).
--
-- 3) Missing key returns the default (no crash, caller decides):
--    SELECT public.fn_admin_config_int('definitely_not_a_key', 7);
--    -- Expected: 7.
-- ============================================================================
