# SAFETY-001: CPSC API Daily Batch Import - Manual Testing Guide

**Task**: SAFETY-001  
**Module**: MODULE-13-SAFETY-COMPLIANCE.md  
**Test Environment**: iOS & Android Simulators + Supabase Production  
**Prerequisites**: Admin role required for verification steps

---

## Test Execution Commands

### Run Unit Tests
```bash
cd supabase/functions/import-cpsc-recalls
deno test --allow-env __tests__/index.unit.test.ts
```

### Run E2E Tests
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- cpsc-import.e2e.test.ts
```

### Run Maestro Tests
```bash
cd p2p-kids-marketplace
npm run test:maestro:ios -- .maestro/cpsc-import-flow.yaml
npm run test:maestro:android -- .maestro/cpsc-import-flow.yaml
```

---

## SQL Setup (Run in Supabase SQL Editor BEFORE Testing)

### Step 1: Run Migrations

```sql
-- Run these migrations in order:
-- 1. supabase/migrations/303_cpsc_recalls_schema.sql
-- 2. supabase/migrations/304_schedule_cpsc_import.sql
```

### Step 2: Verify Tables Exist

```sql
-- Verify cpsc_recalls table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cpsc_recalls' ORDER BY ordinal_position;

-- Verify cpsc_import_log table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cpsc_import_log' ORDER BY ordinal_position;
```

### Step 3: Verify Indexes

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('cpsc_recalls', 'cpsc_import_log');
```

### Step 4: Verify RLS Policies

```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('cpsc_recalls', 'cpsc_import_log');
```

---

## Manual Test Cases

### TC-001: Database Schema Verification

**Objective**: Verify database tables and schema are correct

**Steps**:
1. Open Supabase Dashboard → SQL Editor
2. Run Step 1 migrations
3. Run Step 2-4 verification queries
4. Verify output matches expected schema

**Expected Results**:
- ✅ `cpsc_recalls` table exists with 13 columns
- ✅ `cpsc_import_log` table exists with 7 columns
- ✅ 4 indexes created on `cpsc_recalls`
- ✅ 2 indexes created on `cpsc_import_log`
- ✅ RLS enabled on both tables
- ✅ 5 RLS policies exist total

**Verification**: Check SQL query results match counts above

---

### TC-002: Edge Function Deployment

**Objective**: Deploy Edge Function to Supabase

**Steps**:
1. Open terminal
2. Navigate to project root
3. Run: `cd supabase/functions/import-cpsc-recalls`
4. Run: `supabase functions deploy import-cpsc-recalls`
5. Verify deployment success message

**Expected Results**:
- ✅ Function deploys without errors
- ✅ Function URL displayed: `https://[PROJECT].supabase.co/functions/v1/import-cpsc-recalls`
- ✅ Function visible in Supabase Dashboard → Edge Functions

**Verification**: Check Supabase Dashboard → Edge Functions → import-cpsc-recalls exists

---

### TC-003: Manual Edge Function Trigger

**Objective**: Manually trigger import to verify functionality

**Steps**:
1. Get your Supabase service role key from Dashboard → Settings → API
2. Run this curl command (replace placeholders):

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/import-cpsc-recalls' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

3. Wait 10-30 seconds for response
4. Check response JSON

**Expected Results**:
- ✅ HTTP 200 response
- ✅ JSON response contains:
  ```json
  {
    "success": true,
    "imported": <number>,
    "updated": <number>,
    "errors": 0,
    "total_processed": <number>,
    "duration": <seconds>
  }
  ```
- ✅ `imported` or `updated` count > 0 (or 0 if no new recalls)

**Verification**: Check Edge Function logs in Supabase Dashboard

---

### TC-004: Verify Import Logs Created

**Objective**: Verify import log entry created in database

**Steps**:
1. Open Supabase SQL Editor
2. Run:

```sql
SELECT * FROM public.cpsc_import_log 
ORDER BY import_date DESC 
LIMIT 5;
```

**Expected Results**:
- ✅ At least 1 row exists
- ✅ Most recent row has:
  - `status` = 'success' or 'partial'
  - `recalls_imported` >= 0
  - `recalls_updated` >= 0
  - `total_processed` >= 0
  - `import_date` is recent (within last hour)
  - `duration_seconds` > 0

