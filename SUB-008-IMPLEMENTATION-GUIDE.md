# SUB-008 Implementation Guide

## Overview

**Task**: User-Initiated Cancellation Flow (Move to `cancelled` → `grace_period`)  
**Module**: [MODULE-11-SUBSCRIPTIONS-V2.md](Prompts/MODULE-11-SUBSCRIPTIONS-V2.md)  
**Verification**: [MODULE-11-VERIFICATION-V2.md](Prompts/MODULE-11-VERIFICATION-V2.md)

This guide explains what was implemented, how it works, and how to deploy/test it.

---

## What Was Built

### Summary
Users can now voluntarily cancel their Kids Club+ subscription from the app's Profile/Settings screen. The system respects three cancellation scenarios:

1. **Active subscription** → `cancelled` (benefits continue until billing period end)
2. **Trial with SP activity** → `grace_period` (90-day grace, SP frozen)
3. **Trial without SP** → `free` (immediate downgrade)

### Key Features
- ✅ Cancellation reason collection for analytics (6 presets + custom text)
- ✅ SP wallet freeze logic for grace_period transitions
- ✅ Benefits reminder in modal (prevents accidental cancellation)
- ✅ Re-subscribe CTA for cancelled/grace_period users
- ✅ Deep linking support: `p2pkidsmarketplace://manage-kids-club`
- ✅ Error handling (network, API errors, invalid state)

---

## Architecture

### Data Flow Diagram

```
User taps "Manage Kids Club+"
         ↓
ManageKidsClubScreen loads
  - Fetches getSubscriptionSummary()
  - Displays current status
         ↓
User taps "Cancel Kids Club+" button
         ↓
Cancellation Modal opens
  - Select reason (6 presets + custom)
  - Shows benefits until period end
         ↓
User confirms cancellation
         ↓
cancelSubscription(reason) called
         ↓
Edge Function: cancel-subscription
  - Validate auth (JWT)
  - Determine status (active/trial)
  - Query SP ledger for activity
  - Call Stripe API (set cancel_at_period_end)
  - Update subscriptions table
  - Freeze SP wallet (if grace_period)
         ↓
Response returned to mobile
  - new_status: cancelled | grace_period | free
  - grace_period_ends_at: ISO string (if applicable)
  - current_period_end: ISO string
         ↓
UI updates with new status
```

### Component Responsibilities

| Component | File | Purpose |
|-----------|------|---------|
| **Screen** | `src/screens/subscription/ManageKidsClubScreen.tsx` | User interface for managing subscription and initiating cancellation |
| **Service** | `src/services/subscription.ts` | Client-side function `cancelSubscription()` that calls Edge Function |
| **Edge Function** | `supabase/functions/cancel-subscription/index.ts` | Server-side handler: auth, Stripe API, DB updates, SP freeze |
| **Navigation** | `src/navigation/AppNavigator.tsx` | Route registration and deep linking config |
| **Types** | `src/services/subscription.ts` | `CancelSubscriptionResult` interface |

---

## Files Changed

### Created Files

1. **Edge Function**
   ```
   supabase/functions/cancel-subscription/index.ts (320+ lines)
   ```
   - Handles user-initiated cancellation
   - Validates JWT authorization
   - Queries subscription, Stripe API, SP ledger
   - Updates subscriptions table, sp_wallets table
   - Returns structured response

2. **Mobile Screen**
   ```
   p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx (250+ lines)
   ```
   - Displays subscription status
   - Modal for cancellation with reason picker
   - Loading states and error alerts
   - Re-subscribe CTA for inactive users

3. **Unit Tests**
   ```
   p2p-kids-marketplace/src/__tests__/services/subscription-sub-008.unit.test.ts (280+ lines)
   ```
   - Tests cancelSubscription() function
   - Covers all scenarios: active → cancelled, trial+SP → grace, trial-SP → free
   - Error handling (auth, API errors, validation)

