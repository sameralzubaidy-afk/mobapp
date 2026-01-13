# BADGES-V2-008 & BADGES-V2-009: Consolidated Verification Checklist

**Module:** Badges & Achievements (V2)  
**Tasks:** BADGES-V2-008 (Retroactive Awarding) + BADGES-V2-009 (Sandbox & Real-time)  
**Date:** January 12, 2026

---

## OVERVIEW

This document consolidates verification for:
- **BADGES-V2-008:** Retroactive badge awarding when thresholds are lowered
- **BADGES-V2-009:** Admin sandbox for testing + Mobile real-time subscriptions

---

## VERIFICATION CHECKLIST

### 1. BADGES-V2-008: Retroactive Awarding & Dynamic Triggers

#### 1.1 Database Functions

- [ ] Migration `20260112000002_retroactive_badges.sql` applied successfully
- [ ] Function `preview_retroactive_awards(UUID)` exists
  - [ ] Returns correct column names: `o_user_id`, `o_display_name`, `o_current_value`, `o_already_has_badge`
  - [ ] Filters by `is_active = TRUE` and `is_archived = FALSE`
  - [ ] Works for all categories: `sp_earning`, `sp_spending`, `trades`, `subscription`
  - [ ] Aggregates data correctly from `sp_ledger`, `transactions`, `subscriptions`
- [ ] Function `retroactive_award_badges(UUID)` exists
  - [ ] Awards badges to eligible users who don't have it yet
  - [ ] Respects `ON CONFLICT (user_id, badge_id) DO NOTHING` (no duplicates)
  - [ ] Processes all 4 badge categories correctly
- [ ] Function `admin_trigger_retroactive_awards(UUID)` exists
  - [ ] Can be called from admin portal or SQL editor
  - [ ] Returns success message with count of awards given
- [ ] Trigger `trigger_retroactive_award_on_threshold_decrease` exists
  - [ ] Fires on `UPDATE` of `badges` table
  - [ ] Only fires when `threshold` is decreased (new < old)
  - [ ] Automatically calls `retroactive_award_badges`

#### 1.2 SQL Verification Queries

Run these queries in Supabase SQL Editor to verify functions exist:

```sql
-- Check functions exist
SELECT proname, pronargs FROM pg_proc 
WHERE proname IN (
  'preview_retroactive_awards',
  'retroactive_award_badges',
  'admin_trigger_retroactive_awards',
  'trigger_retroactive_award_on_threshold_decrease'
);

-- Check trigger exists
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_retroactive_award_on_threshold_decrease';
```

Expected: 4 functions + 1 trigger found.

- [ ] All 4 functions exist
- [ ] Trigger exists and is enabled

#### 1.3 Functional Tests

- [ ] **Preview Test:** Run `SELECT * FROM preview_retroactive_awards('active_badge_id');`
  - [ ] Returns eligible users correctly
  - [ ] Shows current values from ledger/transactions
  - [ ] Filters out users who already have badge
- [ ] **Manual Execution Test:** Run `SELECT retroactive_award_badges('badge_id');`
  - [ ] Awards new badges to eligible users
  - [ ] No errors on duplicate attempts
  - [ ] Count increases in `user_badges` table
- [ ] **Threshold Decrease Test:** Update badge threshold from high to low value
  - [ ] Trigger fires automatically
  - [ ] New awards appear in `user_badges` within 2 seconds
  - [ ] `badge_config_history` records the change

#### 1.4 Edge Cases

- [ ] Inactive badge (`is_active = FALSE`) is not awarded retroactively
- [ ] Archived badge (`is_archived = TRUE`) is not awarded retroactively
- [ ] Duplicate awards prevented by unique constraint `(user_id, badge_id)`
- [ ] Users with 0 SP/trades are not awarded higher-threshold badges

---

### 2. BADGES-V2-009: Admin Sandbox & Real-time Integration

#### 2.1 Admin Sandbox Page

- [ ] File created: `p2p-kids-admin/src/app/badges/sandbox/page.tsx`
- [ ] Page accessible at `http://localhost:3000/badges/sandbox`
- [ ] User dropdown populated with test users (emails shown)
- [ ] Badge lists populated by category
- [ ] **SP Simulation Controls:**
  - [ ] Category selector (SP Earning / SP Spending)
  - [ ] Amount input (1-1000 SP)
  - [ ] "Simulate SP Event" button functional
  - [ ] Shows eligible badges for selected category
- [ ] **Trade Simulation Controls:**
  - [ ] "Complete Trade" button functional
  - [ ] Shows eligible trade badges
