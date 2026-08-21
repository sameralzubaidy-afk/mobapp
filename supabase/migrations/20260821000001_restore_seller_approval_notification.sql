-- =============================================================================
-- Migration: 20260821000001_restore_seller_approval_notification.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Restore the seller "Listing Approved" notification in
--          admin_approve_listing(). The R8 rewrite
--          (20260811000001_r8_image_moderation_approval_gate.sql) redefined this
--          function to add the AI image-moderation gate but accidentally DROPPED
--          the create_system_notification_with_preferences(...) call that the
--          April migration (20260425000001_listing_approval_notifications.sql)
--          had added. Confirmed missing on staging via pg_get_functiondef
--          (2026-08-21).
--
-- What this migration does:
--   * Re-issues admin_approve_listing(UUID, UUID, TEXT) with the EXACT R8 body
--     (admin-role check, R8 moderation gate, starter-pack award, admin audit
--     log, admin notification) — nothing in the R8 logic is changed.
--   * Adds back the seller notification block (step 8) that the R8 rewrite
--     dropped: PERFORM public.create_system_notification_with_preferences(
--     seller_id, 'listing_approved', ...) honoring the seller's system
--     notification preferences, wrapped in a BEGIN/EXCEPTION guard so a
--     notification failure never blocks approval (matching the April version's
--     behavior).
--
-- Signature unchanged (UUID, UUID, TEXT) — no BP-12 DROP required.
-- =============================================================================

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

COMMENT ON FUNCTION admin_approve_listing(UUID, UUID, TEXT) IS
  'Approves a pending listing to available (blocked while AI image moderation is '
  'pending or when any image is flagged — MODERATION_BLOCKED_FLAGGED / '
  'MODERATION_IN_PROGRESS). Awards Starter Pack when eligible and notifies the '
  'seller via create_system_notification_with_preferences (restored '
  '20260821000001 after the R8 rewrite dropped it). Signature unchanged.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Confirm the notification call is present in the live definition (must
--    contain create_system_notification_with_preferences and v_notification_body).
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'admin_approve_listing';

-- 2. Approve a pending listing as an admin, then confirm a user_notifications
--    row of type 'listing_approved' was created for the seller:
--    SELECT public.admin_approve_listing('<listing-id>'::uuid, '<admin-user-id>'::uuid, 'approved in manual verification');
--    SELECT un.user_id, un.type, un.title, un.channels, un.data
--    FROM public.user_notifications un
--    WHERE un.type = 'listing_approved'
--    ORDER BY un.created_at DESC
--    LIMIT 5;