4. **E2E Tests**
   ```
   p2p-kids-marketplace/src/__tests__/e2e/subscription-sub-008.e2e.ts (200+ lines)
   ```
   - Verifies Edge Function deployment
   - Database state assertions
   - Manual testing helpers and SQL queries

5. **Manual Test Cases**
   ```
   SUB-008-MANUAL-TEST-CASES.md (300+ lines)
   ```
   - 15 test cases covering all scenarios
   - iOS Simulator and Android Emulator instructions
   - Stripe CLI webhook testing guide

### Modified Files

1. **Subscription Service**
   ```
   p2p-kids-marketplace/src/services/subscription.ts
   ```
   **Changes**:
   - Added `CancelSubscriptionResult` interface:
     ```typescript
     interface CancelSubscriptionResult {
       success: boolean;
       message: string;
       new_status?: 'cancelled' | 'grace_period' | 'free';
       grace_period_ends_at?: string; // ISO date if grace_period
       current_period_end?: string;
     }
     ```
   - Added `cancelSubscription(cancelReason?: string)` function:
     ```typescript
     export async function cancelSubscription(cancelReason?: string): Promise<CancelSubscriptionResult>
     ```

2. **App Navigator**
   ```
   p2p-kids-marketplace/src/navigation/AppNavigator.tsx
   ```
   **Changes**:
   - Imported ManageKidsClubScreen
   - Added Stack.Screen registration with title "Manage Kids Club+ - SUB-008"
   - Added deep linking config: `ManageKidsClub: 'manage-kids-club'`

---

## Pre-Deployment Checklist

### 1. Environment Variables

Verify these are set in your Supabase Edge Function environment:

- ✅ `STRIPE_SECRET_KEY` - Stripe secret key (used to call Stripe API)

Verify these are set in your mobile app `.env.local`:

- ✅ `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

### 2. Database Schema

Run these verification queries in Supabase SQL Editor:

```sql
-- 1. Check subscription_tiers table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscription_tiers'
ORDER BY column_name;
-- Should include: id, name, grace_period_days, trial_days, price

-- 2. Check subscriptions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions'
ORDER BY column_name;
-- Should include: id, user_id, status, stripe_subscription_id, cancel_reason, cancelled_at, grace_started_at, grace_ends_at, current_period_end

-- 3. Check sp_wallets table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sp_wallets'
ORDER BY column_name;
-- Should include: user_id, available_balance, frozen_at, grace_period_ends_at

-- 4. Check sp_ledger table exists
SELECT COUNT(*) FROM sp_ledger LIMIT 1;
-- Should execute without error
```

**Expected columns** (add if missing):

```sql
-- If subscription_tiers.grace_period_days missing:
ALTER TABLE subscription_tiers ADD COLUMN grace_period_days INTEGER DEFAULT 90;

-- If subscriptions.cancel_reason missing:
ALTER TABLE subscriptions ADD COLUMN cancel_reason TEXT;

-- If sp_wallets.frozen_at missing:
ALTER TABLE sp_wallets ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE;

-- If sp_wallets.grace_period_ends_at missing:
ALTER TABLE sp_wallets ADD COLUMN grace_period_ends_at TIMESTAMP WITH TIME ZONE;
```

### 3. RLS Policies

Verify RLS allows Edge Function to update subscriptions/sp_wallets with service role:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('subscriptions', 'sp_wallets') 
AND schemaname = 'public';
-- Should show: rowsecurity = true for both

-- Check policies exist
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'subscriptions';
-- Should have policies for authenticated users and service_role bypass
```

---

## Deployment Steps

### Step 1: Verify Code Compiles

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Lint check
npm run lint
# Expected: exit code 0

# TypeScript check
npm run typecheck
# Expected: exit code 0, no "SyntaxError" or "already declared" errors

# Unit tests
npm test -- --testPathPattern=subscription-sub-008.unit
# Expected: all tests pass
```

**If any fail**, fix before proceeding.

### Step 2: Deploy Edge Function

The Edge Function is ready at: `supabase/functions/cancel-subscription/index.ts`

**Deploy with Supabase CLI**:

```bash
# Ensure you're logged in to Supabase
supabase link --project-ref <YOUR_PROJECT_REF>

