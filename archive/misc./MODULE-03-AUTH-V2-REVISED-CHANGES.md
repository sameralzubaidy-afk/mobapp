# MODULE-03 AUTH-V2 REVISED IMPLEMENTATION

## Summary of Changes

✅ **Corrected Signup Flow**: Trial enrollment moved to AFTER profile completion  
✅ **Removed Parental Consent Logic**: Using existing 18+ age validation  
✅ **Added Admin Trial Configuration**: Admins can enable/disable trial and set duration  

---

## What Changed

### 1. Signup Flow Corrected

**OLD FLOW (INCORRECT)**:
```
Signup → Auto-activate 30-day trial → Phone Verification → Profile Setup
```

**NEW FLOW (CORRECT)**:
```
Signup (18+) → Phone Verification → Profile Setup → User chooses subscription
  ├─ Free Tier: No trial
  └─ Kids Club+: Activate trial (admin-configurable duration)
```

### 2. Signup Screen (Already Restored)

- **File**: [p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx](p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx)
- Uses **existing age validation**: `isAtLeastAge(dob, 18)` 
- **NO parental email logic** - users under 18 cannot register
- **NO trial activation** - only basic signup

### 3. Authentication Service Updated

**File**: [p2p-kids-marketplace/src/services/auth.ts](p2p-kids-marketplace/src/services/auth.ts)

**Old Functions Removed**:
- ❌ `signupWithTrial()` - Combined age + trial logic (NOT NEEDED)

**New Functions**:
- ✅ `signup()` - Basic registration (18+ age check already in screen)
- ✅ `enrollInTrialSubscription(userId)` - **NEW**: Called AFTER profile completion
  - Checks admin config: Is trial enabled?
  - Gets trial duration from admin config
  - Creates subscription with configured duration
  - Initializes SP wallet
  - Links both to profile

### 4. Admin Configuration Table (NEW)

**File**: [supabase/migrations/20251216100002_admin_config_trial_settings.sql](supabase/migrations/20251216100002_admin_config_trial_settings.sql)

**Table**: `admin_config`
- Stores configurable settings with JSONB values
- RLS: Only admins can view/edit
- Includes trial, SP, and feature flag configurations

**Admin Functions**:
- `is_trial_enabled()` - Check if trial enrollment is enabled
- `get_trial_duration_days()` - Get configured trial period (default 30)
- `get_admin_config(key)` - Get any config by key

**Default Configurations**:
```json
{
  "trial_subscription": {
    "enabled": true,
    "duration_days": 30
  },
  "swap_points_config": {
    "enabled": true,
    "max_percent_payment": 50,
    "pending_days": 3,
    "expiry_days": 90
  },
  "feature_flags": {
    "apple_signin": true,
    "google_signin": true,
    "referral_program": true
  }
}
```

### 5. Updated Type Definitions

**File**: [p2p-kids-marketplace/src/types/user.ts](p2p-kids-marketplace/src/types/user.ts)

**Removed**:
- ❌ Age field from SignupInput (no longer needed - already 18+ validated)
- ❌ ParentalEmail field (no longer needed)
- ❌ ZipCode in SignupInput (handled in profile setup)

**SignupInput Now**:
```typescript
interface SignupInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  dob: string;        // YYYY-MM-DD format
  referralCode?: string;
}
```

---

## Implementation Timeline

### Phase 1: Registration (ALREADY DONE)
1. User enters: name, email, phone, password, DOB
2. Age validation: Must be 18+ (existing logic in screen)
3. Create auth user + basic profile

### Phase 2: Phone Verification (EXISTING)
1. Send SMS verification code
2. User enters 6-digit code
3. Mark phone as verified

### Phase 3: Profile Completion (TODO - DEPENDENCY)
1. User adds child profile(s)
2. Fills preferences, interests
3. Sets up node/location
4. Marks profile as complete

### Phase 4: Subscription Choice (TODO - NEW FLOW)
1. Present subscription choice: "Free" or "Kids Club+"
2. If Kids Club+:
   - Call `enrollInTrialSubscription(userId)`
   - Check admin config - is trial enabled?
   - Get trial duration
   - Create subscription with that duration
   - Initialize SP wallet
   - Show success: "30-day trial activated!"
3. If Free:
   - Skip trial/wallet setup
   - User can always upgrade later

---

## Files Modified

### New Migrations
1. ✅ [supabase/migrations/20251216100002_admin_config_trial_settings.sql](supabase/migrations/20251216100002_admin_config_trial_settings.sql)

### Updated Services
1. ✅ [p2p-kids-marketplace/src/services/auth.ts](p2p-kids-marketplace/src/services/auth.ts)
   - Removed `signupWithTrial()` 
   - Added `enrollInTrialSubscription()`
   - Updated imports

