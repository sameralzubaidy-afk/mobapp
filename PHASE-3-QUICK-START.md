# Phase 3 Quick Start - Profile & Subscription Screens

## The Correct Flow (Confirmed ✅)

```
SignupScreen (18+ age check)
    ↓
PhoneVerificationScreen (Twilio SMS verification)
    ↓
ProfileCompletionScreen ← [YOU ARE HERE - PHASE 3-1]
    ↓
SubscriptionChoiceScreen ← [PHASE 3-2]
    ↓
HomeScreen
```

---

## Phase 3-1: Profile Completion Screen

### File to Create
`p2p-kids-marketplace/src/screens/onboarding/ProfileCompletionScreen.tsx`

### Purpose
After phone verification, users complete their profile (child names, interests, location).

### Form Fields Needed
```typescript
interface ProfileFormData {
  childName: string;              // Required: First child name
  childDOB: string;               // Required: YYYY-MM-DD format
  childInterests: string[];       // Optional: Array of interests/categories
  city: string;                   // Optional: User city
  state: string;                  // Optional: User state
  zipCode: string;                // Optional: User zip code
}
```

### Database Updates
When user clicks "Complete Profile":
```typescript
// In the screen, after validation:
await supabase
  .from('profiles')
  .update({
    name: 'Child Name' OR 'Parent Name' // Based on flow decision
    zip_code: formData.zipCode,
    city: formData.city,
    state: formData.state,
    profile_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  })
  .eq('user_id', userId);
```

### Navigation
```typescript
// After successful profile update:
navigation.navigate('SubscriptionChoice', { userId });
```

---

## Phase 3-2: Subscription Choice Screen

### File to Create
`p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx`

### Purpose
User chooses Free Tier or Kids Club+ (with 30-day trial).

### Two Button Options

**Option 1: Free Tier**
- No subscription
- No SP earning/spending
- No access to premium features
- Navigate to Home

**Option 2: Kids Club+ (30-day trial)**
- Call: `enrollInTrialSubscription(userId)` from auth service
- This function:
  - Checks `is_trial_enabled()` RPC (admin may have disabled)
  - Creates trial subscription (with admin-configured duration)
  - Initializes SP wallet
  - Links both to profile
- Handle errors:
  - If trial disabled: "Trial not available right now"
  - If wallet fails: "Setup error, please retry"
  - If success: "Congratulations! 30-day trial activated!"
- Navigate to Home

### Key Code Snippet
```typescript
import { enrollInTrialSubscription } from '../services/auth';

const handleKidsClubPlus = async () => {
  setLoading(true);
  
  const { subscription, wallet, error } = 
    await enrollInTrialSubscription(userId);
  
  if (error) {
    Alert.alert('Trial Setup Failed', error.message);
    setLoading(false);
    return;
  }
  
  // Success: Show message
  Alert.alert(
    'Congratulations!',
    'Your 30-day free trial is activated. Enjoy Kids Club+ features!',
    [
      {
        text: 'Got it',
        onPress: () => navigation.navigate('Home'),
      },
    ]
  );
};
```

---

## Testing Admin Config Changes

Before Phase 3-2 testing, admins can test trial settings:

### Disable Trial (for testing)
```sql
UPDATE admin_config 
SET config_value = '{"enabled": false, "duration_days": 30}'::JSONB
WHERE config_key = 'trial_subscription';
```
→ Users will see "Trial not available" on SubscriptionChoice screen

### Enable Trial & Set 14 Days
```sql
UPDATE admin_config 
SET config_value = '{"enabled": true, "duration_days": 14}'::JSONB
WHERE config_key = 'trial_subscription';
```
→ Next users get 14-day trial instead of 30

### Reset to Default (30 days)
```sql
UPDATE admin_config 
SET config_value = '{"enabled": true, "duration_days": 30}'::JSONB
WHERE config_key = 'trial_subscription';
```

---

## How to Run Phase 3 Work

### Step 1: Start Backend
```bash
cd supabase
supabase start
```

### Step 2: Start App
```bash
cd p2p-kids-marketplace
yarn start
# or: npm start
```

### Step 3: Test Complete Flow
1. Signup with test email + 18+ DOB
2. Enter phone + verify with Twilio code
3. Complete profile (Phase 3-1)
4. Choose subscription (Phase 3-2)
5. Verify subscription is active in profile

---

## Acceptance Criteria for Phase 3

### Phase 3-1: Profile Screen
- ✅ Form validates all required fields
- ✅ Profile updates in database with profile_completed=true
- ✅ onboarding_completed_at is set to NOW()
- ✅ Navigation to SubscriptionChoice screen
- ✅ Handles errors gracefully

