# ManageKidsClubScreen Integration Guide

**Task:** Integrate SUB-016 & SUB-017 components into existing ManageKidsClubScreen  
**Approach:** Minimal edits to preserve existing functionality  

---

## 📍 File Location

`p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx`

---

## 🔧 Step 1: Add Imports (at top of file, after existing imports)

```typescript
// SUB-017 Components
import { PaymentMethodSection } from '../../components/subscription/PaymentMethodSection';
import { AutoRenewToggle } from '../../components/subscription/AutoRenewToggle';
import { BillingHistoryLink } from '../../components/subscription/BillingHistoryLink';

// SUB-016 Service Function
import { resubscribe } from '../../services/subscription';
```

---

## 🔧 Step 2: Add State for Payment Method Refresh

Add inside the component, near other useState declarations:

```typescript
const [paymentMethodRefreshKey, setPaymentMethodRefreshKey] = useState(0);
```

---

## 🔧 Step 3: Add handleResubscribe Function

Add this function inside the component (near handleCancelSubscription):

```typescript
const handleResubscribe = async () => {
  setLoading(true);
  try {
    console.log('[ManageKidsClub] Initiating re-subscribe...');
    const result = await resubscribe();

    if (result.success) {
      Alert.alert(
        'Success! 🎉',
        result.message || 'Your Kids Club+ subscription has been renewed!',
        [
          {
            text: 'OK',
            onPress: async () => {
              // Refresh subscription data
              await fetchSubscription();
              // Refresh auth session to update context
              const { error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError) {
                console.error('[ManageKidsClub] Session refresh error:', refreshError);
              }
            },
          },
        ]
      );
    } else {
      // Handle specific error cases
      if (result.error === 'NO_PAYMENT_METHOD') {
        Alert.alert(
          'Payment Method Required',
          'You need to add a payment method to renew your subscription.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Add Payment',
              onPress: () => navigation.navigate('ContinueKidsClub' as never),
            },
          ]
        );
      } else if (result.error === 'INVALID_STATUS') {
        Alert.alert(
          'Cannot Re-subscribe',
          'Your subscription is already active or in an invalid state for renewal.',
          [{ text: 'OK', onPress: () => fetchSubscription() }]
        );
      } else {
        Alert.alert(
          'Error',
          result.message || 'Failed to renew subscription. Please try again or contact support.'
        );
      }
    }
  } catch (error) {
    console.error('[ManageKidsClub] Re-subscribe error:', error);
    Alert.alert(
      'Unexpected Error',
      'An unexpected error occurred. Please check your connection and try again.'
    );
  } finally {
    setLoading(false);
  }
};
```

---

## 🔧 Step 4: Integrate Components into Render

### Location 1: Payment Method Section

**Where:** After the Status Card, before Benefits section  
**Find this code** (around line 290):

```typescript
{/* Status Card */}
<View style={styles.statusCard}>
  {/* ... existing status badge and billing date code ... */}
</View>

{/* Benefits Section */}
<View style={styles.benefitsSection}>
```

**Insert BETWEEN them:**

```typescript
{/* Status Card */}
<View style={styles.statusCard}>
  {/* ... existing status badge and billing date code ... */}
</View>

{/* SUB-017: Payment Method Management - Show for users with subscription history */}
{(isActive || isTrial || isCancelled || isGracePeriod) && (
  <View style={styles.managementSection}>
    {/* Payment Method Section */}
    <PaymentMethodSection
      key={paymentMethodRefreshKey} // Force refresh when needed
      onPaymentMethodUpdated={() => {
        console.log('[ManageKidsClub] Payment method updated, refreshing...');
        setPaymentMethodRefreshKey((prev) => prev + 1);
        fetchSubscription();
      }}
    />

    {/* Auto-Renew Toggle - Only for active/trial subscriptions */}
    {(isActive || isTrial) && (
      <AutoRenewToggle
        initialValue={subscription.auto_renew_enabled ?? true}
        onToggled={(newValue) => {
          console.log('[ManageKidsClub] Auto-renew toggled to:', newValue);
          // Refresh subscription summary to reflect change
          fetchSubscription();
        }}
      />
    )}

    {/* Billing History Link */}
    <BillingHistoryLink />
  </View>
)}

{/* Benefits Section */}
<View style={styles.benefitsSection}>
```

### Location 2: Re-subscribe Button Logic

**Where:** In the render, where re-subscribe button is shown (around line 320-370)

**Find this code:**

```typescript
{/* Re-subscribe button for cancelled/grace_period */}
{(isCancelled || isGracePeriod) && (
  <View style={styles.resubscribeSection}>
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={() => navigation.navigate('ContinueKidsClub' as never)}
      disabled={loading}
    >
      <Text style={styles.primaryButtonText}>
        {isGracePeriod ? 'Re-subscribe and Unlock SP' : 'Re-subscribe to Kids Club+'}
      </Text>
    </TouchableOpacity>
  </View>
)}
```

**Replace with:**

```typescript
{/* SUB-016: Re-subscribe button for cancelled/grace_period */}
{(isCancelled || isGracePeriod) && (
  <View style={styles.resubscribeSection}>
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={handleResubscribe} // Changed: now calls resubscribe() function
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryButtonText}>
          {isGracePeriod
            ? 'Re-subscribe and Unlock SP'
            : 'Re-subscribe to Kids Club+'}
        </Text>
      )}
    </TouchableOpacity>
    {isGracePeriod && (
      <Text style={styles.gracePeriodNote}>
        Your saved payment method will be charged immediately.
      </Text>
    )}
  </View>
)}
```

---

## 🔧 Step 5: Add Styles (at bottom of styles object)

Add these to the StyleSheet.create({ ... }) object:

