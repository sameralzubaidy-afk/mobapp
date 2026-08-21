-- =============================================================================
-- Migration: 20260821000003_starter_pack_parity_shared_logic.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Starter-pack parity for the flagged-queue approval path (product
--          decision 2026-08-21: "approval is approval regardless of path").
--          admin_approve_flagged_listing (added 20260821000002) did not run the
--          starter-pack eligibility/award logic that admin_approve_listing has.
--          To avoid two copies that can drift apart (the way the notification
--          call did in R8), this migration:
--
--   1) Creates a single shared helper:
--        public.apply_starter_pack_on_approval(
--          p_actor_admin_id UUID, p_seller_id UUID, p_listing_id UUID,
--          p_eligible_for_sp BOOLEAN) RETURNS JSONB  -- {eligible, awarded}
--      which, when the seller is eligible, awards the Starter Pack via
--      issue_starter_pack (if the listing accepts Swap Points), marks the item
--      claimed, and notifies OTHER admins (listing_starter_pack_eligible) —
--      the exact behavior previously inlined in admin_approve_listing.
--
--   2) Re-issues admin_approve_listing(...) to CALL the shared helper instead
--      of its inline award + admin-notification blocks (behavior unchanged).
--
--   3) Re-issues admin_approve_flagged_listing(...) to compute eligibility,
--      stamp eligible_for_starter_pack on the item, and call the same helper —
--      giving the flagged-queue path full starter-pack parity.
--
-- Eligibility itself stays a single shared function (is_eligible_for_starter_pack)
-- called by both RPCs; the drift-prone award block now lives in ONE place.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Shared helper: apply starter pack on approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_starter_pack_on_approval(
  p_actor_admin_id UUID,
  p_seller_id UUID,
  p_listing_id UUID,
  p_eligible_for_sp BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepts_swap_points BOOLEAN;
  v_listing_title TEXT;
  v_award_result JSONB;
  v_awarded BOOLEAN := FALSE;
BEGIN
  -- Not eligible -> nothing to do.
  IF p_eligible_for_sp IS NOT TRUE THEN
    RETURN jsonb_build_object('eligible', FALSE, 'awarded', FALSE);
  END IF;

  -- Award only when the listing accepts Swap Points (non-blocking).
  SELECT i.accepts_swap_points, i.title
    INTO v_accepts_swap_points, v_listing_title
    FROM public.items i
   WHERE i.id = p_listing_id;

  IF COALESCE(v_accepts_swap_points, FALSE) THEN
    SELECT public.issue_starter_pack(p_seller_id, p_listing_id) INTO v_award_result;

    IF COALESCE((v_award_result->>'success')::BOOLEAN, FALSE) THEN
      UPDATE public.items i
         SET starter_pack_claimed = TRUE,
             starter_pack_claimed_at = NOW(),
             updated_at = NOW()
       WHERE i.id = p_listing_id;
      v_awarded := TRUE;
    END IF;
  END IF;

  -- Notify OTHER admins the listing is starter-pack eligible (parity with the
  -- standard approval path; excludes the acting admin).
  INSERT INTO public.admin_notifications (admin_id, notification_type, entity_type, entity_id, title, message)
  SELECT au.id,
         'listing_starter_pack_eligible',
         'item',
         p_listing_id,
         'Listing Eligible for Starter Pack',
         FORMAT('Listing "%s" by seller %s is eligible for Starter Pack reward', COALESCE(v_listing_title, ''), p_seller_id::TEXT)
    FROM public.role_based_access_control rbac
    JOIN auth.users au ON au.id = rbac.user_id
   WHERE rbac.role = 'admin'
     AND rbac.user_id IS DISTINCT FROM p_actor_admin_id;

  RETURN jsonb_build_object('eligible', TRUE, 'awarded', v_awarded);
END;
$$;

COMMENT ON FUNCTION public.apply_starter_pack_on_approval(UUID, UUID, UUID, BOOLEAN) IS
  'Shared Starter-Pack-on-approval logic used by both admin_approve_listing and '
  'admin_approve_flagged_listing (parity: approval is approval regardless of '
  'path). Returns {eligible, awarded}; awards via issue_starter_pack when the '
  'listing accepts Swap Points, marks the item claimed, and notifies other '
  'admins (listing_starter_pack_eligible). Non-blocking.';

GRANT EXECUTE ON FUNCTION public.apply_starter_pack_on_approval(UUID, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_starter_pack_on_approval(UUID, UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) admin_approve_listing — use the shared helper (behavior unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_approve_listing(
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
  v_gate JSONB;
  v_gate_status TEXT;
  v_notification_body TEXT;
BEGIN
  -- 1. Verify admin role
  SELECT EXISTS (
    SELECT 1 FROM role_based_access_control
    WHERE user_id = p_admin_user_id AND role = 'admin'
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
    approved_by = p_admin_user_id,
    eligible_for_starter_pack = v_eligible_for_sp,
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- 5b. Award Starter Pack SP when eligible (shared helper; non-blocking).
  --     The helper also notifies other admins (listing_starter_pack_eligible).
  v_starter_pack_result := public.apply_starter_pack_on_approval(
    p_admin_user_id,
    v_seller_id,
    p_listing_id,
    v_eligible_for_sp
  );
  v_starter_pack_awarded := COALESCE((v_starter_pack_result->>'awarded')::BOOLEAN, FALSE);

  -- 6. Log admin action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    p_admin_user_id,
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

  -- 8. Notify the seller their listing was approved. RESTORED by
  --    20260821000001 — the R8 rewrite (20260811000001) dropped this call.
  --    Honors the seller's system notification preferences (in-app + push);
  --    a notification failure never blocks approval.
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

-- ---------------------------------------------------------------------------
-- 3) admin_approve_flagged_listing — add starter-pack parity via shared helper
-- ---------------------------------------------------------------------------
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
  v_eligible_for_sp BOOLEAN;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
  v_notification_body TEXT;
BEGIN
  -- 1. Verify admin role
  SELECT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = p_admin_user_id AND rbac.role = 'admin'
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

  -- 4b. Starter-pack eligibility (parity with admin_approve_listing: approval is
  --     approval regardless of which queue it was approved through).
  SELECT public.is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  -- 5. Approve. The R8 AI-moderation gate is INTENTIONALLY not enforced here:
  --    the item is in the review queue because an image was flagged, and a
  --    human admin has now reviewed it and is overriding that flag. The
  --    override is recorded in admin_activity_log below.
  UPDATE public.items i
  SET
    status = 'available',
    approved_at = NOW(),
    approved_by = p_admin_user_id,
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

  -- 5b. Award Starter Pack SP when eligible (shared helper; non-blocking; also
  --     notifies other admins) — identical to the standard approval path.
  v_starter_pack_result := public.apply_starter_pack_on_approval(
    p_admin_user_id,
    v_seller_id,
    p_listing_id,
    v_eligible_for_sp
  );
  v_starter_pack_awarded := COALESCE((v_starter_pack_result->>'awarded')::BOOLEAN, FALSE);

  -- 6. Audit log (records the human override + which admin approved)
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
      'listing_title', v_listing.title,
      'source', 'flagged_queue',
      'moderation_gate', 'overridden_by_admin_review'
    ),
    COALESCE(p_reason, 'Approved from flagged queue (human override of AI moderation)')
  );

  -- 7. Notify the seller their listing was approved (honors notification
  --    preferences; a failure never blocks approval).
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

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Shared helper exists:
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'apply_starter_pack_on_approval';

-- 2. Both RPCs reference the shared helper (no inline award block):
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('admin_approve_listing', 'admin_approve_flagged_listing');

-- 3. Parity: approve one fixture item via each path and compare the resulting
--    DB state (items.eligible_for_starter_pack / starter_pack_claimed /
--    sp_wallets.starter_pack_issued) for sellers in the SAME eligibility state.
