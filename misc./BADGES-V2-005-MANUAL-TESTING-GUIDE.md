# BADGES-V2-005: Admin Configuration & History - Manual Testing Guide

**Task:** Admin Configuration Schema & History  
**Module:** MODULE-08-BADGES-V2.md  
**Date:** January 11, 2026

---

## Prerequisites

Before starting manual testing:

1. ✅ Migration `20260111000000_badge_admin_config.sql` applied to Supabase production
2. ✅ Admin account with `is_admin = true` in profiles table
3. ✅ At least 2 test user accounts (one for badge awarding)
4. ✅ Existing badges in the `badges` table

---

## Test Environment Setup

### Step 1: Apply Migration

```bash
# Run in Supabase SQL Editor
-- Copy and paste the entire contents of:
-- supabase/migrations/20260111000000_badge_admin_config.sql

-- After running, verify with these queries:
SELECT COUNT(*) FROM badge_config_history;
SELECT COUNT(*) FROM badge_audit_logs;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'badges' AND column_name IN ('is_archived', 'updated_at');
```

**Expected Results:**
- badge_config_history table exists (count = 0 initially)
- badge_audit_logs table exists (count = 0 initially)
- badges table has `is_archived` and `updated_at` columns

---

## Test Case 1: Badge Schema Extensions

**Objective:** Verify new columns exist and function correctly

### TC1.1: Verify is_archived Column

**Steps:**
1. Open Supabase SQL Editor
2. Run query:
   ```sql
   SELECT id, name, is_archived, is_active 
   FROM badges 
   LIMIT 5;
   ```

**Expected Result:**
- Query returns successfully
- `is_archived` column shows `false` for existing badges
- `is_active` column exists alongside `is_archived`

**Status:** [ ] Pass [ ] Fail

---

### TC1.2: Verify updated_at Column

**Steps:**
1. Run query:
   ```sql
   SELECT id, name, created_at, updated_at 
   FROM badges 
   WHERE name = 'SP Earner - Bronze';
   ```
2. Note the `updated_at` timestamp
3. Update the badge:
   ```sql
   UPDATE badges 
   SET description = 'Updated description for testing'
   WHERE name = 'SP Earner - Bronze';
   ```
4. Re-run the SELECT query

**Expected Result:**
- `updated_at` timestamp is more recent than before the UPDATE
- `updated_at` is automatically updated by trigger

**Status:** [ ] Pass [ ] Fail

---

### TC1.3: Test Archived Badge Filtering

**Steps:**
1. Archive a test badge:
   ```sql
   UPDATE badges 
   SET is_archived = true 
   WHERE name = 'SP Earner - Platinum';
   ```
2. Query active, non-archived badges:
   ```sql
   SELECT id, name, is_active, is_archived 
   FROM badges 
   WHERE is_active = true AND is_archived = false;
   ```
3. Verify 'SP Earner - Platinum' is NOT in results
4. Query all badges including archived:
   ```sql
   SELECT id, name, is_active, is_archived 
   FROM badges 
   WHERE name = 'SP Earner - Platinum';
   ```
5. Restore the badge:
   ```sql
   UPDATE badges 
   SET is_archived = false 
   WHERE name = 'SP Earner - Platinum';
   ```

**Expected Result:**
- Active query excludes archived badge
- Direct query shows badge still exists with is_archived = true
- Badge is successfully restored

**Status:** [ ] Pass [ ] Fail

---

## Test Case 2: Manual Badge Award (RPC)

**Objective:** Test admin manual badge awarding with audit logging

### TC2.1: Award Badge to User

**Prerequisites:**
- Admin user ID: `[YOUR_ADMIN_USER_ID]`
- Test user ID: `[TEST_USER_ID]`
- Badge ID: Get from `SELECT id FROM badges WHERE name = 'First Trade' LIMIT 1;`

**Steps:**
1. Call the RPC in Supabase SQL Editor:
   ```sql
   SELECT * FROM manual_award_badge(
     '[TEST_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'Manual award for testing purposes'
   );
   ```

2. Verify the result JSON shows `success: true`

3. Verify user_badges entry created:
   ```sql
   SELECT * FROM user_badges 
   WHERE user_id = '[TEST_USER_ID]' 
   AND badge_id = '[BADGE_ID]';
   ```

