# MODULE-03 AUTH-V2: Quick Start & Testing Guide

**Date:** December 16, 2025  
**Status:** ✅ COMPLETE - Ready for Testing

---

## 1. Files Modified/Created

### New Files (3)
1. **SubscriptionChoiceScreen.tsx** - User chooses Free or Kids Club+ Trial
2. **auth.integration.test.ts** - E2E integration tests
3. **MODULE-03-AUTH-V2-COMPLETE-VERIFICATION.md** - Full verification document

### Modified Files (5)
1. **auth.test.ts** - Updated unit tests for new flow
2. **auth.ts** - Added `enrollInTrialSubscription()` function
3. **user.ts** - Simplified SignupInput type
4. **admin_config migration** - New admin configuration table
5. **AppNavigator.tsx** - Added SubscriptionChoice route

### Database Migrations (3)
1. `20251215100000_auth_v2_schema.sql` - Core schema
2. `20251215100001_auth_v2_rpc_functions.sql` - RPC functions
3. `20251216100002_admin_config_trial_settings.sql` - Admin config (NEW)

---

## 2. Running Tests

### Unit Tests
```bash
# From p2p-kids-marketplace directory
yarn test src/services/__tests__/auth.test.ts

# Expected output:
# ✓ AUTH-V2-002: enrollInTrialSubscription (7 tests)
#   ✓ should check if trial is enabled from admin config
#   ✓ should return error when trial is disabled by admin
#   ✓ should use admin-configured trial duration
#   ✓ should link subscription and wallet to profile
#   ✓ should handle subscription creation failure
#   ✓ should handle wallet initialization failure
# ✓ AUTH-V2-003: loginWithContext (2 tests)
#   ✓ should return enriched session with subscription and SP context
#   ✓ should handle missing profile gracefully
```

### Integration Tests
```bash
# From p2p-kids-marketplace directory
yarn test src/services/__tests__/auth.integration.test.ts

# Expected output:
# ✓ AUTH-V2: Complete Signup → Trial Flow (6 tests)
#   ✓ should create user and profile without trial activation
#   ✓ should enroll in trial after profile completion when admin config allows
#   ✓ should respect admin config trial disable flag
#   ✓ should use admin-configured trial duration
#   ✓ should return enriched session with trial status after enrollment
#   ✓ should prevent duplicate trial enrollments
```

### Run All Tests
```bash
yarn test
```

---

## 3. Manual Testing Checklist

### Step 1: Verify Database Setup
```bash
# Apply migrations
cd supabase
supabase db push

# Verify tables created
supabase db remote exec "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"

# Should include: subscriptions, sp_wallets, admin_config
```

### Step 2: Verify Admin Config
```bash
# Check admin config values
supabase db remote exec "SELECT config_key, config_value, enabled FROM admin_config;"

# Expected:
# trial_subscription | {"enabled": true, "duration_days": 30, ...} | true
# swap_points_config | {"enabled": true, ...} | true
# feature_flags | {...} | true
```

### Step 3: Test Signup Flow (Fresh Install)
```
1. Launch app: yarn start
2. Click "Sign Up"
3. Enter:
   - Name: "Test User"
   - Email: "test+<timestamp>@example.com"
   - Phone: "555-123-4567"
   - DOB: "2000-01-01" (24+ years old)
   - Password: "SecurePass123!"
4. Verify: Profile created (no subscription_id yet)
5. Click "Send Code" → Verify code input screen
6. Enter code: "123456" (default test code)
7. Verify: Navigate to ProfileCompletion
8. Enter: Display name, bio, optionally select avatar
9. Click "Save Profile"
10. ✅ Verify: Navigate to SubscriptionChoice screen
```

### Step 4: Test Subscription Choice - Kids Club+
```
1. On SubscriptionChoice screen, see two options:
   - "Free Tier" card
   - "Kids Club+" card with "RECOMMENDED" badge
2. Click "Start Free Trial" on Kids Club+
3. Wait for loading...
4. ✅ Verify success alert: "Welcome to Kids Club! Your 30-day free trial..."
5. Click "Get Started"
6. ✅ Verify: Navigate to Home screen
7. Check user profile: subscription_id should now be set
```

### Step 5: Test Subscription Choice - Free Tier
```
1. Repeat Steps 1-9 from above
2. On SubscriptionChoice screen, click "Choose Free"
3. Wait for loading...
4. ✅ Verify: Navigate to Home screen
5. Check user profile: subscription_id should remain NULL
6. In app, SP features should be hidden/disabled
```

### Step 6: Verify Trial Admin Control
```bash
# Test 1: Disable trial enrollment
# In Supabase console:
UPDATE admin_config SET config_value = '{"enabled": false, "duration_days": 30, ...}'
WHERE config_key = 'trial_subscription';

# Signup again → SubscriptionChoice should show:
# - "Free Tier" option (available)
# - "Trial disabled" warning card instead of Kids Club+ card

# Test 2: Custom trial duration (14 days)
UPDATE admin_config SET config_value = '{"enabled": true, "duration_days": 14, ...}'
WHERE config_key = 'trial_subscription';

# Signup → Choose Kids Club+ → Trial should end 14 days from today

# Restore default (30 days):
UPDATE admin_config SET config_value = '{"enabled": true, "duration_days": 30, ...}'
WHERE config_key = 'trial_subscription';
```

