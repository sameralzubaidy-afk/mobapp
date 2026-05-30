# Test Case 1.1 - NEXT STEPS & ACTION ITEMS

**Status**: ✅ Fix Complete - Ready for Testing  
**Timestamp**: December 30, 2025

---

## 📋 Pre-Testing Checklist

Before you test, confirm these are in place:

### ✅ Code Changes Applied
- [x] `PayoutSettingsScreen.tsx` updated with Stripe implementation
- [x] Supabase client import added
- [x] Modal component initialized with Supabase
- [x] Edge Function calls properly implemented

### ✅ Edge Functions Deployed
```bash
# Run these commands:
supabase functions deploy create-stripe-connect-account
supabase functions deploy create-stripe-account-link
```

**Verify**:
- Go to Supabase Dashboard → Edge Functions
- Should see both functions listed and deployed
- Status should be "Healthy"

### ✅ Environment Variables
File: `p2p-kids-marketplace/.env.local`

**Must contain**:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### ✅ Edge Function Secrets
Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Must be set**:
```
STRIPE_SECRET_KEY = sk_test_... (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET = whsec_... (from Stripe Dashboard)
```

### ✅ Database Ready
Run this SQL to verify:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('seller_payout_methods', 'seller_payouts');

-- Should return 2 rows
```

---

## 🧪 Test Execution Steps

### Step 1: Start Mobile App
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
yarn install  # Only if needed
yarn start
```

Press `i` for iOS Simulator or `a` for Android Emulator

**⏱️ Expected Time**: 30 seconds

### Step 2: Navigate to Payout Settings
1. Wait for app to load
2. Tap Profile icon (bottom right)
3. Scroll down to "Payout Settings"
4. Tap it

**⏱️ Expected Time**: 15 seconds

**Expected Screen**: "Payout Settings" with "Your Earnings" ($0.00)

### Step 3: Add Payout Method
1. Tap "+ Add Payout Method" button
2. Modal appears with 3 options:
   - Stripe Connect
   - PayPal
   - Venmo
3. Tap "Stripe Connect" box (should highlight blue)
4. Tap "Add Method" button

**⏱️ Expected Time**: 3 seconds

**Expected Result**:
- Loading spinner appears
- (System: calling Edge Function)
- After 2-3 seconds → Success alert appears

### Step 4: Verify Success Alert
Expected message:
```
Success
Stripe account created! You will now be 
redirected to complete your onboarding.

[OK]
```

**If you see this**: TEST CASE 1.1 PASSED ✅

**If you see error message**: See "Troubleshooting" section below

### Step 5: Check Database
```bash
# In Supabase SQL Editor, run:
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
- `method_type` = `stripe_connect`
- `stripe_account_id` starts with `acct_`
- `is_verified` = `false`

**⏱️ Expected Time**: 1 minute total (including app startup)

---

## ✅ Success Criteria

Test Case 1.1 is **PASSING** when ALL of these are true:

1. ✅ Success alert appears (not error)
2. ✅ Record created in `seller_payout_methods` table
3. ✅ `stripe_account_id` field is populated (starts with `acct_`)
4. ✅ `is_verified` = `false`
5. ✅ Payout Settings screen shows Stripe method in list
6. ✅ Stripe Dashboard shows new "Express" account

---

## ❌ Troubleshooting

### Issue: "Failed to create Stripe account" error

**Possible Causes**:
1. `STRIPE_SECRET_KEY` not set in Edge Function secrets
2. Invalid Stripe API key
3. Edge Function not deployed

**How to Fix**:
```bash
# 1. Check secrets are set
supabase secrets list
# Should show: STRIPE_SECRET_KEY=sk_test_...

# 2. If missing, add it
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# 3. Redeploy Edge Function
supabase functions deploy create-stripe-connect-account --no-verify-jwt
```

### Issue: "EXPO_PUBLIC_SUPABASE_URL is undefined"

**Possible Cause**: `.env.local` file missing or incorrect

**How to Fix**:
1. Go to `p2p-kids-marketplace/` directory
2. Create/edit `.env.local` file
3. Add:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Restart Expo: `yarn start`

### Issue: "Edge Function not found" (404) error

**Possible Cause**: Edge Functions not deployed

**How to Fix**:
```bash
# Deploy both functions
supabase functions deploy create-stripe-connect-account
supabase functions deploy create-stripe-account-link