- [ ] **Result Display:**
  - [ ] Success message shows when event simulated
  - [ ] Badge name displayed if awarded
  - [ ] Error messages shown if simulation fails

#### 2.2 Sandbox Functional Tests

- [ ] **TC-2.2:** Simulate SP event awards correct badge
  - [ ] Entry created in `sp_ledger` with `source_type = 'test_earning'`
  - [ ] Badge trigger fires
  - [ ] Result displayed in UI
- [ ] **TC-2.3:** Simulate trade completion awards correct badge
  - [ ] Entry created in `transactions` with `status = 'completed'`
  - [ ] Badge trigger fires
  - [ ] Result displayed in UI
- [ ] **TC-2.4:** Eligible badges list updates when category changes
- [ ] No errors in browser console when using sandbox

#### 2.3 Mobile Real-time Hook

- [ ] File created: `p2p-kids-marketplace/src/hooks/useUserBadges.ts`
- [ ] Hook exports:
  - [ ] `badges: UserBadge[]` - Current badges list
  - [ ] `loading: boolean` - Loading state
  - [ ] `error: string | null` - Error state
  - [ ] `refresh: () => Promise<void>` - Manual refresh function
  - [ ] `newBadgeAwarded: UserBadge | null` - Last badge awarded
  - [ ] `clearNewBadge: () => void` - Clear notification
- [ ] Real-time subscription setup:
  - [ ] Channel name: `user_badges_{userId}`
  - [ ] Listens to `INSERT` events on `user_badges` table
  - [ ] Filter: `user_id=eq.{userId}`
  - [ ] Auto-unsubscribes on unmount

#### 2.4 Mobile Real-time Functional Tests

- [ ] **TC-3.1:** Badge awarded in Supabase appears immediately in mobile app
  - [ ] No manual refresh required
  - [ ] Badge added to top of list
  - [ ] `newBadgeAwarded` state updated
- [ ] **TC-3.2:** Other users' badges do not appear in current user's list
  - [ ] Real-time filter works correctly
- [ ] **TC-3.3 (Optional):** Celebration modal/toast displays when badge awarded
- [ ] **TC-3.4:** Real-time subscription reconnects after network loss
  - [ ] Enable/disable airplane mode test
  - [ ] New badges still appear after reconnection

---

### 3. UNIT & E2E TESTS

#### 3.1 Unit Tests

- [ ] File: `p2p-kids-marketplace/src/hooks/__tests__/useUserBadges.test.ts`
- [ ] All tests pass: `npm test -- src/hooks/__tests__/useUserBadges.test.ts`
- [ ] Tests cover:
  - [ ] Load badges on mount
  - [ ] Handle empty userId
  - [ ] Handle fetch error
  - [ ] Real-time subscription setup
  - [ ] Refresh function
  - [ ] Clear new badge notification

#### 3.2 E2E Tests

- [ ] File: `p2p-kids-marketplace/src/__tests__/e2e/badgeRealtimeIntegration.e2e.ts`
- [ ] All tests pass: `npm test -- src/__tests__/e2e/badgeRealtimeIntegration.e2e.ts`
- [ ] Tests cover:
  - [ ] Real-time notification when badge awarded
  - [ ] No events received for other users
  - [ ] Subscription cleanup on unmount

---

### 4. INTEGRATION WITH EXISTING MODULE-08 TASKS

#### 4.1 Dependencies

- [ ] BADGES-V2-001 (Schema) - ✅ Complete
- [ ] BADGES-V2-002 (SP Triggers) - ✅ Complete
- [ ] BADGES-V2-003 (Trade Triggers) - ✅ Complete
- [ ] BADGES-V2-004 (UI Display) - ✅ Complete
- [ ] BADGES-V2-005 (Admin Config) - ✅ Complete
- [ ] BADGES-V2-006 (Icon Management) - ✅ Complete
- [ ] BADGES-V2-007 (Admin Portal) - ✅ Complete

#### 4.2 Integration Points

- [ ] Admin badge editor (`BadgeEditor.tsx`) can trigger retroactive awards on save
- [ ] Mobile `BadgesScreen` uses `useUserBadges` hook
- [ ] Real-time updates work with existing badge display UI
- [ ] Sandbox integrates with existing badge and user tables
- [ ] All badge categories (sp_earning, sp_spending, trades, subscription) work end-to-end

---

### 5. NAVIGATION & MANUAL TESTING

#### 5.1 Mobile App Navigation

