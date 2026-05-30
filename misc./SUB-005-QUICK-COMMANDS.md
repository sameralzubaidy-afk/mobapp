# SUB-005 Quick Commands (npm)

## MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules

All commands use `npm` (not yarn) as requested.

---

## 🚀 Pre-Testing Setup

### 1. Run Migrations
```bash
# In Supabase SQL Editor, run BOTH migrations in order:

# Migration 1: Trial conversion RPCs
# /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260215000001_trial_conversion_rpcs.sql

# Migration 2: pg_cron scheduler (IMPORTANT: see configuration below)
# /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260215000002_scheduled_trial_conversion.sql

# BEFORE running migration #2, update these values:
# - Line 7: Replace <YOUR-SERVICE-ROLE-KEY-HERE> with your actual service role key
# - Line 24: Replace <YOUR-PROJECT-REF> with your Supabase project reference
```

### 2. Configure pg_cron (Required for Production)
```sql
-- In Supabase SQL Editor, enable required extensions:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Set service role key (replace with your actual key):
ALTER DATABASE postgres SET app.service_role_key = 'YOUR-SERVICE-ROLE-KEY-HERE';

-- Verify extensions:
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'http');
```

### 3. Deploy Edge Function (Required for Cron)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy trial-conversion Edge Function
npx supabase functions deploy trial-conversion --no-verify-jwt

# Verify deployment with curl:
curl -X POST https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/trial-conversion \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
```

### 4. Verify Cron Scheduler
```sql
-- In Supabase SQL Editor, check cron job:
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'trial-conversion-daily';

-- Expected result:
-- jobname: trial-conversion-daily
-- schedule: 0 2 * * *  (runs at 2:00 AM UTC daily)
-- active: true

-- Manually trigger for testing:
SELECT invoke_trial_conversion_edge_function();
```

### 5. Update Navigation (Manual Edit Required)
```bash
# Edit this file:
# p2p-kids-marketplace/src/navigation/AppNavigator.tsx

# Add after line 184 (after ReviewModeration screen):
# <Stack.Screen name="TrialConversionTest" component={TrialConversionTestScreen} options={{ title: 'Trial Conversion Test - SUB-005' }} />

# See NAVIGATION-UPDATE-REQUIRED-SUB-005.md for details
```

---

## 🧪 Run Unit Tests

```bash
# Navigate to mobile app
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run trial conversion unit tests
npm test -- src/services/subscriptions/__tests__/trialConversion.test.ts

# Run all subscription tests
npm test -- subscriptions

# Run all unit tests
npm test
```

---

## 🔬 Run E2E Tests

```bash
# Navigate to mobile app
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run trial conversion E2E tests (requires Supabase connection)
npm test -- e2e/trial-conversion.e2e.test.ts

# Run all E2E tests
npm run test:e2e
```

---

## 📱 Run App on Simulator

### iOS Simulator
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Start Metro bundler
npm start

# In another terminal, run iOS
npm run ios
```

### Android Emulator
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Start Metro bundler
npm start

# In another terminal, run Android
npm run android
```

---

## 🔍 Typecheck & Lint (Tier 0)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# TypeScript typecheck
npm run typecheck

# ESLint
npm run lint

# Fix lint issues automatically
npm run lint -- --fix

# Run both checks together
npm run typecheck && npm run lint
```

---

## � Cron Scheduler Management

### Check Cron Job Status
```sql
-- View cron job details
SELECT jobid, jobname, schedule, command, active, nodename
FROM cron.job
WHERE jobname = 'trial-conversion-daily';

-- View execution history (if cron.job_run_details table exists)
SELECT 
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

### Manual Trigger (Testing)
```sql
-- Manually invoke the trial conversion process
SELECT invoke_trial_conversion_edge_function();

-- Expected result (JSON):
-- {"statusCode": 200, "body": {"processed": 2, "converted": 1, "downgraded": 1, "errors": []}}
```

### Disable/Enable Cron Job
```sql
-- Temporarily disable the job (for maintenance)
SELECT cron.unschedule('trial-conversion-daily');