**Verification**: Inspect query results

---

### TC-005: Verify Recalls Imported

**Objective**: Verify recall data populated in database

**Steps**:
1. Run SQL query:

```sql
SELECT 
  COUNT(*) as total_recalls,
  MAX(recall_date) as most_recent_recall,
  MIN(recall_date) as oldest_recall
FROM public.cpsc_recalls;
```

2. Then view sample recalls:

```sql
SELECT 
  recall_number,
  product_name,
  manufacturer,
  hazard,
  recall_date
FROM public.cpsc_recalls 
ORDER BY recall_date DESC 
LIMIT 10;
```

**Expected Results**:
- ✅ `total_recalls` > 0 (if any recalls exist in last 30 days)
- ✅ Sample recalls show complete data:
  - `recall_number` not null
  - `product_name` not null
  - `recall_date` not null
  - `hazard` may be null (some recalls don't specify)

**Verification**: Inspect query results

---

### TC-006: Test Duplicate Prevention

**Objective**: Verify duplicate recalls not created

**Steps**:
1. Trigger import twice in a row (use TC-003 curl command twice)
2. Run SQL:

```sql
SELECT recall_number, COUNT(*) as count 
FROM public.cpsc_recalls 
GROUP BY recall_number 
HAVING COUNT(*) > 1;
```

**Expected Results**:
- ✅ Query returns 0 rows (no duplicates)
- ✅ Second import shows `imported=0` but may show `updated>0`

**Verification**: Check query returns empty result

---

### TC-007: Test Search by Product Name

**Objective**: Verify full-text search works

**Steps**:
1. Run SQL query:

```sql
SELECT 
  product_name,
  hazard,
  recall_date
FROM public.cpsc_recalls
WHERE product_name ILIKE '%toy%'
ORDER BY recall_date DESC
LIMIT 10;
```

2. Try different search terms: 'car', 'baby', 'bike', etc.

**Expected Results**:
- ✅ Query returns matching recalls
- ✅ Search is case-insensitive
- ✅ Results sorted by most recent

**Verification**: Inspect query results contain search term

---

### TC-008: Test Date Range Filtering

**Objective**: Verify date filters work correctly

**Steps**:
1. Run SQL:

```sql
SELECT 
  recall_number,
  product_name,
  recall_date
FROM public.cpsc_recalls
WHERE recall_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY recall_date DESC;
```

**Expected Results**:
- ✅ Only recalls from last 30 days returned
- ✅ All dates are within range

**Verification**: Check all `recall_date` values are recent

---

### TC-009: Test RLS - Anonymous Read Access

**Objective**: Verify public can read recalls (no auth required)

**Steps**:
1. Open Supabase API docs or use mobile app
2. Make unauthenticated request:

```javascript
const { data, error } = await supabase
  .from('cpsc_recalls')
  .select('product_name, hazard, recall_date')
  .limit(10);
```

**Expected Results**:
- ✅ Query succeeds without auth
- ✅ Returns recall data
- ✅ No RLS error

**Verification**: Check `error` is null and `data` contains recalls

---

### TC-010: Test RLS - Service Role Write Access

**Objective**: Verify service role can write (for imports)

**Steps**:
1. Use service role key to make insert request
2. Insert test recall:

```sql
-- Using service role connection
INSERT INTO public.cpsc_recalls (
  recall_number,
  product_name,
  recall_date
) VALUES (
  'TEST-001',
  'Test Product',
  CURRENT_DATE
);
```

3. Verify insert succeeded
4. Delete test record:

```sql
DELETE FROM public.cpsc_recalls WHERE recall_number = 'TEST-001';
```

**Expected Results**:
- ✅ Insert succeeds with service role
- ✅ Delete succeeds
- ✅ Regular authenticated user cannot insert (test separately)

**Verification**: Check no RLS errors with service role

---

### TC-011: Configure pg_cron Schedule

**Objective**: Set up daily automated imports

**Steps**:
1. Open Supabase SQL Editor
2. Get your project URL and service role key
3. Run the UPDATE command from migration 304:

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
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_SERVICE_ROLE_KEY'
)
WHERE jobname = 'cpsc-daily-import';
```

4. Verify job updated:

```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'cpsc-daily-import';
```

**Expected Results**:
- ✅ Job shows `active` = true
- ✅ `schedule` = '0 2 * * *' (2 AM daily)
- ✅ `command` contains your actual URL and key

**Verification**: Check cron.job table shows correct config

---

### TC-012: Verify Scheduled Job Execution

**Objective**: Confirm cron job runs successfully

**Steps**:
1. Wait until next day after 2:00 AM UTC
2. Run SQL:

```sql
SELECT 
  job.jobname,
  details.status,
  details.start_time,
  details.end_time,
  details.return_message