### Phase 3-2: Subscription Screen
- ✅ Two clear button options (Free / Kids Club+)
- ✅ Free: navigates to Home
- ✅ Kids Club+: calls enrollInTrialSubscription
- ✅ Respects admin config (shows error if trial disabled)
- ✅ On success: shows message + navigates to Home
- ✅ Trial subscription is visible in user's profile

### Phase 3-3: End-to-End
- ✅ Complete signup → phone → profile → subscription → home
- ✅ Subscription status persists across app restart
- ✅ SP wallet is initialized and visible in profile
- ✅ Users can't spend SP if subscription is Free tier

---

## Reference Code Templates

### Profile Screen Template
```typescript
// File: p2p-kids-marketplace/src/screens/onboarding/ProfileCompletionScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';

export default function ProfileCompletionScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const userId = route.params?.userId;
  
  const [formData, setFormData] = useState({
    childName: '',
    zipCode: '',
    city: '',
    state: '',
  });
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    // Validate
    if (!formData.childName.trim()) {
      Alert.alert('Required', 'Please enter a child name');
      return;
    }

    setLoading(true);

    try {
      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.childName,
          zip_code: formData.zipCode,
          city: formData.city,
          state: formData.state,
          profile_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Navigate to subscription choice
      navigation.navigate('SubscriptionChoice', { userId });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Complete Your Profile
      </Text>

      <TextInput
        placeholder="Child Name"
        value={formData.childName}
        onChangeText={(text) => setFormData({ ...formData, childName: text })}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15, borderRadius: 8 }}
      />

      <TextInput
        placeholder="City"
        value={formData.city}
        onChangeText={(text) => setFormData({ ...formData, city: text })}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15, borderRadius: 8 }}
      />

      <TextInput
        placeholder="State"
        value={formData.state}
        onChangeText={(text) => setFormData({ ...formData, state: text })}
        style={{ borderWidth: 1, padding: 10, marginBottom: 15, borderRadius: 8 }}
      />

      <TextInput
        placeholder="Zip Code"
        value={formData.zipCode}
        onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
        style={{ borderWidth: 1, padding: 10, marginBottom: 20, borderRadius: 8 }}
      />

      <Button
        title={loading ? 'Completing...' : 'Complete Profile'}
        onPress={handleComplete}
        disabled={loading}
      />
    </View>
  );
}
```

### Subscription Screen Template
```typescript
// File: p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx

import React, { useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { enrollInTrialSubscription } from '../services/auth';

export default function SubscriptionChoiceScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const userId = route.params?.userId;
  
  const [loading, setLoading] = useState(false);

  const handleFreeUser = () => {
    // User selects free tier, go to home
    navigation.navigate('Home');
  };

  const handleKidsClubPlus = async () => {
    setLoading(true);

    const { subscription, wallet, error } = 
      await enrollInTrialSubscription(userId);

    if (error) {
      Alert.alert('Trial Setup Failed', error.message || 'Please try again later');
      setLoading(false);
      return;
    }

    Alert.alert(
      'Success!',
      'Your 30-day free trial is activated. Enjoy Kids Club+ features!',
      [
        {
          text: 'Go to Home',
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' }}>
        Choose Your Plan
      </Text>

      {/* Free Tier Option */}
      <View style={{ marginBottom: 20, padding: 15, borderWidth: 2, borderColor: '#ddd', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Free Tier
        </Text>
        <Text style={{ marginBottom: 15 }}>
          • Browse and search listings{'\n'}
          • Basic messaging{'\n'}
          • Community features
        </Text>
        <Button title="Select Free" onPress={handleFreeUser} />
      </View>

      {/* Kids Club+ Option */}
      <View style={{ padding: 15, borderWidth: 2, borderColor: '#4CAF50', borderRadius: 8, backgroundColor: '#f1f8f4' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: '#4CAF50' }}>
          Kids Club+ Premium ✨
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>
          30-day free trial, then $7.99/month
        </Text>
        <Text style={{ marginBottom: 15 }}>
          • Everything in Free Tier{'\n'}
          • Earn & spend Swap Points{'\n'}
          • Priority listing visibility{'\n'}
          • Advanced filters
        </Text>
        <Button
          title={loading ? 'Activating...' : 'Start 30-Day Trial'}
          onPress={handleKidsClubPlus}
          disabled={loading}
          color="#4CAF50"
        />
      </View>
    </View>
  );
}
```

---

## Do Not Forget!

✅ Add screens to navigation stack (App.tsx or RootNavigator)
✅ Import enrollInTrialSubscription in SubscriptionChoice screen
✅ Handle loading states on both screens
✅ Test with admin config disabled (to see error message)
✅ Verify subscription shows in user profile after enrollment
✅ Test with both Free and Kids Club+ paths

---

**Ready to build Phase 3? Good luck!** 🚀
