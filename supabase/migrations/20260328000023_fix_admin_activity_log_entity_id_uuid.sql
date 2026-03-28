-- Migration: Fix admin action RPCs to write UUID entity_id into admin_activity_log
-- Mode: Idempotent rerunnable migration (Mode B)
-- Issue: admin_activity_log.entity_id is UUID, but RPCs inserted p_user_id::TEXT

-- ===============================================
-- RPC: admin_suspend_user
-- ===============================================
CREATE OR REPLACE FUNCTION admin_suspend_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Suspension reason is required';
  END IF;

  UPDATE profiles
  SET
    account_status = 'suspended',
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = p_reason,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'suspend_user', 'user', p_user_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User suspended successfully'
  );
END;
$$;

-- ===============================================
-- RPC: admin_unsuspend_user
-- ===============================================
CREATE OR REPLACE FUNCTION admin_unsuspend_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Unsuspension reason is required';
  END IF;

  UPDATE profiles
  SET
    account_status = 'active',
    suspended_at = NULL,
    suspended_by = NULL,
    suspension_reason = NULL,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'unsuspend_user', 'user', p_user_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User unsuspended successfully'
  );
END;
$$;

-- ===============================================
-- RPC: admin_delete_user
-- ===============================================
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
  IF NOT EXISTS (
    SELECT 1 FROM role_based_access_control rbac
    WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Admin cannot delete their own account';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is required';
  END IF;

  UPDATE profiles
  SET
    deleted_at = now(),
    deleted_by = p_admin_id,
    deletion_reason = p_reason,
    updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE sp_wallets
  SET state = 'frozen'
  WHERE user_id = p_user_id;

  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, notes)
  VALUES (p_admin_id, 'delete_user', 'user', p_user_id, p_reason);

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
