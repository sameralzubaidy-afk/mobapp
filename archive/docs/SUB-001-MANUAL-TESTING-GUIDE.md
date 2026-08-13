# MODULE-11 SUB-001: Manual Testing Guide
**Task:** Kids Club+ Subscription Tier Schema  
**Date:** February 12, 2026  
**Platform:** iOS & Android Simulators

---

## Prerequisites

Before starting manual testing:

1. ✅ Run migration in Supabase SQL Editor:
   ```bash
   # In Supabase Dashboard → SQL Editor → New Query
   # Copy and execute: supabase/migrations/20260212000000_subscription_tiers.sql
   ```

2. ✅ Run verification queries:
   ```bash
   # Execute: supabase/migrations/20260212000001_subscription_tiers_verification.sql
   # Confirm all checks pass (8 verification queries + 4 smoke tests)
   ```

3. ✅ Rebuild the app:
   ```bash
   cd p2p-kids-marketplace
   npm run typecheck
   npm run lint
   npm run ios    # For iOS simulator
   npm run android # For Android simulator
   ```

---

## Test Cases

### **TC-001: Verify Kids Club+ Tier Exists in Database**

**Objective:** Confirm subscription tier was seeded correctly

**Steps:**
1. Open Supabase Dashboard
2. Navigate to Table Editor → `subscription_tiers`
3. Filter by `name = 'kids_club_plus'`

**Expected Results:**
- ✅ One row found with:
  - `display_name`: "Kids Club+"
  - `price_cents`: 499
  - `trial_days`: 30
  - `grace_period_days`: 90
  - `is_active`: true
  - `is_default`: true

**Status:** [ ] Pass / [ ] Fail

---

### **TC-002: Verify Kids Club+ Features Are Seeded**

**Objective:** Confirm all 7 features exist and are enabled

**Steps:**
1. Open Supabase Dashboard
2. Navigate to Table Editor → `subscription_features`
3. Filter by tier_id matching Kids Club+ tier

**Expected Results:**
- ✅ 7 rows found with these `feature_key` values:
  1. `can_earn_sp` (sort_order: 1)
  2. `can_spend_sp` (sort_order: 2)
  3. `can_donate` (sort_order: 3)
  4. `reduced_fee` (sort_order: 4)
  5. `priority_matching` (sort_order: 5)
  6. `early_access` (sort_order: 6)
  7. `priority_support` (sort_order: 7)
- ✅ All rows have `is_enabled = true`

**Status:** [ ] Pass / [ ] Fail

---

### **TC-003: Verify RLS Policies Allow Public Read**

**Objective:** Confirm unauthenticated users can view active tiers

**Steps:**
1. Open Supabase API Settings → Copy anon/public key
2. Use Postman or curl to query:
   ```bash
   curl -X GET 'https://[YOUR_PROJECT].supabase.co/rest/v1/subscription_tiers?is_active=eq.true' \
     -H "apikey: [ANON_KEY]" \
     -H "Authorization: Bearer [ANON_KEY]"
   ```

**Expected Results:**
- ✅ HTTP 200 response
- ✅ JSON array with Kids Club+ tier data
- ✅ No RLS policy violation errors

**Status:** [ ] Pass / [ ] Fail

---

### **TC-004: Test Service Layer - getActiveSubscriptionTiers()**

**Objective:** Verify mobile app service can fetch active tiers

**Steps:**
1. Add temporary debug code in a test screen:
   ```typescript
   import { getActiveSubscriptionTiers } from '../services/subscriptionTiers';
   
   const testFetch = async () => {
     const { data, error } = await getActiveSubscriptionTiers();
     console.log('Active tiers:', data);
     console.log('Error:', error);
   };
   ```
2. Launch app in simulator
3. Trigger the test function
4. Check Metro bundler console logs

**Expected Results:**
- ✅ Console shows array with Kids Club+ tier
- ✅ `error` is null
- ✅ Tier object includes:
  - `name`: "kids_club_plus"
  - `price_cents`: 499
  - `trial_days`: 30

**Status:** [ ] Pass / [ ] Fail

---

### **TC-005: Test Service Layer - getKidsClubPlusTier()**

**Objective:** Verify fetching Kids Club+ with all features

**Steps:**
1. Add debug code:
   ```typescript
   import { getKidsClubPlusTier } from '../services/subscriptionTiers';
   
   const testFetch = async () => {
     const { data, error } = await getKidsClubPlusTier();
     console.log('Kids Club+ tier:', data);
     console.log('Features count:', data?.features.length);
     console.log('Error:', error);
   };
   ```
2. Launch app in simulator
3. Trigger the test function
4. Check console logs

**Expected Results:**
- ✅ `data` is not null
- ✅ `data.name` is "kids_club_plus"
- ✅ `data.features` array has 7 items
- ✅ First feature is `can_earn_sp`
- ✅ `error` is null

**Status:** [ ] Pass / [ ] Fail

---

### **TC-006: Test Feature Check - canUserEarnSwapPoints()**

**Objective:** Verify feature flag check for SP earning

**Steps:**
1. Add debug code:
   ```typescript
   import { canUserEarnSwapPoints } from '../services/subscriptionTiers';
   
   const testCheck = async () => {
     const canEarn = await canUserEarnSwapPoints('kids_club_plus');
     console.log('Can earn SP:', canEarn);
   };
   ```
2. Launch app in simulator
3. Trigger the test function

**Expected Results:**
- ✅ Console logs: `Can earn SP: true`
- ✅ No errors thrown

**Status:** [ ] Pass / [ ] Fail

---

### **TC-007: Test Feature Check - hasReducedFee()**

**Objective:** Verify reduced fee feature flag