4. Check audit log:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     '[TEST_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'manual_award',
     10
   );
   ```

**Expected Result:**
- RPC returns `{"success": true, "message": "Badge awarded successfully", "badge_id": "...", "badge_name": "..."}`
- user_badges has new entry
- Audit log shows action_type = 'manual_award' with reason

**Status:** [ ] Pass [ ] Fail

---

### TC2.2: Prevent Duplicate Award

**Steps:**
1. Try to award the same badge again (use same SQL from TC2.1)

**Expected Result:**
- RPC returns `{"success": false, "message": "User already has this badge"}`
- No duplicate entry in user_badges table

**Status:** [ ] Pass [ ] Fail

---

### TC2.3: Award Badge Without Reason

**Steps:**
1. Award different badge without reason parameter:
   ```sql
   SELECT * FROM manual_award_badge(
     '[TEST_USER_ID]'::uuid,
     '[DIFFERENT_BADGE_ID]'::uuid,
     NULL
   );
   ```

**Expected Result:**
- Badge awarded successfully
- Audit log shows NULL for reason field

**Status:** [ ] Pass [ ] Fail

---

## Test Case 3: Manual Badge Revoke (RPC)

**Objective:** Test admin manual badge revocation

### TC3.1: Revoke Previously Awarded Badge

**Prerequisites:**
- Badge must have been awarded in TC2.1

**Steps:**
1. Revoke the badge:
   ```sql
   SELECT * FROM manual_revoke_badge(
     '[TEST_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'Revoke for testing purposes'
   );
   ```

2. Verify result shows success

3. Verify user_badges entry deleted:
   ```sql
   SELECT * FROM user_badges 
   WHERE user_id = '[TEST_USER_ID]' 
   AND badge_id = '[BADGE_ID]';
   ```

4. Check audit log:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     '[TEST_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'manual_revoke',
     10
   );
   ```

**Expected Result:**
- RPC returns `{"success": true, "message": "Badge revoked successfully"}`
- user_badges entry is deleted
- Audit log shows action_type = 'manual_revoke'

**Status:** [ ] Pass [ ] Fail

---

### TC3.2: Revoke Non-Existent Badge

**Steps:**
1. Try to revoke badge user doesn't have:
   ```sql
   SELECT * FROM manual_revoke_badge(
     '[TEST_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'Attempting to revoke non-existent badge'
   );
   ```

**Expected Result:**
- RPC returns `{"success": false, "message": "User does not have this badge"}`

**Status:** [ ] Pass [ ] Fail

---

## Test Case 4: Badge Configuration History

**Objective:** Verify configuration change tracking

### TC4.1: Track Threshold Changes

**Steps:**
1. Get current threshold:
   ```sql
   SELECT id, name, threshold FROM badges 
   WHERE name = 'SP Earner - Silver';
   ```
   Note: threshold should be 50

2. Update threshold:
   ```sql
   UPDATE badges 
   SET threshold = 75 
   WHERE name = 'SP Earner - Silver';
   ```

3. Wait 2 seconds for trigger to complete

4. Check config history:
   ```sql
   SELECT * FROM get_badge_config_history(
     (SELECT id FROM badges WHERE name = 'SP Earner - Silver'),
     10
   );
   ```

5. Restore original threshold:
   ```sql
   UPDATE badges 
   SET threshold = 50 
   WHERE name = 'SP Earner - Silver';
   ```

**Expected Result:**
- Config history shows entry with:
  - old_threshold = 50
  - new_threshold = 75
  - change_type = 'threshold' or 'multiple'
  - admin_id populated
  - changed_at timestamp is recent

**Status:** [ ] Pass [ ] Fail

---

### TC4.2: Track Name Changes

**Steps:**
1. Update badge name:
   ```sql
   UPDATE badges 
   SET name = '10 Trades - Updated' 
   WHERE name = '10 Trades';
   ```

2. Wait 2 seconds

3. Check config history:
   ```sql
   SELECT * FROM get_badge_config_history(
     (SELECT id FROM badges WHERE name = '10 Trades - Updated'),
     5
   );
   ```

4. Restore original name:
   ```sql
   UPDATE badges 
   SET name = '10 Trades' 
   WHERE name = '10 Trades - Updated';
   ```

**Expected Result:**
- Config history shows:
  - old_name = '10 Trades'
  - new_name = '10 Trades - Updated'
  - change_type = 'name' or 'multiple'

**Status:** [ ] Pass [ ] Fail

---

### TC4.3: Track is_active Changes

**Steps:**
1. Deactivate a badge:
   ```sql
   UPDATE badges 
   SET is_active = false 
   WHERE name = '6-Month Subscriber';
   ```

2. Wait 2 seconds

3. Check config history:
   ```sql
   SELECT * FROM get_badge_config_history(
     (SELECT id FROM badges WHERE name = '6-Month Subscriber'),
     5
   );
   ```

4. Reactivate badge:
   ```sql
   UPDATE badges 
   SET is_active = true 
   WHERE name = '6-Month Subscriber';
   ```

