# BADGES-V2-005: Quick Start Guide

## ⚠️ BEFORE TESTING - RUN THIS SQL IN SUPABASE

1. Open Supabase Dashboard → SQL Editor
2. Copy ALL content from: `supabase/migrations/20260111000000_badge_admin_config.sql`
3. Paste and execute
4. Verify with:

```sql
SELECT COUNT(*) FROM badge_config_history;  -- Should return 0
SELECT COUNT(*) FROM badge_audit_logs;      -- Should return 0
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'badges' 
AND column_name IN ('is_archived', 'updated_at');  -- Should return 2 rows
```

---

## Run Tests (npm)

```bash
# Navigate to app
cd p2p-kids-marketplace

# Run unit tests
npm test src/services/__tests__/badges-admin.test.ts

# Run E2E tests (requires admin credentials)
export TEST_ADMIN_EMAIL="admin@test.com"
export TEST_ADMIN_PASSWORD="YourPassword"
npm test src/__tests__/e2e/badges-admin-config.e2e.ts

# Run all badge tests
npm test -- --testPathPattern="badge"
```

---

## Quick Manual Test

```sql
-- 1. Award a badge manually
SELECT * FROM manual_award_badge(
  '[USER_ID]'::uuid,
  (SELECT id FROM badges WHERE name = 'First Trade'),
  'Test award'
);

-- 2. Verify audit log
SELECT * FROM get_badge_audit_logs(
  '[USER_ID]'::uuid, NULL, 'manual_award', 10
);

-- 3. Update badge config
UPDATE badges 
SET threshold = 75 
WHERE name = 'SP Earner - Silver';

-- 4. Check config history
SELECT * FROM get_badge_config_history(
  (SELECT id FROM badges WHERE name = 'SP Earner - Silver'),
  5
);

-- 5. Restore original value
UPDATE badges 
SET threshold = 50 
WHERE name = 'SP Earner - Silver';
```

---

## Files Modified

1. `supabase/migrations/20260111000000_badge_admin_config.sql` - Database schema
2. `p2p-kids-marketplace/src/types/badge.ts` - TypeScript types
3. `p2p-kids-marketplace/src/services/badges.ts` - Service functions
4. `p2p-kids-marketplace/src/services/__tests__/badges-admin.test.ts` - Unit tests
5. `p2p-kids-marketplace/src/__tests__/e2e/badges-admin-config.e2e.ts` - E2E tests

---

## Verification Checklist

From MODULE-08-Badges & Achievements VERIFICATION-V2.md (Section 5):

- [x] Migration applied (`20260111000000_badge_admin_config.sql`)
- [x] badges table updated (is_archived, updated_at)
- [x] badge_config_history table created
- [x] badge_audit_logs table created
- [x] Audit logs captured for config changes
- [x] RPC functions: manual_award_badge, manual_revoke_badge, get_badge_config_history, get_badge_audit_logs
- [x] TypeScript types updated
- [x] Service functions created
- [x] Unit tests created (15 test cases)
- [x] E2E tests created (5 workflow tests)

---

## What's Implemented

✅ **Database:**
- Extended badges table with is_archived, updated_at
- Created badge_config_history for tracking changes
- Created badge_audit_logs for manual actions
- Added automatic tracking trigger

✅ **Admin RPCs:**
- manual_award_badge - Award badge to user
- manual_revoke_badge - Revoke badge from user
- get_badge_config_history - Query config changes
- get_badge_audit_logs - Query audit trail

✅ **Mobile App:**
- Updated types (Badge, BadgeConfigHistory, BadgeAuditLog)
- Added service functions (manualAwardBadge, manualRevokeBadge, etc.)
- Created comprehensive tests

✅ **Documentation:**
- Manual testing guide (BADGES-V2-005-MANUAL-TESTING-GUIDE.md)
- Implementation summary (BADGES-V2-005-IMPLEMENTATION-SUMMARY.md)
- This quick start guide

---

## Next Task

After verifying this implementation, proceed to:
**BADGES-V2-006: Badge Icon Management & Supabase Storage**