-- Re-enable the job
SELECT cron.schedule(
  'trial-conversion-daily',
  '0 2 * * *',
  $$SELECT invoke_trial_conversion_edge_function()$$
);
```

### Monitor Cron Execution
```sql
-- Check if job ran today
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
  AND start_time::date = CURRENT_DATE
ORDER BY start_time DESC;

-- View Edge Function response details
SELECT 
  start_time,
  (return_message::json->'body'->>'processed')::int AS processed_count,
  (return_message::json->'body'->>'converted')::int AS converted_count,
  (return_message::json->'body'->>'downgraded')::int AS downgraded_count
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
  AND status = 'succeeded'
ORDER BY start_time DESC
LIMIT 7;  -- Last 7 days
```

---

## �🚀 Deploy Edge Function (Optional - Production Only)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Login to Supabase (if not already)
npx supabase login

# Link to project (if not already)
npx supabase link

# Deploy trial-conversion Edge Function
npx supabase functions deploy trial-conversion --no-verify-jwt

# Check function logs
npx supabase functions logs trial-conversion --limit 50
```

---

## 🧹 Clean & Rebuild

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Clean Metro bundler cache
npm start -- --reset-cache

# Clean Watchman (recommended if seeing stale files)
watchman watch-del-all

# Clean iOS build
cd ios
rm -rf build
rm -rf Pods
rm Podfile.lock
pod install
cd ..

# Clean Android build
cd android
./gradlew clean
cd ..

# Reinstall node_modules (if needed)
rm -rf node_modules
npm install
### Check Cron Job Created
```sql
-- Verify cron job exists
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'trial-conversion-daily';

-- Expected: 1 row with schedule = '0 2 * * *'
```

```

---

## 📊 Manual Testing Steps

### Navigate to Test Screen
```
1. Open app on iOS/Android simulator
2. Log in with test user
3. Navigate: Home → Profile → Admin Dashboard → Trial Conversion Test
```

### Create Test Data (Supabase SQL Editor)
```sql
-- Get a test user ID
SELECT id, email FROM auth.users WHERE email LIKE '%test%' LIMIT 1;

-- Set up expired trial (no payment)
UPDATE subscriptions 
SET 
  status = 'trial',
  trial_start_date = NOW() - INTERVAL '35 days',
  trial_end_date = NOW() - INTERVAL '5 days',
  has_used_trial = FALSE,
  stripe_payment_method_id = NULL
WHERE user_id = 'USER_ID_HERE';

-- Set up expired trial (with payment)
UPDATE subscriptions 
SET 
  status = 'trial',
  trial_start_date = NOW() - INTERVAL '35 days',
  trial_end_date = NOW() - INTERVAL '2 days',
  has_used_trial = FALSE,
  stripe_payment_method_id = 'pm_test_12345'
WHERE user_id = 'USER_ID_HERE';
```

### Test Conversion in App
```
1. Click "Refresh Status" - verify trial status shown
2. Click "Trigger Conversion" - verify alert shows result
3. Click "Refresh Status" again - verify status changed
```

### Verify in Database
```sql
-- Check subscription changed
SELECT status, has_used_trial, grace_started_at, grace_ends_at
FROM subscriptions
WHERE user_id = 'USER_ID_HERE';

-- Check SP wallet frozen (if downgraded)
SELECT status, grace_period_ends_at
FROM sp_wallets
WHERE user_id = 'USER_ID_HERE';

-- Check subscription event logged
SELECT event_type, status_from, status_to, created_at
FROM subscription_events
WHERE subscription_id = (
  SELECT id FROM subscriptions WHERE user_id = 'USER_ID_HERE'
)
ORDER BY created_at DESC
LIMIT 1;
```

---

## 🔧 Troubleshooting Commands

### Check Supabase Connection
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Check .env.local file exists and has correct values
cat .env.local | grep SUPABASE

# Test Supabase connection (create a simple test script)
node -e "require('dotenv').config({path:'.env.local'}); console.log('URL:', process.env.EXPO_PUBLIC_SUPABASE_URL); console.log('Anon Key:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...');"
```

