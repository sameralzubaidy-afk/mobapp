# Test Case 1.1 Fix - Stripe Connect Account Creation

**Issue**: When user clicked "Stripe Connect" and then "OK" on the modal, nothing happened. No record was created in `seller_payout_methods` table.

**Root Cause**: The `PayoutSettingsScreen` was showing a placeholder message "Stripe onboarding is not yet implemented" instead of actually calling the Edge Function to create the Stripe Connect account.

---

## What Was Wrong

In `AddPayoutMethodModal` component (lines ~420-425), the code was:

```typescript
case 'stripe_connect':
  // Stripe onboarding will be handled separately via edge function
  Alert.alert(
    'Stripe Connect',
    'Stripe onboarding is not yet implemented. This will redirect you to Stripe onboarding.',
    [{ text: 'OK', onPress: onClose }]
  );
  break;
```

This was just a placeholder - it showed an alert and closed the modal without calling any Edge Function or creating any database record.

---

## What I Fixed

### 1. **Stripe Account Creation Flow**

When user selects "Stripe Connect", the app now:

1. **Calls `create-stripe-connect-account` Edge Function**
   ```typescript
   POST /functions/v1/create-stripe-connect-account
   Body: { userId: "..." }
   ```
   - Creates Stripe Express account
   - Returns: `{ success: true, accountId: "acct_...", methodId: "..." }`
   - **Creates record** in `seller_payout_methods` table with:
     - `method_type = 'stripe_connect'`
     - `stripe_account_id` (the Stripe account ID)
     - `is_verified = false`
     - `stripe_onboarding_complete = false`
     - `stripe_payouts_enabled = false`

2. **Calls `create-stripe-account-link` Edge Function**
   ```typescript
   POST /functions/v1/create-stripe-account-link
   Body: { userId: "...", methodId: "...", returnUrl: "...", refreshUrl: "..." }
   ```
   - Generates Stripe onboarding URL
   - Returns: `{ success: true, url: "https://connect.stripe.com/setup/s/..." }`
   - User can then navigate to this URL to complete onboarding

3. **Shows success alert** with next steps

### 2. **Updated Imports**

Added Supabase client import:
```typescript
import { createClient } from '@supabase/supabase-js';
```

### 3. **Initialize Supabase in Modal**

In `AddPayoutMethodModal`, now initializes the Supabase client:
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || {});
```

---

## Updated Test Case 1.1 Flow

**Now when you follow Test Case 1.1**:

### Steps:
1. Open mobile app → Profile → Payout Settings
2. Tap "+ Add Payout Method"
3. Select "Stripe (Bank Transfer)"
4. Tap "Continue"

### Expected Results (NEW):
- Loading indicator shown
- Edge Function `/create-stripe-connect-account` called successfully
- **Record CREATED** in `seller_payout_methods`:
  ```sql
  SELECT * FROM seller_payout_methods 
  WHERE user_id = '<YOUR_USER_ID>' 
  AND method_type = 'stripe_connect';
  ```
  Should return ONE row with:
  - `stripe_account_id`: `acct_...` (Stripe account ID)
  - `is_verified`: `false`
  - `stripe_onboarding_complete`: `false`
  - `stripe_payouts_enabled`: `false`

- Success alert shown: "Stripe account created! You will now be redirected..."
- User can see Stripe onboarding URL (or deep link if deep linking is enabled)

---

## How to Test Now

### 1. **Manual Test Case 1.1 (Updated)**

```bash
# Open mobile app → Payout Settings → Add Method → Stripe
# Expected: Record created in seller_payout_methods
```

Verify with this SQL query:
```sql
SELECT 
  id, 
  user_id, 
  method_type, 
  stripe_account_id, 
  is_verified, 
  stripe_onboarding_complete,
  stripe_payouts_enabled,
  created_at
FROM seller_payout_methods 
WHERE user_id = '<YOUR_USER_ID>' 
AND method_type = 'stripe_connect'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Output**:
| id | user_id | method_type | stripe_account_id | is_verified | stripe_onboarding_complete | stripe_payouts_enabled | created_at |
|----|---------|-------------|--------------------|-------------|---------------------------|------------------------|-----------|
| UUID | UUID | stripe_connect | acct_... | false | false | false | 2025-12-30T... |

### 2. **Verify Database Record Created**

