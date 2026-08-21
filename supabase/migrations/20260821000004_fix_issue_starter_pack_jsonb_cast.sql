-- =============================================================================
-- Migration: 20260821000004_fix_issue_starter_pack_jsonb_cast.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Fix a pre-existing bug in public.issue_starter_pack() that crashes
--          with "cannot cast jsonb string to type integer" (SQLSTATE 22023)
--          whenever sp_config.config_value is stored as a JSONB *string*
--          (e.g. 'starter_pack_amount' = "10") rather than a JSONB number.
--
--          Root cause: the function did
--            SELECT (c.config_value)::INTEGER FROM public.sp_config c ...
--          which fails on JSONB strings (PostgREST/seed writes can store
--          "10" as a JSON string). This blocked Starter-Pack awards for BOTH
--          approval paths (admin_approve_listing + admin_approve_flagged_listing)
--          on staging since 2026-08-21 parity verification.
--
--          Fix: use the repo's canonical safe reader public.sp_config_int(...)
--          (defined in 20260803000001_fix_referral_sp_config_jsonb_casts.sql;
--          `(config_value #>> '{}')::INTEGER` handles JSON string OR number and
--          returns NULL when the key is missing, so the existing default
--          fallbacks still apply). Nothing else in the function changes.
--
-- Signature unchanged (UUID, UUID) — no BP-12 DROP needed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.issue_starter_pack(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_wallet_id UUID;
  v_starter_pack_issued BOOLEAN;
  v_sp_amount INTEGER;
  v_batch_id UUID;
  v_ledger_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_subscriber BOOLEAN;
BEGIN
  -- 1. Check if user is active subscriber
  SELECT public.is_active_subscriber(p_user_id) INTO v_is_subscriber;

  IF NOT v_is_subscriber THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kids Club+ subscription required to earn Swap Points'
    );
  END IF;

  -- 2. Get wallet and check if starter pack already issued
  SELECT w.id, w.starter_pack_issued
    INTO v_wallet_id, v_starter_pack_issued
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    -- Attempt to initialize wallet (idempotent) then re-fetch.
    PERFORM public.initialize_sp_wallet(p_user_id);
    SELECT w.id, w.starter_pack_issued
      INTO v_wallet_id, v_starter_pack_issued
    FROM public.sp_wallets w
    WHERE w.user_id = p_user_id;

    IF v_wallet_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'SP wallet not found'
      );
    END IF;
  END IF;

  IF COALESCE(v_starter_pack_issued, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Starter pack already issued for this user'
    );
  END IF;

  -- 3. Get starter pack config via the canonical safe reader (handles JSONB
  --    string OR number forms; NULL when missing -> fallback below still applies).
  --    FIX 20260821000004: was `(c.config_value)::INTEGER` which crashed on a
  --    JSONB string value ("cannot cast jsonb string to type integer").
  v_sp_amount := public.sp_config_int('starter_pack_amount');

  IF v_sp_amount IS NULL OR v_sp_amount <= 0 THEN
    v_sp_amount := 10; -- Default fallback
  END IF;

  -- 4. Get expiration config via the canonical safe reader.
  v_expiration_days := public.sp_config_int('expiration_period_days');

  IF v_expiration_days IS NULL THEN
    v_expiration_days := 365; -- Default 1 year
  END IF;

  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 5. Create SP batch
  INSERT INTO public.sp_batches (
    wallet_id,
    user_id,
    initial_sp,
    remaining_sp,
    source_type,
    source_id,
    expires_at
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    v_sp_amount,
    v_sp_amount,
    'starter_pack',
    p_listing_id,
    v_expires_at
  )
  RETURNING id INTO v_batch_id;

  -- 6. Update wallet balance
  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance + v_sp_amount,
    lifetime_earned = w.lifetime_earned + v_sp_amount,
    starter_pack_issued = TRUE,
    starter_pack_issued_at = NOW(),
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  -- 7. Create ledger entry
  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_listing_id,
    related_batch_id,
    idempotency_key
  )
  SELECT
    v_wallet_id,
    p_user_id,
    'earn_starter_pack',
    v_sp_amount,
    w.available_balance - v_sp_amount,
    w.available_balance,
    'Starter Pack: First listing approved',
    p_listing_id,
    v_batch_id,
    'starter_pack_' || p_user_id::TEXT
  FROM public.sp_wallets w
  WHERE w.id = v_wallet_id
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'sp_awarded', v_sp_amount,
    'batch_id', v_batch_id,
    'ledger_entry_id', v_ledger_id,
    'expires_at', v_expires_at
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Confirm the function uses the safe reader (no fragile direct cast):
-- SELECT pg_get_functiondef(p.oid) LIKE '%sp_config_int%' AS uses_sp_config_int
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'issue_starter_pack';

-- 2. Confirm the config reader returns the amount for a JSON-string value:
-- SELECT public.sp_config_int('starter_pack_amount'), public.sp_config_int('expiration_period_days');

-- 3. Award smoke (eligible seller + SP-accepting fixture listing):
-- SELECT public.issue_starter_pack('<eligible-seller-id>', '<sp-listing-id>');
--    -> { success: true, sp_awarded: 10, batch_id, ledger_entry_id, expires_at }
