# SUB-005 Scheduler Setup Guide

## pg_cron Scheduler for Trial Conversion

This guide covers the automated scheduler that runs the **trial-conversion** Edge Function daily to process expired trials.

---

## 📋 Overview

### What It Does:
- Runs daily at **2:00 AM UTC**
- Invokes `trial-conversion` Edge Function via HTTP
- Processes all expired trials automatically
- Converts trials with payment → active subscription
- Downgrades trials without payment → grace period

### Files Created:
- `supabase/migrations/20260215000002_scheduled_trial_conversion.sql`

### Dependencies:
- `trial-conversion` Edge Function (must be deployed)
- `check_expired_trials()` RPC
- `convert_trial_to_active()` RPC
- `downgrade_trial_to_grace()` RPC
- pg_cron extension
- http extension

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Enable Extensions
```sql
-- Run in Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Verify:
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'http');
```

### Step 2: Configure Service Role Key
```sql
-- Replace YOUR-SERVICE-ROLE-KEY-HERE with your actual key:
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

-- Verify:
SHOW app.service_role_key;
```

### Step 3: Update Migration File
```bash
# Before running the migration, edit this file:
# supabase/migrations/20260215000002_scheduled_trial_conversion.sql

# Line 7: Replace <YOUR-SERVICE-ROLE-KEY-HERE> with your service role key
# Line 24: Replace <YOUR-PROJECT-REF> with your Supabase project reference
```

### Step 4: Run Migration
```sql
-- In Supabase SQL Editor, copy/paste and run:
-- /Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260215000002_scheduled_trial_conversion.sql
```

### Step 5: Deploy Edge Function
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
npx supabase functions deploy trial-conversion --no-verify-jwt
```

---

## ✅ Verification

### Check Cron Job Created
```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'trial-conversion-daily';

-- Expected:
-- jobname: trial-conversion-daily
-- schedule: 0 2 * * *
-- active: true
```

### Manual Test (Before Production)
```sql
-- Trigger manually:
SELECT invoke_trial_conversion_edge_function();

-- Expected response:
-- {"statusCode": 200, "body": {"processed": N, "converted": N, "downgraded": N, "errors": []}}
```

### Check Execution History
```sql
-- View past runs:
SELECT 
  start_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 🔧 Management Commands

### Disable Scheduler (Maintenance Mode)
```sql
SELECT cron.unschedule('trial-conversion-daily');
```

### Re-enable Scheduler
```sql
SELECT cron.schedule(
  'trial-conversion-daily',
  '0 2 * * *',
  $$SELECT invoke_trial_conversion_edge_function()$$
);
```

### Change Schedule Time
```sql
-- Example: Change to 3:00 AM UTC
SELECT cron.unschedule('trial-conversion-daily');

SELECT cron.schedule(
  'trial-conversion-daily',
  '0 3 * * *',  -- Hour 3 instead of 2
  $$SELECT invoke_trial_conversion_edge_function()$$
);
```

### View All Cron Jobs
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
ORDER BY jobname;
```

---

## 📊 Monitoring

### Daily Execution Check
```sql
-- Did the job run today?
SELECT 
  start_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
  AND start_time::date = CURRENT_DATE;
```

### Weekly Summary
```sql
-- Last 7 days of executions
SELECT 
  start_time::date AS date,
  status,
  (return_message::json->'body'->>'processed')::int AS processed,
  (return_message::json->'body'->>'converted')::int AS converted,
  (return_message::json->'body'->>'downgraded')::int AS downgraded
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
  AND start_time > CURRENT_DATE - INTERVAL '7 days'
ORDER BY start_time DESC;
```

### Check for Failures
```sql
SELECT 
  start_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
  AND status != 'succeeded'
ORDER BY start_time DESC;
```

---

## 🐛 Troubleshooting

### Issue: Job not running
**Check:**
1. `SELECT * FROM cron.job WHERE jobname = 'trial-conversion-daily';` - Is `active = true`?
2. `SHOW app.service_role_key;` - Is service role key set?
3. Edge Function deployed? `npx supabase functions list`

**Fix:**
```sql
-- Re-create the job
SELECT cron.unschedule('trial-conversion-daily');
SELECT cron.schedule(
  'trial-conversion-daily',
  '0 2 * * *',
  $$SELECT invoke_trial_conversion_edge_function()$$
);
```

### Issue: HTTP request fails
**Check:**
1. Edge Function URL correct in migration (line 24)?
2. Edge Function deployed and responding?

**Test Edge Function directly:**
```bash
curl -X POST https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/trial-conversion \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
```

### Issue: Service role key not working
**Fix:**
```sql
-- Ensure key is set correctly (no quotes in the value)
ALTER DATABASE postgres SET app.service_role_key = 'eyJ...';

-- Reload PostgreSQL configuration
SELECT pg_reload_conf();
```

### Issue: Extension not found
**Fix:**
```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- If http extension not available, contact Supabase support
```

---

## 🔒 Security Notes

1. **Service Role Key**: 
   - Stored in database settings (not in code)
   - Used to bypass RLS for automated processing
   - Keep it secret, never commit to Git

2. **Edge Function Security**:
   - Uses `--no-verify-jwt` flag (no user auth required)
   - Protected by service role key in Authorization header
   - Only callable by scheduler and admins

3. **Audit Trail**:
   - All conversions logged to `subscription_events`
   - Cron execution history in `cron.job_run_details`
   - Edge Function logs available via `supabase functions logs`

---

## 📅 Schedule Details

### Current Schedule: 2:00 AM UTC Daily
- **Cron Expression**: `0 2 * * *`
- **Timezone**: UTC (Coordinated Universal Time)
- **Frequency**: Once per day

### Why 2:00 AM UTC?
- Low traffic time for most US users
- Different from trial-reminders (10:00 AM UTC) to spread load
- Before business hours in most timezones

### Schedule Format (pg_cron)
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 7) (Sunday = 0 or 7)
│ │ │ │ │
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 2 * * *` - Daily at 2:00 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 2 * * 1` - Every Monday at 2:00 AM UTC
- `0 2 1 * *` - First day of every month at 2:00 AM UTC

---

## 🔗 Related Files

- Migration: `supabase/migrations/20260215000002_scheduled_trial_conversion.sql`
- Edge Function: `supabase/functions/trial-conversion/index.ts`
- RPC Functions: `supabase/migrations/20260215000001_trial_conversion_rpcs.sql`
- Implementation Summary: `SUB-005-IMPLEMENTATION-SUMMARY.md`
- Manual Testing Guide: `SUB-005-MANUAL-TESTING-GUIDE.md`
- Quick Commands: `SUB-005-QUICK-COMMANDS.md`

---

## 📞 Support

**Questions or Issues?**
1. Check troubleshooting section above
2. Review Edge Function logs: `npx supabase functions logs trial-conversion`
3. Check cron execution history (SQL queries above)
4. Verify all prerequisites are met

**Need to modify the scheduler?**
- See "Management Commands" section above
- Test changes with manual trigger first: `SELECT invoke_trial_conversion_edge_function();`
- Monitor execution history after changes

---

**END OF SCHEDULER SETUP GUIDE**
