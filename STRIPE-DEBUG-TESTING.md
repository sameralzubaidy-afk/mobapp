# Stripe Connect Account Creation - Comprehensive Debug Testing

## Quick Steps

### 1. Redeploy the Function with Debug Logging
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase functions deploy create-stripe-connect-account --no-verify-jwt
```

Wait for deployment to complete. You should see:
```
✓ Function created successfully: create-stripe-connect-account
```

### 2. Open Function Logs in Real-Time
In a NEW terminal tab, run:
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase functions logs create-stripe-connect-account --tail
```

This will show logs as they happen. Keep this running during testing.

### 3. Test Case 1.1 - Create Stripe Account
In your mobile app:
1. Open the app
2. Navigate: Profile → Settings → Payout Settings
3. Tap: "+ Add Payment Method" button
4. Select: "Stripe Connect"
5. Tap: "Add Method"

### 4. Observe Console Logs

You should see a sequence like this:

#### ✅ SUCCESSFUL SEQUENCE (What you want to see)
```
[create-stripe-connect-account] INIT: Stripe key status: set (sk_test_...)
[create-stripe-connect-account] INIT: Supabase URL status: set
[create-stripe-connect-account] INIT: Supabase Service Key status: set
[create-stripe-connect-account] AUTH: Auth header present: true
[create-stripe-connect-account] AUTH: Creating Supabase client with service role key
[create-stripe-connect-account] AUTH: Verifying user from token
[create-stripe-connect-account] AUTH: User authenticated: user-123-uuid email: user@example.com
[create-stripe-connect-account] REQ: Parsing request body
[create-stripe-connect-account] REQ: Body parsed successfully, keys: userId
[create-stripe-connect-account] REQ: userId from body: user-123-uuid
[create-stripe-connect-account] REQ: user.id from token: user-123-uuid
[create-stripe-connect-account] REQ: Match: true
[create-stripe-connect-account] DB: Checking for existing Stripe Connect method
[create-stripe-connect-account] DB: No existing method found, will create new one
[create-stripe-connect-account] STRIPE: Email to use: user@example.com
[create-stripe-connect-account] STRIPE: Stripe key available: true
[create-stripe-connect-account] STRIPE: Calling stripe.accounts.create()
[create-stripe-connect-account] STRIPE: Creating account with: {type: 'express', country: 'US', email: '...', business_type: 'individual'}
[create-stripe-connect-account] STRIPE: Account created successfully: acct_1Abc...
[create-stripe-connect-account] DB: Creating new payout method for user user-123-uuid
[create-stripe-connect-account] DB: Method data: {user_id: '...', method_type: 'stripe_connect', stripe_account_id: 'acct_...', ...}
[create-stripe-connect-account] DB: Successfully created method method-uuid-123
```

**Then in the mobile app**: You should see a SUCCESS alert.

---

## ❌ COMMON ERROR SEQUENCES AND FIXES

### Error 1: MISSING ENVIRONMENT VARIABLES

**Log Output:**
```
[create-stripe-connect-account] INIT: Stripe key status: MISSING
[create-stripe-connect-account] INIT: Supabase URL status: MISSING
[create-stripe-connect-account] INIT: Supabase Service Key status: MISSING
[create-stripe-connect-account] CRITICAL: Missing Supabase environment variables
```

**What it means**: Environment variables not set in Supabase

**Fix:**
```bash
# Check current secrets
supabase secrets list

# Should show all three:
# STRIPE_SECRET_KEY = sk_test_...
# SUPABASE_URL = https://xyz.supabase.co
# SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...

# If missing, set them:
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

---

### Error 2: STRIPE API KEY INVALID

**Log Output:**
```
[create-stripe-connect-account] STRIPE: Stripe key available: true
[create-stripe-connect-account] STRIPE: Calling stripe.accounts.create()
[create-stripe-connect-account] STRIPE: Creating account with: {...}
[create-stripe-connect-account] STRIPE: Error creating account
  Error type: Error
  Error message: Invalid API Key provided
  Error code: undefined
  Error status: 401
```

**What it means**: STRIPE_SECRET_KEY is not a valid test key

**Fix:**
```bash
# Verify the key format:
# - Must start with: sk_test_
# - Must be ~120 characters long
# - Should NOT be a live key (sk_live_...)

# Get a valid test key from:
# https://dashboard.stripe.com/apikeys (Stripe Dashboard)
# Use the "Secret Key" from Test mode (toggle at top)

supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_NEW_KEY_HERE
```

---

### Error 3: AUTH FAILURE - Missing Token

**Log Output:**
```
[create-stripe-connect-account] AUTH: Auth header present: false
```

**What it means**: Mobile app not sending authorization token

**Possible causes**:
1. Session expired
2. Login failed
3. App not getting token from Supabase
4. Network issue

**Fix**:
```
1. Log out and log back in in the mobile app
2. Check that login succeeded (you should see Dashboard, not Login screen)
3. Try again
```

---

### Error 4: AUTH FAILURE - Invalid Token

**Log Output:**
```
[create-stripe-connect-account] AUTH: Verifying user from token
[create-stripe-connect-account] AUTH: Auth error: Session doesn't exist
[create-stripe-connect-account] AUTH: No user found in token
```

**What it means**: Token is invalid or expired

**Fix**:
```
1. Log out in mobile app: Profile → Sign Out
2. Log back in
3. Try again
```

---

### Error 5: USER ID MISMATCH

**Log Output:**
```
[create-stripe-connect-account] REQ: userId from body: user-123-uuid
[create-stripe-connect-account] REQ: user.id from token: user-456-uuid
[create-stripe-connect-account] REQ: Match: false
[create-stripe-connect-account] SECURITY: User ID mismatch - attempted to access another user
```

**What it means**: Mobile app sending wrong user ID (security issue)

**This should never happen** - if you see this, contact support.

---

### Error 6: DATABASE TABLE NOT FOUND

**Log Output:**
```
[create-stripe-connect-account] DB: Creating new payout method for user user-123-uuid
[create-stripe-connect-account] DB: Insert error: relation "seller_payout_methods" does not exist
  Error details: {...}
  Code: 42P01
```

**What it means**: Database schema not set up correctly

**Fix:**
```bash
# You need to create the seller_payout_methods table
# Run this SQL in Supabase SQL Editor:

CREATE TABLE seller_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('stripe_connect', 'paypal', 'venmo')),
  stripe_account_id TEXT,
  paypal_email TEXT,
  venmo_handle TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, method_type)
);

CREATE INDEX idx_seller_payout_methods_user_id ON seller_payout_methods(user_id);
ALTER TABLE seller_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payout methods"
  ON seller_payout_methods
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payout methods"
  ON seller_payout_methods
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

### Error 7: DATABASE COLUMN MISMATCH

**Log Output:**
```
[create-stripe-connect-account] DB: Insert error: column "stripe_onboarding_complete" does not exist
  Code: 42703
```

**What it means**: One or more columns are missing from seller_payout_methods table

**Fix:**
Alter the table to add missing columns:
```sql
ALTER TABLE seller_payout_methods ADD COLUMN stripe_onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE seller_payout_methods ADD COLUMN stripe_payouts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE seller_payout_methods ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
```

---

### Error 8: UNIQUE CONSTRAINT VIOLATION

**Log Output:**
```
[create-stripe-connect-account] DB: Insert error: duplicate key value violates unique constraint "seller_payout_methods_user_id_method_type_key"
  Code: 23505
```

**What it means**: User already has a stripe_connect method (should have been caught earlier)

**This is a logic error** - the function should have found the existing method in the "Check for existing" step.

**What to check**:
1. Does `seller_payout_methods` have a UNIQUE constraint on (user_id, method_type)?
2. If not, the check-for-existing query isn't working properly

---

## Advanced Debugging

### View Raw Request/Response

Add this to your mobile app temporarily to see what's being sent:

In `p2p-kids-marketplace/src/screens/seller/PayoutSettingsScreen.tsx`, find the Stripe flow and add logging:

```typescript
console.log('[Stripe Flow] Request body:', { userId: user.id });
const response = await fetch(`${url}/create-stripe-connect-account`, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ userId: user.id })
});
console.log('[Stripe Flow] Response status:', response.status);
const result = await response.json();
console.log('[Stripe Flow] Response body:', result);
```

### Direct API Testing with cURL

Test the function directly from terminal (replace with your real values):

```bash
# Get a valid JWT token from your session
# Then run:

curl -X POST https://your-project.supabase.co/functions/v1/create-stripe-connect-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID"}' \
  -v

# -v shows full request/response details
```

---

## Step-by-Step Execution Flow (for understanding)

1. **INIT Phase**: Load environment variables
   - Check: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   - Result: Either all present or errors logged

2. **AUTH Phase**: Verify user is logged in
   - Get: Authorization header
   - Call: supabase.auth.getUser()
   - Result: user.id and user.email extracted

3. **REQ Phase**: Parse and validate request
   - Parse: JSON body
   - Extract: userId from body
   - Verify: userId matches authenticated user.id

4. **DB Phase**: Check for existing method
   - Query: seller_payout_methods WHERE user_id=X AND method_type='stripe_connect'
   - If found: Return existing stripe_account_id
   - If not found: Continue to Stripe creation

5. **STRIPE Phase**: Create account in Stripe
   - Call: stripe.accounts.create({type: 'express', email, ...})
   - Get back: account.id (something like acct_1Abc...)

6. **DB Phase**: Store method in database
   - Insert/Update: seller_payout_methods with stripe_account_id
   - Return: Success response

7. **Mobile**: Show success alert with methodId and stripeAccountId

---

## Testing Checklist

- [ ] Function deployed without errors
- [ ] Logs show INIT phase with all 3 environment variables set
- [ ] Logs show AUTH phase with user ID extracted
- [ ] Logs show STRIPE phase with account creation
- [ ] Logs show DB phase with method insertion
- [ ] Mobile app shows SUCCESS alert
- [ ] Database record created: `SELECT * FROM seller_payout_methods ORDER BY created_at DESC LIMIT 1;`
- [ ] Record has stripe_account_id starting with "acct_"

---

## Next Steps After Success

Once Test Case 1.1 passes (create account), test:
- **Test Case 1.3**: Complete Stripe onboarding flow
- **Test Case 1.4**: Verify payout enablement
- **Test Case 1.5**: Test payout processing

Each has similar debugging approaches.
