-- filepath: supabase/migrations/20260111000000_badge_admin_config.sql
-- TASK: BADGES-V2-005 - Admin Configuration Schema & History

-- =============================================================================
-- 1. Extend badges table with additional admin fields
-- =============================================================================

-- Add new columns to badges table (is_active and sort_order already exist from 20260110000000_badges_v2.sql)
ALTER TABLE badges
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on is_archived for faster filtering
CREATE INDEX IF NOT EXISTS idx_badges_is_archived ON badges(is_archived);
CREATE INDEX IF NOT EXISTS idx_badges_is_active ON badges(is_active);

-- =============================================================================
-- 2. Create badge_config_history table for versioning
-- =============================================================================

CREATE TABLE IF NOT EXISTS badge_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who made the change
  old_threshold INT,
  new_threshold INT,
  old_name TEXT,
  new_name TEXT,
  old_description TEXT,
  new_description TEXT,
  old_is_active BOOLEAN,
  new_is_active BOOLEAN,
  change_type TEXT NOT NULL CHECK (change_type IN ('threshold', 'name', 'description', 'is_active', 'multiple')),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on badge_config_history
ALTER TABLE badge_config_history ENABLE ROW LEVEL SECURITY;

-- Admin can view all config history
DROP POLICY IF EXISTS "Admins can view config history" ON badge_config_history;
CREATE POLICY "Admins can view config history" ON badge_config_history
  FOR SELECT USING (is_admin());

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_badge_config_history_badge ON badge_config_history(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_config_history_admin ON badge_config_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_badge_config_history_changed_at ON badge_config_history(changed_at DESC);

-- =============================================================================
-- 3. Create badge_audit_logs table for manual awards/revokes
-- =============================================================================

CREATE TABLE IF NOT EXISTS badge_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User receiving the action
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin performing the action
  action_type TEXT NOT NULL CHECK (action_type IN ('manual_award', 'manual_revoke', 'config_change', 'bulk_award')),
  reason TEXT,
  metadata JSONB, -- Additional context (e.g., {"old_threshold": 100, "new_threshold": 50})
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on badge_audit_logs
ALTER TABLE badge_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON badge_audit_logs;
CREATE POLICY "Admins can view audit logs" ON badge_audit_logs
  FOR SELECT USING (is_admin());

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_badge_audit_logs_badge ON badge_audit_logs(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_audit_logs_user ON badge_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_audit_logs_admin ON badge_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_badge_audit_logs_action_type ON badge_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_badge_audit_logs_created_at ON badge_audit_logs(created_at DESC);

-- =============================================================================
-- 4. Create trigger to track badge config changes
-- =============================================================================

CREATE OR REPLACE FUNCTION track_badge_config_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_change_type TEXT;
  v_changes INT := 0;
BEGIN
  -- Get admin user ID from current auth context
  v_admin_id := auth.uid();
  
  -- Skip if no admin context (system changes)
  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine change type
  IF OLD.threshold IS DISTINCT FROM NEW.threshold THEN
    v_changes := v_changes + 1;
  END IF;
  
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changes := v_changes + 1;
  END IF;
  
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changes := v_changes + 1;
  END IF;
  
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    v_changes := v_changes + 1;
  END IF;
  
  -- Set change_type
  IF v_changes > 1 THEN
    v_change_type := 'multiple';
  ELSIF OLD.threshold IS DISTINCT FROM NEW.threshold THEN
    v_change_type := 'threshold';
  ELSIF OLD.name IS DISTINCT FROM NEW.name THEN
    v_change_type := 'name';
  ELSIF OLD.description IS DISTINCT FROM NEW.description THEN
    v_change_type := 'description';
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    v_change_type := 'is_active';
  ELSE
    -- No tracked changes
    RETURN NEW;
  END IF;

  -- Insert into history
  INSERT INTO badge_config_history (
    badge_id,
    admin_id,
    old_threshold,
    new_threshold,
    old_name,
    new_name,
    old_description,
    new_description,
    old_is_active,
    new_is_active,
    change_type,
    changed_at
  ) VALUES (
    NEW.id,
    v_admin_id,
    OLD.threshold,
    NEW.threshold,
    OLD.name,
    NEW.name,
    OLD.description,
    NEW.description,
    OLD.is_active,
    NEW.is_active,
    v_change_type,
    NOW()
  );

  -- Update updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_track_badge_config_changes ON badges;
CREATE TRIGGER trigger_track_badge_config_changes
BEFORE UPDATE ON badges
FOR EACH ROW
EXECUTE FUNCTION track_badge_config_changes();

-- =============================================================================
-- 5. Create RPC for manual badge award (admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION manual_award_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_badge RECORD;
  v_existing_badge RECORD;
BEGIN
  -- Get admin user ID
  v_admin_id := auth.uid();
  
  -- Verify admin privileges
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_admin_id AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Verify badge exists
  SELECT * INTO v_badge FROM badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  -- Check if user already has this badge
  SELECT * INTO v_existing_badge
  FROM user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User already has this badge',
      'badge_id', p_badge_id
    );
  END IF;

  -- Award the badge
  INSERT INTO user_badges (user_id, badge_id, awarded_at)
  VALUES (p_user_id, p_badge_id, NOW());

  -- Log the manual award
  INSERT INTO badge_audit_logs (
    badge_id,
    user_id,
    admin_id,
    action_type,
    reason,
    metadata,
    created_at
  ) VALUES (
    p_badge_id,
    p_user_id,
    v_admin_id,
    'manual_award',
    p_reason,
    jsonb_build_object(
      'badge_name', v_badge.name,
      'admin_action', true
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Badge awarded successfully',
    'badge_id', p_badge_id,
    'badge_name', v_badge.name
  );
END;
$$;

-- =============================================================================
-- 6. Create RPC for manual badge revoke (admin only)
-- =============================================================================

CREATE OR REPLACE FUNCTION manual_revoke_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_badge RECORD;
  v_deleted_count INT;
BEGIN
  -- Get admin user ID
  v_admin_id := auth.uid();
  
  -- Verify admin privileges
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_admin_id AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Verify badge exists
  SELECT * INTO v_badge FROM badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  -- Delete user badge
  DELETE FROM user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User does not have this badge'
    );
  END IF;

  -- Log the revocation
  INSERT INTO badge_audit_logs (
    badge_id,
    user_id,
    admin_id,
    action_type,
    reason,
    metadata,
    created_at
  ) VALUES (
    p_badge_id,
    p_user_id,
    v_admin_id,
    'manual_revoke',
    p_reason,
    jsonb_build_object(
      'badge_name', v_badge.name,
      'admin_action', true
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Badge revoked successfully',
    'badge_id', p_badge_id,
    'badge_name', v_badge.name
  );
END;
$$;

-- =============================================================================
-- 7. Create RPC to get badge config history
-- =============================================================================

CREATE OR REPLACE FUNCTION get_badge_config_history(
  p_badge_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  badge_id UUID,
  badge_name TEXT,
  admin_id UUID,
  admin_name TEXT,
  old_threshold INT,
  new_threshold INT,
  old_name TEXT,
  new_name TEXT,
  old_description TEXT,
  new_description TEXT,
  old_is_active BOOLEAN,
  new_is_active BOOLEAN,
  change_type TEXT,
  changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin privileges
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    bch.id,
    bch.badge_id,
    b.name AS badge_name,
    bch.admin_id,
    p.display_name AS admin_name,
    bch.old_threshold,
    bch.new_threshold,
    bch.old_name,
    bch.new_name,
    bch.old_description,
    bch.new_description,
    bch.old_is_active,
    bch.new_is_active,
    bch.change_type,
    bch.changed_at
  FROM badge_config_history bch
  JOIN badges b ON b.id = bch.badge_id
  LEFT JOIN profiles p ON p.user_id = bch.admin_id
  WHERE (p_badge_id IS NULL OR bch.badge_id = p_badge_id)
  ORDER BY bch.changed_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- 8. Create RPC to get badge audit logs
-- =============================================================================

CREATE OR REPLACE FUNCTION get_badge_audit_logs(
  p_user_id UUID DEFAULT NULL,
  p_badge_id UUID DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  badge_id UUID,
  badge_name TEXT,
  user_id UUID,
  user_name TEXT,
  admin_id UUID,
  admin_name TEXT,
  action_type TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin privileges
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    bal.id,
    bal.badge_id,
    b.name AS badge_name,
    bal.user_id,
    p_user.display_name AS user_name,
    bal.admin_id,
    p_admin.display_name AS admin_name,
    bal.action_type,
    bal.reason,
    bal.metadata,
    bal.created_at
  FROM badge_audit_logs bal
  LEFT JOIN badges b ON b.id = bal.badge_id
  LEFT JOIN profiles p_user ON p_user.user_id = bal.user_id
  LEFT JOIN profiles p_admin ON p_admin.user_id = bal.admin_id
  WHERE 
    (p_user_id IS NULL OR bal.user_id = p_user_id)
    AND (p_badge_id IS NULL OR bal.badge_id = p_badge_id)
    AND (p_action_type IS NULL OR bal.action_type = p_action_type)
  ORDER BY bal.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify badges table has new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'badges'
  AND column_name IN ('is_archived', 'updated_at', 'is_active', 'sort_order')
ORDER BY column_name;

-- Verify badge_config_history table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'badge_config_history'
ORDER BY ordinal_position;

-- Verify badge_audit_logs table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'badge_audit_logs'
ORDER BY ordinal_position;

-- Verify triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_track_badge_config_changes';

-- Verify RPCs exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'manual_award_badge',
  'manual_revoke_badge',
  'get_badge_config_history',
  'get_badge_audit_logs'
)
ORDER BY routine_name;
