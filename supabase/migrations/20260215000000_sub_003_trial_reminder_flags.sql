-- File: supabase/migrations/20260215000000_sub_003_trial_reminder_flags.sql
-- Purpose: MODULE-11 SUB-003 - Ensure reminder flags initialized and one-trial-per-user enforcement
-- Mode B: Idempotent rerunnable migration

-- BLOCK 1: Schema updates (if reminder columns don't exist, add them)
-- Note: If columns already exist from SUB-002 migration, this is safe (IF NOT EXISTS pattern)

DO $$ 
BEGIN
  -- Add reminder flag columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='trial_reminder_day_23_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_reminder_day_23_sent BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='trial_reminder_day_28_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_reminder_day_28_sent BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='trial_reminder_day_29_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_reminder_day_29_sent BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add trial_used_at to track WHEN trial was used (not just IF it was used)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='subscriptions' AND column_name='trial_used_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_used_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.subscriptions.trial_reminder_day_23_sent IS 'MODULE-11 SUB-003: Reminder sent on day 23 of trial';
COMMENT ON COLUMN public.subscriptions.trial_reminder_day_28_sent IS 'MODULE-11 SUB-003: Reminder sent on day 28 of trial';
COMMENT ON COLUMN public.subscriptions.trial_reminder_day_29_sent IS 'MODULE-11 SUB-003: Reminder sent on day 29 of trial';
COMMENT ON COLUMN public.subscriptions.trial_used_at IS 'MODULE-11 SUB-003: Timestamp when trial was first activated (for one-trial-per-user enforcement)';


-- BLOCK 2: Update create_trial_subscription to initialize reminder flags and enforce one-trial-per-user
CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_days INTEGER;
  v_existing_trial_used_at TIMESTAMPTZ;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  -- Get configurable trial duration
  v_trial_days := get_trial_duration_days();

  IF FOUND THEN
    -- MODULE-11 SUB-003: Enforce one-trial-per-user rule
    -- If they've EVER used a trial (trial_used_at is set), reject new trial attempts
    IF v_subscription.trial_used_at IS NOT NULL THEN
      RAISE EXCEPTION 'TRIAL_ALREADY_USED: User % has already used their free trial on %', 
        p_user_id, v_subscription.trial_used_at;
    END IF;

    -- If it's free or expired, we can "activate" it as a trial
    IF v_subscription.status IN ('free', 'expired') THEN
      UPDATE subscriptions
      SET 
        status = 'trial',
        trial_start_date = NOW(),
        trial_end_date = NOW() + (v_trial_days || ' days')::INTERVAL,
        trial_used_at = NOW(), -- MODULE-11 SUB-003: Mark trial as used
        -- MODULE-11 SUB-003: Initialize reminder flags
        trial_reminder_day_23_sent = FALSE,
        trial_reminder_day_28_sent = FALSE,
        trial_reminder_day_29_sent = FALSE,
        updated_at = NOW()
      WHERE id = v_subscription.id
      RETURNING * INTO v_subscription;
      
      RETURN v_subscription;
    ELSE
      -- If it's already trial or active, just return it (idempotent)
      RETURN v_subscription;
    END IF;
  END IF;

  -- Create new trial subscription
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    trial_used_at, -- MODULE-11 SUB-003: Mark trial as used
    stripe_customer_id,
    -- MODULE-11 SUB-003: Initialize reminder flags to FALSE
    trial_reminder_day_23_sent,
    trial_reminder_day_28_sent,
    trial_reminder_day_29_sent,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    NOW(), -- MODULE-11 SUB-003: Mark trial as used
    NULL,
    -- MODULE-11 SUB-003: Initialize reminder flags
    FALSE,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION create_trial_subscription IS 'MODULE-11 SUB-003: Creates 30-day trial with reminder flag initialization and one-trial-per-user enforcement';


-- BLOCK 2b: Update upgrade_free_subscription_to_trial with same logic
CREATE OR REPLACE FUNCTION upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Just delegate to the enhanced create_trial_subscription
  -- It now handles: reminder flags, trial_used_at tracking, and one-trial-per-user check
  RETURN create_trial_subscription(p_user_id);
END;
$$;

COMMENT ON FUNCTION upgrade_free_subscription_to_trial IS 'MODULE-11 SUB-003: Upgrade existing free subscription to trial (delegates to create_trial_subscription)';


-- VERIFICATION QUERIES (run these to test the migration)

-- 1. Verify reminder flag columns exist
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN ('trial_reminder_day_23_sent', 'trial_reminder_day_28_sent', 'trial_reminder_day_29_sent', 'trial_used_at')
ORDER BY column_name;

-- Expected: 4 rows with BOOLEAN (default FALSE for reminder flags) and TIMESTAMPTZ (nullable)


-- 2. Test trial creation (use a test user ID)
-- SELECT create_trial_subscription('79919419-47dc-43af-a55c-e58597096026');

-- Expected result: subscription row with:
-- - status = 'trial'
-- - trial_reminder_day_23_sent = false
-- - trial_reminder_day_28_sent = false
-- - trial_reminder_day_29_sent = false
-- - trial_used_at = (current timestamp)


-- 3. Test one-trial-per-user enforcement (run twice on same user)
-- First call: succeeds
-- SELECT create_trial_subscription('00000000-0000-0000-0000-000000000099');
-- Second call: should raise exception 'TRIAL_ALREADY_USED'
-- SELECT create_trial_subscription('00000000-0000-0000-0000-000000000099');

-- Expected: Second call fails with "TRIAL_ALREADY_USED" error


-- 4. Verify function existence
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS definition
FROM pg_proc 
WHERE proname IN ('create_trial_subscription', 'upgrade_free_subscription_to_trial')
ORDER BY proname;

-- Expected: 2 functions returned with updated definitions
