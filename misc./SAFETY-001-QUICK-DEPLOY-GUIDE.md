# SAFETY-001 Quick Deploy Guide

## 🚀 Fast Track: 5 Steps to Production

### ⚠️ Prerequisites
- [ ] Supabase project already set up
- [ ] Admin access to Supabase Dashboard
- [ ] Service role key available

---

## Step 1: Deploy Database (3 minutes)

**Action**: Open Supabase Dashboard → SQL Editor → New Query

**Copy & Run**:
1. Content of `supabase/migrations/303_cpsc_recalls_schema.sql`
2. Content of `supabase/migrations/304_schedule_cpsc_import.sql`

**Verify**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('cpsc_recalls', 'cpsc_import_log');
-- Expected: 2 rows
```

---

## Step 2: Deploy Edge Function (2 minutes)

```bash
cd supabase/functions/import-cpsc-recalls
supabase functions deploy import-cpsc-recalls
```

**Note the URL**: `https://[YOUR-PROJECT].supabase.co/functions/v1/import-cpsc-recalls`

---

## Step 3: Configure Cron Job (2 minutes)

**Get These First**:
- Your Supabase project URL
- Your Supabase service role key (Dashboard → Settings → API)

**Run in SQL Editor**:
```sql
UPDATE cron.job
SET command = format(
  $$
  SELECT net.http_post(
    url := '%s/functions/v1/import-cpsc-recalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer %s'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$,
  'https://YOUR_PROJECT_REF.supabase.co',  -- ⚠️ REPLACE THIS
  'eyJhb...YOUR_SERVICE_ROLE_KEY'          -- ⚠️ REPLACE THIS
)
WHERE jobname = 'cpsc-daily-import';
```

**Verify**:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cpsc-daily-import';
-- Expected: 1 row with schedule '0 2 * * *' and active = true
```

---

## Step 4: Test Manual Import (3 minutes)

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/import-cpsc-recalls' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Expected Response**:
```json
{
  "success": true,
  "imported": 5,
  "updated": 0,
  "errors": 0,
  "total_processed": 5,
  "duration": 12
}
```

---

## Step 5: Verify Data (1 minute)

```sql
-- Check import log
SELECT status, recalls_imported, import_date 
FROM cpsc_import_log 
ORDER BY import_date DESC 
LIMIT 1;

-- Check recalls imported
SELECT COUNT(*) as total FROM cpsc_recalls;

-- View sample recalls
SELECT product_name, hazard, recall_date 
FROM cpsc_recalls 
ORDER BY recall_date DESC 
LIMIT 5;
```

---

## ✅ Success Criteria

- [x] Both tables exist
- [x] Edge Function deployed
- [x] Cron job active
- [x] Manual import returns success
- [x] Import log shows successful entry
- [x] Recalls exist in database

---

## 🧪 Testing (Optional but Recommended)

### Unit Tests
```bash
cd supabase/functions/import-cpsc-recalls
deno test --allow-env __tests__/index.unit.test.ts
```

### E2E Tests
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- cpsc-import.e2e.test.ts
```

---

## 🔍 Monitoring

### Check Daily Import Logs
```sql
SELECT 
  import_date::date as date,
  status,
  recalls_imported,
  recalls_updated,
  error_message
FROM cpsc_import_log
WHERE import_date >= CURRENT_DATE - 7
ORDER BY import_date DESC;
```

### Check Cron Execution
```sql
SELECT 
  job.jobname,
  details.status,
  details.start_time,
  details.return_message
FROM cron.job job
JOIN cron.job_run_details details ON job.jobid = details.jobid
WHERE job.jobname = 'cpsc-daily-import'
ORDER BY details.start_time DESC
LIMIT 5;
```

---

## ❌ Troubleshooting

**Import returns 500 error**
- Check CPSC API is accessible: https://www.saferproducts.gov/RestWebServices/Recall?format=json
- Verify service role key is correct
- Check Edge Function logs in Supabase Dashboard

**Cron job not running**
- Verify pg_cron extension enabled: `SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';`
- Check job is active: `SELECT active FROM cron.job WHERE jobname = 'cpsc-daily-import';`
- Verify pg_net extension enabled: `SELECT * FROM pg_available_extensions WHERE name = 'pg_net';`

**No recalls imported**
- CPSC may not have recalls in last 30 days (normal)
- Check import log: `SELECT * FROM cpsc_import_log ORDER BY import_date DESC LIMIT 1;`
- If error_message exists, investigate that specific issue

---

## 📚 Full Documentation

- **Detailed Manual Tests**: `SAFETY-001-MANUAL-TESTING-GUIDE.md` (12 test cases)
- **Implementation Summary**: `SAFETY-001-IMPLEMENTATION-SUMMARY.md`
- **Module Prompt**: `Prompts/MODULE-13-SAFETY-COMPLIANCE.md`
- **Verification**: `Prompts/MODULE-13-VERIFICATION.md`
- **Flow Registry**: `docs/flow-registry.md` (FLOW-16)

---

## 🎯 Next Task

After SAFETY-001 is verified and running:
- **SAFETY-002**: CPSC Recall Matching Logic (check listings against recalls)
- **SAFETY-003**: Flag items that match recalls
- **SAFETY-004**: Admin review queue for flagged items