FROM cron.job job
JOIN cron.job_run_details details ON job.jobid = details.jobid
WHERE job.jobname = 'cpsc-daily-import'
ORDER BY details.start_time DESC
LIMIT 5;
```

3. Check `cpsc_import_log` for new entry:

```sql
SELECT * FROM public.cpsc_import_log 
WHERE import_date::date = CURRENT_DATE;
```

**Expected Results**:
- ✅ Cron execution shows `status` = 'succeeded'
- ✅ Import log shows new entry for today
- ✅ `recalls_imported` or `recalls_updated` > 0

**Verification**: Check both cron logs and import logs

---

## Error Scenarios

### ER-001: CPSC API Unavailable

**Simulate**: Temporarily change API URL to invalid endpoint

**Steps**:
1. Edit Edge Function to use wrong API URL
2. Redeploy function
3. Trigger import
4. Check error handling

**Expected**:
- ✅ Import fails gracefully
- ✅ Error logged in `cpsc_import_log` with status 'failed'
- ✅ Error message explains API unavailable
- ✅ No partial data inserted

---

### ER-002: Invalid Recall Data

**Simulate**: Mock API returns malformed JSON

**Expected**:
- ✅ Edge Function catches parse error
- ✅ Logs error to `cpsc_import_log`
- ✅ Returns 500 response with error details
- ✅ Database remains consistent (no partial inserts)

---

### ER-003: Database Connection Lost

**Simulate**: Temporarily disable RLS on cpsc_recalls

**Expected**:
- ✅ Import fails
- ✅ Error logged (if possible)
- ✅ Transaction rolled back
- ✅ No orphaned records

---

## Verification Summary Checklist

After completing all test cases, verify:

- [ ] **TC-001**: Schema migration successful
- [ ] **TC-002**: Edge Function deployed
- [ ] **TC-003**: Manual import works
- [ ] **TC-004**: Import logs created
- [ ] **TC-005**: Recalls imported
- [ ] **TC-006**: Duplicates prevented
- [ ] **TC-007**: Search works
- [ ] **TC-008**: Date filtering works
- [ ] **TC-009**: RLS allows public read
- [ ] **TC-010**: RLS allows service role write
- [ ] **TC-011**: pg_cron job configured
- [ ] **TC-012**: Scheduled job runs daily

**All checks must pass ✅ before marking SAFETY-001 as complete.**

---

## MODULE-13-VERIFICATION Mapping

This manual test guide satisfies these verification items:

✅ **1. CPSC Recall Import (Daily Batch)**  
- cpsc_recalls table created (TC-001)
- pg_cron triggers import-cpsc-recalls at 2:00 AM daily (TC-011, TC-012)
- Edge Function calls CPSC API (TC-003)
- Parse XML/JSON response (TC-005)
- Insert into cpsc_recalls table if not exists (TC-005, TC-006)
- Log import: total_imported, total_skipped, errors (TC-004)
- On completion → Check all active listings for matches (SAFETY-002 task)

✅ **2. Import runs daily without fail** (TC-012)  
✅ **3. Duplicates skipped (based on recall_number)** (TC-006)  
✅ **4. All recalls stored with full-text search enabled** (TC-001, TC-007)  
✅ **5. Import logs visible to admin** (TC-004)  
✅ **6. Errors logged if API down** (ER-001, ER-002, ER-003)

---

## Next Steps

After SAFETY-001 verification is complete, proceed to:
- **SAFETY-002**: CPSC Recall Matching Logic (check listings against recalls)
- **SAFETY-003**: Flag items on CPSC match
- **SAFETY-004**: Google Vision image moderation