**Expected Result:**
- Config history shows:
  - old_is_active = true
  - new_is_active = false
  - change_type = 'is_active' or 'multiple'

**Status:** [ ] Pass [ ] Fail

---

### TC4.4: Track Multiple Changes

**Steps:**
1. Update multiple fields at once:
   ```sql
   UPDATE badges 
   SET 
     threshold = 200,
     description = 'Earn 200 Swap Points - Updated',
     is_active = false
   WHERE name = 'SP Earner - Gold';
   ```

2. Wait 2 seconds

3. Check config history:
   ```sql
   SELECT * FROM get_badge_config_history(
     (SELECT id FROM badges WHERE name = 'SP Earner - Gold'),
     1
   );
   ```

4. Restore original values:
   ```sql
   UPDATE badges 
   SET 
     threshold = 100,
     description = 'Earned 100 Swap Points',
     is_active = true
   WHERE name = 'SP Earner - Gold';
   ```

**Expected Result:**
- Config history shows:
  - change_type = 'multiple'
  - All changed fields captured (old_threshold, new_threshold, old_description, new_description, old_is_active, new_is_active)

**Status:** [ ] Pass [ ] Fail

---

## Test Case 5: Badge Audit Logs Query

**Objective:** Test comprehensive audit log retrieval

### TC5.1: Query All Logs for User

**Steps:**
1. Run query:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     '[TEST_USER_ID]'::uuid,
     NULL,
     NULL,
     50
   );
   ```

**Expected Result:**
- Returns all audit logs for the test user
- Shows both manual_award and manual_revoke actions
- Includes admin_name, user_name, badge_name
- Ordered by created_at DESC (most recent first)

**Status:** [ ] Pass [ ] Fail

---

### TC5.2: Filter by Action Type

**Steps:**
1. Query only awards:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     NULL,
     NULL,
     'manual_award',
     20
   );
   ```

2. Query only revokes:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     NULL,
     NULL,
     'manual_revoke',
     20
   );
   ```

**Expected Result:**
- First query returns only manual_award actions
- Second query returns only manual_revoke actions

**Status:** [ ] Pass [ ] Fail

---

### TC5.3: Filter by Badge

**Steps:**
1. Get a specific badge ID:
   ```sql
   SELECT id FROM badges WHERE name = 'First Trade';
   ```

2. Query logs for that badge:
   ```sql
   SELECT * FROM get_badge_audit_logs(
     NULL,
     '[BADGE_ID]'::uuid,
     NULL,
     50
   );
   ```

**Expected Result:**
- Returns only audit logs related to the specified badge
- Shows all users who had this badge awarded/revoked

**Status:** [ ] Pass [ ] Fail

---

## Test Case 6: Admin Authorization

**Objective:** Verify only admins can perform admin operations

### TC6.1: Non-Admin Cannot Award Badge

**Prerequisites:**
- Sign in as non-admin user in Supabase dashboard

**Steps:**
1. Try to call manual_award_badge as non-admin:
   ```sql
   SELECT * FROM manual_award_badge(
     '[SOME_USER_ID]'::uuid,
     '[BADGE_ID]'::uuid,
     'Unauthorized attempt'
   );
   ```

**Expected Result:**
- Query fails with error: "Unauthorized: Admin privileges required"

**Status:** [ ] Pass [ ] Fail

---

### TC6.2: Non-Admin Cannot View Audit Logs

**Steps:**
1. As non-admin, try to query audit logs:
   ```sql
   SELECT * FROM get_badge_audit_logs(NULL, NULL, NULL, 10);
   ```

**Expected Result:**
- Query fails with error: "Unauthorized: Admin privileges required"

**Status:** [ ] Pass [ ] Fail

---

## Test Case 7: Performance & Indexes

**Objective:** Verify queries perform efficiently with indexes

### TC7.1: Verify Indexes Exist

**Steps:**
1. Check indexes on badge_config_history:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'badge_config_history';
   ```

2. Check indexes on badge_audit_logs:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'badge_audit_logs';
   ```

**Expected Result:**
- badge_config_history has indexes on: badge_id, admin_id, changed_at
- badge_audit_logs has indexes on: badge_id, user_id, admin_id, action_type, created_at

**Status:** [ ] Pass [ ] Fail

---

### TC7.2: Test Query Performance

**Steps:**
1. Enable query timing:
   ```sql
   \timing
   ```

2. Run a complex audit log query:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM get_badge_audit_logs(NULL, NULL, NULL, 100);
   ```

**Expected Result:**
- Query completes in < 100ms
- EXPLAIN ANALYZE shows index scans (not sequential scans)

**Status:** [ ] Pass [ ] Fail

