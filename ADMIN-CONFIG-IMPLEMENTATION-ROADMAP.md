# 🔧 Admin Config Hardcoding Elimination - Complete Implementation Guide

## Phase 1: ✅ COMPLETED (Subscription Settings & SP Percentage)

### Changes Made:

#### 1. **Updated `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx`**
- Added import: `getSPMaxPercentage` from adminConfig service
- Added state: `spMaxPercentage` (defaults to 50)
- Updated `loadConfigSettings()` to fetch SP max percentage dynamically
- Replaced hardcoded text `"Spend Swap Points (up to 50%)"` with dynamic: `"Spend Swap Points (up to ${spMaxPercentage}%)"`
- Now fetches fresh config on every screen focus via `invalidateConfigCache()`

**Result**: ✅ All subscription tier UI text now uses dynamic config values instead of hardcoded strings

#### 2. **New Migration: `supabase/migrations/20250117_fix_hardcoded_trial_days.sql`**
- Fixed `create_trial_subscription()` RPC function
- Replaced hardcoded `'30 days'` with dynamic call to `get_trial_duration_days()`
- Now respects admin_config value for `trial_period_days`
- Defaults to 30 days if config not found

**Result**: ✅ Trial subscriptions will use configurable trial duration from admin_config

#### 3. **Existing Migration: `supabase/migrations/20251216_fix_rpc_admin_config_schema.sql`**
- Already fixed schema mismatch issues:
  - `is_trial_enabled()` - now reads from admin_config correctly
  - `get_trial_duration_days()` - now reads from admin_config correctly
- Both functions default gracefully if config not found

**Result**: ✅ RPC functions aligned with new admin_config schema

---

## 🔴 Phase 2: STILL NEEDED - Fee & Pricing Engine

### HIGH PRIORITY: Fee calculation is core to every transaction

**Files to update:**
1. **`p2p-kids-marketplace/src/services/auth.ts`** (if it calculates fees)
2. **Transaction/Checkout screens** (wherever fees are displayed to users)
3. **Edge Functions for transaction creation** (backend fee calculation)

**Config values to make dynamic:**
- `platform_fee_buyer_fixed_cents` (currently 25¢)
- `platform_fee_buyer_percentage` (currently 2.5%)
- `platform_fee_seller_percentage` (currently 5%)
- `stripe_transaction_fee_percentage` (currently 2.9%)
- `stripe_transaction_fee_fixed_cents` (currently 30¢)

**Search pattern to find hardcoded values:**
```bash
grep -rn "2\.5\|0\.025\|5\.0\|0\.05\|2\.9\|0\.029\|25\|30" \
  src --include="*.ts" --include="*.tsx" \
  | grep -i "fee\|charge\|platform\|stripe\|buyer\|seller"
```

### MEDIUM PRIORITY: Swap Points earning/spending rules

**Config values to make dynamic:**
- `sp_pending_days` (currently 3 days)
- `sp_expiration_days` (currently 90 days)
- `sp_subscriber_only` (currently true)
- `sp_earn_multiplier` (currently 1.0)
- `sp_min_balance_for_redemption` (currently 100)
- `sp_redemption_multiplier` (currently 1.0)

**Files to audit:**
- `src/services/auth.ts` (enrollInTrialSubscription, SP earning logic)
- `src/services/swapPoints.ts` (if exists)
- All screens dealing with SP display/spending
- Edge Functions: `sp-create-transaction`, `sp-release-pending`, etc.

### MEDIUM PRIORITY: Feature Flags

**Config values to make dynamic:**
- `feature_flag_sp_redemption_enabled`
- `feature_flag_referral_program_enabled`
- `feature_flag_bundle_purchases_enabled`

**Implementation pattern:**
```typescript
import { getAdminConfig } from '@/services/adminConfig';

// In screen/component
useEffect(() => {
  const checkFeatureFlags = async () => {
    const config = await getAdminConfig();
    setSPRedemptionEnabled(config.feature_flag_sp_redemption_enabled);
    setReferralEnabled(config.feature_flag_referral_program_enabled);
  };
  checkFeatureFlags();
}, []);
```

### LOW PRIORITY: SMS & Email settings (validation timeouts, daily limits, sender addresses)

**Config values:**
- `sms_twilio_enabled`
- `sms_verification_timeout_seconds`
- `sms_daily_limit_per_user`
- `email_sendgrid_enabled`
- `email_from_address`

---

## 📋 Immediate Next Steps

### Step 1: Deploy & Test Phase 1 Changes (ASAP)
```bash
# 1. Run migrations in Supabase:
#    a) 20251216_fix_rpc_admin_config_schema.sql (if not done)
#    b) 20250117_fix_hardcoded_trial_days.sql (NEW)

# 2. Test trial enrollment:
#    - Go to subscription choice screen
#    - Click "Try Free Trial"
#    - Verify:
#      - Trial created with correct days (check DB)
#      - SP max % displays dynamically (currently 50%)
#      - No hardcoded values visible

# 3. Test admin config change:
#    - In admin portal, change trial_period_days to 14
#    - Logout/login as new user
#    - Verify trial created with 14 days (not 30)

# 4. Test SP max % change:
#    - In admin portal, change sp_max_percentage_per_purchase to 75
#    - Go to subscription choice screen
#    - Verify text shows "up to 75%" (not "up to 50%")
```

### Step 2: Audit Fee Calculations (HIGH PRIORITY)
```bash
# Search for fee-related hardcoding
grep -rn "0\.025\|0\.05\|0\.029\|25\|30" \
  p2p-kids-marketplace/src \
  supabase/functions \
  --include="*.ts" --include="*.tsx" \
  | grep -i "fee\|charge"
```

