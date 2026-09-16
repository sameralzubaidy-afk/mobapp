-- =============================================================================
-- Migration: Dev Task 59 (Revision 2) — Systemic Grant Sweep (catch-all)
-- File: identity-fix portion (auth.uid()-derived identity for functions with a
--       legitimate user-JWT caller)
-- Date: 2026-08-30
-- Mode: Idempotent Rerunnable (Mode B) — CREATE OR REPLACE + REVOKE/GRANT are
--       safe to re-run.
--
-- Context: this is the second half of Dev Task 59. File
-- 20260830000011 handled the grant-only lockdowns (functions with NO user-JWT
-- caller). THIS file fixes functions that MUST stay callable by a user JWT
-- (mobile app or admin-portal browser), by deriving the real caller identity
-- from auth.uid() instead of trusting a self-declared p_user_id / p_admin_user_id
-- parameter. Pattern per DT-57:
--     v_actor_id := COALESCE(auth.uid(), p_user_id);
--       - user-JWT calls: auth.uid() is the real caller and takes precedence,
--         so a self-declared id can never be spoofed;
--       - service_role calls (EFs verified the JWT server-side): auth.uid() is
--         NULL -> the parameter is used (trusted backend credential only).
--
-- Caller analysis (verified 2026-08-30):
--   * upsert_admin_config_setting — admin portal settings pages call it from the
--     BROWSER with the admin's user JWT (p2p-kids-admin/src/app/settings/*);
--     the /config hub API route calls it with service role. Both must keep
--     working -> gate on admin_has_role(auth.uid()) OR service_role.
--   * admin_approve_listing / admin_approve_flagged_listing — admin portal
--     ListingSearch.tsx calls from the BROWSER with the admin's user JWT.
--   * request_seller_payout / initialize_sp_wallet / ensure_sp_wallet_exists /
--     set_primary_payout_method / apply_referral_code / apply_tax_to_trade /
--     create_trial_subscription / upgrade_free_subscription_to_trial /
--     create_free_subscription — mobile app, user JWT.
--   * refund_tax — mobile service function exists (src/services/tax.ts) though
--     only exercised by tests; keep authenticated + party check.
--
-- Rollback (one-line reverse per function): re-apply the previous migration
-- definition (referenced in each section) and restore the prior grants.
-- =============================================================================

