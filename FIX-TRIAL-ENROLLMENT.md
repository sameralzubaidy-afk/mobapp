# Fix RPC Functions for Admin Config Schema

The trial enrollment error occurs because the RPC functions (`is_trial_enabled()`, `get_trial_duration_days()`) are using the OLD admin_config schema (JSONB) but we created the NEW schema with separate `key` and `value` columns.

## Step 1: Run this SQL in Supabase Dashboard

Go to: https://app.supabase.com → SQL Editor → New Query

Copy and paste:

```sql
-- Fix is_trial_enabled() for new schema
CREATE OR REPLACE FUNCTION is_trial_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_enabled_value TEXT;
BEGIN
  SELECT value INTO trial_enabled_value
  FROM admin_config
  WHERE key = 'trial_enabled'
    AND is_active = TRUE;

  RETURN COALESCE(trial_enabled_value = 'true', FALSE);
END;
$$;

-- Fix get_trial_duration_days() for new schema
CREATE OR REPLACE FUNCTION get_trial_duration_days()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duration_value TEXT;
  duration INTEGER;
BEGIN
  SELECT value INTO duration_value
  FROM admin_config
  WHERE key = 'trial_period_days'
    AND is_active = TRUE;

  IF duration_value IS NULL THEN
    RETURN 30;
  END IF;

  duration := duration_value::INTEGER;
  RETURN COALESCE(duration, 30);
END;
$$;

-- Verify functions work
SELECT is_trial_enabled();
SELECT get_trial_duration_days();
```

Click "Run"

Expected output:
```
is_trial_enabled: true
get_trial_duration_days: 30
```

## Step 2: Test trial enrollment in mobile app

After running the SQL:
1. Go back to mobile app
2. Click "Free Trial" button again
3. Should now work! ✅

If you still get an error, run this diagnostic SQL:

```sql
-- Check what's in admin_config
SELECT key, value, is_active FROM admin_config WHERE key IN ('trial_enabled', 'trial_period_days');

-- Check if the RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_trial_enabled', 'get_trial_duration_days');
```