### Step 7: Verify Login with Enriched Session
```
1. After successful trial enrollment, logout
2. Click "Log In"
3. Enter email and password
4. ✅ Verify: Session loads with:
   - subscription_status: "trial"
   - can_spend_sp: true
   - available_points: 0 (no trades yet)
5. SP features should be visible and functional
```

---

## 4. Error Scenarios to Test

### Scenario 1: Admin Disables Trial Mid-Signup
```
1. User goes through signup → phone verification → profile completion
2. Admin disables trial: UPDATE admin_config SET enabled = false
3. User clicks "Start Free Trial"
4. ✅ Verify: Alert "Trial Unavailable - choose Free Tier"
```

### Scenario 2: Duplicate Trial Enrollment
```
1. User enrolls in trial successfully
2. Try to call enrollInTrialSubscription again (programmatically)
3. ✅ Verify: Error "SUBSCRIPTION_CREATION_FAILED" with subscription already exists message
```

### Scenario 3: Network Failure During Enrollment
```
1. Disconnect network
2. Click "Start Free Trial"
3. ✅ Verify: Alert shows "Failed to activate trial"
4. Reconnect and retry
5. ✅ Verify: Trial enrolled successfully on retry
```

### Scenario 4: Age Validation
```
1. Try to signup with DOB that makes user under 18
2. ✅ Verify: Alert "Sorry, you must be 18 years old to register."
3. Cannot proceed
```

---

## 5. Key File Locations for Reference

### Auth Service
- **Logic:** `p2p-kids-marketplace/src/services/auth.ts`
- **Key function:** `enrollInTrialSubscription(userId: string)`
- **Key function:** `loginWithContext(email, password)`

### UI Screens
- **Signup:** `p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx`
- **Phone Verify:** `p2p-kids-marketplace/src/screens/auth/PhoneVerificationScreen.tsx`
- **Profile Completion:** `p2p-kids-marketplace/src/screens/onboarding/ProfileCompletionScreen.tsx`
- **Subscription Choice:** `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx` (NEW)

### Types
- **User types:** `p2p-kids-marketplace/src/types/user.ts`
- **SignupInput:** Simplified - email, password, name, phone, dob, referralCode

### Database
- **Schema:** `supabase/migrations/20251215100000_auth_v2_schema.sql`
- **RPC Functions:** `supabase/migrations/20251215100001_auth_v2_rpc_functions.sql`
- **Admin Config:** `supabase/migrations/20251216100002_admin_config_trial_settings.sql` (NEW)

### Navigation
- **Routes:** `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`
- **Flow:** Landing → Signup → PhoneVerification → ProfileCompletion → SubscriptionChoice → Home

---

## 6. Deployment Checklist

Before merging to main:
- [ ] All tests passing: `yarn test` (13 total)
- [ ] No TypeScript errors: `yarn typecheck`
- [ ] Supabase migrations applied to staging
- [ ] Admin config verified: trial enabled, 30 days default
- [ ] E2E flow tested manually (signup → trial enrollment)
- [ ] Free tier tested manually (no trial activation)
- [ ] Admin disable scenario tested
- [ ] Error scenarios tested
- [ ] Rollback plan: Keep V1 routes if needed
- [ ] Commit message includes: "feat(auth): implement MODULE-03 AUTH-V2 with trial enrollment and admin control"

---

## 7. Troubleshooting

### Issue: "Trial enrollment failed" but no specific error
**Solution:** 
1. Check Supabase Edge Function logs
2. Verify admin_config table has trial_subscription entry
3. Check RLS policies on admin_config (admin-only)
4. Verify Supabase Auth user has correct role

### Issue: "Subscription already exists" on signup
**Solution:**
1. This is expected if user signs up twice with same email
2. Supabase Auth should prevent duplicate emails
3. If persists, clear auth.users table and try again

### Issue: Trial duration not matching admin config
**Solution:**
1. Verify get_trial_duration_days() RPC returns correct value
2. Check admin_config entry has duration_days field
3. Run: `SELECT (config_value ->> 'duration_days')::INTEGER FROM admin_config WHERE config_key = 'trial_subscription';`

### Issue: Can't see SubscriptionChoice screen
**Solution:**
1. Verify ProfileCompletionScreen navigates to 'SubscriptionChoice' (not 'LocationPicker')
2. Verify AppNavigator.tsx imports and registers SubscriptionChoiceScreen
3. Check React Navigation deep linking config

---

## 8. Performance Notes

### Expected Timings
- Signup (Supabase Auth): ~500ms
- Phone verification code send (Twilio): ~1s
- Phone verification code verify: ~500ms
- Profile completion (upload + update): ~1-2s
- Trial enrollment (RPC × 3 + profile update): ~800ms
- Login with enriched session: ~1s

### Optimization Opportunities
- Add client-side form validation to reduce server calls
- Cache admin_config locally (re-check daily or on app foreground)
- Pre-fetch subscription summary while profile saving

---

## 9. Next Steps After Verification

1. **MODULE-11 Integration**: Ensure subscription lifecycle hooks call session refresh
2. **MODULE-09 Integration**: Verify SP spending gated to Kids Club+ tier
3. **MODULE-14 Notifications**: Add welcome email after signup, trial activation email
4. **Admin Portal**: Add admin_config editor to MODULE-12 admin interface
5. **Analytics**: Wire signup, trial enrollment, subscription choice events

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Status:** READY FOR TESTING