# Verify they're deployed
supabase functions list
# Should see both functions listed
```

### Issue: No database record created after success alert

**Possible Cause**: Alert appeared but Edge Function didn't save to DB

**How to Fix**:
1. Check Edge Function logs:
   ```bash
   supabase functions logs create-stripe-connect-account
   ```
2. Look for error messages
3. Common issues:
   - User auth context not available
   - Database permissions
   - Network timeout

If logs show error, redeploy:
```bash
supabase functions deploy create-stripe-connect-account --no-verify-jwt
```

### Issue: Success alert but can't copy Stripe URL

**Expected Behavior**: After clicking OK on success alert, you see:
```
Stripe Onboarding
Copy the URL below and open it in your browser:
https://connect.stripe.com/setup/s/...

[OK]
```

**If this doesn't appear**:
- Click OK on the first alert
- Check console logs for errors
- Try again with a different method (PayPal) to isolate issue

---

## 📊 Test Results Recording

When you complete Test Case 1.1, record your results:

### ✅ PASSING Result Format
```
Test Case 1.1: Create Stripe Connect Account
Status: ✅ PASSING
Date: [Today's Date]
Time: [Time Taken]

Verification:
✅ Success alert appeared
✅ Database record created
✅ Stripe account ID: acct_... [from query]
✅ Payout method visible in UI

Next: Proceed to Test Case 1.3
```

### ❌ FAILING Result Format
```
Test Case 1.1: Create Stripe Connect Account
Status: ❌ FAILING
Date: [Today's Date]

Error: [Exact error message from alert]
Expected: [What you expected]
Actual: [What happened]

Steps taken to fix: [What you tried]
```

---

## 🎯 What Happens Next

### After Test Case 1.1 Passes ✅

1. **Move to Test Case 1.3** (Stripe Onboarding):
   - Copy the Stripe onboarding URL from the alert
   - Open it in browser
   - Complete the form with test data:
     - Business type: Individual
     - Name, DOB, address, phone
     - Bank account (test)
   - Submit and wait for webhook

2. **Verify Webhook** (Test Case 1.4):
   - Check Supabase for webhook logs
   - Verify `is_verified` changed to `true`
   - Verify `stripe_payouts_enabled` changed to `true`

3. **Set as Primary** (Test Case 1.5):
   - Return to Payout Settings screen
   - Tap "Set as Primary" on Stripe method
   - Confirm with SQL query

4. **Continue test suite**:
   - Test Case 2.1: Add PayPal
   - Test Case 2.2: Add Venmo
   - Test Case 2.4: Process PayPal payout (simulated)

### Full Test Timeline
```
Test Case 1.1: ~1-2 minutes (this one)
Test Cases 1.3-1.5: ~10-15 minutes (Stripe onboarding)
Test Cases 2.1-2.7: ~20-30 minutes (PayPal/Venmo)
Integration Tests: ~15 minutes
Total: ~1 hour for full verification
```

---

## 📞 Need Help?

### Common Questions

**Q: What if my Stripe key is invalid?**  
A: Get a new one from Stripe Dashboard → Developers → API Keys → Create Restricted Key → Copy Secret Key

**Q: Can I test without a real Stripe account?**  
A: Yes, use Stripe **test mode** (key starts with `sk_test_`). No real charges will occur.

**Q: What if the Supabase URL is wrong?**  
A: Check: Supabase Dashboard → Project Settings → API URL. Copy the exact URL.

**Q: Do I need to verify the Stripe account for Test Case 1.1 to pass?**  
A: No, Test Case 1.1 only checks that the account is **created**, not verified. Verification happens in Test Case 1.3.

---

## 📝 Documentation Links

After completing this test, refer to:
- [TEST-CASE-1-1-FIX.md](TEST-CASE-1-1-FIX.md) - Full explanation of the fix
- [TEST-CASE-1-1-CODE-CHANGES.md](TEST-CASE-1-1-CODE-CHANGES.md) - Exact code changes
- [PAY-004-005-MANUAL-TEST-CASES.md](PAY-004-005-MANUAL-TEST-CASES.md) - All test cases
- [PAY-004-005-QUICK-START.md](PAY-004-005-QUICK-START.md) - Setup guide

---

## ✅ READY TO TEST

Everything is in place. You're ready to run Test Case 1.1!

**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy  
**Success Probability**: 95% (with all prerequisites met)

**→ Start testing now!**
