# SAFETY-002: Quick Setup Guide

**Date**: March 29, 2026  
**Issues Addressed**:
1. Empty `cpsc_recalls` table - how to populate
2. CPSC config in admin portal at http://localhost:3001/config

---

## Issue 1: Populating cpsc_recalls Table

### Background
The `cpsc_recalls` table is populated by the **`import-cpsc-recalls`** Edge Function, which:
- Fetches recall data from the official **CPSC public API** (https://www.saferproducts.gov/RestWebServices/Recall)
- Runs **automatically every day at 2:00 AM UTC** via pg_cron scheduled job
- Imports the last 30 days of recalls on each run
- Stores recalls with full-text search enabled for matching against listings

### Solution: Manual Trigger (First Time Setup)

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to: https://drntwgporzabmxdqykrp.supabase.co/project/default/functions
2. Find the **"import-cpsc-recalls"** function in the list
3. Click the **"Invoke"** button
4. In the modal, click **"Execute"** (no request body needed)
5. Wait 10-30 seconds for import to complete
6. Verify success in the logs

**Option B: Via curl with Service Role Key**

```bash
# Get your service role key from Supabase Dashboard → Settings → API
# IMPORTANT: Never commit this key to git!

curl -X POST \
  "https://drntwgporzabmxdqykrp.supabase.co/functions/v1/import-cpsc-recalls" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "imported": 150,
  "updated": 5,
  "processed": 155,
  "message": "Successfully imported 150 new recalls"
}
```

### Verify Import Success

Run this SQL in Supabase SQL Editor:

```sql
-- Check total recalls imported
SELECT COUNT(*) as total_recalls FROM cpsc_recalls;
-- Expected: 100+ recalls (varies by date)

-- View recent recalls
SELECT 
  recall_number,
  recall_date,
  title,
  product_name,
  manufacturer,
  hazards
FROM cpsc_recalls 
ORDER BY recall_date DESC 
LIMIT 10;

-- Check import logs
SELECT * FROM cpsc_import_log 
ORDER BY created_at DESC 
LIMIT 5;
```

### Troubleshooting

**Issue**: "No new recalls found" but table is empty

**Solution**: The API may not have returned data. Try adjusting the date range:
1. Edit `supabase/functions/import-cpsc-recalls/index.ts`
2. Change `const daysBack = 30;` to `const daysBack = 90;` (3 months)
3. Redeploy: `supabase functions deploy import-cpsc-recalls`
4. Trigger again

**Issue**: "CPSC API error: 503 Service Unavailable"

**Solution**: CPSC API is temporarily down. Wait 10-15 minutes and retry.

---

## Issue 2: Add CPSC Config to Admin Portal

### Changes Made

✅ **Updated Admin Portal UI** (`p2p-kids-admin/src/app/config/page.tsx`):
- Added description for `cpsc_recall_check_enabled`
- Added description for `cpsc_match_threshold`
- Added help text explaining both settings

✅ **Created SQL Script** (`scripts/insert-cpsc-config.sql`):
- Inserts both config items into `admin_config` table
- Sets default values (`cpsc_recall_check_enabled=true`, `cpsc_match_threshold=0.5`)
- Uses `ON CONFLICT` for safe re-running

### Deployment Steps

#### Step 1: Insert Config Items into Database

Run this SQL in Supabase SQL Editor:

```sql
-- Insert CPSC recall check enabled flag (default: true)
INSERT INTO admin_config (key, value, category, description)
VALUES (
  'cpsc_recall_check_enabled',
  'true',
  'safety',
  'Enable automatic CPSC recall matching for new listings'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert CPSC match threshold (default: 0.5)
INSERT INTO admin_config (key, value, category, description)
VALUES (
  'cpsc_match_threshold',
  '0.5',
  'safety',
  'Confidence threshold (0.0-1.0) for automatic item flagging'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify insertion
SELECT key, value, category, description 
FROM admin_config 
WHERE key IN ('cpsc_recall_check_enabled', 'cpsc_match_threshold');
```

**Expected Result**:
```
key                          | value | category | description
-----------------------------|-------|----------|-------------
cpsc_recall_check_enabled    | true  | safety   | Enable automatic...
cpsc_match_threshold         | 0.5   | safety   | Confidence threshold...
```

#### Step 2: Restart Admin Portal (if already running)

```bash
cd p2p-kids-admin

# Kill existing process (Ctrl+C or find PID)
# Then restart:
npm run dev
```

#### Step 3: Verify in Admin UI

1. Open: http://localhost:3001/config
2. Scroll to **"Safety"** section
3. You should see two new config items:
   
   **Cpsc Recall Check Enabled**
   - Description: "Enable automatic CPSC recall matching for new listings..."
   - Input field with value: `true`
   - Save button
   
   **Cpsc Match Threshold**
   - Description: "Confidence threshold (0.0-1.0) for automatic item flagging..."
   - Input field with value: `0.5`
   - Save button

### How to Use

#### Enable/Disable CPSC Checking

1. Navigate to http://localhost:3001/config
2. Find **"Cpsc Recall Check Enabled"** in Safety section
3. Change value to:
   - `true` - Enable CPSC checking (default)
   - `false` - Disable CPSC checking (for testing only)
4. Click **"Save"**

#### Adjust Match Sensitivity

1. Navigate to http://localhost:3001/config
2. Find **"Cpsc Match Threshold"** in Safety section
3. Adjust value (0.0 to 1.0):
   - `0.3` - Very sensitive (more false positives, catches more recalls)
   - `0.5` - **Default** (balanced)
   - `0.7` - Less sensitive (fewer false positives, may miss some)
   - `0.9` - Very strict (minimal false positives, may miss recalls)
4. Click **"Save"**

**Recommendation**: Start with `0.5` and adjust based on false positive rate after 1-2 weeks.

---

## Complete Setup Checklist

- [ ] **Step 1**: Trigger CPSC import (via Supabase Dashboard or curl)
- [ ] **Step 2**: Verify recalls imported (run SQL query: `SELECT COUNT(*) FROM cpsc_recalls`)
- [ ] **Step 3**: Insert CPSC config items (run SQL from `scripts/insert-cpsc-config.sql`)
- [ ] **Step 4**: Restart admin portal (`cd p2p-kids-admin && npm run dev`)
- [ ] **Step 5**: Verify config appears at http://localhost:3001/config
- [ ] **Step 6**: Test CPSC checking with a listing (follow SAFETY-002-MANUAL-TESTING-GUIDE.md)

---

## Testing After Setup

### Test 1: Verify CPSC Check is Enabled

```sql
-- Should return: cpsc_recall_check_enabled = 'true'
SELECT value FROM admin_config WHERE key = 'cpsc_recall_check_enabled';
```

### Test 2: Create Safe Listing (Should NOT Flag)

1. Open mobile app
2. Create listing: "LEGO Building Blocks Set"
3. Verify listing is created with status = `available`
4. Check: No safety flags created

### Test 3: Create Flagged Listing (Should Flag)

1. Open mobile app
2. Create listing: "Fisher-Price Rock 'n Play Sleeper"
3. Verify listing is created
4. Wait 3-5 seconds
5. Check database:
   ```sql
   SELECT status, flagged_at FROM items WHERE title ILIKE '%Fisher-Price%' ORDER BY created_at DESC LIMIT 1;
   -- Expected: status='flagged', flagged_at IS NOT NULL
   
   SELECT * FROM item_safety_flags WHERE item_id = '<item_id>';
   -- Expected: 1 row with flag_type='cpsc_recall', confidence_score >= 0.5
   ```

---

## Summary

### Issue 1: Empty cpsc_recalls Table
**Root Cause**: Import function not triggered yet (scheduled for daily 2:00 AM UTC)  
**Solution**: Manually trigger via Supabase Dashboard or curl  
**Result**: Table populated with 100+ recalls from CPSC API

### Issue 2: CPSC Config Missing from Admin UI
**Root Cause**: Config items not yet in admin_config table  
**Solution**: Run SQL script to insert both config items  
**Result**: Two new settings appear in http://localhost:3001/config under "Safety" section

---

## Next Steps

1. Complete this setup guide checklist
2. Follow **SAFETY-002-MANUAL-TESTING-GUIDE.md** to test CPSC matching
3. Monitor false positive rate over 1-2 weeks
4. Adjust `cpsc_match_threshold` if needed
5. Set up alert for daily CPSC import failures (optional)

---

## Support Resources

- **CPSC API Docs**: https://www.saferproducts.gov/api/
- **Implementation Summary**: SAFETY-002-IMPLEMENTATION-SUMMARY.md
- **Manual Testing Guide**: SAFETY-002-MANUAL-TESTING-GUIDE.md
- **Quick Reference**: SAFETY-002-QUICK-REFERENCE.md

---

_Setup guide complete. Both issues resolved._
