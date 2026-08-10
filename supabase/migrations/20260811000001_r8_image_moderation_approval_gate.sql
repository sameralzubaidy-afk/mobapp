-- =============================================================================
-- Migration: 20260811000001_r8_image_moderation_approval_gate.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: R8 Core Trust & Safety — make Google Vision image moderation a hard
--          gate on admin listing approval. A listing whose uploaded images have
--          NOT all received an 'approved' AI-moderation decision cannot be
--          approved (unless AI moderation is disabled by admin config).
--
-- New objects:
--   * public.get_listing_moderation_gate(p_listing_id UUID) RETURNS JSONB
--        status: 'ok' | 'flagged' | 'pending' | 'disabled'
--   * public.admin_approve_listing(...)  — re-defined; now blocks approval when
--        gate status is 'flagged' (MODERATION_BLOCKED_FLAGGED) or 'pending'
--        (MODERATION_IN_PROGRESS). Signature unchanged (no BP-12 DROP needed).
--
-- Common failure modes:
--   - Matching ai_moderation_logs.image_url to item_images.url: both store the
--     public storage URL written at upload time (see listing.uploadListingImages).
--   - admin_config.moderation_ai_enabled missing row: COALESCE default TRUE
--     (BP-22) so the gate stays ON (fail-safe) rather than silently off.
--   - 'rejected' decision value: treated as flagged (not approvable).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Gate RPC (read-only, SECURITY DEFINER to read across tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_listing_moderation_gate(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER: must read item_images + ai_moderation_logs + admin_config
-- regardless of caller RLS. Search path pinned to public.
DECLARE
  v_moderation_enabled BOOLEAN;
  v_total_images INTEGER;
  v_approved INTEGER;
  v_flagged INTEGER;
  v_reviewed INTEGER;
  v_pending INTEGER;
  v_status TEXT;
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pending',
      'enforced', TRUE,
      'total_images', 0,
      'approved', 0,
      'flagged', 0,
      'pending', 0,
      'error', 'missing_listing_id'
    );
  END IF;

  -- AI moderation toggle. admin_config.key is UNIQUE, one row per key.
  -- COALESCE default TRUE so a missing row keeps the gate ON (BP-22).
  SELECT COALESCE(NULLIF(ac.value, '')::BOOLEAN, TRUE)
    INTO v_moderation_enabled
  FROM public.admin_config ac
  WHERE ac.key = 'moderation_ai_enabled'
    AND ac.is_active = TRUE;

  IF v_moderation_enabled IS NULL THEN
    v_moderation_enabled := TRUE;
  END IF;

  SELECT COUNT(*) INTO v_total_images
  FROM public.item_images ii
  WHERE ii.item_id = p_listing_id;

  -- Moderation disabled by admin -> gate is not enforced.
  IF NOT v_moderation_enabled THEN
    RETURN jsonb_build_object(
      'status', 'disabled',
      'enforced', FALSE,
      'total_images', v_total_images,
      'approved', 0,
      'flagged', 0,
      'pending', 0
    );
  END IF;

  -- No images to moderate -> nothing blocks approval.
  IF v_total_images = 0 THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'enforced', TRUE,
      'total_images', 0,
      'approved', 0,
      'flagged', 0,
      'pending', 0
    );
  END IF;

  -- Images with an explicit 'approved' decision (and not flagged).
  SELECT COUNT(*) INTO v_approved
  FROM public.item_images ii
  WHERE ii.item_id = p_listing_id
    AND EXISTS (
      SELECT 1 FROM public.ai_moderation_logs aml
      WHERE aml.item_id = ii.item_id
        AND aml.image_url = ii.url
        AND aml.decision = 'approved'
        AND aml.flagged = FALSE
    );

  -- Images with a flagged OR rejected decision (not approvable).
  SELECT COUNT(*) INTO v_flagged
  FROM public.item_images ii
  WHERE ii.item_id = p_listing_id
    AND EXISTS (
      SELECT 1 FROM public.ai_moderation_logs aml
      WHERE aml.item_id = ii.item_id
        AND aml.image_url = ii.url
        AND (aml.decision IN ('flagged', 'rejected') OR aml.flagged = TRUE)
    );

  v_reviewed := v_approved + v_flagged;
  v_pending := GREATEST(v_total_images - v_reviewed, 0);

  IF v_flagged > 0 THEN
    v_status := 'flagged';
  ELSIF v_pending > 0 THEN
    v_status := 'pending';
  ELSE
    v_status := 'ok';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'enforced', TRUE,
    'total_images', v_total_images,
    'approved', v_approved,
    'flagged', v_flagged,
    'pending', v_pending
  );
END;
$$;

COMMENT ON FUNCTION public.get_listing_moderation_gate(UUID) IS
  'R8: returns {status: ok|flagged|pending|disabled, enforced, ...} for a listing. '
  'Approval is blocked unless status is ok or disabled.';

GRANT EXECUTE ON FUNCTION public.get_listing_moderation_gate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_moderation_gate(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) admin_approve_listing — add the moderation gate (signature unchanged)
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

  -- 5b. Award Starter Pack SP when eligible (do not block approval if awarding fails)
  IF v_eligible_for_sp AND COALESCE(v_listing.accepts_swap_points, FALSE) THEN
    SELECT issue_starter_pack(v_seller_id, p_listing_id) INTO v_starter_pack_result;
    IF COALESCE((v_starter_pack_result->>'success')::BOOLEAN, FALSE) THEN
      v_starter_pack_awarded := TRUE;
      UPDATE items
      SET
        starter_pack_claimed = TRUE,
        starter_pack_claimed_at = NOW(),
        updated_at = NOW()
      WHERE id = p_listing_id;
    END IF;
  END IF;

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

  -- 7. Create admin notification if starter pack eligible
  IF v_eligible_for_sp THEN
    INSERT INTO admin_notifications (admin_id, notification_type, entity_type, entity_id, title, message)
    SELECT
      au.id,
      'listing_starter_pack_eligible',
      'item',
      p_listing_id,
      'Listing Eligible for Starter Pack',
      FORMAT('Listing "%s" by seller %s is eligible for Starter Pack reward', v_listing.title, v_seller_id::TEXT)
    FROM role_based_access_control rbac
    JOIN auth.users au ON au.id = rbac.user_id
    WHERE rbac.role = 'admin'
      AND rbac.user_id != p_admin_user_id; -- Don't notify the approver

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

COMMENT ON FUNCTION admin_approve_listing(UUID, UUID, TEXT) IS
  'R8: approves a pending listing to available. Blocks approval while AI image '
  'moderation is pending or when any image is flagged (returns code '
  'MODERATION_BLOCKED_FLAGGED / MODERATION_IN_PROGRESS). Signature unchanged.';

-- ---------------------------------------------------------------------------
-- 3) Verification queries
-- ---------------------------------------------------------------------------
-- A) Gate RPC exists.
-- SELECT p.proname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'get_listing_moderation_gate';
--
-- B) Gate RPC smoke test (returns a JSONB payload, not an error).
-- SELECT public.get_listing_moderation_gate('00000000-0000-0000-0000-000000000000');
--
-- C) admin_approve_listing still resolves with the same signature.
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'admin_approve_listing';
