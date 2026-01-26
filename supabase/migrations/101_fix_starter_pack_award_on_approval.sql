-- Migration 101: Fix starter pack awarding on listing approval
-- Mode: Idempotent rerunnable migration
-- Purpose:
--  1) Fix is_active_subscriber() to match subscriptions schema (no end_date, supports trial/grace)
--  2) Make issue_starter_pack() initialize wallet if missing
--  3) Update admin_approve_listing() to award starter pack on eligible approval (non-blocking)

-- BLOCK 1 — Schema (RPC updates)

CREATE OR REPLACE FUNCTION public.is_active_subscriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trial', 'trialing', 'grace')
      AND (
        (s.status IN ('trial', 'trialing') AND (s.trial_end_date IS NULL OR s.trial_end_date > NOW()))
        OR
        (s.status IN ('active', 'grace') AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_starter_pack(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 3. Get starter pack config
  SELECT (c.config_value)::INTEGER
    INTO v_sp_amount
  FROM public.sp_config c
  WHERE c.config_key = 'starter_pack_amount';

  IF v_sp_amount IS NULL OR v_sp_amount <= 0 THEN
    v_sp_amount := 10; -- Default fallback
  END IF;

  -- 4. Get expiration config
  SELECT (c.config_value)::INTEGER
    INTO v_expiration_days
  FROM public.sp_config c
  WHERE c.config_key = 'expiration_period_days';

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

CREATE OR REPLACE FUNCTION public.admin_approve_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing RECORD;
  v_seller_id UUID;
  v_eligible_for_sp BOOLEAN;
  v_is_admin BOOLEAN;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
BEGIN
  -- 1. Verify admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_user_id
      AND rbac.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can approve listings'
    );
  END IF;

  -- 2. Get listing details
  SELECT * INTO v_listing
  FROM public.items i
  WHERE i.id = p_listing_id;

  IF v_listing IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing not found'
    );
  END IF;

  v_seller_id := v_listing.seller_id;

  -- 3. Check if already approved
  IF v_listing.status = 'available' AND v_listing.approved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing is already approved'
    );
  END IF;

  -- 4. Check starter pack eligibility
  SELECT public.is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  -- 5. Approve listing
  UPDATE public.items i
  SET
    status = 'available',
    approved_at = NOW(),
    approved_by = p_admin_user_id,
    eligible_for_starter_pack = v_eligible_for_sp,
    updated_at = NOW()
  WHERE i.id = p_listing_id;

  -- 5b. Award Starter Pack SP when eligible (do not block approval if awarding fails)
  IF v_eligible_for_sp AND COALESCE(v_listing.accepts_swap_points, FALSE) THEN
    SELECT public.issue_starter_pack(v_seller_id, p_listing_id) INTO v_starter_pack_result;
    IF COALESCE((v_starter_pack_result->>'success')::BOOLEAN, FALSE) THEN
      v_starter_pack_awarded := TRUE;
      UPDATE public.items i
      SET
        starter_pack_claimed = TRUE,
        starter_pack_claimed_at = NOW(),
        updated_at = NOW()
      WHERE i.id = p_listing_id;
    END IF;
  END IF;

  -- 6. Log admin action
  INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    p_admin_user_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'eligible_for_starter_pack', v_eligible_for_sp,
      'starter_pack_awarded', v_starter_pack_awarded,
      'listing_title', v_listing.title
    ),
    p_reason
  );

  -- 7. Create admin notification if starter pack eligible
  IF v_eligible_for_sp THEN
    INSERT INTO public.admin_notifications (admin_id, notification_type, entity_type, entity_id, title, message)
    SELECT
      au.id,
      'listing_starter_pack_eligible',
      'item',
      p_listing_id,
      'Listing Eligible for Starter Pack',
      FORMAT('Listing "%s" by seller %s is eligible for Starter Pack reward', v_listing.title, v_seller_id::TEXT)
    FROM public.role_based_access_control rbac
    JOIN auth.users au ON au.id = rbac.user_id
    WHERE rbac.role = 'admin'
      AND rbac.user_id <> p_admin_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'status', 'available',
    'eligible_for_starter_pack', v_eligible_for_sp,
    'starter_pack_awarded', v_starter_pack_awarded,
    'approved_at', NOW(),
    'message', CASE
      WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN 'Listing approved! Starter Pack awarded to seller.'
      WHEN v_eligible_for_sp THEN 'Listing approved! Seller is eligible for Starter Pack reward.'
      ELSE 'Listing approved (seller not eligible for Starter Pack - check subscription status)'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- BLOCK 2 — Security + Performance (permissions)
GRANT EXECUTE ON FUNCTION public.is_active_subscriber(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_starter_pack(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_listing(UUID, UUID, TEXT) TO authenticated;

-- Verification queries (run after approval):
-- SELECT public.admin_approve_listing('<LISTING_ID>'::uuid, '<ADMIN_ID>'::uuid, 'approve');
-- SELECT user_id, available_balance, starter_pack_issued FROM public.sp_wallets WHERE user_id = '<SELLER_ID>'::uuid;
-- SELECT transaction_type, amount, related_listing_id FROM public.sp_ledger WHERE user_id = '<SELLER_ID>'::uuid ORDER BY created_at DESC LIMIT 5;
