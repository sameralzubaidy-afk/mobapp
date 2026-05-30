# MSG-007 Cron Job Setup Guide

## Overview

This guide walks you through setting up the PostgreSQL cron job to automatically send message email notifications every hour, following the same pattern used for trade auto-complete.

---

## What Gets Created

The migration `084_add_pg_cron_send_message_emails.sql` creates:

1. **Audit table** `message_email_runs` - logs each cron execution
2. **Scheduled function** `scheduled_send_message_emails()` - finds and marks emails to send
3. **Cron job** `send_message_emails_hourly` - runs the function every hour

---

## Setup Steps

### Step 1: Apply the Migration

Run the migration in your Supabase SQL Editor:

```bash
# Option A: Run in Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy entire contents of 084_add_pg_cron_send_message_emails.sql
# 3. Paste and Execute

# Option B: Via CLI
supabase db push  # Applies all pending migrations in order
```

### Step 2: Verify pg_cron is Available

Run this query in Supabase SQL Editor:

```sql
-- Check if pg_cron extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
```

**Expected Output:**
```
extname  | extversion
---------+----------
pg_cron  | 1.4
```

**If pg_cron is NOT available:**
Contact Supabase support to enable it, or use external scheduler (see Alternative Methods below).

### Step 3: Verify Cron Job Created

```sql
-- List all message email cron jobs
SELECT jobid, jobname, schedule, command, active, next_start 
FROM cron.job 
WHERE jobname LIKE '%message_email%';
```

**Expected Output:**
```
jobid | jobname                    | schedule   | command                                | active | next_start
------|----------------------------|-----------|----------------------------------------|--------|------------------
123   | send_message_emails_hourly | 0 * * * * | SELECT public.scheduled_send_message_emails(); | t | 2026-01-09 15:00:00+00
```

**Schedule Explanation:**
- `0 * * * *` = Every hour at the top of the hour (00 minutes)
- Other examples:
  - `*/30 * * * *` = Every 30 minutes
  - `0 */6 * * *` = Every 6 hours
  - `0 0 * * *` = Once daily at midnight

### Step 4: Verify Audit Table

```sql
-- Check that audit table exists
SELECT * FROM message_email_runs;
```

**Expected:** Empty table (will populate after first cron run)

---

## Testing the Cron Job

### Manual Test (Dry Run)

```sql
-- Manually trigger the scheduled function to test
SELECT * FROM scheduled_send_message_emails();
```

**Expected Output:**
```json
{
  "run_at": "2026-01-08T20:30:00+00",
  "processed_count": 5,
  "delay_hours": 1,
  "status": "success"
}
```

### Create Test Data

```sql
-- Create a test message older than 1 hour
INSERT INTO messages (id, trade_id, sender_id, content, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Test message for email',
  NOW() - INTERVAL '2 hours'
);

-- Check email_sent_at is NULL
SELECT id, content, email_sent_at 
FROM messages 
WHERE content = 'Test message for email';
```

### Run Scheduled Function

```sql
-- Execute the function
SELECT scheduled_send_message_emails();

-- Verify message was marked
SELECT id, content, email_sent_at 
FROM messages 
WHERE content = 'Test message for email';
-- Expected: email_sent_at populated
```

### View Audit Log

```sql
-- See execution history
SELECT run_at, result, error 
FROM message_email_runs 
ORDER BY run_at DESC 
LIMIT 5;
```

---

## Monitor Cron Job Health

### Check Execution History

```sql
-- How many emails processed per run?
SELECT 
  DATE_TRUNC('hour', run_at) as hour,
  COUNT(*) as run_count,
  AVG((result->>'processed_count')::INT) as avg_emails_per_run
FROM message_email_runs
WHERE run_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', run_at)
ORDER BY hour DESC;
```

### Check for Errors

```sql
-- Find failed runs
SELECT run_at, error, result 
FROM message_email_runs 
WHERE error IS NOT NULL 
ORDER BY run_at DESC 
LIMIT 10;
```

### Count Pending Emails

```sql
-- How many unread messages are waiting for email?
SELECT COUNT(*) as pending_emails
FROM messages 
WHERE email_sent_at IS NULL 
  AND deleted_at IS NULL 
  AND created_at < (NOW() - INTERVAL '1 hour');
```

---

## Configuration Options

### Change Email Delay

Default is 1 hour. To change:

```sql
-- Change to 24 hours
UPDATE admin_config 
SET value = '24' 
WHERE key = 'message_email_delay_hours';

-- Change to 30 minutes
UPDATE admin_config 
SET value = '0.5' 
WHERE key = 'message_email_delay_hours';
```

### Change Cron Frequency

To run more/less frequently, unschedule and recreate:

```sql
-- Unschedule current job
SELECT cron.unschedule('send_message_emails_hourly');

-- Recreate with new schedule (every 30 minutes)
SELECT cron.schedule('send_message_emails_hourly', '*/30 * * * *', 'SELECT public.scheduled_send_message_emails();');
```

### Disable Email Notifications

```sql
UPDATE admin_config 
SET value = 'false' 
WHERE key = 'message_email_enabled';

-- Cron job will skip execution (logged as "disabled" in audit)
```

---

## Troubleshooting

### Cron Job Not Running

**Check 1: Is pg_cron enabled?**
```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
```
If empty, contact Supabase support.

**Check 2: Is the job active?**
```sql
SELECT jobid, active FROM cron.job WHERE jobname = 'send_message_emails_hourly';
```
If `active = false`, recreate the job.

**Check 3: Check execution logs**
```sql
SELECT run_at, error FROM message_email_runs 
WHERE error IS NOT NULL 
ORDER BY run_at DESC LIMIT 5;
```

### Emails Not Being Marked as Sent

**Check admin config:**
```sql
SELECT value FROM admin_config 
WHERE key IN ('message_email_enabled', 'message_email_delay_hours');
```

**Check message criteria:**
```sql
-- Messages that will be processed
SELECT id, email_sent_at, delivery_status, created_at
FROM messages
WHERE email_sent_at IS NULL
  AND deleted_at IS NULL
  AND delivery_status != 'read'
  AND created_at < (NOW() - INTERVAL '1 hour')
LIMIT 10;
```

### Cron Job Errors

**Check error messages:**
```sql
SELECT run_at, error, result 
FROM message_email_runs 
WHERE error IS NOT NULL 
ORDER BY run_at DESC LIMIT 1;
```

Common errors:
- `table "admin_config" does not exist` - Run migration 082 first
- `column "email_sent_at" does not exist` - Run migration 082 first
- `permission denied` - Check RLS policies and pg_cron permissions

---

## Alternative: External Scheduler (If pg_cron Not Available)

If Supabase can't enable pg_cron, use GitHub Actions instead:

### Option 1: GitHub Actions Workflow

Create `.github/workflows/send-message-emails.yml`:

```yaml
name: Send Message Emails

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Manual trigger

jobs:
  send-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Send message emails via Edge Function
        run: |
          curl -X POST \
            'https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/send-message-email' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
            -H 'Content-Type: application/json' \
            -d '{"limit": 100}'
```

### Option 2: External Cron Service

Use EasyCron, AWS EventBridge, or similar:

```
Service: EasyCron (easycron.com)
URL: https://[project].supabase.co/functions/v1/send-message-email
Method: POST
Headers:
  Authorization: Bearer [SUPABASE_ANON_KEY]
  Content-Type: application/json
Body: {"limit": 100}
Interval: Hourly
```

---

## Comparison: pg_cron vs External Scheduler

| Aspect | pg_cron | GitHub Actions | External Service |
|--------|---------|----------------|------------------|
| **Setup** | Simple (1 migration) | Easy (1 YAML file) | Simple (web dashboard) |
| **Reliability** | Database-native | 99.9% uptime | Service-dependent |
| **Cost** | Included | Free | Free/Paid |
| **Observability** | Database logs | GitHub logs | Service dashboard |
| **Control** | Full | Full | Limited |
| **Recommended** | Yes (preferred) | Yes (fallback) | Third-choice |

---

## Rollback

If you need to remove the cron job:

```sql
-- Remove the cron job
SELECT cron.unschedule('send_message_emails_hourly');

-- (Optional) Remove audit table and function
DROP TABLE IF EXISTS public.message_email_runs;
DROP FUNCTION IF EXISTS public.scheduled_send_message_emails();
```

---

## Summary Checklist

- [ ] Migration 084 executed successfully
- [ ] pg_cron extension verified with `SELECT extname FROM pg_extension WHERE extname = 'pg_cron'`
- [ ] Cron job created: `SELECT * FROM cron.job WHERE jobname LIKE '%message_email%'`
- [ ] Manual test passed: `SELECT scheduled_send_message_emails()`
- [ ] Audit table populated: `SELECT * FROM message_email_runs`
- [ ] Configuration verified: delay hours and enabled status correct
- [ ] Error monitoring set up: Alerts for failed runs

---

## Next Steps

1. Monitor `message_email_runs` table for successful executions
2. Set up alerts if error rate increases
3. Test email delivery end-to-end with real user scenario
4. Document admin config changes in team wiki

---

**Version:** 1.0  
**Date:** 2026-01-08  
**Module:** MODULE-07 MSG-007  
**Related:** 084_add_pg_cron_send_message_emails.sql
