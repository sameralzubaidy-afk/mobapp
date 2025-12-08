# MODULE-03 VERIFICATION CHECKLIST (V2)

**Module:** Authentication & User Onboarding  
**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Last Updated:** [Auto-generated timestamp]

---

## PURPOSE

This checklist ensures that MODULE-03 (Authentication & User Onboarding V2) has been fully implemented with:
1. All database migrations and schema changes.
2. All TypeScript types and service functions.
3. All authentication flows (email, social, password reset).
4. All onboarding wizard steps.
5. Full test coverage.
6. Cross-module integration with MODULE-11 (Subscriptions) and MODULE-09 (SP Wallet).

---

## VERIFICATION CHECKLIST

### 1. DATABASE & SCHEMA (AUTH-V2-001)

- [ ] **Migration `030_users_v2.sql` applied** to production database
  - [ ] Column `subscription_id` added (UUID, FK to subscriptions)
  - [ ] Column `sp_wallet_id` added (UUID, FK to sp_wallets)
  - [ ] Column `onboarding_completed_at` added (TIMESTAMPTZ, nullable)
  - [ ] Column `parental_consent_verified` added (BOOLEAN, default FALSE)
  - [ ] Indexes created on `subscription_id` and `sp_wallet_id`

- [ ] **TypeScript types updated** (`src/types/user.ts`)
  - [ ] `User` interface includes all V2 fields
  - [ ] `UserProfile` interface for profile data
  - [ ] `AuthSession` interface with subscription context fields

---

### 2. SIGNUP WITH TRIAL ACTIVATION (AUTH-V2-002)

- [ ] **Service function `signupWithTrial` implemented** (`src/services/auth.ts`)
  - [ ] Validates email, password, display name, age
  - [ ] Requires parental email for users under 13
  - [ ] Creates Supabase auth user
  - [ ] Calls `create_trial_subscription` RPC (MODULE-11)
  - [ ] Calls `initialize_sp_wallet` RPC (MODULE-09)
  - [ ] Creates user record with `subscription_id` and `sp_wallet_id` links
  - [ ] Sends parental consent email if required
  - [ ] Returns enriched `AuthSession` with trial context
  - [ ] Rollback auth user if subscription/wallet creation fails

- [ ] **RPC `create_trial_subscription` deployed**
  - [ ] Creates subscription with `status = 'trial'`
  - [ ] Sets `trial_start_date = NOW()` and `trial_end_date = NOW() + 30 days`
  - [ ] Returns subscription record

- [ ] **RPC `initialize_sp_wallet` deployed**
  - [ ] Creates SP wallet with `status = 'active'`
  - [ ] Initial balance = 0 SP
  - [ ] Returns wallet record

- [ ] **UI: SignupScreen** (`src/screens/SignupScreen.tsx`)
  - [ ] Form fields: email, password, display name, age
  - [ ] Conditional parental email field (shown if age < 13)
  - [ ] "Sign Up & Start Trial" button calls `signupWithTrial`
  - [ ] Navigates to onboarding on success

- [ ] **Tests passing**
  - [ ] Test: Signup creates user + trial + wallet atomically
  - [ ] Test: Under-13 signup requires parental email
  - [ ] Test: Signup rollback on subscription creation failure

---

### 3. LOGIN & SESSION MANAGEMENT (AUTH-V2-003)

- [ ] **Service function `loginWithContext` implemented** (`src/services/auth.ts`)
  - [ ] Authenticates with Supabase auth
  - [ ] Fetches user record
  - [ ] Calls `get_subscription_summary` RPC (MODULE-11)
  - [ ] Calls `get_user_sp_wallet_summary` RPC (MODULE-09)
  - [ ] Returns `AuthSession` with `subscription_status`, `can_spend_sp`, `available_points`

- [ ] **UI: LoginScreen** (`src/screens/LoginScreen.tsx`)
  - [ ] Form fields: email, password
  - [ ] "Login" button calls `loginWithContext`
  - [ ] "Sign Up" button navigates to SignupScreen

- [ ] **Auth Context Hook** (`src/hooks/useAuth.tsx`)
  - [ ] `AuthProvider` manages session state
  - [ ] `refreshSession` function re-fetches subscription + wallet context
  - [ ] Real-time subscription: Listens for subscription table changes
  - [ ] Automatically refreshes session when subscription status updates

- [ ] **Tests passing**
  - [ ] Test: Login returns enriched session with subscription context
  - [ ] Test: Session refresh updates `can_spend_sp` and `available_points`
  - [ ] Test: Real-time subscription change triggers session refresh

---

### 4. SOCIAL AUTHENTICATION (AUTH-V2-004)

- [ ] **Service function `signInWithApple` implemented** (`src/services/auth.ts`)
  - [ ] Triggers Apple OAuth via Supabase
  - [ ] Checks if user exists (query users table)
  - [ ] If existing: Calls `loginWithContext` and returns session
  - [ ] If new: Creates trial subscription + SP wallet, creates user record, returns session

- [ ] **Service function `signInWithGoogle` implemented**
  - [ ] Same logic as `signInWithApple` but with Google provider

- [ ] **UI: Social Auth Buttons** (in LoginScreen)
  - [ ] "Sign in with Apple" button
  - [ ] "Sign in with Google" button
  - [ ] Both buttons call respective service functions and set session

- [ ] **Supabase OAuth configured**
  - [ ] Apple OAuth credentials configured in Supabase dashboard
  - [ ] Google OAuth credentials configured in Supabase dashboard
  - [ ] Redirect URLs configured for mobile app

- [ ] **Tests passing**
  - [ ] Test: New Apple user gets trial + wallet
  - [ ] Test: Existing Apple user logs in without duplicate subscription
  - [ ] Test: Google auth follows same flow