```typescript
managementSection: {
  marginTop: 20,
},
gracePeriodNote: {
  marginTop: 8,
  fontSize: 13,
  color: '#666',
  textAlign: 'center',
  fontStyle: 'italic',
},
```

---

## 🔧 Step 6: Add ActivityIndicator Import (if not already present)

At the top with other imports from 'react-native':

```typescript
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator, // Add this if missing
  Modal,
  FlatList,
} from 'react-native';
```

---

## ✅ Verification Checklist

After integration, verify:

- [ ] File compiles without TypeScript errors
- [ ] All imports resolve correctly
- [ ] Component paths are correct (`../../components/subscription/...`)
- [ ] Service import path is correct (`../../services/subscription`)
- [ ] No duplicate function names
- [ ] No missing closing tags
- [ ] Styles added to StyleSheet object

Run these commands:

```bash
cd p2p-kids-marketplace

# Type check
npm run typecheck
# or
npx tsc --noEmit

# Lint check
npm run lint
# or
npx eslint src/screens/subscription/ManageKidsClubScreen.tsx

# Start dev server
npm start
```

---

## 🧪 Quick Manual Test After Integration

1. **Open iOS Simulator:**
   ```bash
   npm run ios
   ```

2. **Log in as active subscriber**

3. **Navigate to:** Profile → Manage Kids Club+

4. **Verify visible:**
   - Payment Method Section (shows card or "No payment method")
   - Auto-Renew Toggle (with switch)
   - Billing History Link

5. **Test auto-renew toggle:**
   - Tap to disable → should see confirmation dialog
   - Tap "Disable" → should see success alert
   - Warning box should appear
   - Tap to enable → no confirmation, immediate update

6. **Test billing history navigation:**
   - Tap "View Billing History"
   - Should navigate to BillingHistoryScreen
   - Should show records (if any exist)

7. **Test re-subscribe (if in grace period):**
   - Use test user in grace_period status
   - Tap "Re-subscribe" button
   - Should see loading indicator
   - Should see success alert
   - Status should change to "Active"

---

## 🐛 Common Integration Issues

### Issue 1: Import path errors

**Error:** `Cannot find module '../../components/subscription/PaymentMethodSection'`

**Fix:** Verify the component files exist at:
- `p2p-kids-marketplace/src/components/subscription/PaymentMethodSection.tsx`
- `p2p-kids-marketplace/src/components/subscription/AutoRenewToggle.tsx`
- `p2p-kids-marketplace/src/components/subscription/BillingHistoryLink.tsx`

If components are in different locations, update import paths accordingly.

### Issue 2: TypeScript errors on subscription object

**Error:** `Property 'auto_renew_enabled' does not exist on type 'SubscriptionSummary'`

**Fix:** Ensure SubscriptionSummary type includes V2.1 fields:

```typescript
// In subscription.ts or types file
export interface SubscriptionSummary {
  // ... existing fields
  auto_renew_enabled?: boolean;
  stripe_payment_method_id?: string;
  grace_period_ends_at?: string;
  grace_started_at?: string;
}
```

### Issue 3: Navigation type errors

**Error:** `Argument of type '"BillingHistory"' is not assignable to parameter of type...`

**Fix:** Add BillingHistory to navigation types:

```typescript
// In navigation/types.ts
export type SubscriptionStackParamList = {
  ManageKidsClub: undefined;
  ContinueKidsClub: undefined;
  BillingHistory: undefined; // Add this
};
```

### Issue 4: Components not rendering

**Problem:** Components imported but not visible on screen

**Debug steps:**
1. Check console for errors: `console.log('[ManageKidsClub] Subscription:', subscription);`
2. Verify subscription object has expected fields
3. Check conditional logic: `(isActive || isTrial || isCancelled || isGracePeriod)`
4. Verify user's actual subscription status in database

### Issue 5: Re-subscribe button does nothing

**Problem:** Button tap doesn't trigger resubscribe

**Debug steps:**
1. Add console.log in handleResubscribe: `console.log('[ManageKidsClub] handleResubscribe called');`
2. Check Edge Function is deployed: `npx supabase functions list`
3. Check user's subscription status allows re-subscribe (grace_period or expired)
4. Check network tab for API errors

---

## 📚 Related Files

After integration, these files work together:

**Edge Functions:**
- `supabase/functions/renew-subscription/index.ts`
- `supabase/functions/get-payment-method/index.ts`
- `supabase/functions/update-auto-renew/index.ts`

**Services:**
- `p2p-kids-marketplace/src/services/subscription.ts` (extended)

**Components:**
- `p2p-kids-marketplace/src/components/subscription/PaymentMethodSection.tsx`
- `p2p-kids-marketplace/src/components/subscription/AutoRenewToggle.tsx`
- `p2p-kids-marketplace/src/components/subscription/BillingHistoryLink.tsx`

**Screens:**
- `p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx` (YOU ARE HERE)
- `p2p-kids-marketplace/src/screens/subscription/BillingHistoryScreen.tsx`

**Navigation:**
- `p2p-kids-marketplace/src/navigation/*` (needs BillingHistory route added)

---

## 🚀 Next Steps After Integration

1. **Deploy Edge Functions** (if not already done):
   ```bash
   npx supabase functions deploy renew-subscription
   npx supabase functions deploy get-payment-method
   npx supabase functions deploy update-auto-renew
   ```

2. **Update Navigation Config** (add BillingHistory route)

3. **Run Manual Tests** (see SUB-016-017-MANUAL-TEST-CASES.md)

4. **Create Automated Tests** (unit, E2E, Maestro)

5. **Update flow-registry.md** with new flows

6. **Production Deployment** after testing passes

---

**Integration Guide Complete**  
**Date:** 2025-01-18  