# Deploy the function
supabase functions deploy cancel-subscription

# Verify deployment
supabase functions list
# Should show: cancel-subscription
```

**Verify Edge Function can be invoked** (even if auth fails, the 404 error would mean it's not deployed):

```bash
# From mobile app terminal, sign in first, then:
# (This will fail with 401 Unauthorized, which is expected)
curl -X POST \
  https://<your-supabase-url>/functions/v1/cancel-subscription \
  -H "Authorization: Bearer <invalid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"cancel_reason":"test"}'
# Expected: 401 Unauthorized (proves function is deployed)
```

### Step 3: Verify Mobile App Integration

```bash
# Confirm navigation is registered
grep -n "ManageKidsClub" p2p-kids-marketplace/src/navigation/AppNavigator.tsx
# Should find: Stack.Screen name="ManageKidsClub"
#             deep linking config

# Confirm service function exists
grep -n "export async function cancelSubscription" p2p-kids-marketplace/src/services/subscription.ts
# Should find the function
```

### Step 4: Test in Simulator

Choose one:

**iOS Simulator**:
```bash
cd p2p-kids-marketplace
npm run ios
# Wait for app to load
# Navigate: Profile → Manage Kids Club+
```

**Android Emulator**:
```bash
cd p2p-kids-marketplace
npm run android
# Wait for app to load
# Navigate: Profile → Manage Kids Club+
```

---

## Flow Walkthrough

### User Flow (Happy Path)

```
1. User opens app and signs in
   ↓
2. User navigates to Profile/Settings
   ↓
3. User sees "Manage Kids Club+" option
   ↓
4. User taps "Manage Kids Club+"
   ↓
5. ManageKidsClubScreen loads and calls getSubscriptionSummary()
   ↓
6. Screen displays:
   - Status badge (Active / Trial / Cancelled / Grace Period)
   - Plan name (Kids Club+)
   - Renewal/expiration date
   - "Cancel Kids Club+" button (if active/trial)
   ↓
7. User taps "Cancel Kids Club+"
   ↓
8. Modal slides up with:
   - Warning about losing benefits
   - 6 cancellation reasons (Too expensive, Not enough items, etc.)
   - Custom reason text field
   - "Keep Subscription" button
   - "Confirm Cancellation" button (red/danger)
   ↓
9. User selects reason and taps "Confirm Cancellation"
   ↓
10. Mobile calls cancelSubscription(reason)
    ↓
11. Service calls Edge Function: POST /functions/v1/cancel-subscription
    ↓
12. Edge Function:
    - Validates JWT
    - Determines user's subscription status
    - Queries SP ledger for activity
    - Calls Stripe API (sets cancel_at_period_end)
    - Updates subscriptions.status → cancelled/grace_period/free
    - Updates subscriptions.cancel_reason
    - Updates subscriptions.cancelled_at
    - If grace_period: freezes SP wallet
    - Returns response
    ↓
13. Mobile receives response
    ↓
14. Alert shown:
    - Active users: "Your subscription will end on <date>. You'll keep all benefits until then."
    - Trial+SP users: "You're in a 90-day grace period. Your Swap Points are frozen."
    - Trial-SP users: "You've been downgraded to the free tier."
    ↓
15. Modal closes
    ↓
16. ManageKidsClubScreen refreshes
    - Status badge now shows "Cancelled" or "Grace Period"
    - "Cancel" button hidden
    - "Re-subscribe" CTA visible
    ↓
17. User sees confirmation
```

### Database State Changes

**Before cancellation (active user example)**:
```
subscriptions:
  status: 'active'
  cancelled_at: NULL
  cancel_reason: NULL
  current_period_end: 2026-03-22

Stripe:
  cancel_at_period_end: FALSE