### Check Migration Applied
```sql
-- In Supabase SQL Editor:
-- Check functions exist
SELECT proname AS function_name
FROM pg_proc
WHERE proname IN ('check_expired_trials', 'convert_trial_to_active', 'downgrade_trial_to_grace')
ORDER BY proname;

-- Should return 3 rows
### Verify pg_cron Configuration
```sql
-- Check pg_cron extension enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check http extension enabled (required for Edge Function calls)
SELECT * FROM pg_extension WHERE extname = 'http';

-- Check service role key set
SHOW app.service_role_key;

-- Check cron job definition
SELECT jobid, schedule, command, active 
FROM cron.job 
WHERE jobname = 'trial-conversion-daily';
```

### Test Edge Function Manually
```bash
# Test Edge Function directly via curl
curl -X POST https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/trial-conversion \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY" \
  -H "Content-Type: application/json"

# Expected: 200 OK with JSON response
# {"processed": N, "converted": N, "downgraded": N, "errors": []}
```

```

### Check Edge Function Deployed
```bash
# List deployed functions
npx supabase functions list

# Should show: trial-conversion
```

---

## 📚 Reference Files

All files created in this implementation:

```
supabase/migrations/20260215000001_trial_conversion_rpcs.sql
supabase/functions/trial-conversion/index.ts
p2p-kids-marketplace/src/services/subscriptions/trialConversion.ts
p2p-kids-marketplace/src/services/subscriptions/__tests__/trialConversion.test.ts
p2p-kids-marketplace/e2e/trial-conversion.e2e.test.ts
p2p-kids-marketplace/src/screens/admin/TrialConversionTestScreen.tsx
p2p-kids-marketplace/src/navigation/types.ts (modified)
p2p-kids-marketplace/src/navigation/AppNavigator.tsx (modified)
SUB-005-MANUAL-TESTING-GUIDE.md
SUB-005-IMPLEMENTATION-SUMMARY.md
NAVIGATION-UPDATE-REQUIRED-SUB-005.md
docs/flow-registry.md (modified)
```

---

## ✅ Quick Verification Checklist

Before manual testing:
- [  ] Migration #1 applied in Supabase SQL Editor (trial_conversion_rpcs.sql)
- [  ] Migration #2 applied in Supabase SQL Editor (scheduled_trial_conversion.sql)
- [  ] pg_cron and http extensions enabled
- [  ] Service role key configured in database settings
- [  ] Edge Function deployed (`trial-conversion`)
- [  ] Cron job created and active (check with `SELECT * FROM cron.job`)
- [  ] Navigation route added to AppNavigator.tsx
- [  ] App compiles without errors: `npm run typecheck && npm run lint`
- [  ] Unit tests pass: `npm test trialConversion.test.ts`

During manual testing:
- [  ] Test screen loads without crash
- [  ] Can see trial status for test user
- [  ] "Trigger Conversion" invokes Edge Function
- [  ] Database updates correctly after conversion

Production verification:
- [  ] Cron job running daily at 2:00 AM UTC
- [  ] Check execution history in cron.job_run_details
- [  ] Monitor Edge Function logs for errors

---
- ✅ pg_cron scheduler running daily at 2:00 AM UTC
- ✅ Cron execution history shows successful runs

## 🎯 Success Criteria

**TASK SUB-005 COMPLETE** when:
- ✅ All unit tests pass
- ✅ All manual test cases pass (see SUB-005-MANUAL-TESTING-GUIDE.md)
- ✅ `has_used_trial` flag set correctly on conversion/downgrade
- ✅ SP wallet frozen on downgrade to grace
- ✅ 90-day grace period calculated correctly
- ✅ Edge Function processes expired trials successfully

---

**END OF QUICK COMMANDS**
