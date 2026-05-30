# Referral Attribution Bug - Complete Fix Summary

## Problem Statement
New users signing up with valid referral codes end up with NULL values in:
- `profiles.referral_code` (should have their own generated 8-char code)
- `profiles.referred_by` (should have the referrer's user_id)

This breaks:
- Referral tracking and rewards
- User's ability to share their own referral code
- Analytics for referral program effectiveness

## Root Cause
The issue is a **race condition + data clobbering** between two systems:

1. **Database trigger** (`handle_new_user()`) correctly sets both fields on signup ✅
2. **Mobile app** calls `setupUserProfile()` during onboarding, which uses `.upsert()` **without** including `referral_code` or `referred_by`, causing them to be overwritten to NULL ❌

### Timeline
```
T=0: User signs up → auth.users row created
T=1: Trigger fires → profile created with referral_code='abc12345', referred_by=<uuid>
T=2: App calls setupUserProfile() → profile UPDATED without those fields
T=3: Fields are now NULL (BUG)
```

## Files Changed

### 1. Database Migration (with logging)
**File**: `supabase/migrations/20260204000002_fix_referral_with_logging.sql`

**Changes**:
- Created `debug_logs` table to track execution flow
- Added logging to `create_referral_code()`, `apply_referral_code()`, and `handle_new_user()`
- Logs every step (code generation, profile insert, referral application)
- Captures errors with context for debugging

**Why**: Without logging, silent failures are invisible. This gives us full visibility into what's happening during signup.

### 2. Mobile App Service (preserve referral fields)
**File**: `p2p-kids-marketplace/src/services/profile.ts`

**Changes in `setupUserProfile()`**:
```typescript
// BEFORE (overwrites referral fields to NULL):
const dbProfileData: Record<string, any> = {
  user_id: userId,
  name: profileData.display_name,
  // ... other fields ...
  // ❌ referral_code and referred_by are MISSING
};

// AFTER (preserves existing referral fields):
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('referral_code, referred_by')
  .eq('user_id', userId)
  .maybeSingle();

const dbProfileData: Record<string, any> = {
  user_id: userId,
  name: profileData.display_name,
  // ... other fields ...
  // ✅ Explicitly preserve trigger-set fields
  referral_code: existingProfile?.referral_code || null,
  referred_by: existingProfile?.referred_by || null,
};
```

**Why**: The app should never modify fields it doesn't "own". Referral fields are managed by the auth trigger, so the app must preserve them.

### 3. Diagnostic Scripts

**File**: `DIAGNOSE-REFERRAL-ISSUE.sql`
- Queries to inspect trigger state, metadata, and tables
- Helps identify which step in the flow failed

**File**: `VERIFY-REFERRAL-FIX.sql`
- Step-by-step verification checklist
- Expected log sequence
- Success criteria

**File**: `REFERRAL-ATTRIBUTION-ROOT-CAUSE.md`
- Detailed analysis of the bug
- Timeline reconstruction
- Fix options comparison

## Deployment Steps

### Step 1: Apply Database Migration
```bash
# Option A: Via Supabase CLI (local or remote)
supabase db push

# Option B: Via SQL Editor in Supabase Dashboard
# Copy/paste contents of:
# supabase/migrations/20260204000002_fix_referral_with_logging.sql
```

**Verify**:
```sql
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'debug_logs';
```

Expected: Trigger exists and enabled, debug_logs table exists.

### Step 2: Deploy Mobile App Fix

**Preflight Tier 0** (MANDATORY):
```bash
cd p2p-kids-marketplace
yarn lint
yarn type-check
```

Expected: Both pass with exit code 0.

**Build & Deploy**:
```bash
# For development testing:
yarn start

# For staging:
eas build --profile staging --platform all

# For production:
eas build --profile production --platform all
```

### Step 3: Test End-to-End

Use the checklist in `VERIFY-REFERRAL-FIX.sql`:

1. **Get a valid referral code** from an existing user
2. **Sign up a new user** via the app with that code
3. **Check debug logs** to confirm execution flow
4. **Verify profile BEFORE onboarding**: referral_code and referred_by should be set
5. **Complete onboarding** (location picker, profile setup)
6. **Verify profile AFTER onboarding**: referral_code and referred_by should STILL be set ✅
7. **Check referrals table**: Should have a pending row
8. **Check referral_codes table**: Should have new user's code

### Step 4: Monitor Production

After deployment, monitor for:
- Any entries in `debug_logs` with `error_message IS NOT NULL`
- Profile creation failures
- Missing referral_code or referred_by on new signups

Query to check health:
```sql
-- Check recent signups have referral codes
SELECT 
  p.user_id,
  p.email,
  p.referral_code IS NOT NULL AS has_own_code,
  p.referred_by IS NOT NULL AS has_referrer,
  p.created_at
FROM public.profiles p
WHERE p.created_at > NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 50;
```

## Rollback Plan

If issues occur after deployment:

### Database Rollback
The migration is **additive only** (adds tables/logging, doesn't break existing logic), so rollback is not necessary. However, if needed:

```sql
-- Remove debug logging (optional, not required for rollback)
DROP TABLE IF EXISTS public.debug_logs CASCADE;
DROP FUNCTION IF EXISTS public.log_debug(TEXT, UUID, TEXT, JSONB, TEXT);

-- Revert to previous trigger version (if you have a backup of the old one)
-- This is ONLY needed if the new trigger causes issues
```

### Mobile App Rollback
Redeploy the previous version via EAS or revert the commit:

```bash
git revert <commit_hash>
# Rebuild and deploy
```

The old code will continue to clobber referral fields, but at least the system will function.

## Change Classification
- **DB/RPC/Triggers**: Yes (new migration with logging)
- **Mobile UI/Logic**: Yes (profile service fix)
- **Breaking**: No (additive only)

## Impacted Flows
- **FLOW-01**: Auth – Signup (trigger path)
- **FLOW-02**: Profiles & Onboarding (profile completion)
- **FLOW-13**: Referrals (code generation + apply on signup)

## Regression Plan

### Tier 0 (ALWAYS - before any manual testing):
```bash
# Mobile app
cd p2p-kids-marketplace
yarn lint        # Expected: pass
yarn type-check  # Expected: pass

# Admin portal (if you deployed admin changes earlier)
cd p2p-kids-admin
yarn lint        # Expected: pass
yarn type-check  # Expected: pass
yarn build       # Expected: pass
```

### Tier 1 (Targeted smoke for impacted flows):
```bash
# Run referral smoke test (after setting env vars)
node scripts/smoke/run.mjs --flows referrals
```

Expected: PASS with confirmed `profiles.referred_by` set.

### Tier 2 (Full regression - if deploying to production):
```bash
# Rebuild local Supabase from migrations
supabase db reset

# Run all smoke tests
node scripts/smoke/run.mjs --all
```

## Success Criteria

✅ **Immediate (after deployment)**:
- Database migration applies without errors
- Mobile app compiles (Tier 0 passes)
- Triggers are enabled (`SELECT tgname FROM pg_trigger`)

✅ **After first test signup**:
- Debug logs show complete execution without errors
- Profile has `referral_code` set immediately after signup
- Profile has `referred_by` set if referral code was provided
- Profile STILL has both fields after completing onboarding

✅ **After 24 hours in production**:
- No new entries in `debug_logs` with `error_message IS NOT NULL`
- 100% of new signups have `referral_code` populated
- Referral tracking works end-to-end (referrer gets rewards when referee completes first trade)

## Known Limitations / Future Work

1. **Existing users with NULL fields**: This fix only prevents future occurrences. Existing users with NULL values need a backfill script (already included in the migration).

2. **Client-side fallback**: The app still calls `processReferralCode()` after signup as a fallback. This is redundant now that the trigger handles it, but keeping it provides defense in depth.

3. **No notification if trigger fails**: If `handle_new_user()` fails completely, the user won't know their referral wasn't applied. Consider adding a post-signup check + user notification if referral fields are unexpectedly NULL.

4. **Trigger dependency**: The fix assumes the trigger fires reliably. If Supabase has issues, referrals won't work. Consider monitoring trigger execution health.

## Questions for Product Team

1. **Backfill strategy**: Do we want to attempt to backfill `referred_by` for existing users who signed up with a referral code but have NULL? (Would require checking client-side logs or Supabase auth metadata history)

2. **Reward retroactivity**: If we backfill referrals, should we grant retroactive rewards (SP bonuses, trial extensions)?

3. **Grace period for fix**: Should we announce "referral system maintenance" or silently fix and announce when stable?

## Contact / Support

For questions or issues with this fix:
- **Root cause analysis**: See `REFERRAL-ATTRIBUTION-ROOT-CAUSE.md`
- **Verification steps**: See `VERIFY-REFERRAL-FIX.sql`
- **Diagnostic queries**: See `DIAGNOSE-REFERRAL-ISSUE.sql`
- **Debug logs**: Query `SELECT * FROM public.debug_logs WHERE process_name LIKE '%referral%'`

---

**Fix applied by**: GitHub Copilot Agent
**Date**: 2026-02-04
**Status**: Ready for deployment & testing
