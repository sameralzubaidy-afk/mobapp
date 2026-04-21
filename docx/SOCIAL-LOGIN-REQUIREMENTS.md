# Social Login (Google, Facebook, Apple) — Complete Requirements Document

**Project:** Kids P2P Marketplace  
**Feature:** Social Authentication & Account Linking  
**Version:** 1.0  
**Date:** April 20, 2026  
**Owner:** @sameralzubaidy-afk  
**Target Release:** Week 7-8 (MVP Track 3)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [UX Decisions & Competitor Benchmarks](#ux-decisions--competitor-benchmarks)
3. [User Stories](#user-stories)
4. [Database Schema Changes](#database-schema-changes)
5. [Backend Functions (RPCs & Services)](#backend-functions-rpcs--services)
6. [Frontend Architecture](#frontend-architecture)
7. [Complete Function Reference](#complete-function-reference)
8. [Component Specifications](#component-specifications)
9. [Performance Requirements](#performance-requirements)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Testing Requirements](#testing-requirements)
12. [Acceptance Criteria](#acceptance-criteria)
13. [Out of Scope (Post-MVP)](#out-of-scope-post-mvp)
14. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### **Problem Statement**

Current authentication has critical UX friction & conversion gaps:
- ❌ Email/password only → high abandonment during manual signup
- ❌ No social login → users expect one-tap Google/Apple/Facebook auth
- ❌ New users must fill profile manually → extra steps reduce conversion
- ❌ No account linking → users with multiple emails create duplicate accounts
- ❌ Password recovery friction → locked-out users abandon app

### **Solution Overview**

**Scope:**
- ✅ Google Sign In (OAuth 2.0)
- ✅ Facebook Login (OAuth 2.0)
- ✅ Apple Sign In (required for App Store)
- ✅ Auto-fill profile (name + photo) from social provider
- ✅ Smart account linking (prompt if email exists)
- ✅ Optional password fallback (set password after social login)
- ✅ Existing users can link social accounts in Settings
- ✅ Phone verification deferred to first transaction (conversion optimization)

**Phase 1 (MVP — Weeks 7-8):**
- ✅ Social login buttons on signup/login screens
- ✅ OAuth flows for Google, Facebook, Apple
- ✅ Auto-populate name + avatar from provider
- ✅ Skip email verification (trust provider verification)
- ✅ Prompt to link if existing account found
- ✅ Phone optional at signup, required before first listing/purchase
- ✅ Settings page: Link/unlink social accounts
- ✅ Settings page: Set password for social-only users
- ✅ Graceful error handling (fallback to email signup)
- ✅ Multiple login methods per account (email + Google + Apple)

**Phase 2 (Post-MVP):**
- SMS/Phone number login (OTP)
- Biometric login (Touch ID / Face ID)
- Session management across devices
- 2FA for high-value accounts
- Social profile sync (auto-update avatar when changed on provider)

### **Success Metrics**

| Metric | Current | Target (MVP) |
|--------|---------|--------------|
| Signup completion rate | ~45% | > 70% |
| Time to first signup | ~2-3 min | < 30 sec |
| Password recovery requests | 15% of users | < 5% |
| Duplicate account creation | Unknown | < 2% |
| Social login adoption | 0% | > 60% of new users |

---

## UX Decisions & Competitor Benchmarks

### **1. Providers: Google + Facebook + Apple**
**Decision:** Support all 3 major providers

**Rationale:**
- **Google:** Most popular (70% of Android users)
- **Facebook:** Strong with parents demographic (40% adoption)
- **Apple:** App Store requirement for apps with third-party login (mandatory)

**Benchmark:**
| App | Providers |
|-----|-----------|
| Facebook Marketplace | Facebook only |
| OfferUp | Google + Facebook + Apple |
| Mercari | Google + Facebook + Apple |
| Poshmark | Google + Facebook + Apple |
| **Kids Marketplace** | **Google + Facebook + Apple** |

---

### **2. Account Linking: Smart Prompt**
**Decision:** If user tries social login with email that already exists, prompt to link

**Flow:**
```
User taps "Sign in with Google"
→ Google returns email: john@gmail.com
→ System finds existing account with john@gmail.com
→ Show prompt: "You already have an account with this email. Link your Google account?"
   [Link Account] [Cancel]
→ If Link: user logs in, Google linked to account
→ If Cancel: return to login screen
```

**Security:** Require password verification before linking (prevents account takeover)

---

### **3. Profile Auto-Fill**
**Decision:** Auto-populate name + profile photo from social provider

**Data Mapping:**
| Provider | Name | Photo | Email |
|----------|------|-------|-------|
| Google | `given_name + family_name` | `picture` URL | `email` |
| Facebook | `name` | `picture.data.url` | `email` |
| Apple | `firstName + lastName` | Not provided | `email` (or private relay) |

**Editable:** User can edit name/photo after signup in profile settings

---

### **4. Email Verification: Skipped**
**Decision:** Skip email verification for social login users

**Rationale:**
- Google, Facebook, Apple already verify emails
- Reduces friction (industry standard)
- Faster time-to-value for user

**Exception:** If user sets password later, and changes email, require verification for new email

---

### **5. Phone Verification: Deferred**
**Decision:** Phone optional at signup, required before first listing or purchase

**Timing:**
```
Social Signup: Name + photo auto-filled, phone skipped
→ User browses app freely
→ User taps "Create Listing" or "Buy Item"
→ Modal: "Before you can trade, please verify your phone number for safety"
→ SMS verification flow
→ After verification: proceed with listing/purchase
```

**Rationale:** Balances conversion (70%+ signup rate) with safety (all traders verified)

---

### **6. Existing Users: Link Social Accounts**
**Decision:** Yes, from Settings → Account → Linked Accounts

**UI:**
```
Settings → Account → Linked Accounts

Email: john@gmail.com (Primary)
Password: ••••••••   [Change]

Linked Social Accounts:
✅ Google: john@gmail.com   [Unlink]
❌ Facebook: Not linked     [Link]
❌ Apple: Not linked        [Link]
```

**Rules:**
- Can link multiple providers to one account
- Can unlink social account (requires password or another linked account)
- Cannot unlink all methods (must keep ≥1 login method)

---

### **7. Social Login on Login Screen**
**Decision:** Show social buttons for users who've linked social accounts

**Login Screen:**
```
┌─────────────────────────────────────┐
│  Welcome Back                       │
│                                     │
│  [  Sign in with Google  ]          │
│  [  Sign in with Facebook  ]        │
│  [  Sign in with Apple  ]           │
│                                     │
│  ─────────── OR ───────────         │
│                                     │
│  Email: ________________            │
│  Password: ____________             │
│  [Forgot Password?]                 │
│                                     │
│  [Sign In]                          │
│                                     │
│  Don't have an account? [Sign Up]   │
└─────────────────────────────────────┘
```

**Smart Auto-Detect:**
- User taps "Sign in with Google"
- Google returns email: john@gmail.com
- If account exists but Google not linked: prompt "Link this account?"
- If account exists and Google already linked: log in directly

---

### **8. Password Fallback**
**Decision:** Social-only users can optionally set password in Settings

**Use Case:** User loses access to Google account, needs backup login method

**UI:**
```
Settings → Account → Password

Current Status: No password set (using Google login only)

[Set Password]  ← Tapping opens password creation flow
```

---

### **9. Error Handling**
**Decision:** Graceful fallback to email signup

**Scenarios:**
| Error | User Experience |
|-------|-----------------|
| Provider down (503) | "Google is temporarily unavailable. Sign up with email instead?" |
| User cancels OAuth | Return to login screen (no error shown) |
| Network error | "Can't connect. Check your internet and try again." |
| Provider rejects (denied permissions) | "Google login requires email permission. Sign up with email instead?" |

---

### **10. Testing Strategy**
**Decision:** Mock for unit tests, real OAuth for E2E

**Approach:**
- **Unit tests:** Mock OAuth responses, test account linking logic
- **Integration tests:** Use Google/Facebook/Apple test accounts (staging)
- **Manual E2E:** Real personal accounts (production)

---

## User Stories

### **US-301: Fast Social Signup**
**As a** new user  
**I want** to sign up with my Google account in one tap  
**So that** I don't have to fill out forms or remember another password

**Acceptance Criteria:**
- Tap "Sign in with Google" → OAuth flow starts
- Google returns name + photo → auto-filled in profile
- Account created in < 30 seconds
- No email verification required
- Phone optional (deferred to first transaction)

---

### **US-302: Account Linking Prompt**
**As a** user with an existing email account  
**I want** to link my Google account to it  
**So that** I can login faster next time

**Acceptance Criteria:**
- Try to sign in with Google using same email
- Prompt: "Link this account?"
- Verify password before linking
- After linking: can use Google OR email/password to login

---

### **US-303: Social Login on Existing Account**
**As a** returning user who linked Google  
**I want** to login with Google instead of typing password  
**So that** I save time

**Acceptance Criteria:**
- See "Sign in with Google" button on login screen
- Tap button → OAuth flow → logged in
- No password typing required
- Works even if account was originally email/password

---

### **US-304: Set Password Fallback**
**As a** user who signed up with Google only  
**I want** to set a password as backup  
**So that** I can still login if I lose access to Google

**Acceptance Criteria:**
- Go to Settings → Account → Password
- See "No password set" status
- Tap "Set Password" → create password flow
- After setting: can login with email/password OR Google

---

### **US-305: Link Social Account Later**
**As a** user who signed up with email/password  
**I want** to link my Facebook account  
**So that** I have a faster login option

**Acceptance Criteria:**
- Go to Settings → Account → Linked Accounts
- See "Facebook: Not linked"
- Tap "Link" → Facebook OAuth flow
- After linking: shows "✅ Facebook: name@email.com [Unlink]"
- Can now login with Facebook on login screen

---

### **US-306: Unlink Social Account**
**As a** user with multiple login methods  
**I want** to unlink my Facebook account  
**So that** I remove unused login methods

**Acceptance Criteria:**
- Go to Settings → Linked Accounts
- Tap "Unlink" next to Facebook
- Confirmation: "You can still login with Google and password"
- After unlinking: Facebook button hidden from login screen
- Cannot unlink last remaining method (error shown)

---

### **US-307: Phone Verification at First Transaction**
**As a** new user who signed up socially  
**I want** to verify my phone only when needed  
**So that** I can explore the app freely first

**Acceptance Criteria:**
- Sign up with Google → no phone prompt
- Browse items, view profiles freely
- Tap "Create Listing" → modal: "Verify phone to list items"
- Complete SMS verification
- After verification: proceed to create listing
- Phone not asked again

---

### **US-308: OAuth Error Recovery**
**As a** user trying social login  
**I want** helpful error messages if OAuth fails  
**So that** I know what to do next

**Acceptance Criteria:**
- Google is down → "Google temporarily unavailable. Try email signup?"
- Cancel OAuth → return to login screen (no error)
- Network error → "Check internet connection. Retry?"
- Each error shows clear next steps

---

### **US-309: Auto-Filled Profile**
**As a** new user signing up with Apple  
**I want** my name and photo auto-filled  
**So that** I don't have to type them manually

**Acceptance Criteria:**
- Complete Apple Sign In
- Name field pre-filled from Apple ID
- Profile photo: shows placeholder (Apple doesn't provide photo)
- User can edit name before completing signup
- User can upload custom photo or keep placeholder

---

### **US-310: Multiple Social Accounts Linked**
**As a** user with Google and Facebook linked  
**I want** to login with either provider  
**So that** I have flexibility

**Acceptance Criteria:**
- Settings shows: Google ✅ Linked, Facebook ✅ Linked
- Login screen shows both buttons
- Tapping either button logs in to same account
- Profile data synced regardless of login method

---

## Database Schema Changes

### **Migration 1: Add Social Auth Columns to auth.users**

**Note:** Supabase `auth.users` table is managed by Supabase Auth. We extend it via metadata.

**Metadata Structure (JSON):**
```json
{
  "provider": "google",
  "provider_id": "google_user_id_12345",
  "linked_providers": ["google", "apple"],
  "auto_filled_from_provider": true,
  "phone_verified_at": null,
  "phone_required": true
}
```

**Stored in:** `auth.users.raw_user_meta_data`

---

### **Migration 2: Create user_identities Table**

**File:** `supabase/migrations/20260420000004_create_user_identities.sql`

```sql
-- ================================================================
-- Migration: Create user_identities Table
-- Date: 2026-04-20
-- Description: Track linked social accounts per user
-- Note: Supabase Auth already has identities table, but we extend
--       with custom fields for our use case
-- ================================================================

-- Supabase Auth provides: auth.identities (read-only)
-- Columns: id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at

-- Create view for easier access
CREATE OR REPLACE VIEW public.user_linked_providers AS
SELECT 
  user_id,
  provider,
  identity_data->>'email' AS provider_email,
  identity_data->>'name' AS provider_name,
  identity_data->>'picture' AS provider_avatar,
  last_sign_in_at,
  created_at
FROM auth.identities
ORDER BY user_id, provider;

-- RLS (view inherits from auth.identities)
GRANT SELECT ON public.user_linked_providers TO authenticated;

COMMENT ON VIEW public.user_linked_providers IS 'User-friendly view of linked social accounts';
```

---

### **Migration 3: Add Phone Verification Tracking**

```sql
-- ================================================================
-- Migration: Add Phone Verification Tracking
-- ================================================================

-- Add columns to public.user_profiles (assuming this exists)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verification_method TEXT
    CHECK (phone_verification_method IN ('sms', 'social_auto', 'manual'));

-- Index for phone verification checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_verified
  ON user_profiles(phone_verified_at)
  WHERE phone_verified_at IS NULL;

COMMENT ON COLUMN user_profiles.phone_verified_at IS 'Timestamp of phone verification (required before first transaction)';
COMMENT ON COLUMN user_profiles.phone_verification_method IS 'How phone was verified';
```

---

### **Migration 4: Create RPC for Account Linking**

```sql
-- ================================================================
-- RPC: Link Social Account to Existing Account
-- ================================================================

CREATE OR REPLACE FUNCTION link_social_account(
  provider_name TEXT,
  provider_user_id TEXT,
  provider_email TEXT,
  provider_data JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify current user owns the email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = provider_email
  ) THEN
    RAISE EXCEPTION 'Email mismatch: cannot link account';
  END IF;

  -- Supabase Auth handles identity linking automatically
  -- This RPC just validates business logic
  
  -- Log audit trail
  INSERT INTO public.audit_log (user_id, action, details)
  VALUES (
    auth.uid(),
    'link_social_account',
    jsonb_build_object(
      'provider', provider_name,
      'provider_email', provider_email
    )
  );
END;
$$;

COMMENT ON FUNCTION link_social_account IS 'Validates and logs social account linking';
```

---

## Backend Functions (RPCs & Services)

### **OAuth Flow Management**

#### `initiateSocialLogin(provider: 'google' | 'facebook' | 'apple'): Promise<OAuthSession>`
- Initiates OAuth flow for selected provider
- Returns OAuth URL + state token
- Uses Supabase Auth `signInWithOAuth()`
- Stores state in secure session storage

#### `handleOAuthCallback(code: string, state: string): Promise<AuthResult>`
- Handles OAuth callback from provider
- Exchanges code for access token
- Fetches user profile from provider
- Creates or updates user account
- Returns user session + profile

#### `extractProviderProfile(provider: string, data: any): ProviderProfile`
- Parses provider-specific profile data
- Normalizes to standard format: `{ name, email, avatar }`
- Handles Apple's private relay email
- Handles missing fields gracefully

---

### **Account Linking**

#### `checkAccountExists(email: string): Promise<{ exists: boolean; user_id?: string; providers?: string[] }>`
- Checks if account with email exists
- Returns linked providers if found
- Used for smart linking prompt

#### `linkSocialAccount(userId: string, provider: string, providerData: any): Promise<void>`
- Links social account to existing user
- Requires password verification first
- Calls `link_social_account()` RPC
- Updates user metadata

#### `unlinkSocialAccount(userId: string, provider: string): Promise<void>`
- Removes social account link
- Validates user has ≥1 remaining login method
- Cannot unlink last method
- **Error:** Throws if last method

#### `getLinkedProviders(userId: string): Promise<LinkedProvider[]>`
- Returns list of linked social accounts
- Queries `user_linked_providers` view
- Used in Settings → Linked Accounts

---

### **Profile Auto-Fill**

#### `autoFillProfile(providerData: ProviderProfile): Promise<Partial<UserProfile>>`
- Extracts name, email, avatar from provider
- Downloads avatar from provider URL
- Uploads to Supabase Storage: `avatars/{user_id}/profile.jpg`
- Returns profile object ready for DB insert

#### `downloadProviderAvatar(url: string, userId: string): Promise<string>`
- Fetches image from provider URL
- Uploads to `avatars/{user_id}/social_avatar.jpg`
- Returns public Supabase Storage URL
- **Error:** If download fails, returns default avatar

---

### **Phone Verification**

#### `isPhoneRequired(userId: string): Promise<boolean>`
- Checks if user has verified phone
- Returns `true` if `phone_verified_at IS NULL`
- Called before listing creation or purchase

#### `sendPhoneVerificationCode(phone: string): Promise<void>`
- Sends SMS OTP via Twilio (or similar)
- Stores code in `phone_verification_codes` table (5-min expiry)
- Rate limited: 3 attempts per hour

#### `verifyPhoneCode(phone: string, code: string): Promise<void>`
- Validates OTP code
- Updates `user_profiles.phone_verified_at`
- Sets `phone_verification_method = 'sms'`
- **Error:** Throws if code invalid or expired

---

### **Password Fallback**

#### `canSetPassword(userId: string): Promise<boolean>`
- Checks if user already has password
- Returns `true` if social-only user (no password set)
- Used to show "Set Password" button in Settings

#### `setPasswordForSocialUser(userId: string, password: string): Promise<void>`
- Creates password for social-only user
- Validates password strength (min 8 chars, etc.)
- Uses Supabase Auth `updateUser()`
- **Error:** Throws if password too weak

---

## Frontend Architecture

### **Screen: LoginScreen (Enhanced)**

**Path:** `p2p-kids-marketplace/src/screens/LoginScreen.tsx`

**Component Tree:**
```
LoginScreen
├── SocialLoginButtons
│   ├── GoogleSignInButton
│   ├── FacebookSignInButton
│   └── AppleSignInButton
├── Divider ("OR")
├── EmailPasswordForm
│   ├── EmailInput
│   ├── PasswordInput
│   └── ForgotPasswordLink
└── SignUpLink
```

**State:**
- `isLoading: boolean` (during OAuth flow)
- `error: string | null`
- `provider: 'google' | 'facebook' | 'apple' | null`

---

### **Screen: SignupScreen (Enhanced)**

**Component Tree:**
```
SignupScreen
├── SocialSignupButtons (same as login)
├── Divider ("OR")
├── EmailSignupForm
│   ├── NameInput
│   ├── EmailInput
│   ├── PasswordInput
│   └── PhoneInput (optional, skippable)
└── LoginLink
```

---

### **Screen: Settings → Account → Linked Accounts**

**Component Tree:**
```
LinkedAccountsScreen
├── AccountOverview
│   ├── EmailDisplay
│   └── PasswordStatus
├── LinkedProvidersList
│   ├── ProviderCard (Google)
│   ├── ProviderCard (Facebook)
│   └── ProviderCard (Apple)
└── SetPasswordButton (if no password)
```

**ProviderCard:**
```
┌─────────────────────────────────────┐
│ 🔵 Google                           │
│ john.doe@gmail.com                  │
│ Linked on Apr 15, 2026              │
│                        [Unlink]     │
└─────────────────────────────────────┘
```

---

### **Modal: AccountLinkingPrompt**

**Triggered:** When social login email matches existing account

```
┌─────────────────────────────────────┐
│  Link Your Accounts                 │
├─────────────────────────────────────┤
│  You already have an account with   │
│  john@gmail.com                     │
│                                     │
│  Would you like to link your Google │
│  account for faster login?          │
│                                     │
│  Password: ____________             │
│  (verify it's you)                  │
│                                     │
│  [Cancel]         [Link Account]    │
└─────────────────────────────────────┘
```

---

### **Modal: PhoneVerificationModal**

**Triggered:** Before first listing or purchase (if phone not verified)

```
┌─────────────────────────────────────┐
│  Verify Your Phone                  │
├─────────────────────────────────────┤
│  For safety, we need to verify your │
│  phone before you can trade.        │
│                                     │
│  Phone: +1 ___ ___ ____             │
│                                     │
│  [Send Code]                        │
│                                     │
│  Enter code: __ __ __ __ __ __      │
│                                     │
│  [Verify]                           │
└─────────────────────────────────────┘
```

---

## Complete Function Reference

### **Database (4 migrations, 8 objects)**

| # | Type | Object | Purpose |
|---|------|--------|---------|
| 1 | View | `user_linked_providers` | Friendly view of linked social accounts |
| 2 | Column | `user_profiles.phone_verified_at` | Track phone verification |
| 3 | Column | `user_profiles.phone_verification_method` | How phone was verified |
| 4 | RPC | `link_social_account()` | Validate + audit account linking |
| 5 | Index | `idx_user_profiles_phone_verified` | Query unverified users |
| 6 | Metadata | `auth.users.raw_user_meta_data` | Store provider info |
| 7 | Audit | `audit_log` inserts | Track linking events |
| 8 | Trigger | (Future) Auto-sync provider data | Phase 2 |

---

### **Backend Services (15 functions)**

| # | Function | Module | Purpose |
|---|----------|--------|---------|
| 1 | `initiateSocialLogin()` | OAuthService | Start OAuth flow |
| 2 | `handleOAuthCallback()` | OAuthService | Process OAuth callback |
| 3 | `extractProviderProfile()` | OAuthService | Parse provider data |
| 4 | `checkAccountExists()` | AccountService | Check for existing account |
| 5 | `linkSocialAccount()` | AccountService | Link provider to account |
| 6 | `unlinkSocialAccount()` | AccountService | Remove provider link |
| 7 | `getLinkedProviders()` | AccountService | Fetch linked accounts |
| 8 | `autoFillProfile()` | ProfileService | Auto-populate profile |
| 9 | `downloadProviderAvatar()` | ProfileService | Fetch provider avatar |
| 10 | `isPhoneRequired()` | PhoneService | Check verification status |
| 11 | `sendPhoneVerificationCode()` | PhoneService | Send SMS OTP |
| 12 | `verifyPhoneCode()` | PhoneService | Validate OTP |
| 13 | `canSetPassword()` | PasswordService | Check password status |
| 14 | `setPasswordForSocialUser()` | PasswordService | Create password |
| 15 | `validatePasswordStrength()` | PasswordService | Password validation |

---

### **Mobile App Components (32 functions)**

#### **SocialLoginButtons (6 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 16 | `handleGoogleSignIn()` | Initiate Google OAuth |
| 17 | `handleFacebookSignIn()` | Initiate Facebook OAuth |
| 18 | `handleAppleSignIn()` | Initiate Apple OAuth |
| 19 | `handleOAuthError(error)` | Show error + fallback |
| 20 | `showAccountLinkPrompt()` | Trigger linking modal |
| 21 | `renderProviderButton(provider)` | Render branded button |

---

#### **LinkedAccountsScreen (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 22 | `loadLinkedProviders()` | Fetch user's linked accounts |
| 23 | `handleLinkProvider(provider)` | Start linking flow |
| 24 | `handleUnlinkProvider(provider)` | Unlink with confirmation |
| 25 | `validateCanUnlink(provider)` | Check ≥1 method remains |
| 26 | `handleSetPassword()` | Open password creation modal |
| 27 | `refreshProviderList()` | Reload after linking/unlinking |
| 28 | `showUnlinkConfirmation(provider)` | Confirm unlink action |
| 29 | `getProviderIcon(provider)` | Return provider logo |

---

#### **AccountLinkingPrompt (5 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 30 | `showPrompt(email, provider)` | Display linking modal |
| 31 | `handlePasswordVerify(password)` | Verify before linking |
| 32 | `confirmLinking()` | Execute link + update UI |
| 33 | `handleCancel()` | Dismiss modal |
| 34 | `handleLinkSuccess()` | Navigate after linking |

---

#### **PhoneVerificationModal (7 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 35 | `showModal()` | Display phone verification |
| 36 | `handlePhoneInput(phone)` | Format phone number |
| 37 | `sendVerificationCode()` | Trigger SMS send |
| 38 | `handleCodeInput(code)` | Auto-advance input fields |
| 39 | `verifyCode()` | Submit code for validation |
| 40 | `handleVerificationSuccess()` | Close modal + proceed |
| 41 | `resendCode()` | Resend OTP (rate limited) |

---

#### **LoginScreen/SignupScreen Enhanced (6 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 42 | `renderSocialButtons()` | Show Google/Facebook/Apple |
| 43 | `handleSocialSignupSuccess(profile)` | Auto-fill form from provider |
| 44 | `skipPhoneVerification()` | Allow signup without phone |
| 45 | `handleEmailFallback()` | Switch to email signup on error |
| 46 | `saveProviderMetadata(provider)` | Store provider in user meta |
| 47 | `handleFirstTimeUserFlow()` | Onboarding after social signup |

---

## Component Specifications

### **SocialLoginButtons**

```
┌─────────────────────────────────────┐
│  [  🔵 Continue with Google  ]       │
│  [  🔷 Continue with Facebook  ]     │
│  [  ⚫ Continue with Apple  ]        │
└─────────────────────────────────────┘
```

**Props:**
- `mode: 'signup' | 'login'` (changes button text)
- `onSuccess: (user) => void`
- `onError: (error) => void`

**Behavior:**
- Tapping button → OAuth flow via Supabase Auth
- On success → navigate to home or link prompt
- On error → show error banner + email fallback

---

### **LinkedAccountsScreen**

```
┌─────────────────────────────────────┐
│  Account                            │
├─────────────────────────────────────┤
│  Email                              │
│  john.doe@gmail.com                 │
│                                     │
│  Password                           │
│  ••••••••                [Change]   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Linked Social Accounts             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔵 Google                   │   │
│  │ john.doe@gmail.com          │   │
│  │ Linked Apr 15, 2026 [Unlink]│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔷 Facebook                 │   │
│  │ Not linked         [Link]   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⚫ Apple                     │   │
│  │ Not linked         [Link]   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

### **AccountLinkingPrompt**

```
┌─────────────────────────────────────┐
│  🔗 Link Your Accounts              │
├─────────────────────────────────────┤
│  You already have an account with:  │
│  john.doe@gmail.com                 │
│                                     │
│  Link your Google account for       │
│  faster login in the future?        │
│                                     │
│  Password                           │
│  ┌──────────────────────────────┐   │
│  │ ____________                 │   │
│  └──────────────────────────────┘   │
│  (verify it's you)                  │
│                                     │
│  [Maybe Later]    [Link Account]    │
└─────────────────────────────────────┘
```

---

### **PhoneVerificationModal**

```
┌─────────────────────────────────────┐
│  📱 Verify Your Phone               │
├─────────────────────────────────────┤
│  For safety, we verify all traders  │
│  before their first transaction.    │
│                                     │
│  Phone Number                       │
│  ┌──────────────────────────────┐   │
│  │ +1 (___) ___-____            │   │
│  └──────────────────────────────┘   │
│                                     │
│  [Send Code]                        │
│                                     │
│  ─── After sending ───              │
│                                     │
│  Enter the 6-digit code:            │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐          │
│  │__││__││__││__││__││__│          │
│  └──┘└──┘└──┘└──┘└──┘└──┘          │
│                                     │
│  Didn't receive? [Resend] (0:45)    │
│                                     │
│  [Verify]                           │
└─────────────────────────────────────┘
```

---

## Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| OAuth flow start | < 500ms | Pre-load OAuth SDK |
| OAuth callback processing | < 1s | Async profile fetch |
| Avatar download | < 2s | Background download |
| Account linking | < 1s | Optimistic update |
| Phone verification code send | < 3s | Twilio API |
| Phone verification check | < 500ms | Indexed DB query |
| Provider list load | < 300ms | Cached view |
| Unlink provider | < 500ms | Optimistic update |

---

## Accessibility Requirements

- All social buttons: `accessibilityLabel` ("Sign in with Google, button")
- OAuth loading state: screen reader announces "Signing you in..."
- Account linking prompt: focus trap + keyboard navigation
- Phone input: auto-format (123-456-7890) + voice-over support
- Verification code inputs: auto-advance focus between digits
- Error messages: announced immediately by screen reader
- Linked accounts list: each row has clear provider name + status
- Unlink confirmation: focus on "Cancel" (safer default)

---

## Testing Requirements

### **Unit Tests**

| Test | Location | Coverage |
|------|----------|---------|
| `extractProviderProfile()` | `__tests__/services/oauthService.test.ts` | Google, Facebook, Apple data parsing |
| `checkAccountExists()` | `__tests__/services/accountService.test.ts` | Email match, provider check |
| `linkSocialAccount()` | `__tests__/services/accountService.test.ts` | Success, password verification |
| `unlinkSocialAccount()` | `__tests__/services/accountService.test.ts` | Success, last-method error |
| `autoFillProfile()` | `__tests__/services/profileService.test.ts` | Avatar download, name extraction |
| `validatePasswordStrength()` | `__tests__/services/passwordService.test.ts` | Weak, strong passwords |
| `verifyPhoneCode()` | `__tests__/services/phoneService.test.ts` | Valid, invalid, expired codes |

### **Integration Tests**

| Test | Supabase | Description |
|------|----------|-------------|
| Social signup flow | Prod staging | Google test account → signup → profile created |
| Account linking | Prod staging | Existing email user → link Google → verify dual login |
| Phone verification | Prod staging | Send code → verify → check DB timestamp |
| Unlink provider | Prod staging | Unlink Google → verify login still works via password |

### **Maestro UI Flow Tests**

| Flow | File | States Covered |
|------|------|---------------|
| Social signup (Google) | `.maestro/social-signup-google.yaml` | Happy path, auto-fill profile |
| Account linking prompt | `.maestro/account-linking.yaml` | Prompt shown, link successful |
| Phone verification | `.maestro/phone-verification.yaml` | Send code, enter code, verify |
| Link social in Settings | `.maestro/link-social-settings.yaml` | Navigate, link Facebook |
| Unlink provider | `.maestro/unlink-provider.yaml` | Unlink, confirmation, verify |

---

## Acceptance Criteria

### **AC-001: Social Signup (Google)**
- [ ] Tap "Sign in with Google" on signup screen
- [ ] Google OAuth flow opens in browser/webview
- [ ] User approves permissions
- [ ] Name + email auto-filled from Google profile
- [ ] Avatar downloaded from Google and set as profile photo
- [ ] Account created in < 30 seconds
- [ ] User logged in immediately
- [ ] No email verification required
- [ ] Phone verification skipped (deferred)

### **AC-002: Account Linking Prompt**
- [ ] Existing user with email: john@gmail.com
- [ ] Attempt to sign in with Google (same email)
- [ ] Prompt shown: "Link your Google account?"
- [ ] Enter password to verify
- [ ] After linking: Google appears in Settings → Linked Accounts
- [ ] Can login with Google OR email/password

### **AC-003: Phone Verification at First Transaction**
- [ ] New user signs up with Facebook (no phone)
- [ ] Can browse items, view profiles freely
- [ ] Tap "Create Listing"
- [ ] Modal appears: "Verify phone to list items"
- [ ] Complete SMS verification
- [ ] After verification: proceed to listing creation
- [ ] Phone not asked again for future listings

### **AC-004: Link Social Account in Settings**
- [ ] Go to Settings → Account → Linked Accounts
- [ ] See "Facebook: Not linked [Link]"
- [ ] Tap "Link"
- [ ] Facebook OAuth flow completes
- [ ] Shows "✅ Facebook: name@email.com [Unlink]"
- [ ] Login screen now shows Facebook button

### **AC-005: Unlink Social Account**
- [ ] Settings shows: Google ✅ Linked, Password ✅ Set
- [ ] Tap "Unlink" next to Google
- [ ] Confirmation: "You can still login with password"
- [ ] After unlink: Google removed from list
- [ ] Can still login with email/password
- [ ] Cannot unlink password if it's the last method (error shown)

### **AC-006: Set Password for Social-Only User**
- [ ] User signed up with Apple only (no password)
- [ ] Settings → Account → Password shows "No password set"
- [ ] Tap "Set Password"
- [ ] Enter new password (min 8 chars, validated)
- [ ] Password created successfully
- [ ] Can now login with email/password OR Apple

### **AC-007: OAuth Error Handling**
- [ ] Simulate Google down (503 error)
- [ ] Error: "Google temporarily unavailable. Sign up with email?"
- [ ] Tap "Sign up with email" → email signup form shown
- [ ] User can complete signup via email fallback

### **AC-008: Multiple Social Logins**
- [ ] User linked: Google + Facebook + password
- [ ] Login screen shows all 3 options
- [ ] Tapping any option logs in successfully
- [ ] All methods access same account + data

---

## Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| Phone/SMS login (passwordless OTP) | Different auth flow, Phase 2 |
| Biometric login (Touch ID / Face ID) | Requires device permissions setup |
| 2FA for high-value accounts | Security feature, not MVP priority |
| Social profile sync (auto-update avatar) | Complex background job, Phase 2 |
| LinkedIn / Twitter / TikTok login | Low priority for kids marketplace |
| Session management across devices | Advanced security, Phase 2 |
| Login history / device management | Admin feature, Phase 2 |
| OAuth token refresh handling | Handled by Supabase Auth automatically |

---

## Implementation Checklist

### **Supabase Auth Setup**
- [ ] Enable Google provider in Supabase dashboard
- [ ] Enable Facebook provider in Supabase dashboard
- [ ] Enable Apple provider in Supabase dashboard
- [ ] Configure OAuth redirect URLs for staging + production
- [ ] Set up Google OAuth 2.0 credentials (client ID + secret)
- [ ] Set up Facebook App (App ID + secret)
- [ ] Set up Apple Sign In (Service ID + key)
- [ ] Test OAuth flows in Supabase dashboard

### **Database**
- [ ] Run migration: create `user_linked_providers` view
- [ ] Run migration: add phone verification columns
- [ ] Run migration: create `link_social_account()` RPC
- [ ] Verify RLS policies on views
- [ ] Test metadata storage in `auth.users.raw_user_meta_data`

### **Backend Services**
- [ ] Implement `OAuthService` (initiate, callback, extract profile)
- [ ] Implement `AccountService` (check exists, link, unlink, get providers)
- [ ] Implement `ProfileService` (auto-fill, download avatar)
- [ ] Implement `PhoneService` (send code, verify code)
- [ ] Implement `PasswordService` (can set, set password, validate)
- [ ] Integrate Twilio for SMS (or alternative provider)

### **Mobile App**
- [ ] Add `SocialLoginButtons` component to LoginScreen
- [ ] Add `SocialLoginButtons` component to SignupScreen
- [ ] Implement OAuth flow handling (Supabase Auth SDK)
- [ ] Build `LinkedAccountsScreen` in Settings
- [ ] Build `AccountLinkingPrompt` modal
- [ ] Build `PhoneVerificationModal`
- [ ] Implement auto-fill profile from provider data
- [ ] Implement avatar download + upload to Storage
- [ ] Add "Set Password" flow for social-only users

### **Testing**
- [ ] Unit tests: all service functions
- [ ] Integration tests: OAuth flows (Google, Facebook, Apple test accounts)
- [ ] Maestro flows: all 5 flows listed in Testing Requirements
- [ ] Manual E2E: Real accounts on staging + production
- [ ] Test error scenarios (provider down, network error, cancel OAuth)

### **iOS/Android Configuration**
- [ ] Add Google Sign-In SDK to iOS (CocoaPods)
- [ ] Add Google Sign-In SDK to Android (Gradle)
- [ ] Add Facebook SDK to iOS
- [ ] Add Facebook SDK to Android
- [ ] Configure Apple Sign In in Xcode (Capabilities)
- [ ] Add OAuth URL schemes to `app.json` (Expo) or `Info.plist` / `AndroidManifest.xml`
- [ ] Test deep linking back to app after OAuth

### **Security**
- [ ] Validate OAuth state tokens (CSRF protection)
- [ ] Verify provider email before linking
- [ ] Rate limit phone verification (3 attempts/hour)
- [ ] Encrypt phone verification codes in DB
- [ ] Audit log all account linking events
- [ ] Test account takeover scenarios (prevent unauthorized linking)

---

*Document version: 1.0 | Last updated: April 20, 2026 | Next review: after Track 3 implementation*