- [ ] `Badges` screen accessible from Profile
- [ ] `Leaderboard` screen accessible from Badges screen
- [ ] Navigation routes defined in `AppNavigator.tsx`
- [ ] Deep linking works (if applicable)

#### 5.2 Admin Portal Navigation

- [ ] `Badges` page accessible from main navigation
- [ ] `Sandbox` page accessible from badges section
- [ ] URL: `http://localhost:3000/badges/sandbox`

#### 5.3 Manual Testing Guide

- [ ] File created: `BADGES-V2-008-009-MANUAL-TESTING.md`
- [ ] Contains 16 test cases covering:
  - [ ] Retroactive awarding (4 TCs)
  - [ ] Admin sandbox (4 TCs)
  - [ ] Mobile real-time (4 TCs)
  - [ ] Integration/edge cases (4 TCs)
- [ ] All test cases have clear steps and expected results
- [ ] Includes SQL queries for verification
- [ ] Includes npm commands for running tests

---

## TIER 0 CHECKS (MANDATORY BEFORE MANUAL TESTING)

### Mobile App

Run these commands:

```bash
cd p2p-kids-marketplace
npm run type-check
npm run lint
```

Expected:
- [ ] TypeCheck: PASS (no errors)
- [ ] Lint: PASS (no errors)

### Admin Portal

Run these commands:

```bash
cd p2p-kids-admin
npm run build
```

Expected:
- [ ] Build: PASS (no errors)

---

## TIER 1 CHECKS (TARGETED SMOKE TESTS)

Run unit and E2E tests:

```bash
cd p2p-kids-marketplace
npm test -- src/hooks/__tests__/useUserBadges.test.ts
npm test -- src/__tests__/e2e/badgeRealtimeIntegration.e2e.ts
```

Expected:
- [ ] Unit tests: PASS (6 tests)
- [ ] E2E tests: PASS (2 tests)

---

## TIER 2 CHECKS (FULL REGRESSION - IF DB CHANGED)

If you modified database schema or RLS policies:

1. Run all badge-related tests:
   ```bash
   cd p2p-kids-marketplace
   npm test -- badges
   ```

2. Verify all badge migrations applied:
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations 
   WHERE version LIKE '%badge%' 
   ORDER BY version DESC;
   ```

3. Check RLS policies on badge tables:
   ```sql
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE tablename IN ('badges', 'user_badges', 'badge_config_history', 'badge_audit_logs');
   ```

---

## DELIVERABLES SUMMARY

### Files Created

#### Admin Portal
- `p2p-kids-admin/src/app/badges/sandbox/page.tsx` (Sandbox UI)

#### Mobile App
- `p2p-kids-marketplace/src/hooks/useUserBadges.ts` (Real-time hook)
- `p2p-kids-marketplace/src/hooks/__tests__/useUserBadges.test.ts` (Unit tests)
- `p2p-kids-marketplace/src/__tests__/e2e/badgeRealtimeIntegration.e2e.ts` (E2E tests)

#### Documentation
- `BADGES-V2-008-009-MANUAL-TESTING.md` (Manual test guide)
- `BADGES-V2-008-009-VERIFICATION.md` (This file)

### Database
- Migration `20260112000002_retroactive_badges.sql` (already applied)
  - 4 functions for retroactive awarding
  - 1 trigger for threshold decrease

---

## VERIFICATION STATUS

Use this section to track completion:

### BADGES-V2-008: Retroactive Awarding
- [ ] Database functions verified
- [ ] Preview function tested
- [ ] Retroactive award function tested
- [ ] Trigger tested (threshold decrease)
- [ ] All 4 badge categories tested
- [ ] Edge cases verified

### BADGES-V2-009: Sandbox & Real-time
- [ ] Admin sandbox page functional
- [ ] SP simulation tested
- [ ] Trade simulation tested
- [ ] Mobile real-time hook implemented
- [ ] Real-time subscription tested
- [ ] Unit tests passing
- [ ] E2E tests passing

### Overall
- [ ] Tier 0 checks passed
- [ ] Tier 1 checks passed
- [ ] Manual testing completed (16/16 test cases)
- [ ] No critical defects found
- [ ] Ready for production

---

## KNOWN ISSUES / LIMITATIONS

Document any issues found during testing:

1. _None yet_

---

## SIGN-OFF

- [ ] Implementation Complete
- [ ] Tests Passing
- [ ] Manual Testing Complete
- [ ] Documentation Updated
- [ ] Ready for Production

**Developer:** ___________________________  
**Date:** ___________________________

---

**End of Consolidated Verification Checklist**
