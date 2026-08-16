-- MODULE-11 SUB-009: Grace Period Implementation Verification Queries
-- Run these in Supabase SQL Editor to verify the implementation

-- =============================================================================
-- 1. VERIFY ADMIN CONFIG
-- =============================================================================

-- Check grace_reminder_thresholds exists
SELECT 
  key, 
  value,
  description,
  category,
  data_type,
  created_at,
  updated_at
FROM admin_config 
WHERE key = 'grace_reminder_thresholds';

/*
Expected Result:
- key: 'grace_reminder_thresholds'
- value: '[60, 30, 7, 1]' (or similar JSON array)
- data_type: 'json'
- 1 row returned
*/

-- Check grace_period_days also exists (used by cron)
SELECT 
  key, 
  value,
  description
FROM admin_config 
WHERE key = 'grace_period_days';

/*
Expected Result:
- key: 'grace_period_days'
- value: '90' (or configured grace period duration)
- 1 row returned
*/

-- =============================================================================
-- 2. VERIFY CRON JOB SCHEDULED
-- =============================================================================

-- Check pg_cron job exists
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job 
WHERE jobname = 'grace-period-daily';

/*
Expected Result:
- jobname: 'grace-period-daily'
- schedule: '0 3 * * *' (3:00 AM UTC every day)
- command: SELECT invoke_grace_period_cron();
- active: true
- 1 row returned
*/

-- =============================================================================
-- 3. VERIFY RPC FUNCTION EXISTS
-- =============================================================================

-- Check invoke_grace_period_cron function exists
SELECT 
  proname as function_name,
  pronargs as num_arguments,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'invoke_grace_period_cron';

/*
Expected Result:
- function_name: 'invoke_grace_period_cron'
- num_arguments: 0
- return_type: json
- 1 row returned
*/

-- =============================================================================
-- 4. VERIFY GRACE PERIOD REMINDER COLUMNS EXIST
-- =============================================================================

-- Check subscriptions table has all required grace period columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN (
    'grace_period_ends_at',
    'grace_reminder_sent_day_60',
    'grace_reminder_sent_day_30',
    'grace_reminder_sent_day_7',
    'grace_reminder_sent_day_1'
  )
ORDER BY column_name;

/*
Expected Result: 5 rows with:
- grace_period_ends_at: TIMESTAMP WITH TIME ZONE, nullable: YES
- grace_reminder_sent_day_60: BOOLEAN, nullable: YES or default: FALSE
- grace_reminder_sent_day_30: BOOLEAN, nullable: YES or default: FALSE
- grace_reminder_sent_day_7: BOOLEAN, nullable: YES or default: FALSE
- grace_reminder_sent_day_1: BOOLEAN, nullable: YES or default: FALSE
*/

-- =============================================================================
-- 5. VERIFY HTTP EXTENSION ENABLED
-- =============================================================================

-- Check http extension is enabled (required for cron → Edge Function calls)
SELECT 
  extname,
  extversion
FROM pg_extension 
WHERE extname = 'http';

/*
Expected Result:
- extname: 'http'
- extversion: (any version, e.g., '1.5')
- 1 row returned

If no rows: Run CREATE EXTENSION http;
*/

-- =============================================================================
-- 6. VERIFY DATABASE SETTINGS (Supabase URL + Service Role Key)
-- =============================================================================

-- Check app.supabase_url is set
SELECT name, setting 
FROM pg_settings 
WHERE name = 'app.supabase_url';

/*
Expected Result:
- name: 'app.supabase_url'
- setting: 'https://YOUR_PROJECT_REF.supabase.co'
- 1 row returned

If no rows or wrong value: Run ALTER DATABASE postgres SET app.supabase_url TO '...';
*/

-- Check app.service_role_key is set (value will be masked)
SELECT 
  name, 
  CASE 
    WHEN setting IS NOT NULL AND setting != '' THEN '*** SET (masked) ***'
    ELSE 'NOT SET'
  END as status
FROM pg_settings 
WHERE name = 'app.service_role_key';

/*
Expected Result:
- name: 'app.service_role_key'
- status: '*** SET (masked) ***'
- 1 row returned

If 'NOT SET': Run ALTER DATABASE postgres SET app.service_role_key TO 'your-service-role-key';
*/

