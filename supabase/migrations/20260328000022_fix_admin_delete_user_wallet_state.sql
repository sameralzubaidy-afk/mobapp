-- Migration: Fix admin_delete_user wallet freeze column
-- Mode: Idempotent rerunnable migration (Mode B)
-- Issue: sp_wallets uses state column, not status

CREATE OR REPLACE FUNCTION admin_delete_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent admin from deleting themselves
  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Admin cannot delete their own account';
  END IF;

  -- Prevent empty reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is required';
  END IF;

  -- Soft delete the user
  UPDATE profiles
  SET
    deleted_at = now(),
    deleted_by = p_admin_id,
    deletion_reason = p_reason,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Freeze the SP wallet (if exists)
  UPDATE sp_wallets
  SET state = 'frozen'
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'delete_user', 'user', p_user_id::TEXT, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User deleted successfully (soft delete)'
  );
END;
$$;

-- Verification
-- SELECT admin_delete_user(
--   p_admin_id := '<admin_uuid>'::UUID,
--   p_user_id := '00000000-0000-0000-0000-00000000dead'::UUID,
--   p_reason := 'smoke test delete rpc'
-- );
