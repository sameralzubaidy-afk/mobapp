# Test Case 1.1: Quick Verification Steps

**Status**: ✅ FIXED - Code now properly calls Edge Functions

---

## Prerequisites (Must Complete First)

1. **Environment Variables Set**
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

2. **Edge Functions Deployed**
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
   supabase functions deploy create-stripe-connect-account
   supabase functions deploy create-stripe-account-link
   ```

3. **Edge Function Secrets Set** (in Supabase Dashboard)
   ```
   STRIPE_SECRET_KEY = sk_test_...
   STRIPE_WEBHOOK_SECRET = whsec_...
   ```

4. **Database Ready**
   - `seller_payout_methods` table exists
   - `seller_payouts` table exists
   - RPC `set_primary_payout_method` exists
   ```bash
   # Run migration
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
   supabase db push  # or manually run 061_seller_payouts_helpers.sql
   ```

---

## Test Execution

### Step 1: Start Mobile App
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm start
# or
yarn start
```

Press `i` for iOS Simulator or `a` for Android Emulator

### Step 2: Navigate to Payout Settings
1. Open mobile app
2. Tap Profile icon (bottom right)
3. Scroll down → tap "Payout Settings"
   - You should see "Your Earnings" section with $0.00

### Step 3: Add Stripe Payout Method
1. Tap "+ Add Payout Method" button
2. Modal appears with options:
   - Stripe Connect
   - PayPal
   - Venmo
3. Tap "Stripe Connect" (blue box)
   - Box should highlight in blue
4. Tap "Add Method" button

### Step 4: Expected Result
- Loading spinner appears for 2-3 seconds
- Success alert appears:
  ```
  Success
  Stripe account created! You will now be 
  redirected to complete your onboarding.
  
  [OK]
  ```
5. Tap "OK"
   - Modal closes
   - You're back to Payout Settings screen
   - Should see Stripe method in list with "Not Verified" badge

---

## Verification (SQL Queries)

### Verify 1: Record Created
```sql
SELECT 
  id, 
  user_id, 
  method_type, 
  stripe_account_id, 
  is_verified, 
  created_at
FROM seller_payout_methods 
WHERE method_type = 'stripe_connect'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**:
- Exactly 1 row returned
- `method_type = 'stripe_connect'`
- `stripe_account_id` starts with `acct_`
- `is_verified = false`

### Verify 2: Stripe Account Created
Run in Stripe Dashboard:
- Go to **Developers** → **Connect** → **Connected Accounts**
- Should see new "Express" account
- Status: "Onboarding incomplete"

### Verify 3: Edge Function Logs
In Supabase Dashboard:
1. Go to **Edge Functions**
2. Click `create-stripe-connect-account`
3. Scroll to **Recent Invocations**
   - Should see your function call
   - Status: Success
   - Should return the Stripe account ID

---

## If Test Fails

### Scenario 1: "No record created in database"

**Check 1**: Did the success alert appear?
- If NO → Edge Function failed
  - Check Edge Function logs in Supabase Dashboard
  - Look for error messages
  - Verify `STRIPE_SECRET_KEY` is set in secrets

- If YES → Edge Function succeeded, but modal closed without refresh
  - Check mobile app console logs (run `yarn start` then look at terminal)
  - Look for network errors

**Fix**:
```bash
# Redeploy Edge Functions
supabase functions deploy create-stripe-connect-account --no-verify-jwt

# Check logs
supabase functions logs create-stripe-connect-account
```

### Scenario 2: "Error: EXPO_PUBLIC_SUPABASE_URL is undefined"

**Fix**:
1. Check `.env.local` file exists in `p2p-kids-marketplace/`
2. Add these lines:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. Restart Expo: `yarn start`

### Scenario 3: "Failed to create Stripe account" error

**Check steps**:
1. Is `STRIPE_SECRET_KEY` set in Supabase Edge Function secrets?
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Should see `STRIPE_SECRET_KEY` listed
   - If not, add it

2. Is the key valid?
   - Should start with `sk_test_` (test mode) or `sk_live_` (production)
   - Try a new key from Stripe Dashboard

3. Are you authenticated?
   - Make sure you logged in via the mobile app before testing
   - Check console logs for auth errors

**Fix**:
```bash
# Verify key in Supabase
supabase secrets list

# Update if needed
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

---

## Success Indicators

✅ **Test Case 1.1 is PASSING when:**
1. Success alert appears after clicking "Add Method"
2. Record created in `seller_payout_methods` with `method_type='stripe_connect'`
3. `stripe_account_id` starts with `acct_`
4. Payout Settings screen shows Stripe method in the list
5. Stripe Dashboard shows new connected account

---

## Next Step After Verification

Once Test Case 1.1 passes, continue with:
- **Test Case 1.3**: Complete Stripe onboarding in sandbox
  - Open Stripe onboarding URL
  - Fill in test information
  - Submit form
  - Verify webhook updates `is_verified=true`

See [PAY-004-005-MANUAL-TEST-CASES.md](PAY-004-005-MANUAL-TEST-CASES.md) for full test suite.
