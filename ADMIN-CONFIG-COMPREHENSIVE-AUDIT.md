# Comprehensive Admin Config Hardcoding Audit & Fix

## Status: Implementation Started

### ✅ COMPLETED

1. **Created `adminConfig.ts` service**
   - Centralized dynamic config fetching
   - In-memory cache with 5-minute TTL
   - Type-safe config interface
   - Convenience functions for common values
   - Default fallback values

2. **Updated SubscriptionChoiceScreen.tsx**
   - Now uses `getSubscriptionPrice()`, `getTrialDays()`, `isTrialEnabled()`
   - Fetches fresh config on screen focus
   - No more hardcoded "7.99" or "30"

### 🔴 STILL NEEDS FIXING (HIGH PRIORITY)

#### Mobile App (p2p-kids-marketplace)

1. **Auth Service - `src/services/auth.ts`**
   - Line ~250: Hard-check of SP earning/spending logic
   - Need to use `sp_subscriber_only` config value
   - Need to use `sp_max_percentage_per_purchase` config value
   - Need to use `sp_pending_days` config value
   - **Files**: `enrollInTrialSubscription()`, fee calculation functions

2. **Checkout/Payment Flow**
   - Platform fee calculation should use:
     - `platform_fee_buyer_fixed_cents`
     - `platform_fee_buyer_percentage`
     - `platform_fee_seller_percentage`
     - `stripe_transaction_fee_percentage`
     - `stripe_transaction_fee_fixed_cents`
   - **Files**: Transaction creation, checkout screens, payment components

3. **Swap Points Management**
   - SP wallet creation should use `sp_subscriber_only`
   - Earning/spending should respect `sp_max_percentage_per_purchase` (50% cap)
   - SP release timing should use `sp_pending_days` (3 days)
   - Expiration should use `sp_expiration_days` (90 days)
   - **Files**: `src/screens/wallet/*`, `src/services/swapPoints.ts`

4. **Feature Flags**
   - SP redemption UI should check `feature_flag_sp_redemption_enabled`
   - Referral UI should check `feature_flag_referral_program_enabled`
   - Bundle purchase UI should check `feature_flag_bundle_purchases_enabled`
   - **Files**: All screens that show premium features

#### Backend (Supabase)

1. **RPC Functions - Already Fixed in SQL**
   - ✅ `is_trial_enabled()` - Fixed
   - ✅ `get_trial_duration_days()` - Fixed
   - ⏳ Other RPC functions need to read from admin_config:
     - `calculate_platform_fee()`
     - `calculate_sp_earned()`
     - `check_sp_spending_allowed()`
     - `validate_transaction_amount()`

2. **Edge Functions**
   - `create_transaction()` - Use config for fee calculation
   - `create_swap_points_transaction()` - Use config for SP rules
   - `process_subscription()` - Use config for pricing

### 📋 Implementation Checklist

#### Phase 1: Auth & Subscription (CURRENT)
- [x] Create adminConfig service
- [x] Update SubscriptionChoiceScreen
- [ ] Fix enrollInTrialSubscription() to use config
- [ ] Update RPC functions

#### Phase 2: Fees & Pricing
- [ ] Replace hardcoded fees with config values
- [ ] Update fee calculation logic in auth service
- [ ] Create fee calculation utility
- [ ] Update Edge Functions

#### Phase 3: Swap Points
- [ ] Replace SP rule hardcoding with config
- [ ] Update SP earning logic
- [ ] Update SP spending validation
- [ ] Update SP expiration logic

#### Phase 4: Feature Flags
- [ ] Add feature flag checks to all screens
- [ ] Update navigation based on flags
- [ ] Hide/show premium features

#### Phase 5: Testing
- [ ] Test changing prices in admin portal
- [ ] Test SP rule changes
- [ ] Test fee calculation changes
- [ ] End-to-end flow with admin config changes

### 🔍 Search Pattern

To find remaining hardcoded values, search for:

**Mobile App:**
```
grep -rn "7\.99\|79\.99\|2\.5\|5\.0\|0\.25\|30\|90\|50\|100\|3" \
  src --include="*.ts" --include="*.tsx" \
  | grep -E "const|let|=|price|fee|percent|trial|grace|sp_|swap" \
  | grep -v node_modules
```

**Backend:**
```
grep -rn "7\.99\|79\.99\|2\.5\|5\.0\|30\|90" \
  supabase/functions --include="*.ts" \
  | grep -v node_modules
```

### 📝 Config Keys Reference

**Subscription:**
- `subscription_price_monthly` (7.99)
- `subscription_price_yearly` (79.99)
- `trial_period_days` (30)
- `trial_enabled` (true)
- `grace_period_days` (90)

**Swap Points:**
- `sp_max_percentage_per_purchase` (50%)
- `sp_pending_days` (3)
- `sp_expiration_days` (90)
- `sp_subscriber_only` (true)
- `sp_earn_multiplier` (1.0)
- `sp_min_balance_for_redemption` (100)
- `sp_redemption_multiplier` (1.0)

**Fees:**
- `platform_fee_buyer_fixed_cents` (25¢)
- `platform_fee_buyer_percentage` (2.5%)
- `platform_fee_seller_percentage` (5%)
- `stripe_transaction_fee_percentage` (2.9%)
- `stripe_transaction_fee_fixed_cents` (30¢)
- `min_transaction_amount_cents` (100¢)

**Feature Flags:**
- `feature_flag_sp_redemption_enabled`
- `feature_flag_referral_program_enabled`
- `feature_flag_bundle_purchases_enabled`

### ✨ Next Steps

1. Run the trial enrollment fix SQL (if not done already)
2. Test trial enrollment works with dynamic config
3. Move to Phase 2 (Fees & Pricing)
4. Update auth service to use config-based fees
5. Test price changes in admin portal propagate to checkout