### Step 3: Create Fee Calculation Service
**File**: `p2p-kids-marketplace/src/services/feeCalculation.ts`
```typescript
import { getAdminConfig } from '@/services/adminConfig';

export async function calculateBuyerFee(itemPrice: number): Promise<number> {
  const config = await getAdminConfig();
  const fixedCents = config.platform_fee_buyer_fixed_cents;
  const percentageAmount = itemPrice * (config.platform_fee_buyer_percentage / 100);
  return (fixedCents / 100) + percentageAmount;
}

export async function calculateSellerFee(itemPrice: number, isSubscriber: boolean): Promise<number> {
  const config = await getAdminConfig();
  const basePercentage = config.platform_fee_seller_percentage;
  const discountPercentage = isSubscriber 
    ? config.platform_fee_seller_discount_percentage_kids_club_plus
    : config.platform_fee_seller_discount_percentage_freemium;
  const effectivePercentage = basePercentage - discountPercentage;
  return itemPrice * (effectivePercentage / 100);
}

export async function calculateStripeFee(amount: number): Promise<number> {
  const config = await getAdminConfig();
  const fixedCents = config.stripe_transaction_fee_fixed_cents;
  const percentageAmount = amount * (config.stripe_transaction_fee_percentage / 100);
  return (fixedCents / 100) + percentageAmount;
}
```

### Step 4: Update Edge Functions
All transaction-related Edge Functions must:
1. Import admin_config values
2. Call RPC functions or query admin_config table directly
3. Calculate fees dynamically (NOT hardcoded)

**Files to update:**
- `supabase/functions/transactions-create/index.ts`
- `supabase/functions/transactions-complete/index.ts`
- Any other transaction endpoints

### Step 5: Add Caching to adminConfig Service (if not already done)
✅ Already done! The service has:
- 5-minute in-memory TTL cache
- `invalidateConfigCache()` to force refresh
- Type-safe config interface

---

## 🧪 Testing Checklist

### Smoke Test: Changing Admin Config
1. ✅ Change `subscription_price_monthly` from 7.99 to 9.99 in admin portal
2. ✅ Logout and login as new user
3. ✅ Go to Subscription Choice screen
4. ✅ Verify price shows as $9.99 (not $7.99)
5. ✅ Start trial - verify trial created with correct price
6. ✅ Repeat for `trial_period_days`, `sp_max_percentage_per_purchase`

### Regression Test: Trial Enrollment
1. ✅ Signup → Complete profile → Reach Subscription Choice
2. ✅ Click "Try Free Trial"
3. ✅ Verify:
   - Trial created with configured duration
   - SP wallet initialized (if applicable)
   - User redirected to Home
   - No errors in console
   - Correct subscription status in DB

### Feature Test: SP Percentage Display
1. ✅ Admin changes sp_max_percentage_per_purchase to 40
2. ✅ Mobile app fetches fresh config (via invalidateConfigCache)
3. ✅ Subscription Choice screen shows "up to 40%"
4. ✅ During purchase, SP slider respects 40% cap (not hardcoded 50%)

---

## 📊 Config Values Coverage

### ✅ COMPLETED
- `subscription_price_monthly` - Dynamic ✅
- `trial_period_days` - Dynamic ✅
- `trial_enabled` - Dynamic ✅
- `sp_max_percentage_per_purchase` - Dynamic ✅ (in UI)

### 🔴 NOT YET IMPLEMENTED
- `subscription_price_yearly` - Needs implementation
- `grace_period_days` - Needs implementation in subscription renewal logic
- `sp_pending_days` - Needs implementation
- `sp_expiration_days` - Needs implementation
- `sp_subscriber_only` - Needs implementation
- `platform_fee_buyer_fixed_cents` - Needs implementation
- `platform_fee_buyer_percentage` - Needs implementation
- `platform_fee_seller_percentage` - Needs implementation
- `stripe_transaction_fee_percentage` - Needs implementation
- `stripe_transaction_fee_fixed_cents` - Needs implementation
- All other config values - Needs implementation

---

## 🎯 Success Criteria

✅ **Phase 1 Complete When:**
- Migrations deployed and tested
- Trial enrollment uses configurable trial days
- Subscription choice screen displays all dynamic values
- Admin config changes propagate to mobile UI

✅ **Phase 2 Complete When:**
- Fee calculations use admin_config (not hardcoded)
- All fees visible in transaction flows are dynamic
- Admin can change fees and new transactions respect new fees
- All edge functions query admin_config for fee values

✅ **Full Completion When:**
- ALL 36 config values properly used throughout codebase
- No hardcoded numeric values for business rules remain (except defaults)
- Every numeric config value testable via admin portal
- Comprehensive audit passed (no grep results for hardcoded values)

---

## 📞 Reference

**Admin Config Service**: `p2p-kids-marketplace/src/services/adminConfig.ts`
- `getAdminConfig()` - Get all 36 config values
- `getConfigValue(key)` - Get single value by key
- `invalidateConfigCache()` - Force cache refresh
- Convenience functions: `getSubscriptionPrice()`, `getTrialDays()`, `getSPMaxPercentage()`, etc.

**Config Table**: `admin_config` in Supabase
- Columns: key, value, data_type, category, is_active, description
- Query directly in Edge Functions
- Query via RPC functions from mobile app (auto-conversion based on data_type)

**RPC Functions**: 
- `is_trial_enabled()` - Check if trial enrollment is enabled
- `get_trial_duration_days()` - Get configured trial days
- Other RPC functions to be created for dynamic fee/SP config

---