-- =============================================================================
-- 7. TEST DATA: Create Grace Period User for Testing
-- =============================================================================

-- OPTIONAL: Uncomment to create a test user in grace_period status
/*
-- Replace with actual test user_id from your auth.users table
DO $$
DECLARE
  v_test_user_id UUID := 'YOUR_TEST_USER_ID_HERE'; -- Replace with actual UUID
BEGIN
  -- Check if subscription exists for test user
  IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = v_test_user_id) THEN
    -- Update existing subscription to grace_period
    UPDATE subscriptions
    SET 
      status = 'grace_period',
      grace_period_ends_at = NOW() + INTERVAL '15 days', -- 15 days from now
      grace_reminder_sent_day_60 = FALSE,
      grace_reminder_sent_day_30 = FALSE,
      grace_reminder_sent_day_7 = FALSE,
      grace_reminder_sent_day_1 = FALSE,
      updated_at = NOW()
    WHERE user_id = v_test_user_id;
    
    RAISE NOTICE 'Updated subscription for user % to grace_period status', v_test_user_id;
  ELSE
    -- Create new subscription in grace_period
    INSERT INTO subscriptions (
      user_id,
      status,
      grace_period_ends_at,
      grace_reminder_sent_day_60,
      grace_reminder_sent_day_30,
      grace_reminder_sent_day_7,
      grace_reminder_sent_day_1,
      created_at,
      updated_at
    ) VALUES (
      v_test_user_id,
      'grace_period',
      NOW() + INTERVAL '15 days',
      FALSE,
      FALSE,
      FALSE,
      FALSE,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created new grace_period subscription for user %', v_test_user_id;
  END IF;
END $$;
*/

-- =============================================================================
-- 8. MANUAL CRON TRIGGER TEST
-- =============================================================================

-- OPTIONAL: Manually trigger the grace period cron to test it
/*
SELECT invoke_grace_period_cron();
*/

/*
Expected Result:
- Returns JSON like:
  {
    "success": true,
    "processed": 1,
    "expired": 0,
    "reminders": []
  }

If error: Check Edge Function logs in Supabase dashboard
*/

-- =============================================================================
-- 9. CHECK GRACE PERIOD SUBSCRIPTIONS
-- =============================================================================

-- List all subscriptions currently in grace_period status
SELECT 
  id,
  user_id,
  status,
  grace_period_ends_at,
  EXTRACT(DAY FROM (grace_period_ends_at - NOW())) as days_remaining,
  grace_reminder_sent_day_60,
  grace_reminder_sent_day_30,
  grace_reminder_sent_day_7,
  grace_reminder_sent_day_1,
  created_at,
  updated_at
FROM subscriptions
WHERE status = 'grace_period'
  AND grace_period_ends_at IS NOT NULL
ORDER BY grace_period_ends_at ASC;

/*
Expected Result:
- Shows all grace_period subscriptions with days remaining
- Can be 0 rows if no users currently in grace period (normal)
*/

-- =============================================================================
-- 10. VERIFY EDGE FUNCTION DEPLOYED
-- =============================================================================

-- NOTE: This must be verified via Supabase Dashboard or CLI
-- Go to: Edge Functions → grace-period-cron → Check deployment status

-- CLI verification:
-- npx supabase functions list

-- Expected: grace-period-cron appears in list with status: deployed

-- =============================================================================
-- VERIFICATION SUMMARY
-- =============================================================================

/*
Checklist (All should show expected results):

[ ] Section 1: admin_config has grace_reminder_thresholds
[ ] Section 2: pg_cron job 'grace-period-daily' scheduled at 3:00 AM UTC
[ ] Section 3: RPC function invoke_grace_period_cron exists
[ ] Section 4: subscriptions table has 5 grace period columns
[ ] Section 5: http extension enabled
[ ] Section 6: app.supabase_url and app.service_role_key set
[ ] Section 7: (Optional) Test user created in grace_period status
[ ] Section 8: (Optional) Manual cron trigger returns success
[ ] Section 9: Grace period subscriptions query runs (0+ rows)
[ ] Section 10: Edge Function deployed (verify in dashboard/CLI)

If all checkboxes pass: ✅ Database setup is complete!
If any fail: See SUB-009-IMPLEMENTATION-INSTRUCTIONS.md for fixes
*/
