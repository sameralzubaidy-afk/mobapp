-- =============================================================================
-- Migration: 20260821000002_admin_approve_flagged_listing.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Complete the flagged-queue approval path (product decision
--          2026-08-21). The flagged-items moderation queue (/items/flagged +
--          Action Center flagged_items) historically approved via a direct
--          service-role `items.update` from /api/admin/items/[id]/status, which
--          (unlike admin_approve_listing) never set approved_at/approved_by,
--          never wrote an admin_activity_log row, and never notified the seller.
--
-- This migration adds a dedicated RPC, admin_approve_flagged_listing(...), that
-- performs a COMPLETE approval for flagged-queue items:
--   * sets status='available' + approved_at/approved_by
--   * clears flagged/rejected/appeal fields
--   * writes an admin_activity_log entry (records the human override)
--   * fires the seller "Listing Approved" notification
--   * INTENTIONALLY bypasses the R8 AI-moderation gate — a human has already
--     reviewed the flagged listing and is overriding the flag; the R8 gate would
--     otherwise hard-block every flagged item (MODERATION_BLOCKED_FLAGGED). The
--     override is recorded explicitly in the audit log.
--   * scoped to items currently in flagged/rejected/needs_edits, so it cannot
--     accidentally bypass the gate on a pending item (use admin_approve_listing
--     for the pending approval flow).
--
-- New function (not a redefinition) — no BP-12 DROP needed.
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

  -- 5. Approve. The R8 AI-moderation gate is INTENTIONALLY not enforced here:
  --    the item is in the review queue because an image was flagged, and a
  --    human admin has now reviewed it and is overriding that flag. The
  --    override is recorded in admin_activity_log below.
  UPDATE public.items i
  SET
    status = 'available',
    approved_at = NOW(),
    approved_by = p_admin_user_id,
    flagged_at = NULL,
    rejected_at = NULL,
    rejection_reason = NULL,
    appealed_at = NULL,
    appeal_reason = NULL,
    edited_since_rejection = FALSE,
    edited_since_rejection_at = NULL,
    updated_at = NOW()
  WHERE i.id = p_listing_id;

  -- 6. Audit log (records the human override + which admin approved)
  INSERT INTO public.admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    p_admin_user_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'listing_title', v_listing.title,
      'source', 'flagged_queue',
      'moderation_gate', 'overridden_by_admin_review'
    ),
    COALESCE(p_reason, 'Approved from flagged queue (human override of AI moderation)')
  );

  -- 7. Notify the seller their listing was approved (honors notification
  --    preferences; a failure never blocks approval).
  v_notification_body := FORMAT('Your listing "%s" was approved and is now live.', v_listing.title);

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
    'approved_at', NOW(),
    'message', 'Listing approved from flagged queue.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.admin_approve_flagged_listing(UUID, UUID, TEXT) IS
  'Flagged-queue approval (human override): sets approved_at/approved_by, clears '
  'flagged/rejected/appeal fields, writes admin_activity_log, and notifies the '
  'seller (listing_approved). Intentionally bypasses the R8 AI-moderation gate '
  '(the human has reviewed/overridden the flag); the override is audited. '
  'Restricted to items currently in flagged/rejected/needs_edits.';

GRANT EXECUTE ON FUNCTION public.admin_approve_flagged_listing(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_flagged_listing(UUID, UUID, TEXT) TO service_role;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Function exists:
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'admin_approve_flagged_listing';

-- 2. Approve a flagged fixture item as an admin, then confirm:
--    - items row: status='available', approved_at/approved_by set, flagged fields cleared
--    - admin_activity_log row created (action_type='approve_listing', details->>'source'='flagged_queue')
--    - user_notifications row type='listing_approved' created for the seller
