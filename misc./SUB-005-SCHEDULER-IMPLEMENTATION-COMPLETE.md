# SUB-005 Scheduler Implementation Complete ✅

## pg_cron Scheduler for Trial Conversion Edge Function

**Status**: ✅ COMPLETE - Ready for Testing

**Date**: 2026-02-15

---

## 📦 What Was Delivered

### New Migration File
**File**: `supabase/migrations/20260215000002_scheduled_trial_conversion.sql`

**Contents**:
1. RPC Function: `invoke_trial_conversion_edge_function()`
   - Calls Edge Function via HTTP POST
   - Uses service role key for authentication
   - Returns Edge Function response as JSON

2. pg_cron Job: `trial-conversion-daily`
   - Scheduled for **2:00 AM UTC** daily
   - Cron expression: `0 2 * * *`
   - Invokes the RPC function above

3. Comprehensive Documentation:
   - Installation instructions
   - Configuration steps
   - Verification queries
   - Manual testing commands
   - Troubleshooting guide

---

## 📝 Updated Documentation Files

### 1. SUB-005-IMPLEMENTATION-SUMMARY.md
**Updates**:
- Added scheduler migration to "Files Created" section
- Updated deployment steps with scheduler configuration
- Added cron verification commands

### 2. SUB-005-QUICK-COMMANDS.md
**Updates**:
- Added migration #2 to pre-testing setup
- Added pg_cron configuration section
- Added cron scheduler management commands
- Added monitoring queries for execution history
- Added troubleshooting section for scheduler
- Updated success criteria to include scheduler

### 3. SUB-005-MANUAL-TESTING-GUIDE.md
**Updates**:
- Added prerequisites for both migrations
- Added Test Case 9: pg_cron Scheduler Installation & Verification
- Renumbered subsequent test cases (TC10-TC12)
- Updated success criteria checklist

### 4. SUB-005-SCHEDULER-SETUP.md (NEW)
**Contents**:
- Quick 5-step setup guide
- Verification commands
- Management commands (disable/enable/change schedule)
- Monitoring queries (daily check, weekly summary, failure detection)
- Troubleshooting section
- Security notes
- Schedule format reference with examples

---

## 🔧 How It Works

```
┌─────────────────────┐
│   pg_cron           │
│   (2:00 AM UTC)     │
└──────────┬──────────┘
           │
           │ Triggers daily
           ▼
┌─────────────────────────────────────┐
│ invoke_trial_conversion_edge_function() │
│ (RPC in Postgres)                       │
└──────────┬──────────────────────────┘
           │
           │ HTTP POST with service role key
           ▼
┌──────────────────────────┐
│ trial-conversion         │
│ (Supabase Edge Function) │
└──────────┬───────────────┘
           │
           │ Calls RPCs
           ▼
┌──────────────────────────┐
│ check_expired_trials()   │
│ convert_trial_to_active()│
│ downgrade_trial_to_grace()│
└──────────────────────────┘
```

**Daily Process**:
1. pg_cron triggers at 2:00 AM UTC
2. Invokes `invoke_trial_conversion_edge_function()` RPC
3. RPC makes HTTP POST to Edge Function
4. Edge Function fetches expired trials
5. For each trial:
   - Check Stripe subscription status
   - If payment exists → convert to active
   - If no payment → downgrade to grace period
6. Returns summary: `{processed, converted, downgraded, errors}`
7. Execution logged to `cron.job_run_details`

---

## 🚀 Deployment Checklist

Use this checklist for production deployment:

### Phase 1: Prerequisites
- [  ] Migration #1 applied (`20260215000001_trial_conversion_rpcs.sql`)
- [  ] Edge Function deployed (`trial-conversion`)
- [  ] Service role key available from Supabase dashboard

### Phase 2: Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

### Phase 3: Configure Database
```sql
ALTER DATABASE postgres SET app.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
```

### Phase 4: Update Migration File
- [  ] Line 7: Replace `<YOUR-SERVICE-ROLE-KEY-HERE>`
- [  ] Line 24: Replace `<YOUR-PROJECT-REF>` with your Supabase project reference

### Phase 5: Run Migration
- [  ] Copy/paste `20260215000002_scheduled_trial_conversion.sql` to Supabase SQL Editor
- [  ] Click "Run"
- [  ] Verify no errors

### Phase 6: Verification
```sql
-- Check job created:
SELECT * FROM cron.job WHERE jobname = 'trial-conversion-daily';

-- Manual trigger test:
SELECT invoke_trial_conversion_edge_function();
```