```

**After cancellation**:
```
subscriptions:
  status: 'cancelled'
  cancelled_at: 2026-02-22T14:35:00Z
  cancel_reason: 'Too expensive'
  current_period_end: 2026-03-22

Stripe:
  cancel_at_period_end: TRUE
```

**For trial+SP user**:
```
subscriptions:
  status: 'grace_period'
  cancelled_at: 2026-02-22T14:35:00Z
  cancel_reason: 'Not using enough'
  grace_started_at: 2026-02-22T14:35:00Z
  grace_ends_at: 2026-05-23T14:35:00Z

sp_wallets:
  frozen_at: 2026-02-22T14:35:00Z
  grace_period_ends_at: 2026-05-23T14:35:00Z
  available_balance: <unchanged>
```

---

## Developer Notes

### Key Code Points to Understand

#### 1. Edge Function: Determining Final Status

```typescript
// In supabase/functions/cancel-subscription/index.ts

// For ACTIVE users:
if (subscription.status === 'active') {
  // Set cancel_at_period_end in Stripe
  // Update status to 'cancelled'
  // No SP freeze (they keep benefits until period end)
}

// For TRIAL users:
if (subscription.status === 'trial') {
  // Check if user has SP activity
  const hasSp = await hasSpActivity(user_id);
  
  if (hasSp) {
    // Move to 'grace_period'
    // Freeze SP wallet (frozen_at, grace_period_ends_at = now + 90 days)
  } else {
    // Move to 'free'
    // No SP freeze
  }
}
```

#### 2. Freezing SP Wallet

```typescript
// Query grace_period_days from subscription_tiers
const { data: tier } = await supabaseAdmin
  .from('subscription_tiers')
  .select('grace_period_days')
  .eq('name', 'Kids Club+')
  .single();

const graceDays = tier?.grace_period_days || 90;
const graceEndsAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

// Update sp_wallets
await supabaseAdmin
  .from('sp_wallets')
  .update({
    frozen_at: new Date().toISOString(),
    grace_period_ends_at: graceEndsAt.toISOString(),
  })
  .eq('user_id', user_id);
```

#### 3. Service Function: Calling Edge Function

```typescript
// In src/services/subscription.ts
export async function cancelSubscription(
  cancelReason?: string
): Promise<CancelSubscriptionResult> {
  const { data, error } = await supabase.functions.invoke(
    'cancel-subscription',
    {
      body: { cancel_reason: cancelReason },
    }
  );

  if (error) {
    return {
      success: false,
      message: `Cancellation failed: ${error.message}`,
    };
  }

  return data; // Typed as CancelSubscriptionResult
}
```

#### 4. UI: Reason Picker

```typescript
// In ManageKidsClubScreen.tsx
const cancellationReasons = [
  'Too expensive',
  'Not enough items',
  'Not using enough',
  'Technical issues',
  'Moving away',
  'Other',
];

// When "Other" selected, show text input
if (selectedReason === 'Other') {
  <TextInput
    placeholder="Tell us why..."
    value={customReason}
    onChangeText={setCustomReason}
  />
}
```

---

## Testing Strategy

### Unit Tests (Run First)

```bash
cd p2p-kids-marketplace
npm test -- --testPathPattern=subscription-sub-008.unit
```

**Coverage**:
- ✅ Auth error (user not logged in)
- ✅ Active user → cancelled
- ✅ Trial+SP → grace_period
- ✅ Trial-SP → free
- ✅ Edge Function error handling
- ✅ Response schema validation

### E2E Tests (Requires Supabase)

```bash
cd p2p-kids-marketplace
npm test -- --testPathPattern=subscription-sub-008.e2e
```

**Note**: E2E tests check if Edge Function is deployed and DB tables exist. They may skip if not set up.

### Manual Tests (Use SUB-008-MANUAL-TEST-CASES.md)

After deploying Edge Function, follow:
1. TC-001: Navigate to screen
2. TC-002: Open modal
3. TC-003: Select reason and confirm
4. TC-004: Active user cancellation
5. TC-005: Trial+SP → grace_period
6. TC-006: Trial-SP → free
7. TC-013: Deep linking

---

## Common Issues & Solutions

### Issue: "cancel-subscription function not found"

**Cause**: Edge Function not deployed or wrong URL

**Solution**:
```bash
# Verify deployment
supabase functions list

