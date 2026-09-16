-- File: supabase/migrations/20251216100002_admin_config_trial_settings.sql
-- MODULE-12 ADMIN: Admin configuration table for trial period and feature toggles

-- =============================================================================
-- 1. CREATE admin_config TABLE - SUPERSEDED, intentionally skipped
-- =============================================================================
-- FIX-Task-40 phase 3. This file was written against an early
-- `admin_config(config_key, config_value, enabled, ...)` design that never
-- shipped. The CANONICAL table is created by 20250113_create_admin_config.sql
-- (`key`, `value`, `category`, `data_type`, `is_secret`, `is_active`, ...) and
-- that file sorts EARLIER, so on a chain-built or live database the CREATE below
-- was already a no-op and the two `config_key` indexes could not apply at all
-- ("column config_key does not exist") - which is why this migration never
-- reached staging (staging has no such migration row and no `config_key` column).
-- Verified against staging's captured fingerprint before removing anything:
--   * staging HAS `idx_admin_config_key` but on (key) - created by 20250113;
--   * staging has NO `idx_admin_config_enabled` (it has idx_admin_config_is_active);
--   * staging HAS `update_admin_config_updated_at()` and NO other migration
--     creates it, so that one object is RETAINED below (fidelity SUBSET).
-- Original legacy DDL removed: legacy admin_config CREATE TABLE + the
-- `config_key` / `enabled` indexes (see git history for the verbatim text).

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view and update config
-- NOTE: Admin role check should be done via auth.jwt() -> role = 'admin'
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
CREATE POLICY "Admins can view config"
  ON admin_config FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can update config" ON admin_config;
CREATE POLICY "Admins can update config"
  ON admin_config FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FIX-Task-40 phase 3: the trigger RE-POINT is intentionally skipped. Staging's
-- `admin_config_updated_at_trigger` executes `update_admin_config_timestamp()`
-- (created by 20250113_create_admin_config.sql); re-pointing it here would make the
-- replayed trigger definition diverge from the live one (fidelity rule 3, CONFLICT).
-- `update_admin_config_updated_at()` itself is still defined - staging carries it.
-- Original statements removed: DROP TRIGGER + CREATE TRIGGER admin_config_updated_at_trigger.

-- =============================================================================
-- 2. INSERT DEFAULT ADMIN CONFIGURATIONS - SUPERSEDED, intentionally skipped
-- =============================================================================
-- These three INSERTs (`trial_subscription`, `swap_points_config`, `feature_flags`)
-- target the never-shipped `config_key`/`config_value`/`enabled` columns, so they
-- cannot run against the canonical table. They are NOT rewritten to canonical
-- columns on purpose: that would seed config keys on a rebuilt database that
-- staging is not known to carry, i.e. a silent DATA divergence dressed up as a
-- schema fix. The keys these rows were meant to provide are seeded - where they are
-- actually used - by the canonical admin_config migrations. `is_trial_enabled()`
-- and `get_trial_duration_days()` below degrade safely when the row is absent.
-- Original statements removed: 3 x INSERT INTO admin_config (config_key, ...).

-- =============================================================================
-- 3. CREATE RPC: Get admin config - SUPERSEDED, intentionally skipped
-- =============================================================================
-- `get_admin_config(text)` selects `ac.config_value` / `ac.enabled`, columns that do
-- not exist on the canonical table, so it would be a permanently-broken RPC.
-- Checked before removing: staging does NOT have it, it has no call sites in the
-- mobile app / Edge Functions / admin portal (all of which use
-- `fn_get_admin_config_values`), and the replayed database never had it either.
-- Original statement removed: CREATE OR REPLACE FUNCTION get_admin_config(TEXT)
-- plus its COMMENT.

-- =============================================================================
-- 4. CREATE RPC: Check if trial is enabled
-- =============================================================================

CREATE OR REPLACE FUNCTION is_trial_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_config JSONB;
  is_enabled BOOLEAN;
BEGIN
  SELECT config_value INTO trial_config
  FROM admin_config
  WHERE config_key = 'trial_subscription'
    AND enabled = TRUE;

  IF trial_config IS NULL THEN
    RETURN FALSE;
  END IF;

  is_enabled := (trial_config ->> 'enabled')::BOOLEAN;
  RETURN COALESCE(is_enabled, FALSE);
END;
$$;

COMMENT ON FUNCTION is_trial_enabled IS 'MODULE-12: Check if trial subscription enrollment is enabled';

-- =============================================================================
-- 5. CREATE RPC: Get trial duration days
-- =============================================================================

CREATE OR REPLACE FUNCTION get_trial_duration_days()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_config JSONB;
  duration INTEGER;
BEGIN
  SELECT config_value INTO trial_config
  FROM admin_config
  WHERE config_key = 'trial_subscription'
    AND enabled = TRUE;

  IF trial_config IS NULL THEN
    RETURN 30; -- Default 30 days
  END IF;

  duration := (trial_config ->> 'duration_days')::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;

COMMENT ON FUNCTION get_trial_duration_days IS 'MODULE-12: Get configured trial duration in days';

-- =============================================================================
-- 6. UPDATE create_trial_subscription RPC TO USE CONFIG
-- =============================================================================

CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_duration INTEGER;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
  END IF;

  -- Get trial duration from admin config
  v_trial_duration := get_trial_duration_days();

  -- Create trial subscription with configured duration
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_duration || ' days')::INTERVAL,
    NULL, -- No Stripe customer during no-card trial
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION create_trial_subscription IS 'MODULE-03/MODULE-12: Creates trial subscription with admin-configured duration';
