# BADGES-V2-008: SQL Commands to Run in Supabase

## ⚠️ IMPORTANT
You must run these commands in your **production Supabase SQL Editor** since you don't use Supabase locally.

---

## STEP 1: Apply Migration

Copy the entire contents of this file into Supabase SQL Editor:

**File:** `/supabase/migrations/20260112000002_retroactive_badges.sql`

**Location:** `/Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260112000002_retroactive_badges.sql`

Click "Run" to execute the migration.

---

## STEP 2: Verify Installation

Run this verification query to confirm everything was created:

```sql
-- Check all functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'retroactive_award_badges',
  'trigger_retroactive_award_on_threshold_decrease',
  'admin_trigger_retroactive_awards',
  'preview_retroactive_awards'
)
ORDER BY routine_name;
```

**Expected Result:** Should return 4 rows (all functions created)

---

## STEP 3: Check Trigger

```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_retroactive_award_on_threshold_decrease';
```

**Expected Result:** Should return 1 row showing trigger on `badges` table

---

## STEP 4: Quick Smoke Test

### Test 4.1: Preview Eligible Users

```sql
-- Find an SP earning badge
SELECT id, name, threshold FROM badges WHERE category = 'sp_earning' AND is_active = TRUE LIMIT 1;
-- Copy the badge ID

-- Preview who would get the badge (replace YOUR_BADGE_ID with actual ID)
SELECT * FROM preview_retroactive_awards('YOUR_BADGE_ID');
```

**Expected Result:** Returns list of users with their SP amounts and `already_has_badge` flag

---

### Test 4.2: Manually Trigger Retroactive Award

```sql
-- Trigger retroactive awarding (replace YOUR_BADGE_ID)
SELECT * FROM admin_trigger_retroactive_awards(
  'YOUR_BADGE_ID',
  'Testing retroactive awarding from Quick Start guide'
);
```

**Expected Result:** Returns JSON with:
- `success: true`
- `badge_name: "..."`
- `awarded_count: X`

---

### Test 4.3: Verify Audit Log

```sql
-- Check that audit log entry was created
SELECT *
FROM badge_audit_logs
WHERE action_type = 'bulk_award'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:** Shows recent audit log entry with your reason

---

### Test 4.4: Test Automatic Trigger

```sql
-- First, check current threshold
SELECT id, name, threshold FROM badges WHERE name = 'SP Earner - Bronze';
-- Note the current threshold

-- Lower the threshold (this will auto-trigger retroactive awarding)
UPDATE badges 
SET threshold = 5 
WHERE name = 'SP Earner - Bronze';

-- Wait 2-3 seconds, then check if new badges were awarded
SELECT COUNT(*) as total_badges_awarded
FROM user_badges
WHERE badge_id = (SELECT id FROM badges WHERE name = 'SP Earner - Bronze');

-- Check audit log for automatic trigger
SELECT *
FROM badge_audit_logs
WHERE badge_id = (SELECT id FROM badges WHERE name = 'SP Earner - Bronze')
  AND action_type = 'bulk_award'
ORDER BY created_at DESC
LIMIT 1;

-- IMPORTANT: Restore original threshold after testing!
UPDATE badges 
SET threshold = 10  -- Replace 10 with original value
WHERE name = 'SP Earner - Bronze';
```

**Expected Result:** Audit log shows automatic trigger with `triggered_by: 'threshold_decrease'`

---

## STEP 5: Make Yourself Admin (If Needed)

If you get "Unauthorized: Admin privileges required" errors:

```sql
-- Check if you're already an admin
SELECT id, email, raw_user_meta_data->>'is_admin' as is_admin
FROM auth.users
WHERE id = auth.uid();

-- If is_admin is NULL or FALSE, run this:
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'
)
WHERE id = auth.uid();

-- Verify it worked
SELECT id, email, raw_user_meta_data->>'is_admin' as is_admin
FROM auth.users
WHERE id = auth.uid();
```

**Expected Result:** `is_admin` should now be `'true'`

---

## TROUBLESHOOTING

### Error: "relation 'sp_ledger' does not exist"
**Cause:** SP ledger table not created yet  
**Fix:** Run MODULE-09 migrations first (Swap Points module)

### Error: "relation 'transactions' does not exist"  
**Cause:** Transactions table not created yet  
**Fix:** Run MODULE-06 migrations first (Trade Flow module)

### Error: "function is_admin() does not exist"
**Cause:** Admin helper function not created  
**Fix:** Run this:

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt()->>'is_admin')::boolean,
    (SELECT raw_user_meta_data->>'is_admin' = 'true'
     FROM auth.users
     WHERE id = auth.uid())
  );
$$;
```

---

## NEXT STEPS AFTER SQL

1. Run mobile app tests:
   ```bash
   cd p2p-kids-marketplace
   npm test -- src/__tests__/services/badges-retroactive.test.ts
   ```

2. Follow complete manual testing guide:
   - Open `BADGES-V2-008-MANUAL-TESTING-GUIDE.md`
   - Complete all 22 test cases

3. Integrate with admin portal:
   - Add "Preview Awards" button to badge management UI
   - Add "Award Retroactively" button
   - Display audit logs

---

## REFERENCE

- **Migration File:** `supabase/migrations/20260112000002_retroactive_badges.sql`
- **Service Functions:** `p2p-kids-marketplace/src/services/badges.ts`
- **Full Testing Guide:** `BADGES-V2-008-MANUAL-TESTING-GUIDE.md`
- **Implementation Summary:** `BADGES-V2-008-IMPLEMENTATION-SUMMARY.md`