---

### 5. ONBOARDING WIZARD (AUTH-V2-005)

- [ ] **UI: OnboardingScreen** (`src/screens/OnboardingScreen.tsx`)
  - [ ] Multi-step wizard with 4 steps
  - [ ] Step 1: Age verification (parental email if under 13)
  - [ ] Step 2: Profile setup (bio, interests)
  - [ ] Step 3: Notification preferences (email, push, SMS toggles)
  - [ ] Step 4: Trial benefits explainer

- [ ] **Profile creation**
  - [ ] Creates `user_profiles` record on completion
  - [ ] Stores age, bio, interests, notification preferences

- [ ] **Onboarding completion**
  - [ ] Updates `users.onboarding_completed_at` timestamp
  - [ ] Navigates to Home screen

- [ ] **Tests passing**
  - [ ] Test: Onboarding wizard completes all 4 steps
  - [ ] Test: Profile created with correct data
  - [ ] Test: `onboarding_completed_at` timestamp set

---

### 6. PASSWORD RESET & ACCOUNT RECOVERY (AUTH-V2-006)

- [ ] **Service function `requestPasswordReset` implemented** (`src/services/auth.ts`)
  - [ ] Calls `supabase.auth.resetPasswordForEmail`
  - [ ] Sends reset link to user email
  - [ ] Redirect URL configured for mobile app

- [ ] **Service function `updatePassword` implemented**
  - [ ] Calls `supabase.auth.updateUser` with new password

- [ ] **UI: PasswordResetRequestScreen** (`src/screens/PasswordResetRequestScreen.tsx`)
  - [ ] Email input field
  - [ ] "Send Reset Link" button

- [ ] **UI: PasswordResetConfirmationScreen** (optional)
  - [ ] New password input field
  - [ ] "Update Password" button

- [ ] **Tests passing**
  - [ ] Test: Password reset email sent successfully
  - [ ] Test: Password updated successfully

---

### 7. TESTS & MODULE SUMMARY (AUTH-V2-007)

- [ ] **Unit tests implemented** (`src/services/auth.test.ts`)
  - [ ] `signupWithTrial` tests (3+ test cases):
    - [ ] Successful signup creates trial + wallet
    - [ ] Under-13 requires parental email
    - [ ] Rollback on failure
  - [ ] `loginWithContext` tests (2+ test cases):
    - [ ] Login returns enriched session
    - [ ] Session includes subscription context

- [ ] **Integration tests implemented**
  - [ ] E2E: Signup → onboarding → login → session refresh

- [ ] **Module summary document complete** (included in MODULE-03-AUTH-V2.md)
  - [ ] User lifecycle diagram
  - [ ] Cross-module contracts (MODULE-11, MODULE-09)
  - [ ] API surface documented
  - [ ] Key rules summarized

- [ ] **All tests passing in CI/CD**
  - [ ] Unit tests pass
  - [ ] Integration tests pass
  - [ ] Test coverage >= 80% for auth services

---

## CROSS-MODULE INTEGRATION VERIFICATION

### Integration with MODULE-11 (Subscriptions)

- [ ] **`create_trial_subscription` RPC called correctly:**
  - [ ] Creates subscription with 30-day trial
  - [ ] Returns subscription ID for linking to user

- [ ] **`get_subscription_summary` RPC called correctly:**
  - [ ] Returns `status`, `can_spend_sp`, `is_subscriber`
  - [ ] Used in login to enrich session

### Integration with MODULE-09 (SP Gamification)

- [ ] **`initialize_sp_wallet` RPC called correctly:**
  - [ ] Creates wallet with `status = 'active'`
  - [ ] Returns wallet ID for linking to user

- [ ] **`get_user_sp_wallet_summary` RPC called correctly:**
  - [ ] Returns `availablePoints`
  - [ ] Used in login to enrich session

---

## DEPLOYMENT CHECKLIST

- [ ] **Database migrations applied to production**
  - [ ] `030_users_v2.sql` migration run successfully
  - [ ] `031_create_trial_subscription_rpc.sql` migration run successfully
  - [ ] `032_initialize_sp_wallet_rpc.sql` migration run successfully

- [ ] **OAuth providers configured**
  - [ ] Apple OAuth credentials set in Supabase
  - [ ] Google OAuth credentials set in Supabase
  - [ ] Redirect URLs whitelisted

- [ ] **Mobile app deployed**
  - [ ] SignupScreen live
  - [ ] LoginScreen live with social auth buttons
  - [ ] OnboardingScreen live
  - [ ] PasswordResetRequestScreen live

- [ ] **Email templates configured**
  - [ ] Password reset email template
  - [ ] Parental consent email template (if applicable)

---

## ACCEPTANCE SIGN-OFF

- [ ] **Product Owner Approval**
  - [ ] Signup flow with trial activation approved
  - [ ] Onboarding wizard approved

- [ ] **Engineering Lead Approval**
  - [ ] All code reviewed and merged
  - [ ] Test coverage meets standards

- [ ] **QA Sign-Off**
  - [ ] All test cases passed
  - [ ] COPPA compliance verified (parental consent for under 13)
  - [ ] No critical bugs outstanding

---

## NOTES

- **Trial Duration**: 30 days, no credit card required.
- **COPPA Compliance**: Parental consent required for users under 13 per US law.
- **Session Refresh**: Real-time subscription changes trigger automatic session refresh for up-to-date SP balance and subscription status.
- **Social Auth**: Trial activation is identical for email and OAuth signups.

---

## CHANGELOG

| Date       | Author | Change Description                          |
|------------|--------|---------------------------------------------|
| [Date]     | AI     | Initial V2 verification checklist created   |

---

**End of MODULE-03-VERIFICATION-V2.md**
