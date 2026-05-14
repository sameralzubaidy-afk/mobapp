# NAVIGATION UPDATES FOR FLOW-12 SUBSCRIPTIONS

## STEP 1: Update Navigation Types

**File:** `p2p-kids-marketplace/src/navigation/types.ts`

Find the `RootStackParamList` interface and add these routes:

```typescript
export type RootStackParamList = {
  // ... existing routes ...
  
  // MODULE-15.1 FLOW-12: Subscription screens
  SubscriptionPlans: undefined;
  PlanComparison: undefined;
  UpgradePlan: undefined;
  CancelSubscription: undefined;
  SubscriptionExpired: { planName?: string; expiredDate?: string } | undefined;
  MySubscription: undefined;
  
  // ... rest of existing routes ...
};
```

## STEP 2: Update App Navigator

**File:** `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`

### Add Imports (add to top of file):

```typescript
import SubscriptionPlansScreen from '@/screens/subscription/SubscriptionPlansScreen';
import PlanComparisonScreen from '@/screens/subscription/PlanComparisonScreen';
import UpgradePlanScreen from '@/screens/subscription/UpgradePlanScreen';
import CancelSubscriptionScreen from '@/screens/subscription/CancelSubscriptionScreen';
import SubscriptionExpiredScreen from '@/screens/subscription/SubscriptionExpiredScreen';
import MySubscriptionScreen from '@/screens/subscription/MySubscriptionScreen';
```

### Add Stack Screens (add to Stack.Navigator):

```typescript
{/* MODULE-15.1 FLOW-12: Subscription Screens */}
<Stack.Screen 
  name="SubscriptionPlans" 
  component={SubscriptionPlansScreen} 
  options={{ 
    title: 'Choose Your Plan',
    headerBackTitle: 'Back',
  }}
/>
<Stack.Screen 
  name="PlanComparison" 
  component={PlanComparisonScreen} 
  options={{ 
    title: 'Compare Plans',
    headerBackTitle: 'Back',
  }}
/>
<Stack.Screen 
  name="UpgradePlan" 
  component={UpgradePlanScreen} 
  options={{ 
    title: 'Upgrade Plan',
    headerBackTitle: 'Back',
  }}
/>
<Stack.Screen 
  name="CancelSubscription" 
  component={CancelSubscriptionScreen} 
  options={{ 
    title: 'Cancel Subscription',
    headerBackTitle: 'Back',
  }}
/>
<Stack.Screen 
  name="SubscriptionExpired" 
  component={SubscriptionExpiredScreen} 
  options={{ 
    headerShown: false,
    gestureEnabled: false,
  }}
/>
<Stack.Screen 
  name="MySubscription" 
  component={MySubscriptionScreen} 
  options={{ 
    title: 'My Subscription',
    headerBackTitle: 'Back',
  }}
/>
```

## STEP 3: Copy/Paste Commands

To apply the changes quickly:

1. **Open types.ts:**
   ```bash
   code p2p-kids-marketplace/src/navigation/types.ts
   ```

2. **Find the RootStackParamList interface** and add the 6 new routes from STEP 1.

3. **Open AppNavigator.tsx:**
   ```bash
   code p2p-kids-marketplace/src/navigation/AppNavigator.tsx
   ```

4. **Add the 6 imports** from STEP 2 to the top of the file.

5. **Add the 6 Stack.Screen components** from STEP 2 inside the Stack.Navigator (ideally grouped together in one section).

## STEP 4: Verify Navigation

After making the changes, verify TypeScript compiles:

```bash
cd p2p-kids-marketplace
npm run typecheck
```

Expected: **PASS** ✅ (no errors about missing routes or incorrect params)

## ENTRY POINTS

You'll also need to add entry points to these screens. Common locations:

### Profile Menu

**File:** `p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx` (or similar)

Add navigation buttons:

```typescript
// View subscription plans (for all users)
<TouchableOpacity onPress={() => navigation.navigate('SubscriptionPlans')}>
  <Text>View Subscription Plans</Text>
</TouchableOpacity>

// My subscription (for existing subscribers)
{subscription?.status === 'active' || subscription?.status === 'trial' ? (
  <TouchableOpacity onPress={() => navigation.navigate('MySubscription')}>
    <Text>My Subscription</Text>
  </TouchableOpacity>
) : null}
```

### Settings Menu

**File:** `p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx` (or similar)

Add link:

```typescript
<TouchableOpacity onPress={() => navigation.navigate('MySubscription')}>
  <Text>Manage Subscription</Text>
</TouchableOpacity>
```

### Onboarding Upsell

**File:** Onboarding completion screen or after first listing created

```typescript
<TouchableOpacity onPress={() => navigation.navigate('SubscriptionPlans')}>
  <Text>Unlock Pro Features</Text>
</TouchableOpacity>
```

## VERIFICATION

After adding navigation:

1. Start app: `npx expo start --ios`
2. Navigate to Profile → "View Subscription Plans"
3. Verify SubscriptionPlans screen loads
4. Tap "Compare Plans" → verify PlanComparison screen loads
5. Go back, tap "Get Pro" → verify SubscriptionPayment screen loads
6. Return to Profile → "My Subscription" → verify MySubscription screen loads

**All navigation flows should complete without errors.**

---

**End of Navigation Updates**
