# BADGES-V2-008: Retroactive Awarding - Quick Start

## 📋 Summary

Implemented dynamic badge awarding system that automatically awards badges to eligible users when admin lowers thresholds.

## 🎯 What's New

1. **Retroactive Awarding Function** - Awards badges to all users who meet the threshold
2. **Preview Function** - Dry-run to see who would get badges before triggering
3. **Automatic Trigger** - Auto-runs when admin lowers badge threshold
4. **Manual Admin Trigger** - Admin can manually trigger retroactive awards

---

## 🚀 STEP 1: Apply SQL Migration

Run this in **Supabase SQL Editor**:

```bash
# The migration file is located at:
# /supabase/migrations/20260112000002_retroactive_badges.sql
```

Copy and paste the entire file contents into Supabase SQL Editor and run.

---

## 🧪 STEP 2: Quick Test (SQL)

### Test 1: Preview Eligible Users

```sql
-- Find a badge ID
SELECT id, name, threshold FROM badges WHERE category = 'sp_earning' LIMIT 1;

-- Preview who would get the badge
SELECT * FROM preview_retroactive_awards('PASTE_BADGE_ID_HERE');
```

### Test 2: Manually Trigger Awarding

```sql
-- Trigger retroactive awards (admin only)
SELECT * FROM admin_trigger_retroactive_awards(
  'PASTE_BADGE_ID_HERE',
  'Testing retroactive awarding'
);
```

### Test 3: Verify Automatic Trigger

```sql
-- Lower a threshold (this will auto-trigger retroactive awarding)
UPDATE badges 
SET threshold = 5 
WHERE name = 'SP Earner - Bronze';

-- Wait 2 seconds, then check audit logs
SELECT * FROM badge_audit_logs 
WHERE action_type = 'bulk_award' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 📱 STEP 3: Test Mobile App Functions (Optional)

### Install dependencies (if needed):
```bash
cd p2p-kids-marketplace
npm install
```

### Run unit tests:
```bash
npm test -- src/__tests__/services/badges-retroactive.test.ts
```

### Run E2E tests:
```bash
npm test -- src/__tests__/e2e/badges-retroactive.e2e.ts
```

---

## 🔍 STEP 4: Verify Everything Works

Run this verification query in Supabase:

```sql
-- 1. Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'retroactive_award_badges',
  'admin_trigger_retroactive_awards',
  'preview_retroactive_awards',
  'trigger_retroactive_award_on_threshold_decrease'
);
-- Should return 4 rows

-- 2. Check trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_retroactive_award_on_threshold_decrease';
-- Should return 1 row

-- 3. Test preview (pick any active badge)
SELECT * FROM preview_retroactive_awards(
  (SELECT id FROM badges WHERE is_active = TRUE LIMIT 1)
);
-- Should return eligible users or empty array (both OK)
```

---

## ✅ Success Criteria

You should see:
- ✅ All 4 SQL functions created
- ✅ Trigger on `badges` table for threshold changes
- ✅ Preview function returns eligible users
- ✅ Manual trigger awards badges and returns count
- ✅ Audit logs capture retroactive award events
- ✅ Lowering threshold auto-triggers retroactive awarding

---

## 🐛 Troubleshooting

### Issue: "Function does not exist"
**Fix:** Re-run the migration SQL file in Supabase SQL Editor

### Issue: "Unauthorized: Admin privileges required"
**Fix:** Ensure your user has `raw_user_meta_data->>'is_admin' = 'true'`

```sql
-- Make yourself admin:
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'
)
WHERE id = auth.uid();
```

### Issue: "Badge not found or inactive"
**Fix:** Check badge is active and not archived:

```sql
SELECT id, name, is_active, is_archived 
FROM badges 
WHERE id = 'YOUR_BADGE_ID';

-- Activate if needed:
UPDATE badges 
SET is_active = TRUE, is_archived = FALSE 
WHERE id = 'YOUR_BADGE_ID';
```

---

## 📚 Related Files

### Created:
- `supabase/migrations/20260112000002_retroactive_badges.sql`
- `p2p-kids-marketplace/src/__tests__/services/badges-retroactive.test.ts`
- `p2p-kids-marketplace/src/__tests__/e2e/badges-retroactive.e2e.ts`
- `BADGES-V2-008-MANUAL-TESTING-GUIDE.md`

### Modified:
- `p2p-kids-marketplace/src/services/badges.ts` (added retroactive functions)

---

## 🎓 How It Works

1. **Preview**: Admin previews who would get a badge if retroactive awarding runs
2. **Manual Trigger**: Admin clicks "Award Retroactively" → runs RPC → badges awarded
3. **Auto Trigger**: Admin lowers threshold in UI → UPDATE triggers → automatic retroactive awarding
4. **Audit Trail**: Every retroactive award is logged in `badge_audit_logs`

---

## 📖 Full Testing Guide

For complete test cases, see:
- **Manual Testing:** `BADGES-V2-008-MANUAL-TESTING-GUIDE.md`
- **Unit Tests:** Run `npm test -- badges-retroactive.test.ts`
- **E2E Tests:** Run `npm test -- badges-retroactive.e2e.ts`

---

**Next Steps:**
- Integrate with admin portal UI (BADGES-V2-007 task)
- Add "Preview & Award" button to badge management screen
- Display audit logs in admin dashboard
