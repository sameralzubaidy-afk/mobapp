# SUB-HARDCODED-PRICE-FIX: Removed All Hardcoded Subscription Prices

**Date**: March 7, 2026  
**Related**: MODULE-11 SUB-016/017 (Re-subscribe & Billing History)

---

## 🎯 Problem Summary

The billing history showed **$4.99** instead of the configured admin price ($1500) because:
1. Edge functions had hardcoded fallback of `499` cents ($4.99)
2. Mobile screens had hardcoded `useState(4.99)`
3. When Stripe couldn't find the admin_config value or tier, it silently used $4.99

**The $4.99 shown in billing history is REAL** - that's what Stripe actually charged because the fallback was used when the subscription was created.

---

## ✅ What Was Fixed

### Edge Functions (2 files)
1. **`supabase/functions/create-subscription-from-payment-method/index.ts`**
   - ❌ Removed: `return 499;` hardcoded fallback in `normalizeAdminPriceToCents()`
   - ❌ Removed: `getAdminConfigNumber(supabaseClient, 'subscription_price_monthly', 4.99)` fallback
   - ✅ Now: Throws clear error if admin_config is missing or invalid
   - ✅ Deployed: March 7, 2026

2. **`supabase/functions/renew-subscription/index.ts`**
   - ❌ Removed: Same hardcoded fallbacks
   - ✅ Now: Throws clear error if admin_config is missing
   - ✅ Deployed: March 7, 2026

### Mobile App (3 screens)
3. **`src/screens/subscription/ContinueKidsClubScreen.tsx`**
   - ❌ Removed: `useState<number>(4.99)`
   - ✅ Now: `useState<number>(0)` - fetches from admin_config on mount

4. **`src/screens/subscription/KidsClubOverviewScreen.tsx`**
   - ❌ Removed: `useState(4.99)`
   - ✅ Now: `useState<number | null>(null)` - shows "loading..." if null

5. **`src/screens/subscription/SubscriptionPaymentScreen.tsx`**
   - ❌ Removed: `const DEFAULT_MONTHLY_PRICE_DOLLARS = 4.99`
   - ✅ Now: `useState<number>(0)` - shows 0 if config missing (indicates error)

---

## 📐 Admin Config Price Convention (IMPORTANT!)

The `subscription_price_monthly` field in `admin_config` follows this convention:

- **Values >= 100** → Treated as CENTS
  - Example: `1500` → 1500 cents → **$15.00/month**
  - Example: `2999` → 2999 cents → **$29.99/month**
  - Example: `150000` → 150000 cents → **$1500.00/month** ✅

- **Values < 100** → Treated as DOLLARS
  - Example: `15` → 15 dollars → **$15.00/month**
  - Example: `29.99` → 29.99 dollars → **$29.99/month**

### Your $1500 Subscription Price
If you want to charge **$1500 per month**:
```sql
UPDATE admin_config 
SET value = '150000'  -- 150000 cents = $1500.00
WHERE key = 'subscription_price_monthly';
```

If you want to charge **$15 per month**:
```sql
UPDATE admin_config 
SET value = '1500'    -- 1500 cents = $15.00
WHERE key = 'subscription_price_monthly';
```

---

## 🔍 Why Billing History Shows $4.99

The billing history table (`billing_history`) stores the **actual amount Stripe charged**. When you saw $4.99:

1. You tapped "Re-subscribe Now" 
2. The edge function created a Stripe subscription
3. At that moment, either:
   - `admin_config.subscription_price_monthly` was not set, OR
   - The tier's `price_cents` was 0, OR
   - An error occurred loading the config
4. The old code fell back to hardcoded `499` cents ($4.99)
5. Stripe charged $4.99
6. This was recorded in `billing_history` as `amount: 499` (cents)
7. The screen correctly displa displayed `$4.99` (499 cents ÷ 100)

**The billing history screen is working correctly** - it's showing the real charges from Stripe.

---

## 🛡️ New Behavior (After Fix)

### If admin_config is Missing
**Before**: Subscription created with $4.99 (silent fallback)  
**After**: Clear error message to user:
```
"Billing is not configured correctly. Please contact support."
```

**Edge function logs**:
```
Invalid subscription price in admin_config: 0. 
Set subscription_price_monthly to a positive number.
Values >= 100 are cents (e.g., 1500 = $15), values < 100 are dollars (e.g., 15 = $15)
```

### If admin_config is Valid
All prices now come from `admin_config.subscription_price_monthly`:
- ✅ Billing history will show the correct configured price
- ✅ Re-subscribe screen shows the correct price
- ✅ Payment screens show the correct price  
- ✅ Stripe subscriptions are created with the correct price

---

## ✅ Verification Checklist

- [x] Removed all hardcoded `4.99` and `499` fallbacks
- [x] Edge functions throw clear errors if config missing
- [x] Mobile screens fetch price from admin_config (no hardcoded defaults)
- [x] TypeScript compilation passes (0 errors)
- [x] Both edge functions deployed successfully
- [ ] **User must test**: Re-subscribe flow with updated admin_config

---

## 🧪 Testing Instructions

### Step 1: Set Your Desired Price in Admin Config
```sql
-- For $15/month
UPDATE admin_config 
SET value = '1500', is_active = true 
WHERE key = 'subscription_price_monthly';

-- OR for $1500/month
UPDATE admin_config 
SET value = '150000', is_active = true 
WHERE key = 'subscription_price_monthly';
```

### Step 2: Force-Refresh Mobile App
1. Close the app completely (swipe up from app switcher)
2. Reopen the app
3. This ensures the new edge functions are used

### Step 3: Test Re-Subscribe Flow
1. Navigate to **Profile → Manage Kids Club**
2. If you're on grace_period/expired, tap **"Re-subscribe Now"**
3. Complete the payment flow
4. **Expected**: Stripe charges the configured price (not $4.99)
5. **Verify**: Check Billing History - should show new charge at configured price

### Step 4: Check Price Display
1. Navigate to **Profile → Manage Kids Club**
2. **Expected**: Price display matches your admin_config value
   - If you set `1500`, you should see **$15.00/month**
   - If you set `150000`, you should see **$1500.00/month**

---

## 📊 Files Modified

### Edge Functions
- `supabase/functions/create-subscription-from-payment-method/index.ts`
- `supabase/functions/renew-subscription/index.ts`

### Mobile App
- `src/screens/subscription/ContinueKidsClubScreen.tsx`
- `src/screens/subscription/KidsClubOverviewScreen.tsx`
- `src/screens/subscription/SubscriptionPaymentScreen.tsx`

---

## 🚨 Breaking Change Notice

**After this fix, subscriptions will FAIL if admin_config is not properly set.**

This is intentional! Better to fail loudly than silently charge $4.99.

To fix, ensure `admin_config` has:
```sql
SELECT * FROM admin_config WHERE key = 'subscription_price_monthly';
-- Must return a row with positive numeric value and is_active = true
```

---

## ⏭️ Next Steps

1. **Set your desired price in admin_config** (see Step 1 above)
2. **Test re-subscribe flow** with your test user
3. **Verify billing history** shows the correct amount
4. **If you see any errors**, share the exact error message

---

## 💡 Why This Fix Matters

- **Transparency**: Users see the actual configured price everywhere
- **Consistency**: One source of truth (admin_config) for all pricing
- **Debugging**: Clear errors make misconfiguration obvious
- **Billing Integrity**: Stripe charges match what users see in the app

The old hardcoded fallbacks made debugging impossible because:
- Users saw one price in the UI
- Stripe charged a different price (fallback $4.99)
- No errors indicated why

Now the system will fail fast with clear error messages if configuration is missing!