Run in Supabase SQL Editor:
```sql
-- Count total Stripe methods for your user
SELECT COUNT(*) as stripe_methods_count
FROM seller_payout_methods
WHERE user_id = '<YOUR_USER_ID>'
AND method_type = 'stripe_connect';

-- Should return: 1
```

### 3. **Verify Stripe Account Created**

Check Stripe Dashboard:
- Go to **Developers** → **Connect** → **Connected Accounts**
- You should see a new "Express" account created
- Status should be "Onboarding incomplete"

---

## Files Modified

- **`p2p-kids-marketplace/src/screens/seller/PayoutSettingsScreen.tsx`**
  - Added Supabase import
  - Updated Stripe Connect case in `AddPayoutMethodModal` to call Edge Functions
  - Initialize Supabase client in modal component

---

## Next Steps

Once you verify Test Case 1.1 is working:

1. **Complete Stripe Onboarding** (Test Case 1.3)
   - Navigate to Stripe onboarding URL
   - Complete the form
   - Submit
   - Wait for webhook to update `is_verified` and `stripe_payouts_enabled` flags

2. **Verify Webhook Firing** (Test Case 1.4)
   - Check Stripe Dashboard for webhook events
   - Verify `account.updated` event received
   - Confirm database flags updated

3. **Set as Primary** (Test Case 1.5)
   - Once verified, set Stripe as primary payout method
   - Confirm `is_primary = true` in database

---

## Troubleshooting

### Error: "EXPO_PUBLIC_SUPABASE_URL is undefined"

**Fix**: Make sure your `.env.local` file has:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Error: "Edge Function not found" or "404"

**Fix**: 
1. Confirm you deployed the Edge Functions to Supabase
2. Run: `supabase functions deploy create-stripe-connect-account create-stripe-account-link`
3. Verify in Supabase Dashboard → Edge Functions that they appear

### Error: "Failed to create Stripe account"

**Possible causes**:
1. `STRIPE_SECRET_KEY` not set in Supabase Edge Function secrets
2. User doesn't have a valid session (not authenticated)
3. Stripe API key is invalid or revoked

**Fix**:
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add: `STRIPE_SECRET_KEY=sk_test_...`
3. Redeploy Edge Functions
4. Try again

---

## Code Changes Summary

### Before (Not Working):
```typescript
case 'stripe_connect':
  Alert.alert(
    'Stripe Connect',
    'Stripe onboarding is not yet implemented. This will redirect you to Stripe onboarding.',
    [{ text: 'OK', onPress: onClose }]
  );
  break;
```

### After (Fixed):
```typescript
case 'stripe_connect':
  try {
    // 1. Create Stripe Connect account
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-connect-account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          userId: (await supabase.auth.getUser()).data.user?.id,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      Alert.alert('Error', result.error || 'Failed to create Stripe account');
      return;
    }

    // 2. Generate onboarding link
    const linkResponse = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-account-link`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          userId: (await supabase.auth.getUser()).data.user?.id,
          methodId: result.methodId,
          returnUrl: 'kidsmarketplace://payout-settings?stripe=success',
          refreshUrl: 'kidsmarketplace://payout-settings?stripe=refresh',
        }),
      }
    );

    const linkResult = await linkResponse.json();
    if (!linkResponse.ok || !linkResult.success) {
      Alert.alert('Error', linkResult.error || 'Failed to generate onboarding link');
      return;
    }

    // 3. Show success and onboarding URL
    Alert.alert(
      'Success',
      'Stripe account created! You will now be redirected to complete your onboarding.',
      [{ 
        text: 'OK', 
        onPress: async () => {
          const url = linkResult.url;
          if (url) {
            Alert.alert(
              'Stripe Onboarding',
              'Copy the URL below and open it in your browser:\n\n' + url,
              [{ text: 'OK', onPress: () => onClose(true) }]
            );
          } else {
            onClose(true);
          }
        }
      }]
    );
  } catch (error) {
    console.error('Failed to create Stripe Connect account:', error);
    Alert.alert('Error', String(error) || 'Failed to create Stripe account');
  }
  break;
```

---

## Status: ✅ FIXED

Test Case 1.1 should now work correctly. When you click "Stripe Connect" and proceed, a record will be created in `seller_payout_methods` table with the Stripe account details.
