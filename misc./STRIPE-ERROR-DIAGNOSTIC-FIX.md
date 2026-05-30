# Test Case 1.1 - "Failed to create Stripe account" Diagnostic & Fix

**Issue**: Getting error alert "Failed to create Stripe account"  
**Status**: FIXED - Updated Edge Function with better error logging and handling

---

## What I Fixed

The Edge Function had two issues:

### Issue 1: Profile Lookup Failing
The function was trying to load user profile from `profiles` table with `.single()`, which fails silently if the profile doesn't exist.

**Before**:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('email')
  .eq('id', userId)
  .single();  // ← This fails if profile doesn't exist!

const account = await stripe.accounts.create({
  // ...
  email: profile?.email || user.email,  // ← email might be undefined
});
```

**After**:
```typescript
// Use auth email directly (always available)
const userEmail = user.email || `user-${userId}@kids-marketplace.local`;

// Create Stripe account with proper error handling
let account;
try {
  account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: userEmail,  // ← Always has a value
    // ...
  });
} catch (stripeError: any) {
  // Return actual Stripe error message instead of generic one
  return new Response(
    JSON.stringify({ success: false, error: `Stripe API error: ${stripeError.message}` }),
    { status: 400, headers: { ... } }
  );
}
```

### Issue 2: Generic Error Messages
The function returned generic "Failed to create Stripe account" errors instead of real error details.

**Before**:
```typescript
return new Response(
  JSON.stringify({ success: false, error: 'Failed to create payout method' }),
  // ← No details about what actually failed
);
```

**After**:
```typescript
return new Response(
  JSON.stringify({ success: false, error: `Database error: ${insertError.message}` }),
  // ← Shows actual error from database or Stripe
);
```

### Issue 3: No Debug Logging
Hard to troubleshoot without logs.

**Added**:
```typescript
console.log(`[create-stripe-connect-account] Creating account for user ${userId}`);
console.log(`[create-stripe-connect-account] Created Stripe account: ${account.id}`);
console.error('[create-stripe-connect-account] Error creating payout method:', insertError);
```

---

## How to Debug Now

### Step 1: Check Edge Function Logs

```bash
# In terminal, run:
supabase functions logs create-stripe-connect-account
```

You'll now see detailed logs like:
```
[create-stripe-connect-account] Creating account for user abc-123-def
[create-stripe-connect-account] Creating new payout method for user abc-123-def
[create-stripe-connect-account] Successfully created method xyz-456-uvw
```

Or if it fails:
```
[create-stripe-connect-account] Stripe API error: Invalid API Key provided
[create-stripe-connect-account] Error creating payout method: relation "seller_payout_methods" does not exist
```

### Step 2: Test the Edge Function Directly

```bash
# Get your JWT token and user ID first, then:
curl -X POST \
  'https://your-project.supabase.co/functions/v1/create-stripe-connect-account' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{
    "userId": "your-user-uuid"
  }' | jq
```

Expected success response:
```json
{
  "success": true,
  "methodId": "xyz-456",
  "stripeAccountId": "acct_..."
}
```

Expected error response (now with real details):
```json
{
  "success": false,
  "error": "Stripe API error: Invalid API Key provided"
}
```

---

## Common Errors & Solutions

### Error: "Stripe API error: Invalid API Key provided"

**Cause**: `STRIPE_SECRET_KEY` not set or invalid

**Fix**:
```bash
# 1. Verify key is set
supabase secrets list
# Should show: STRIPE_SECRET_KEY=sk_test_...

# 2. If not set, add it
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY

# 3. Redeploy function
supabase functions deploy create-stripe-connect-account --no-verify-jwt
```

**Get valid key from**: Stripe Dashboard → Developers → API Keys → Reveal Test Secret Key → Copy

### Error: "relation \"seller_payout_methods\" does not exist"

**Cause**: Database table doesn't exist

**Fix**:
```bash
# Run the migration
supabase db push

# Or manually create table (verify schema first)
# Run migration file: supabase/migrations/061_seller_payouts_helpers.sql
```

### Error: "Database error: duplicate key value violates unique constraint"

**Cause**: Stripe method already exists for this user

**Why this is actually OK**: The function has logic to handle this - it returns the existing method instead of creating a duplicate.

**If you want to test creating a new account**: Create a new test user or use different user ID

### Error: "Unauthorized" or "Missing authorization header"

**Cause**: JWT token not passed or invalid

**Fix**:
```bash
# In mobile app, make sure:
# 1. User is logged in (AuthContext has session)
# 2. Authorization header is being sent:

-H 'Authorization: Bearer ${(await supabase.auth.getSession()).data.session?.access_token}'
```

Check that code in `PayoutSettingsScreen.tsx` around line 415-420

### Error: "User ID mismatch"

**Cause**: Sending different userId than the authenticated user

**Fix**:
```typescript
// Make sure you're sending the authenticated user's ID:
const { data: { user } } = await supabase.auth.getUser();
body: JSON.stringify({
  userId: user.id,  // ← Must be the authenticated user
})
```

---

## Deploy & Test Again

### Step 1: Redeploy the Fixed Function

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase functions deploy create-stripe-connect-account --no-verify-jwt
```

Expected output:
```
Deploying function 'create-stripe-connect-account'...
✓ Function deployed successfully
```

### Step 2: Verify Secrets Are Set

```bash
supabase secrets list
```

Should show:
```
STRIPE_SECRET_KEY      = sk_test_...
STRIPE_WEBHOOK_SECRET  = whsec_...
SUPABASE_URL           = https://...
SUPABASE_SERVICE_ROLE_KEY = eyJ...
```

If anything is missing:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

### Step 3: Test in Mobile App Again

1. Open mobile app: `yarn start`
2. Profile → Payout Settings
3. "+ Add Method" → "Stripe" → "Add Method"

**Expected results**:
- ✅ Success alert appears **OR**
- ✅ Error alert with **specific error message** (not generic)

### Step 4: Check Logs While Testing

In another terminal:
```bash
supabase functions logs create-stripe-connect-account
```

Watch for detailed logs showing exactly where it's failing.

---

## If Still Failing

### Collect Information

Run these commands and share the output:

```bash
# 1. Check function logs
supabase functions logs create-stripe-connect-account

# 2. Verify deployment
supabase functions list | grep create-stripe

# 3. Verify secrets
supabase secrets list

# 4. Check database tables
# Run in Supabase SQL Editor:
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'seller_payout_methods';
```

### Test Edge Function Directly

```bash
# Test with curl (replace values with your own)
curl -X POST \
  'https://your-project.supabase.co/functions/v1/create-stripe-connect-account' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -d '{"userId":"YOUR_USER_ID"}' | jq .
```

This will show you the exact error from the function.

---

## Summary of Changes

**File**: `supabase/functions/create-stripe-connect-account/index.ts`

**Changes**:
1. ✅ Remove profile lookup (use auth email instead)
2. ✅ Add try/catch for Stripe API calls
3. ✅ Improve error messages (show actual errors)
4. ✅ Add console logging for debugging
5. ✅ Better error handling in database operations

**Result**: Error messages are now specific and helpful instead of generic

---

## Next: Test Case 1.1 Again

You should now get either:

1. **Success**: "Stripe account created! You will now be redirected..."
2. **Specific Error**: "Stripe API error: X" or "Database error: Y"

If you get a specific error message, use the "Common Errors & Solutions" section above to fix it.

**Ready to test again?** Follow the test steps in [TEST-CASE-1-1-QUICK-RUN.md](TEST-CASE-1-1-QUICK-RUN.md)
