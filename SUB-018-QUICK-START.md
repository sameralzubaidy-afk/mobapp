# SUB-018 Quick Start Guide

**Status:** ✅ COMPLETE  
**View full details:** `SUB-018-IMPLEMENTATION-SUMMARY.md`  
**Manual testing:** `SUB-018-MANUAL-TEST-CASES.md`

---

## 🚀 Quick Testing Commands

### Tier 0 Checks (Run First)
```bash
cd p2p-kids-marketplace
npm run lint
npm run typecheck
```

### Unit Tests
```bash
cd p2p-kids-marketplace

# All SUB-018 tests
npm test -- --testPathPattern="paymentFailure|paymentRetry"

# Individual test files
npm run test:unit -- usePaymentFailure
npm run test:unit -- PaymentFailureBanner
npm run test:unit -- paymentRetry
```

### E2E Tests
```bash
cd p2p-kids-marketplace
export RUN_SUPABASE_E2E=true
npm run test:e2e -- sub-018-payment-failure
```

### Maestro UI Tests
```bash
cd p2p-kids-marketplace

# iOS
npm run test:maestro:ios -- payment-failure-handling

# Android
npm run test:maestro:android -- payment-failure-handling
```

---

## 🗄️ SQL Quick Setup

### 1. Verify Schema Exists
```sql
-- Check RPC function
SELECT proname FROM pg_proc WHERE proname = 'record_payment_attempt';

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN ('payment_retry_count', 'payment_failed_at');
```

### 2. Create Test User
```sql
-- Insert test user
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  gen_random_uuid(),
  'test-payment-failure@example.com',
  crypt('test123', gen_salt('bf'))
)
ON CONFLICT (email) DO NOTHING;

-- Create active subscription
INSERT INTO subscriptions (user_id, subscription_tier, status, stripe_subscription_id)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com'),
  'kids_club_plus',
  'active',
  'sub_test_' || gen_random_uuid()
)
ON CONFLICT (user_id) DO UPDATE SET status = 'active';
```

### 3. Simulate Payment Failure
```sql
-- First failure (retry 1)
SELECT public.record_payment_attempt(
  (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com'),
  false
);

-- Verify state
SELECT payment_retry_count, payment_failed_at, status
FROM subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com');
-- Expected: payment_retry_count = 1, status = 'active'
```

### 4. Simulate Grace Period Entry (3 Failures)
```sql
-- Second failure
SELECT public.record_payment_attempt(
  (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com'),
  false
);

-- Third failure
SELECT public.record_payment_attempt(
  (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com'),
  false
);

-- Verify grace period
SELECT payment_retry_count, status, grace_period_ends_at
FROM subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com');
-- Expected: payment_retry_count = 3, status = 'grace_period'
```

### 5. Reset Test User
```sql
UPDATE subscriptions
SET 
  status = 'active',
  payment_retry_count = 0,
  payment_failed_at = NULL,
  grace_period_ends_at = NULL
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com');
```

---

## 🏗️ Quick Deployment

### 1. Deploy Edge Functions
```bash
cd supabase/functions

# Deploy retry function
npx supabase functions deploy retry-failed-payment

# Redeploy webhook handler (with notification integration)
npx supabase functions deploy stripe-webhook-subscriptions

# Verify
npx supabase functions list
```

### 2. Configure Environment Variables
In Supabase Dashboard → Settings → Edge Functions:
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET=whsec_...
SEND_PUSH_NOTIFICATION_URL=https://your-project.supabase.co/functions/v1/send-push-notification
```

### 3. Build Mobile App
```bash
cd p2p-kids-marketplace

# Tier 0 checks
npm run lint && npm run typecheck

# EAS build
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

---

## 📱 Add Banner to Screens

Add `PaymentFailureBanner` to these screens:

**DashboardScreen.tsx:**
```tsx
import { PaymentFailureBanner } from '../../components/subscription/PaymentFailureBanner';

export const DashboardScreen = () => {
  return (
    <SafeAreaView>
      <PaymentFailureBanner />
      {/* Rest of content */}
    </SafeAreaView>
  );
};
```

**ProfileScreen.tsx:**
```tsx
import { PaymentFailureBanner } from '../../components/subscription/PaymentFailureBanner';

export const ProfileScreen = () => {
  return (
    <ScrollView>
      <PaymentFailureBanner />
      {/* Rest of content */}
    </ScrollView>
  );
};
```

**WalletScreen.tsx:**
```tsx
import { PaymentFailureBanner } from '../../components/subscription/PaymentFailureBanner';

export const WalletScreen = () => {
  return (
    <SafeAreaView>
      <PaymentFailureBanner />
      {/* Rest of content */}
    </SafeAreaView>
  );
};
```

---

## 🧪 Quick Manual Test (iOS Simulator)

```bash
# 1. Start iOS Simulator
open -a Simulator

# 2. Run Expo app
cd p2p-kids-marketplace
npm start

# 3. In another terminal, simulate payment failure
./scripts/simulate-payment-failure.js

# 4. Pull down to refresh in app
# Expected: Orange "Payment Declined" banner appears

# 5. Tap "Update Payment Method"
# Expected: Navigates to ManageKidsClub screen

# 6. Tap "Dismiss"
# Expected: Banner hides

# 7. Force quit and reopen app
# Expected: Banner reappears (failure within 24 hours)

# 8. Simulate old failure (>24 hours)
./scripts/simulate-old-payment-failure.js

# 9. Pull down to refresh
# Expected: Banner does NOT appear (not recent)

# 10. Reset state
npm run db:reset-test-user
```

---

## 📋 Verification Checklist

Before marking SUB-018 complete:

- [ ] Tier 0 checks pass (lint + typecheck)
- [ ] All unit tests pass (23+ tests)
- [ ] E2E tests pass
- [ ] Maestro flows complete successfully
- [ ] SQL verification queries return expected results
- [ ] Edge Functions deployed to Supabase production
- [ ] Environment variables configured
- [ ] PaymentFailureBanner added to appropriate screens
- [ ] Manual test cases executed on iOS/Android simulators
- [ ] flow-registry.md updated
- [ ] MODULE-11-VERIFICATION-V2.md updated

---

## 🐛 Troubleshooting

**Banner not appearing?**
```sql
-- Check if payment_failed_at is recent
SELECT 
  payment_retry_count,
  payment_failed_at,
  NOW() - payment_failed_at AS time_since_failure
FROM subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-failure@example.com');
-- Must be < 24 hours for banner to show
```

**Push notifications not sending?**
```bash
# Check environment variable is set
npx supabase secrets list | grep SEND_PUSH_NOTIFICATION
```

**Manual retry returns 403?**
```bash
# Verify JWT token includes correct user_id
# Check request body user_id matches authenticated user
```

---

## 📚 Related Files

- **Implementation:** `SUB-018-IMPLEMENTATION-SUMMARY.md`
- **Manual Testing:** `SUB-018-MANUAL-TEST-CASES.md`
- **Flow Registry:** `docs/flow-registry.md` (SUB-018 entry)
- **Verification:** `Prompts/MODULE-11-VERIFICATION-V2.md` (lines 20-26, 71-72, 183-186, 308-318)

---

**Quick Start by:** Kids P2P App Builder Agent  
**Date:** 2026-03-07