---

## Test Case 8: Integration with Mobile App

**Objective:** Verify mobile app can use admin functions (admin users only)

### TC8.1: Call Admin RPC from Mobile Service Layer

**Note:** This requires admin credentials in the mobile app

**Steps:**
1. In mobile app, import admin badge functions
2. Authenticate as admin user
3. Call `manualAwardBadge(userId, badgeId, reason)`
4. Verify success response
5. Check user's badge list updates

**Expected Result:**
- Badge is awarded successfully
- User's badge collection updates in real-time
- Audit log is created

**Status:** [ ] Pass [ ] Fail [ ] N/A (Admin portal only)

---

## Verification Summary

### Migration Verification

- [ ] `badges` table has `is_archived` column
- [ ] `badges` table has `updated_at` column
- [ ] `badge_config_history` table exists with correct schema
- [ ] `badge_audit_logs` table exists with correct schema
- [ ] Trigger `trigger_track_badge_config_changes` exists and fires
- [ ] RPC `manual_award_badge` exists and works
- [ ] RPC `manual_revoke_badge` exists and works
- [ ] RPC `get_badge_config_history` exists and works
- [ ] RPC `get_badge_audit_logs` exists and works

### Functional Verification

- [ ] Manual badge awards are logged in audit_logs
- [ ] Manual badge revokes are logged in audit_logs
- [ ] Badge configuration changes are tracked in config_history
- [ ] `updated_at` timestamp updates automatically
- [ ] Archived badges are filtered correctly
- [ ] Only admins can perform admin operations
- [ ] Config history includes admin details
- [ ] Audit logs include user and admin names

### Performance Verification

- [ ] All indexes are created and used
- [ ] Queries complete in < 100ms
- [ ] No sequential scans on large tables

---

## MODULE-08 BADGES-V2-005 VERIFICATION CHECKLIST

From `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/MODULE-08-Badges & Achievements VERIFICATION-V2.md`:

### 5. ADMIN CONFIGURATION & AUDIT (BADGES-V2-005)

- [x] Migration `084_badge_admin_config.sql` applied (File: `20260111000000_badge_admin_config.sql`)
  - [x] `badges` table updated with `is_active`, `sort_order`, `is_archived`, `updated_at`
  - [x] `badge_config_history` table created
  - [x] `badge_audit_logs` table created
- [x] Audit logs captured for config changes
  - [x] Trigger tracks threshold, name, description, is_active changes
  - [x] Admin ID captured in history
- [x] RPC functions implemented:
  - [x] `manual_award_badge` - Admin can award badges manually
  - [x] `manual_revoke_badge` - Admin can revoke badges manually
  - [x] `get_badge_config_history` - Query configuration change history
  - [x] `get_badge_audit_logs` - Query audit logs with filters
- [x] TypeScript types updated:
  - [x] Badge interface includes new fields
  - [x] BadgeConfigHistory interface
  - [x] BadgeAuditLog interface
- [x] Service functions created:
  - [x] `manualAwardBadge()`
  - [x] `manualRevokeBadge()`
  - [x] `getBadgeConfigHistory()`
  - [x] `getBadgeAuditLogs()`
- [x] Unit tests created and passing
- [x] E2E tests created covering full workflows
- [x] Manual testing guide provided

---

## Troubleshooting

### Issue: Trigger not firing on badge updates

**Solution:**
```sql
-- Check if trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_track_badge_config_changes';

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS trigger_track_badge_config_changes ON badges;
CREATE TRIGGER trigger_track_badge_config_changes
BEFORE UPDATE ON badges
FOR EACH ROW
EXECUTE FUNCTION track_badge_config_changes();
```

### Issue: Admin user cannot perform admin operations

**Solution:**
```sql
-- Verify admin status
SELECT user_id, is_admin FROM profiles WHERE user_id = '[YOUR_USER_ID]';

-- Set admin status if needed
UPDATE profiles SET is_admin = true WHERE user_id = '[YOUR_USER_ID]';
```

### Issue: Config history not capturing changes

**Solution:**
- Ensure you're authenticated when making updates (not using service role key directly)
- Check that auth.uid() returns a valid admin user ID
- Review trigger logs for errors

---

## Completion Checklist

- [ ] All 8 test cases completed
- [ ] All verification items checked
- [ ] No errors in Supabase logs
- [ ] Performance meets requirements (< 100ms queries)
- [ ] Admin authorization working correctly
- [ ] Audit trails complete and accurate
- [ ] Documentation reviewed and accurate

---

**Tester Name:** ___________________  
**Date:** ___________________  
**Overall Result:** [ ] Pass [ ] Fail  
**Notes:**

