# Fix: scheduled_message_cleanup() Ambiguity Error

## Problem

The cron job failed with:
```
ERROR: function public.scheduled_message_cleanup() is not unique
HINT: Could not choose a best candidate function. You might need to add explicit type casts.
```

## Root Cause

Two versions of `scheduled_message_cleanup()` exist:

1. **Migration 083** created: `scheduled_message_cleanup()` ← no parameters
2. **Migration 084** created: `scheduled_message_cleanup(text, jsonb)` ← with parameters

When the cron job calls `SELECT public.scheduled_message_cleanup();`, PostgreSQL can't decide which version to use.

## Solution

**Migration 085** (`085_fix_scheduled_message_cleanup_ambiguity.sql`) fixes this by:

1. ✅ Dropping the no-parameter version
2. ✅ Keeping only the parameterized version (which has DEFAULT values)
3. ✅ Now both calls work:
   - `SELECT scheduled_message_cleanup();` → uses defaults
   - `SELECT scheduled_message_cleanup('pg_cron', '{...}');` → with values

## How to Apply

### Step 1: Run the Fix Migration

In Supabase SQL Editor:
```sql
-- Run entire migration file
\i supabase/migrations/085_fix_scheduled_message_cleanup_ambiguity.sql
```

Or via CLI:
```bash
supabase db push
```

### Step 2: Verify Only One Version Exists

```sql
SELECT proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
WHERE proname = 'scheduled_message_cleanup'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Expected Output:**
```
proname                    | pg_get_function_identity_arguments
---------------------------|------------------------------------
scheduled_message_cleanup  | text, jsonb
```

✅ Only 1 row = ambiguity fixed

### Step 3: Test the Function

```sql
-- Test with no parameters (uses defaults)
SELECT public.scheduled_message_cleanup();

-- Test with parameters
SELECT public.scheduled_message_cleanup('pg_cron', '{}'::jsonb);
```

**Expected Output:**
```json
{
  "run_at": "2026-01-09T12:30:00+00",
  "processed_count": 5,
  "errors_count": 0,
  "result": {"status": "success", "processed_count": 5}
}
```

### Step 4: Manually Trigger Cron Job to Test

```sql
-- Check cron job configuration
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'cleanup-expired-messages';

-- Verify it's active and next run time
SELECT jobid, schedule, active, next_start 
FROM cron.job 
WHERE jobname = 'cleanup-expired-messages';
```

### Step 5: Check Execution History

```sql
-- View recent runs
SELECT run_at, invoked_by, result, error 
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'cleanup-expired-messages'
)
ORDER BY start_time DESC 
LIMIT 5;

-- Expected: "status": "succeeded", no errors
```

## Verify Cron Job Now Works

```sql
-- Check message_cleanup_runs audit table
SELECT run_at, invoked_by, result, error 
FROM message_cleanup_runs 
ORDER BY run_at DESC 
LIMIT 10;

-- Should show recent runs with:
-- - invoked_by: 'pg_cron' (or 'system')
-- - error: NULL (no errors)
-- - result: {"status": "success", ...}
```

---

## Why This Happened

Migration sequencing created duplicate functions:
- Migration 083 created `scheduled_message_cleanup()` (no args)
- Migration 084 tried to "replace" it but Postgres allows both versions to coexist
- PostgreSQL's function resolution was ambiguous when no parameters given

## Why The Fix Works

Function signatures in PostgreSQL:
```sql
-- Before (ambiguous - 2 functions with same name)
scheduled_message_cleanup()                    -- 0 params
scheduled_message_cleanup(text, jsonb)         -- 2 params

-- After (unambiguous - 1 function with defaults)
scheduled_message_cleanup(text, jsonb)         -- params have defaults
                                               -- can be called with 0 or 2 args
```

Default parameters allow backwards-compatible calling.

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Function versions | 2 (ambiguous) | 1 (unique) |
| Call `SELECT scheduled_message_cleanup();` | ❌ Error | ✅ Works |
| Call `SELECT scheduled_message_cleanup('pg_cron', '{}');` | ✅ Works | ✅ Works |
| Cron job status | ❌ Failed | ✅ Success |

---

## Next Steps

1. ✅ Apply migration 085
2. ✅ Verify with queries above
3. ✅ Monitor `cron.job_run_details` for next scheduled run
4. ✅ Confirm `message_cleanup_runs` shows successful executions

---

**Resolution:** The cron job will now execute successfully on the next scheduled interval (2 AM UTC daily).

**Document Version:** 1.0  
**Date:** 2026-01-09  
**Status:** RESOLVED ✅