**Steps:**
1. Add debug code:
   ```typescript
   import { hasReducedFee } from '../services/subscriptionTiers';
   
   const testCheck = async () => {
     const reduced = await hasReducedFee('kids_club_plus');
     console.log('Has reduced fee:', reduced);
   };
   ```
2. Launch app in simulator
3. Trigger the test function

**Expected Results:**
- ✅ Console logs: `Has reduced fee: true`
- ✅ No errors thrown

**Status:** [ ] Pass / [ ] Fail

---

### **TC-008: Test formatTierForDisplay() Formatting**

**Objective:** Verify tier data is formatted for UI correctly

**Steps:**
1. Add debug code:
   ```typescript
   import { getKidsClubPlusTier, formatTierForDisplay } from '../services/subscriptionTiers';
   
   const testFormat = async () => {
     const { data } = await getKidsClubPlusTier();
     if (data) {
       const displayInfo = formatTierForDisplay(data);
       console.log('Display info:', displayInfo);
     }
   };
   ```
2. Launch app in simulator
3. Trigger the test function

**Expected Results:**
- ✅ `displayInfo.priceFormatted` is "$4.99/month"
- ✅ `displayInfo.trialDays` is 30
- ✅ `displayInfo.features` has 7 items
- ✅ Each feature has `key`, `name`, and `description`

**Status:** [ ] Pass / [ ] Fail

---

### **TC-009: Verify TypeScript Types Compile Without Errors**

**Objective:** Ensure new types don't break compilation

**Steps:**
1. Run typecheck:
   ```bash
   cd p2p-kids-marketplace
   npm run typecheck
   ```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ Exit code 0
- ✅ No "Cannot find module" errors for subscription.types.ts

**Status:** [ ] Pass / [ ] Fail

---

### **TC-010: Run Unit Tests**

**Objective:** Verify all unit tests pass

**Steps:**
1. Run tests:
   ```bash
   cd p2p-kids-marketplace
   npm test -- subscriptionTiers.test.ts
   ```

**Expected Results:**
- ✅ All tests pass
- ✅ No failures or errors
- ✅ Test coverage includes:
  - getActiveSubscriptionTiers()
  - getSubscriptionTierByName()
  - getKidsClubPlusTier()
  - checkTierFeature()
  - formatTierForDisplay()

**Status:** [ ] Pass / [ ] Fail

---

### **TC-011: Run E2E Tests**

**Objective:** Verify database integration works end-to-end

**Steps:**
1. Ensure Supabase env vars are set in `.env.local`
2. Run E2E tests:
   ```bash
   cd p2p-kids-marketplace
   npm test -- sub-001-subscription-tiers.e2e.ts
   ```

**Expected Results:**
- ✅ All E2E tests pass
- ✅ Kids Club+ tier configuration validated
- ✅ All 7 features validated
- ✅ RLS policies validated
- ✅ Feature checks validated

**Status:** [ ] Pass / [ ] Fail

---

### **TC-012: Verify Database Indexes Exist**

**Objective:** Confirm performance indexes were created

**Steps:**
1. Open Supabase SQL Editor
2. Run query:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE schemaname = 'public' 
     AND tablename IN ('subscription_tiers', 'subscription_features')
   ORDER BY tablename, indexname;
   ```

**Expected Results:**
- ✅ `idx_subscription_tiers_is_active` exists
- ✅ `idx_subscription_tiers_is_default` exists
- ✅ `idx_subscription_tiers_name` exists
- ✅ `idx_subscription_features_tier_id` exists
- ✅ `idx_subscription_features_is_enabled` exists

**Status:** [ ] Pass / [ ] Fail

---

### **TC-013: Verify RLS Policies Exist**

**Objective:** Confirm all 4 RLS policies were created

**Steps:**
1. Open Supabase SQL Editor
2. Run query:
   ```sql
   SELECT tablename, policyname
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('subscription_tiers', 'subscription_features')
   ORDER BY tablename, policyname;
   ```

**Expected Results:**
- ✅ `subscription_tiers`: 2 policies
  - `subscription_tiers_select_public`
  - `subscription_tiers_admin_all`
- ✅ `subscription_features`: 2 policies
  - `subscription_features_select_public`
  - `subscription_features_admin_all`

**Status:** [ ] Pass / [ ] Fail

---

## Summary Checklist

After completing all test cases, verify:

- [ ] Migration executed successfully
- [ ] Kids Club+ tier seeded with correct values ($4.99, 30d trial, 90d grace)
- [ ] All 7 features seeded and enabled
- [ ] RLS policies allow public read for active tiers
- [ ] Service layer functions work correctly
- [ ] TypeScript compilation succeeds
- [ ] Unit tests pass (10+ tests)
- [ ] E2E tests pass (database integration)
- [ ] Database indexes created
- [ ] RLS policies created

---

## Troubleshooting

### Issue: "relation 'subscription_tiers' does not exist"
**Solution:** Run migration 20260212000000_subscription_tiers.sql in Supabase SQL Editor

### Issue: "No rows found for Kids Club+"
**Solution:** Check migration seed data ran correctly; manually insert if needed

### Issue: "RLS policy violation"
**Solution:** Verify RLS policies were created; check anon role has SELECT permission

### Issue: "TypeScript error: Cannot find module"
**Solution:** Run `npm install` and verify `subscription.types.ts` exists in src/types/

### Issue: "Tests timeout"
**Solution:** Check SUPABASE_URL and SUPABASE_ANON_KEY are set in `.env.local`

---

## Notes

- This is **SUB-001 only** - tier schema foundation
- No UI screens yet (covered in SUB-010+ tasks)
- Focus is on database schema + service layer + tests
- Next task (SUB-002) will build user_subscriptions table and lifecycle management