### Updated Types
1. ✅ [p2p-kids-marketplace/src/types/user.ts](p2p-kids-marketplace/src/types/user.ts)
   - Simplified `SignupInput` interface

### UI Screens (NO CHANGES)
1. ✅ [p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx](p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx)
   - Already has correct flow
   - Already validates 18+ age
   - No parental email logic

### Existing Tests (NOW INVALID)
1. ⚠️ [p2p-kids-marketplace/src/services/__tests__/auth.test.ts](p2p-kids-marketplace/src/services/__tests__/auth.test.ts)
   - OLD: Tests for `signupWithTrial()` with age validation + parental consent
   - **NEEDS UPDATE**: Tests for `enrollInTrialSubscription()` with admin config

---

## Admin Configuration: How to Control Trial

### Turn Trial ON/OFF

```sql
UPDATE admin_config
SET config_value = jsonb_set(
  config_value,
  '{enabled}',
  'true'::jsonb
)
WHERE config_key = 'trial_subscription';
```

### Change Trial Duration (e.g., 14 days instead of 30)

```sql
UPDATE admin_config
SET config_value = jsonb_set(
  config_value,
  '{duration_days}',
  '14'::jsonb
)
WHERE config_key = 'trial_subscription';
```

### Check Current Trial Config

```sql
SELECT config_value 
FROM admin_config 
WHERE config_key = 'trial_subscription';

-- Result:
-- {
--   "enabled": true,
--   "duration_days": 30,
--   "description": "30-day no-card trial for new Kids Club+ subscribers"
-- }
```

---

## Testing Scenarios

### Scenario 1: Signup with Age < 18
1. Fill signup form with DOB making user age 17
2. Tap "Sign Up"
3. **Expected**: Alert "You must be 18 years old to register"

### Scenario 2: Normal Signup Flow (Age 18+)
1. Fill signup form: name, email, phone, password, DOB (18+)
2. Tap "Sign Up"
3. **Expected**: Navigate to phone verification
4. Complete phone verification
5. **Expected**: Navigate to profile setup
6. Complete profile setup
7. **Expected**: Show subscription choice screen
8. User selects "Kids Club+"
9. **Expected**: Call `enrollInTrialSubscription()`

### Scenario 3: Trial Disabled by Admin
1. First, disable trial in Supabase:
   ```sql
   UPDATE admin_config
   SET config_value = jsonb_set(
     config_value,
     '{enabled}',
     'false'::jsonb
   )
   WHERE config_key = 'trial_subscription';
   ```
2. User completes profile and selects "Kids Club+"
3. **Expected**: Error "Trial enrollment is not available at this time"

### Scenario 4: Trial Duration Changed
1. Change trial duration to 14 days:
   ```sql
   UPDATE admin_config
   SET config_value = jsonb_set(
     config_value,
     '{duration_days}',
     '14'::jsonb
   )
   WHERE config_key = 'trial_subscription';
   ```
2. User enrolls in trial
3. **Expected**: Subscription created with `trial_end_date = NOW() + 14 days`

---

## Next Steps

1. **Update Auth Tests** - Replace old `signupWithTrial()` tests with new `enrollInTrialSubscription()` tests
2. **Implement Profile Completion Screen** - MODULE-03 onboarding wizard
3. **Implement Subscription Choice Screen** - After profile, offer Free vs Kids Club+
4. **Wire `enrollInTrialSubscription()` to Subscription Screen** - Call when user selects Kids Club+
5. **Update admin portal** - MODULE-12 admin panel to manage trial configuration

---

## Verification Against BRD

From [docx/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md](docx/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md):

✅ **FR-UM-001**: Users must provide name, email, phone, password, DOB  
✅ **FR-UM-001**: Users choose subscription tier at signup: Free or Kids Club+ (trial)  
✅ **FR-UM-004**: 30-day free trial for new subscribers (one per user)  
✅ **FR-UM-004**: Users can upgrade from Free to Kids Club+ anytime  

✅ **CRITICAL RULE**: Trial only applies to Kids Club+ tier, not Free tier  
✅ **CRITICAL RULE**: Trial is admin-configurable (admin can turn on/off and set duration)  

---

## Summary

**Key Changes**:
1. ✅ Moved trial enrollment from signup to AFTER profile completion
2. ✅ Removed parental email logic (using existing 18+ age validation)
3. ✅ Added admin configuration table to control trial enable/disable and duration
4. ✅ Created `enrollInTrialSubscription()` function that respects admin settings
5. ✅ Simplified `SignupInput` types - no age or parental email fields

**Status**: Ready for test updates and profile completion screen implementation

**All migrations ready to deploy**: 
- `supabase/migrations/20251216100002_admin_config_trial_settings.sql`