### Phase 7: Monitor First Run
- [  ] Wait for first scheduled run (2:00 AM UTC next day)
- [  ] Check execution history:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
ORDER BY start_time DESC LIMIT 1;
```

---

## 📊 Expected Behavior

### What Happens Daily:
1. **Before 2:00 AM UTC**: Cron job is scheduled and waiting
2. **At 2:00 AM UTC**: Cron triggers RPC function
3. **RPC execution**: HTTP POST to Edge Function
4. **Edge Function**: Processes all expired trials
5. **After completion**: Results logged to `cron.job_run_details`

### Success Indicators:
- ✅ `status = 'succeeded'` in `cron.job_run_details`
- ✅ `return_message` contains valid JSON with counts
- ✅ No errors in Edge Function logs
- ✅ Subscription status updated for processed users
- ✅ `has_used_trial = TRUE` set for converted/downgraded users

### Failure Indicators:
- ❌ `status = 'failed'` in `cron.job_run_details`
- ❌ HTTP errors (404, 401, 500) in return message
- ❌ No execution records for today
- ❌ Edge Function not responding

---

## 🐛 Common Issues & Solutions

### Issue: Cron job not found after migration
**Cause**: Migration not applied or failed silently

**Solution**:
1. Verify extensions enabled: `SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'http');`
2. Re-run migration after updating service role key and project ref
3. Check for SQL errors in Supabase SQL Editor

### Issue: HTTP request fails (401 Unauthorized)
**Cause**: Service role key not set or incorrect

**Solution**:
```sql
-- Update service role key
ALTER DATABASE postgres SET app.service_role_key = 'eyJ...';

-- Reload config
SELECT pg_reload_conf();

-- Test manually
SELECT invoke_trial_conversion_edge_function();
```

### Issue: HTTP request fails (404 Not Found)
**Cause**: Edge Function URL incorrect or not deployed

**Solution**:
1. Verify Edge Function deployed: `npx supabase functions list`
2. Check project reference in migration (line 24)
3. Test Edge Function directly with curl

### Issue: Job runs but no trials processed
**Cause**: No expired trials exist, or trial_end_date not properly set

**Solution**:
```sql
-- Check for expired trials
SELECT * FROM subscriptions 
WHERE status = 'trial' 
AND trial_end_date < NOW();

-- Create test data if needed (see SUB-005-MANUAL-TESTING-GUIDE.md)
```

---

## 📚 Reference Links

**Implementation Files**:
- Scheduler Migration: [supabase/migrations/20260215000002_scheduled_trial_conversion.sql](supabase/migrations/20260215000002_scheduled_trial_conversion.sql)
- Edge Function: [supabase/functions/trial-conversion/index.ts](supabase/functions/trial-conversion/index.ts)
- RPC Functions: [supabase/migrations/20260215000001_trial_conversion_rpcs.sql](supabase/migrations/20260215000001_trial_conversion_rpcs.sql)

**Documentation**:
- Implementation Summary: [SUB-005-IMPLEMENTATION-SUMMARY.md](SUB-005-IMPLEMENTATION-SUMMARY.md)
- Manual Testing Guide: [SUB-005-MANUAL-TESTING-GUIDE.md](SUB-005-MANUAL-TESTING-GUIDE.md)
- Quick Commands: [SUB-005-QUICK-COMMANDS.md](SUB-005-QUICK-COMMANDS.md)
- Scheduler Setup Guide: [SUB-005-SCHEDULER-SETUP.md](SUB-005-SCHEDULER-SETUP.md)

**External Resources**:
- pg_cron Documentation: https://github.com/citusdata/pg_cron
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Cron Expression Reference: https://crontab.guru/

---

## ✅ Definition of Done

**Scheduler implementation is COMPLETE when**:
- ✅ Migration file created with RPC + cron job
- ✅ Documentation updated (4 files)
- ✅ Scheduler setup guide created
- ✅ Verification queries provided
- ✅ Troubleshooting guide included
- ✅ Management commands documented
- ✅ Monitoring queries provided

**Scheduler is DEPLOYED when**:
- [ ] Extensions enabled (pg_cron, http)
- [ ] Service role key configured
- [ ] Migration #2 applied
- [ ] Cron job visible in `cron.job` table
- [ ] Manual trigger test passes
- [ ] First scheduled run completes successfully

**Scheduler is IN PRODUCTION when**:
- [ ] Running daily at 2:00 AM UTC for 7+ days
- [ ] No failures in execution history
- [ ] Expired trials processed correctly
- [ ] Monitoring queries show expected results

---

## 🎯 Next Steps

1. **Deploy to Production**:
   - Follow deployment checklist above
   - Test manually before first scheduled run
   - Monitor first 7 days of execution

2. **Set Up Alerts** (Optional):
   - Create alert for failed executions
   - Monitor daily execution count
   - Track conversion/downgrade rates

3. **Documentation**:
   - Share scheduler setup guide with team
   - Add to runbook/operations manual
   - Update infrastructure documentation

4. **Future Enhancements** (Not in scope):
   - Add email notifications for failures
   - Retry logic for failed conversions
   - Dashboard for monitoring conversion rates

---

## 🙏 Acknowledgments

**Pattern Based On**: `supabase/migrations/20260215_scheduled_trial_reminders.sql`
- Followed existing trial-reminders pattern
- Used same HTTP extension approach
- Aligned with existing cron job conventions

**Module**: MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules
**Implementation Date**: 2026-02-15
**Status**: ✅ READY FOR TESTING & DEPLOYMENT

---

**END OF SCHEDULER IMPLEMENTATION SUMMARY**