-- =============================================================================
-- 1. upsert_admin_config_setting (7-arg, shared write path — BP-48)
--    Previous: 20260808000001_settings_single_source_audit.sql
--    Problem: SECURITY DEFINER writing admin_config (every money/fee/tax/payout
--    lever) with NO admin check, granted to anon + authenticated + service_role.
--    anon could overwrite any money lever. Fix: gate on service_role OR
--    admin_has_role(auth.uid()) (real identity); REVOKE anon.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_admin_config_setting(
  p_key TEXT,
  p_value TEXT,
  p_category public.admin_config_category,
  p_data_type TEXT DEFAULT 'string',
  p_is_secret BOOLEAN DEFAULT FALSE,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
  out_id BIGINT,
  out_key TEXT,
  out_value TEXT,
  out_category public.admin_config_category,
  out_data_type TEXT,
  out_is_secret BOOLEAN,
  out_is_active BOOLEAN,
  out_updated_at TIMESTAMP WITH TIME ZONE,
  out_updated_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
BEGIN
  -- DT59: admin_config holds every money lever (fees, caps, payout enable,
  -- trial/grace, tax rates, min price). Only service_role (admin API routes,
  -- x-admin-secret-verified) or an authenticated admin (browser, real
  -- auth.uid()) may write. current_setting('role') — NOT request.jwt.claim.role
  -- (never set by this PostgREST, DT-57).
  v_actor_role := COALESCE(current_setting('role', true), '');
  IF v_actor_role <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.admin_has_role(auth.uid())) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only admins or service_role can update configuration';
  END IF;

  RETURN QUERY
  INSERT INTO public.admin_config (
    key,
    value,
    category,
    data_type,
    is_secret,
    is_active,
    updated_at,
    updated_by
  )
  VALUES (
    p_key,
    p_value,
    p_category,
    p_data_type,
    p_is_secret,
    p_is_active,
    NOW(),
    p_admin_id
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    data_type = EXCLUDED.data_type,
    is_secret = EXCLUDED.is_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW(),
    -- Never wipe the recorded editor when p_admin_id is absent (e.g. a legacy
    -- 6-arg/system caller). COALESCE keeps the previous editor intact.
    updated_by = COALESCE(p_admin_id, admin_config.updated_by)
  RETURNING
    admin_config.id,
    admin_config.key,
    admin_config.value,
    admin_config.category,
    admin_config.data_type,
    admin_config.is_secret,
    admin_config.is_active,
    admin_config.updated_at,
    admin_config.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_admin_config_setting(text, text, public.admin_config_category, text, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_admin_config_setting(text, text, public.admin_config_category, text, boolean, boolean, uuid) TO authenticated, service_role;

-- =============================================================================
-- 2. admin_approve_listing — admin check on the REAL caller (auth.uid()),
--    never the self-declared p_admin_user_id. Previous: 20260821000003.
--    Browser admin path (ListingSearch.tsx) sends the admin's real JWT, so
--    auth.uid() = the actual admin and approval keeps working; a non-admin
--    authenticated user can no longer spoof a known admin UUID.
-- =============================================================================
CREATE OR REPLACE FUNCTION admin_approve_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_seller_id UUID;
  v_eligible_for_sp BOOLEAN;
  v_is_admin BOOLEAN;
  v_admin_id UUID;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
  v_gate JSONB;
  v_gate_status TEXT;
  v_notification_body TEXT;
BEGIN
  -- DT59: derive the acting admin from the real caller. User-JWT (browser admin
  -- path) -> auth.uid() wins; service_role (future API route) -> p_admin_user_id.
  v_admin_id := COALESCE(auth.uid(), p_admin_user_id);
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can approve listings');
  END IF;

  -- 1. Verify admin role against the REAL caller identity
  SELECT EXISTS (
    SELECT 1 FROM role_based_access_control
    WHERE user_id = v_admin_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can approve listings'
    );
  END IF;

  -- 1b. R8 image-moderation approval gate: a listing cannot be approved until
  --     every uploaded image has an 'approved' Google Vision decision, unless
  --     AI moderation is disabled by admin config (status 'disabled').
  SELECT public.get_listing_moderation_gate(p_listing_id) INTO v_gate;
  v_gate_status := v_gate->>'status';

  IF v_gate_status = 'flagged' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MODERATION_BLOCKED_FLAGGED',
      'error', 'Listing cannot be approved: one or more images were flagged by AI moderation. Reject the listing or ask the seller to replace the flagged image.',
      'moderation', v_gate
    );
  ELSIF v_gate_status = 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MODERATION_IN_PROGRESS',
      'error', 'Listing cannot be approved yet: AI moderation is still reviewing its images. Try again shortly.',
      'moderation', v_gate
    );
  END IF;

  -- 2. Get listing details
  SELECT * INTO v_listing FROM items WHERE id = p_listing_id;

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
  SELECT is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  -- 5. Approve listing
  UPDATE items
  SET
    status = 'available',
    approved_at = NOW(),
    approved_by = v_admin_id,
    eligible_for_starter_pack = v_eligible_for_sp,
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- 5b. Award Starter Pack SP when eligible (shared helper; non-blocking).
  v_starter_pack_result := public.apply_starter_pack_on_approval(
    v_admin_id,
    v_seller_id,
    p_listing_id,
    v_eligible_for_sp
  );
  v_starter_pack_awarded := COALESCE((v_starter_pack_result->>'awarded')::BOOLEAN, FALSE);

  -- 6. Log admin action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    v_admin_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'eligible_for_starter_pack', v_eligible_for_sp,
      'listing_title', v_listing.title,
      'image_moderation', v_gate
    ),
    p_reason
  );

  -- 8. Notify the seller their listing was approved.
  v_notification_body := CASE
    WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN FORMAT('Your listing "%s" was approved and your Starter Pack reward has been applied.', v_listing.title)
    ELSE FORMAT('Your listing "%s" was approved and is now live.', v_listing.title)
  END;

  BEGIN
    PERFORM public.create_system_notification_with_preferences(
      v_seller_id,
      'listing_approved',
      'Listing Approved',
      v_notification_body,
      jsonb_build_object(
        'listing_id', p_listing_id::TEXT,
        'item_id', p_listing_id::TEXT,
        'item_title', COALESCE(v_listing.title, ''),
        'status', 'available',
        'deep_link', '/listing/' || p_listing_id::TEXT,
        'type', 'listing_approved'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'admin_approve_listing: seller notification failed for listing=%: %', p_listing_id, SQLERRM;
  END;

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

REVOKE EXECUTE ON FUNCTION public.admin_approve_listing(UUID, UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_listing(UUID, UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- 3. admin_approve_flagged_listing — same auth.uid()-derived admin check.
--    Previous: 20260821000003.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_flagged_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_seller_id UUID;
  v_is_admin BOOLEAN;
  v_admin_id UUID;
  v_eligible_for_sp BOOLEAN;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
  v_notification_body TEXT;
BEGIN
  -- DT59: acting admin derived from the real caller (auth.uid() wins).
  v_admin_id := COALESCE(auth.uid(), p_admin_user_id);
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can approve listings');
  END IF;

  -- 1. Verify admin role against the REAL caller identity
  SELECT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = v_admin_id AND rbac.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can approve listings'
    );
  END IF;

  -- 2. Get listing
  SELECT i.* INTO v_listing FROM public.items i WHERE i.id = p_listing_id;

  IF v_listing IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  v_seller_id := v_listing.seller_id;

  -- 3. Scope guard: this override path is ONLY for the flagged review queue.
  IF v_listing.status NOT IN ('flagged', 'rejected', 'needs_edits') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATUS_FOR_FLAGGED_APPROVAL',
      'error', 'admin_approve_flagged_listing may only approve items in the flagged/rejected/needs_edits review queue. Use admin_approve_listing for pending items (it enforces the AI-moderation gate).'
    );
  END IF;

  -- 4. Already approved?
  IF v_listing.status = 'available' AND v_listing.approved_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is already approved');
  END IF;

  -- 4b. Starter-pack eligibility (parity with admin_approve_listing).
  SELECT public.is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  -- 5. Approve (human override of the AI-moderation gate is intentional here).
  UPDATE public.items i
  SET
    status = 'available',
    approved_at = NOW(),
    approved_by = v_admin_id,
    eligible_for_starter_pack = v_eligible_for_sp,
    flagged_at = NULL,
    rejected_at = NULL,
    rejection_reason = NULL,
    appealed_at = NULL,
    appeal_reason = NULL,
    edited_since_rejection = FALSE,
    edited_since_rejection_at = NULL,
    updated_at = NOW()
  WHERE i.id = p_listing_id;

  -- 5b. Award Starter Pack SP when eligible (shared helper; non-blocking).
  v_starter_pack_result := public.apply_starter_pack_on_approval(
    v_admin_id,
    v_seller_id,
    p_listing_id,
    v_eligible_for_sp
  );
  v_starter_pack_awarded := COALESCE((v_starter_pack_result->>'awarded')::BOOLEAN, FALSE);

  -- 6. Audit log (records the human override + which admin approved)
  INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    v_admin_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'eligible_for_starter_pack', v_eligible_for_sp,
      'starter_pack_awarded', v_starter_pack_awarded,
      'listing_title', v_listing.title,
      'source', 'flagged_queue',
      'moderation_gate', 'overridden_by_admin_review'
    ),
    COALESCE(p_reason, 'Approved from flagged queue (human override of AI moderation)')
  );

  -- 7. Notify the seller their listing was approved.
  v_notification_body := CASE
    WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN FORMAT('Your listing "%s" was approved and your Starter Pack reward has been applied.', v_listing.title)
    ELSE FORMAT('Your listing "%s" was approved and is now live.', v_listing.title)
  END;

  BEGIN
    PERFORM public.create_system_notification_with_preferences(
      v_seller_id,
      'listing_approved',
      'Listing Approved',
      v_notification_body,
      jsonb_build_object(
        'listing_id', p_listing_id::TEXT,
        'item_id', p_listing_id::TEXT,
        'item_title', COALESCE(v_listing.title, ''),
        'status', 'available',
        'deep_link', '/listing/' || p_listing_id::TEXT,
        'type', 'listing_approved'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'admin_approve_flagged_listing: seller notification failed for listing=%: %', p_listing_id, SQLERRM;
  END;

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
      ELSE 'Listing approved from flagged queue (seller not eligible for Starter Pack - check subscription status)'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_flagged_listing(UUID, UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_flagged_listing(UUID, UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- 4. request_seller_payout — derive the seller from auth.uid().
--    Previous: 076_enforce_minimum_withdrawal_in_rpc.sql. Mobile calls with user
--    JWT; a self-declared p_user_id could withdraw another user's balance.
-- =============================================================================
CREATE OR REPLACE FUNCTION request_seller_payout(
  p_user_id UUID,
  p_amount_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_primary_method RECORD;
  v_payout_id UUID;
  v_payout_fee_cents INTEGER;
  v_net_amount_cents INTEGER;
  v_minimum_withdrawal_cents INTEGER;
  v_config_value TEXT;
  v_user_id UUID;
BEGIN
  -- DT59: the acting seller is the real caller (auth.uid() wins); a user JWT
  -- can never request a payout for another user. service_role callers pass the
  -- verified id. Fail closed on NULL (no caller identity -> nothing to withdraw).
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Fetch minimum withdrawal amount from admin_config (server-side validation)
  SELECT value INTO v_config_value
  FROM admin_config
  WHERE key = 'minimum_withdrawal_amount_cents'
    AND is_active = TRUE
  LIMIT 1;

  -- Default to 500 cents ($5.00) if not configured
  IF v_config_value IS NULL OR v_config_value = '' THEN
    v_minimum_withdrawal_cents := 500;
  ELSE
    v_minimum_withdrawal_cents := v_config_value::INTEGER;
  END IF;

  -- Validate minimum withdrawal amount (if minimum > 0)
  IF v_minimum_withdrawal_cents > 0 AND p_amount_cents < v_minimum_withdrawal_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Minimum withdrawal amount is $' || (v_minimum_withdrawal_cents / 100.0)::TEXT,
      'minimum_required', v_minimum_withdrawal_cents,
      'requested', p_amount_cents
    );
  END IF;

  -- 1. Get seller balance
  SELECT * INTO v_balance FROM seller_balance WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No balance found for this seller'
    );
  END IF;

  -- 2. Verify sufficient balance
  IF v_balance.available_balance_cents < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available', v_balance.available_balance_cents,
      'requested', p_amount_cents
    );
  END IF;

  -- 3. Get primary payout method
  SELECT * INTO v_primary_method
  FROM seller_payout_methods
  WHERE user_id = v_user_id AND is_primary = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No primary payout method configured',
      'action_required', 'add_payout_method'
    );
  END IF;

  -- 4. Verify payout method is verified
  IF NOT v_primary_method.is_verified THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Primary payout method is not verified',
      'action_required', 'verify_payout_method'
    );
  END IF;

  -- 5. Calculate payout fee based on method type
  CASE v_primary_method.method_type
    WHEN 'stripe_connect' THEN
      -- Stripe: $0.25 + 0.25%
      v_payout_fee_cents := 25 + ROUND(p_amount_cents * 0.0025);
    WHEN 'paypal', 'venmo' THEN
      -- PayPal/Venmo: 2% capped at $20
      v_payout_fee_cents := LEAST(ROUND(p_amount_cents * 0.02), 2000);
    WHEN 'bank_ach' THEN
      -- Bank ACH: $0.25 flat (placeholder for Post-MVP)
      v_payout_fee_cents := 25;
    ELSE
      v_payout_fee_cents := 0;
  END CASE;

  -- 6. Calculate net amount
  v_net_amount_cents := p_amount_cents - v_payout_fee_cents;

  IF v_net_amount_cents <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout amount too small after fees',
      'minimum_required', v_payout_fee_cents + 100
    );
  END IF;

  -- 7. Create payout record with 'processing' status (manual withdrawal)
  INSERT INTO seller_payouts (
    user_id,
    trade_id,
    payout_method_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    payout_fee_cents,
    net_amount_cents,
    status,
    provider,
    idempotency_key,
    initiated_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    NULL, -- This is a manual withdrawal, not tied to a single trade
    v_primary_method.id,
    'usd',
    p_amount_cents,
    0, -- Platform transaction fee is $0 per fee policy
    v_payout_fee_cents,
    v_net_amount_cents,
    'processing', -- Auto-dispatch to payment provider (no admin approval needed)
    CASE v_primary_method.method_type
      WHEN 'stripe_connect' THEN 'stripe'
      WHEN 'paypal' THEN 'paypal'
      WHEN 'venmo' THEN 'paypal'
      WHEN 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    'manual_withdrawal:' || v_user_id::TEXT || ':' || EXTRACT(EPOCH FROM NOW())::TEXT,
    NOW(), -- initiated_at set to NOW() (withdrawal started immediately)
    NOW(),
    NOW()
  ) RETURNING id INTO v_payout_id;

  -- 8. Deduct from available balance
  UPDATE seller_balance
  SET
    available_balance_cents = available_balance_cents - p_amount_cents,
    last_payout_at = NOW(),
    updated_at = NOW()
  WHERE user_id = v_user_id;

  -- 9. Return success with payout details
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount_cents', p_amount_cents,
    'payout_fee_cents', v_payout_fee_cents,
    'net_amount_cents', v_net_amount_cents,
    'method_type', v_primary_method.method_type,
    'status', 'processing',
    'message', 'Withdrawal request submitted and dispatched to payment provider'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_seller_payout(UUID, INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_seller_payout(UUID, INTEGER) TO authenticated, service_role;

-- =============================================================================
-- 5. initialize_sp_wallet — wallet creation keyed to the real caller.
--    Previous: 095_fix_sp_wallet_column_rename.sql. Mobile calls with user JWT
--    for the just-signed-up user (self); triggers/internal call as owner.
-- =============================================================================
CREATE OR REPLACE FUNCTION initialize_sp_wallet(p_user_id UUID)
RETURNS sp_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet sp_wallets;
  v_user_id UUID;
BEGIN
  -- DT59: the wallet owner is the real caller (auth.uid() wins); a user JWT
  -- cannot mint wallets for arbitrary users. Trigger/internal calls (owner
  -- context, auth.uid() NULL) fall back to p_user_id.
  v_user_id := COALESCE(auth.uid(), p_user_id);

  -- Check if wallet already exists
  SELECT * INTO v_wallet FROM sp_wallets WHERE user_id = v_user_id;

  IF FOUND THEN
    -- Just return existing wallet instead of failing
    RETURN v_wallet;
  END IF;

  -- Create SP wallet with zero balance ('state' is the canonical column name)
  INSERT INTO sp_wallets (
    user_id,
    state,
    available_balance,
    pending_balance,
    lifetime_earned,
    lifetime_spent,
    starter_pack_issued,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    'active',
    0,
    0,
    0,
    0,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initialize_sp_wallet(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_sp_wallet(UUID) TO authenticated, service_role;

-- =============================================================================
-- 6. ensure_sp_wallet_exists — same auth.uid() derivation.
--    Previous: 20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_sp_wallet_exists(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_user_id UUID;
BEGIN
  -- DT59: real caller identity wins (auth.uid()); internal calls (owner) fall
  -- back to p_user_id.
  v_user_id := COALESCE(auth.uid(), p_user_id);

  -- Try to get existing wallet
  SELECT w.id INTO v_wallet_id
  FROM public.sp_wallets AS w
  WHERE w.user_id = v_user_id;

  IF v_wallet_id IS NULL THEN
    -- Create new wallet if missing (insert only user_id so this works across
    -- schema versions, e.g. status->state rename).
    INSERT INTO public.sp_wallets (user_id)
    VALUES (v_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_sp_wallet_exists(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_sp_wallet_exists(UUID) TO authenticated, service_role;

-- =============================================================================
-- 7. apply_referral_code — referral linking keyed to the real caller.
--    Previous (newest): 20260811000003_referral_action_gating_and_notifications.sql.
--    Mobile applies its own code with user JWT; signup trigger (owner) calls with
--    the new user's id. A user JWT can no longer link ANOTHER user's profile.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_program_enabled BOOLEAN;
  v_clean_code TEXT;
  v_user_id UUID;
BEGIN
  -- DT59: the referred user is the real caller (auth.uid() wins). Trigger calls
  -- (owner, auth.uid() NULL) fall back to p_user_id = NEW.id.
  v_user_id := COALESCE(auth.uid(), p_user_id);

  v_clean_code := LOWER(TRIM(p_code));

  -- Program toggle — FAIL LOUD if the key is missing (no hardcoded default).
  v_program_enabled := public.sp_config_bool('referral_program_enabled');
  IF v_program_enabled IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_program_enabled');
  END IF;
  IF NOT v_program_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral program is disabled');
  END IF;

  -- Already referred?
  SELECT (p2.referred_by IS NOT NULL) INTO v_already_referred
  FROM public.profiles p2
  WHERE p2.user_id = v_user_id;

  IF v_already_referred THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already applied');
  END IF;

  -- Find referrer (case insensitive) — profiles first, then referral_codes.
  SELECT p2.user_id INTO v_referrer_id
  FROM public.profiles p2
  WHERE LOWER(p2.referral_code) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    SELECT rc.user_id INTO v_referrer_id
    FROM public.referral_codes rc
    WHERE LOWER(rc.code) = v_clean_code
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Link profile (idempotent).
  UPDATE public.profiles
  SET referred_by = v_referrer_id,
      referred_by_code = v_clean_code,
      updated_at = now()
  WHERE user_id = v_user_id AND referred_by IS NULL;

  -- Create pending referral — NO SP is awarded here (R12: action-gated).
  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    created_at
  )
  VALUES (
    v_referrer_id,
    v_user_id,
    v_clean_code,
    'pending',
    now()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'Applied (pending, no SP at signup)',
    jsonb_build_object('referee_id', v_user_id, 'referrer_id', v_referrer_id, 'code', v_clean_code));

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'status', 'pending',
    'points_awarded', 0,
    'message', 'Referral code applied. Rewards unlock after their first trade or approved listing.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', v_user_id, 'code', p_code));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- 8. set_primary_payout_method — method change keyed to the real caller.
--    Previous: 061_seller_payouts_helpers.sql. Mobile calls with user JWT.
-- =============================================================================
CREATE OR REPLACE FUNCTION set_primary_payout_method(
  p_user_id UUID,
  p_method_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- DT59: the acting user is the real caller (auth.uid() wins); a user JWT can
  -- only change their OWN primary payout method.
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify method belongs to user and is verified
  IF NOT EXISTS (
    SELECT 1 FROM seller_payout_methods
    WHERE id = p_method_id
    AND user_id = v_user_id
    AND is_verified = TRUE
  ) THEN
    RAISE EXCEPTION 'Payout method not found or not verified';
  END IF;

  -- Clear any existing primary for this user
  UPDATE seller_payout_methods
  SET is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = v_user_id
  AND is_primary = TRUE
  AND id != p_method_id;

  -- Set new primary
  UPDATE seller_payout_methods
  SET is_primary = TRUE,
      updated_at = NOW()
  WHERE id = p_method_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_primary_payout_method(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_payout_method(UUID, UUID) TO authenticated, service_role;

-- =============================================================================
-- 9. apply_tax_to_trade — party check (buyer/seller only for user-JWT calls).
--    Previous (newest): 20260801000001_fix_apply_tax_to_trade_category_aware.sql.
--    Mobile calls with the completing user's JWT; complete-trade flows.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_tax_to_trade(p_trade_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_rate DECIMAL(5,4);
  v_taxable_cents INTEGER;
  v_tax_cents INTEGER;
  v_jurisdiction TEXT;
  v_existing UUID;
  v_tax_category_id UUID;
  v_item_price_cents INTEGER;
  v_include_fee_in_base BOOLEAN;
  v_tax_result JSONB;
  v_tax_data JSONB;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','p_trade_id required'));
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','TRADE_NOT_FOUND','message','Trade does not exist'));
  END IF;

  -- DT59: a user JWT may only apply tax to a trade they are a party to. Service-
  -- role calls (auth.uid() NULL — complete-trade EF / admin) are unaffected.
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_trade.buyer_id AND auth.uid() <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHORIZED','message','Only the buyer or seller can apply tax to this trade'));
  END IF;

  SELECT id INTO v_existing FROM public.tax_records WHERE trade_id = p_trade_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
      'trade_id', p_trade_id, 'tax_record_id', v_existing,
      'tax_amount_cents', v_trade.tax_amount_cents,
      'taxable_amount_cents', v_trade.taxable_amount_cents,
      'tax_rate_applied', v_trade.tax_rate_applied,
      'tax_jurisdiction', v_trade.tax_jurisdiction,
      'idempotent_hit', true));
  END IF;

  -- Resolve the item's tax category + full price so the same category-aware rule
  -- (tax_exempt_goods => non-taxable) used by create-trade-offer is honored here.
  SELECT i.tax_category_id, (i.price * 100)::INTEGER
    INTO v_tax_category_id, v_item_price_cents
    FROM public.items i
   WHERE i.id = v_trade.listing_id
   LIMIT 1;

  -- BP-37: taxable base = full item price (SP is tender, not a discount).
  v_taxable_cents := COALESCE(v_item_price_cents, 0);
  SELECT (value::boolean) INTO v_include_fee_in_base
    FROM public.admin_config WHERE key = 'include_fee_in_tax_base' LIMIT 1;
  IF COALESCE(v_include_fee_in_base, false) THEN
    v_taxable_cents := v_taxable_cents + COALESCE(v_trade.buyer_transaction_fee_cents, 0);
  END IF;

  -- Category-aware calculation (legacy trades fall back to the flat node rate).
  v_tax_result := public.calculate_tax(
    v_trade.node_id,
    v_taxable_cents,
    v_tax_category_id,
    v_item_price_cents
  );

  IF (v_tax_result->>'success') <> 'true' THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','APPLY_TAX_ERROR','message','Tax calculation failed'));
  END IF;

  v_tax_data := v_tax_result->'data';
  v_tax_cents := (v_tax_data->>'tax_amount_cents')::INTEGER;
  v_rate := (v_tax_data->>'tax_rate')::DECIMAL(5,4);
  v_jurisdiction := v_tax_data->>'tax_jurisdiction';

  -- Only persist nonzero tax + rate; exempt trades stay clean (0 / NULL).
  UPDATE public.trades
     SET tax_amount_cents     = v_tax_cents,
         taxable_amount_cents = CASE WHEN v_tax_cents > 0 THEN v_taxable_cents ELSE 0 END,
         tax_rate_applied     = CASE WHEN v_tax_cents > 0 THEN v_rate ELSE NULL END,
         tax_jurisdiction     = CASE WHEN v_tax_cents > 0 THEN v_jurisdiction ELSE NULL END,
         updated_at           = NOW()
   WHERE id = p_trade_id;

  -- Exempt/zero-tax trades get NO tax_records row (tax reports treat as zero).
  IF v_tax_cents > 0 THEN
    INSERT INTO public.tax_records
      (trade_id, buyer_id, node_id, taxable_amount_cents, tax_rate, tax_amount_cents, tax_jurisdiction)
    VALUES
      (p_trade_id, v_trade.buyer_id, v_trade.node_id, v_taxable_cents, v_rate, v_tax_cents, v_jurisdiction)
    RETURNING id INTO v_existing;
  END IF;

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'trade_id', p_trade_id,
    'tax_record_id', v_existing,
    'tax_amount_cents', v_tax_cents,
    'taxable_amount_cents', CASE WHEN v_tax_cents > 0 THEN v_taxable_cents ELSE 0 END,
    'tax_rate_applied', CASE WHEN v_tax_cents > 0 THEN v_rate ELSE NULL END,
    'tax_jurisdiction', CASE WHEN v_tax_cents > 0 THEN v_jurisdiction ELSE NULL END,
    'idempotent_hit', false));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','APPLY_TAX_ERROR','message', SQLERRM));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_tax_to_trade(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_tax_to_trade(UUID) TO authenticated, service_role;

-- =============================================================================
-- 10. refund_tax — party check (buyer/seller only for user-JWT calls).
--    Previous: 20260510000004_tax_004_refund_tax_rpc.sql. Mobile service fn
--    exists (test-only today); keep authenticated with the party gate.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refund_tax(
  p_trade_id UUID, p_refund_amount_cents INTEGER, p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_already INTEGER;
  v_max_left INTEGER;
  v_buyer_id UUID;
  v_seller_id UUID;
BEGIN
  IF p_trade_id IS NULL OR p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','INVALID_INPUT','message','trade_id + positive refund_amount_cents required'));
  END IF;

  -- DT59: a user JWT may only refund tax on a trade they are a party to.
  -- Service-role calls (auth.uid() NULL — refund EFs / rpc_record_stripe_refund)
  -- are unaffected.
  SELECT t.buyer_id, t.seller_id INTO v_buyer_id, v_seller_id
    FROM public.trades t WHERE t.id = p_trade_id;
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_buyer_id AND auth.uid() <> v_seller_id THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHORIZED','message','Only the buyer or seller can refund tax on this trade'));
  END IF;

  SELECT * INTO v_record FROM public.tax_records WHERE trade_id = p_trade_id FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','NO_TAX_RECORD','message','No tax was collected for this trade'));
  END IF;
  v_already := COALESCE(v_record.refunded_tax_cents, 0);
  v_max_left := v_record.tax_amount_cents - v_already;
  IF p_refund_amount_cents > v_max_left THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','REFUND_EXCEEDS_COLLECTED',
        'message','Refund exceeds collected tax remaining',
        'details', jsonb_build_object('remaining_cents', v_max_left)));
  END IF;
  UPDATE public.tax_records
     SET refunded_tax_cents = v_already + p_refund_amount_cents,
         refund_reason      = COALESCE(p_reason, refund_reason),
         updated_at         = NOW()
   WHERE id = v_record.id;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'tax_record_id', v_record.id,
    'refunded_total', v_already + p_refund_amount_cents,
    'tax_amount_cents', v_record.tax_amount_cents,
    'remaining_cents', v_record.tax_amount_cents - (v_already + p_refund_amount_cents)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'error', jsonb_build_object('code','REFUND_TAX_ERROR','message', SQLERRM));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_tax(UUID, INTEGER, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_tax(UUID, INTEGER, TEXT) TO authenticated, service_role;

-- =============================================================================
-- 11. create_trial_subscription — trial start keyed to the real caller.
--    Previous: 20260312000000_sub_020_trial_limit_control.sql. Mobile calls
--    with user JWT; a user JWT can no longer start a trial for another user.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_trial_subscription(p_user_id UUID)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.subscriptions;
  v_trial_days INTEGER;
  v_user_id UUID;
BEGIN
  -- DT59: the trial belongs to the real caller (auth.uid() wins); internal calls
  -- (signup trigger / upgrade path, owner) fall back to p_user_id.
  v_user_id := COALESCE(auth.uid(), p_user_id);

  SELECT s.* INTO v_subscription
  FROM public.subscriptions s
  WHERE s.user_id = v_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT public.is_user_trial_eligible(v_user_id) THEN
    RAISE EXCEPTION 'TRIAL_LIMIT_REACHED: User % has reached the configured trial limit', v_user_id;
  END IF;

  v_trial_days := public.get_trial_duration_days();

  IF FOUND THEN
    IF v_subscription.status IN ('free', 'expired') THEN
      UPDATE public.subscriptions s
      SET status = 'trial',
          trial_start_date = NOW(),
          trial_end_date = NOW() + (v_trial_days || ' days')::INTERVAL,
          trial_used_at = COALESCE(s.trial_used_at, NOW()),
          trial_reminder_day_23_sent = FALSE,
          trial_reminder_day_28_sent = FALSE,
          trial_reminder_day_29_sent = FALSE,
          updated_at = NOW()
      WHERE s.id = v_subscription.id
      RETURNING s.* INTO v_subscription;

      PERFORM public.increment_trial_uses(v_user_id);

      RETURN v_subscription;
    END IF;

    RETURN v_subscription;
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    trial_used_at,
    stripe_customer_id,
    trial_reminder_day_23_sent,
    trial_reminder_day_28_sent,
    trial_reminder_day_29_sent,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    NOW(),
    NULL,
    FALSE,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  PERFORM public.increment_trial_uses(v_user_id);

  RETURN v_subscription;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_trial_subscription(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trial_subscription(UUID) TO authenticated, service_role;

-- =============================================================================
-- 12. upgrade_free_subscription_to_trial — delegate with real caller identity.
--    Previous: 20260312000000_sub_020_trial_limit_control.sql.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DT59: pass the real caller identity (auth.uid() wins) to create_trial_subscription.
  RETURN public.create_trial_subscription(COALESCE(auth.uid(), p_user_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upgrade_free_subscription_to_trial(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_free_subscription_to_trial(UUID) TO authenticated, service_role;

-- =============================================================================
-- 13. create_free_subscription — free-tier creation keyed to the real caller.
--    Previous: 20251220_free_subscription_creation.sql. Mobile calls with user
--    JWT post-signup (self); a user JWT can no longer create a sub for another.
-- =============================================================================
CREATE OR REPLACE FUNCTION create_free_subscription(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_user_id UUID;
BEGIN
  -- DT59: the subscription belongs to the real caller (auth.uid() wins).
  v_user_id := COALESCE(auth.uid(), p_user_id);

  -- Create free subscription (no trial)
  INSERT INTO subscriptions (
    user_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'id', v_subscription_id,
    'user_id', v_user_id,
    'status', 'free',
    'created_at', NOW(),
    'updated_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_free_subscription(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_free_subscription(UUID) TO authenticated, service_role;

-- =============================================================================
-- 14. increment_trial_uses — self-gate via auth.uid().
--    Previous: 20260312000000_sub_020_trial_limit_control.sql. Called by the
--    sub-020 E2E with a user JWT AND inside create_trial_subscription (owner).
--    A user JWT can only increment their OWN count (self-sabotage at worst).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_trial_uses(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
  v_user_id UUID;
BEGIN
  -- DT59: the real caller (auth.uid()) wins; internal calls (create_trial_subscription,
  -- owner context) fall back to p_user_id.
  v_user_id := COALESCE(auth.uid(), p_user_id);

  UPDATE public.profiles p
  SET trial_uses_count = COALESCE(p.trial_uses_count, 0) + 1,
      updated_at = NOW()
  WHERE p.user_id = v_user_id
  RETURNING p.trial_uses_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: profile missing for user %', v_user_id;
  END IF;

  INSERT INTO public.subscription_events (user_id, event_type, metadata, created_at)
  VALUES (
    v_user_id,
    'trial_uses_incremented',
    jsonb_build_object('trial_uses_count', v_new_count),
    NOW()
  );

  RETURN v_new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_trial_uses(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_trial_uses(UUID) TO authenticated, service_role;

-- =============================================================================
-- VERIFICATION QUERIES (run after apply; one statement per MCP call)
-- 1) Function bodies carry auth.uid()/admin/party gates and no broken GUC:
--    SELECT proname FROM pg_proc WHERE prosrc ILIKE '%request.jwt.claim.role%';
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('upsert_admin_config_setting','admin_approve_listing',
--      'admin_approve_flagged_listing','request_seller_payout','initialize_sp_wallet',
--      'ensure_sp_wallet_exists','apply_referral_code','set_primary_payout_method',
--      'apply_tax_to_trade','refund_tax','create_trial_subscription',
--      'upgrade_free_subscription_to_trial','create_free_subscription')
--      AND prosrc ILIKE '%auth.uid()%';
--    EXPECTED: every listed function contains auth.uid() (except
--    admin_reset_trial_uses which is in the companion file and uses
--    current_setting('role') instead).
-- 2) Grants for the 13 functions above = authenticated + service_role (no anon).
-- =============================================================================