# If not listed, deploy:
supabase functions deploy cancel-subscription

# Check Edge Function logs
supabase functions logs cancel-subscription
```

### Issue: "Unauthorized" error when cancelling

**Cause**: JWT token not passed to Edge Function or token expired

**Solution**:
```typescript
// Ensure JWT is being passed automatically by supabase.functions.invoke()
// Check AuthContext has valid session:
const { session } = useAuth();
console.log('Session exists:', !!session);

// In mobile, restart app to refresh token
```

### Issue: Subscription status not updating

**Cause**: RLS policies blocking update OR Edge Function crashed silently

**Solution**:
```sql
-- Check RLS allows service role to update
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename = 'subscriptions';

-- Check function logs for errors
supabase functions logs cancel-subscription

-- Verify Stripe API key is correct
-- (Check .env in function deployment)
```

### Issue: SP wallet not frozen

**Cause**: Grace period logic not executed OR subscription_tiers missing grace_period_days

**Solution**:
```sql
-- Verify subscription_tiers has grace_period_days
SELECT id, name, grace_period_days 
FROM subscription_tiers;

-- Check sp_wallets frozen_at is set
SELECT user_id, frozen_at, grace_period_ends_at 
FROM sp_wallets 
WHERE user_id = '<TEST_USER>';
```

### Issue: TypeScript errors

**Cause**: Missing types or incompatible versions

**Solution**:
```bash
cd p2p-kids-marketplace

# Clean install
rm -rf node_modules package-lock.json
npm install

# TypeScript check
npm run typecheck

# Fix errors as shown
```

---

## Next Steps Before Manual Testing

1. ✅ **Run Tier 0 checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm test -- --testPathPattern=subscription-sub-008.unit
   ```

2. ✅ **Verify database schema**:
   ```sql
   -- Run verification queries from "Pre-Deployment Checklist"
   -- in Supabase SQL Editor
   ```

3. ✅ **Deploy Edge Function**:
   ```bash
   supabase functions deploy cancel-subscription
   ```

4. ✅ **Start simulator**:
   ```bash
   npm run ios  # or: npm run android
   ```

5. ✅ **Follow manual test cases**: `SUB-008-MANUAL-TEST-CASES.md`

---

## Related Documentation

- **Module Spec**: [Prompts/MODULE-11-SUBSCRIPTIONS-V2.md](Prompts/MODULE-11-SUBSCRIPTIONS-V2.md)
- **Verification Checklist**: [Prompts/MODULE-11-VERIFICATION-V2.md](Prompts/MODULE-11-VERIFICATION-V2.md)
- **Manual Test Cases**: [SUB-008-MANUAL-TEST-CASES.md](SUB-008-MANUAL-TEST-CASES.md)
- **Flow Registry**: [docs/flow-registry.md](docs/flow-registry.md#L105)

---

## Summary

**What you implemented**:
- ✅ Edge Function for server-side cancellation logic
- ✅ Mobile UI screen with cancellation modal
- ✅ Service function to call Edge Function
- ✅ Navigation registration and deep linking
- ✅ Comprehensive unit tests
- ✅ E2E test scaffolding
- ✅ Manual test cases guide

**What you need to do before simulator testing**:
1. Run `npm run lint && npm run typecheck && npm test`
2. Deploy Edge Function: `supabase functions deploy cancel-subscription`
3. Verify database schema (run SQL checks)
4. Start simulator: `npm run ios` or `npm run android`
5. Follow manual test cases in `SUB-008-MANUAL-TEST-CASES.md`

**Questions?** Check troubleshooting section or review relevant code comments in the implementation files.
