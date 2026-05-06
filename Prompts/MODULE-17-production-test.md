# MODULE 17: PRODUCTION LIVE TEST (PRE-LAUNCH)

**Timeline:** Week 24-25  
**Total Tasks:** 5  
**Estimated Time:** ~11 hours

---

## Overview

This module defines the critical smoke tests and verification steps required immediately after the app is live in the production environment, but before the official public launch. These tests ensure that the production infrastructure (Auth, Database, Storage, Edge Functions) is working as expected with real network conditions and production secrets.

**Key Deliverables:**
- Production sanity check complete
- E2E flows verified in live environment (Social login, data integrity)
- Manual verification of critical security boundaries

---

## TASK PROD-001: Setup Admin Support Account

**Duration:** 1 hour  
**Priority:** Critical  
**Dependencies:** MODULE-16-DEPLOYMENT (Live Environment Ready)

### Description
Create and configure the primary admin support account in the production environment. This account is responsible for handling user support escalations, account suspensions, and critical moderation actions.

### Sub-Tasks
- [ ] Create admin user account with email: `admin-support@kidsmarketplace.app`
- [ ] Assign admin role with full permissions (user management, moderation, config controls)
- [ ] Verify admin can access the production admin portal (`p2p-kids-admin`)
- [ ] Set up admin profile with appropriate metadata (role, support contact info)
- [ ] Configure email forwarding/notifications for critical admin actions
- [ ] Test admin account can view and manage user accounts

### Verification Checklist
- [ ] Admin account exists in production `auth.users` with correct email
- [ ] Admin profile created in production `profiles` table
- [ ] Admin role assigned with appropriate `is_admin` flag set to `true`
- [ ] Login to admin portal succeeds with admin credentials
- [ ] Admin can view user list and account details from dashboard
- [ ] Admin account can perform account suspension/unsuspension operations
- [ ] Support email receives notifications for critical admin actions (if configured)

---

## TASK PROD-002: Execute Auth V3 Production Sanity Checks (Social Login)

**Duration:** 4 hours  
**Priority:** Critical  
**Dependencies:** MODULE-16-DEPLOYMENT (Live Environment Ready)

### Description
Run the manual testing guides for Social Auth and Account Management to ensure the Supabase production project, Google/Apple/Facebook API keys, and production redirect URLs are correctly configured.

### Sub-Tasks
- [ ] Execute [AUTH-V3-007-MANUAL-TESTING-GUIDE.md](../AUTH-V3-007-MANUAL-TESTING-GUIDE.md) in the production environment.
- [ ] Execute [AUTH-V3-008-MANUAL-TESTING-GUIDE.md](../AUTH-V3-008-MANUAL-TESTING-GUIDE.md) in the production environment.
- [ ] Execute [AUTH-V3-009-MANUAL-TESTING.md](../AUTH-V3-009-MANUAL-TESTING.md) for full module verification.

### Verification Checklist
- [ ] Social sign-up creates a profile in the production `profiles` table.
- [ ] Redirect URLs return the user to the Production iOS/Android app correctly.
- [ ] Account linking (TC-001/TC-002) works with production password re-auth.

---

## TASK PROD-003: Production Data Layer Verification

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** PROD-002

### Description
Verify that no staging data has leaked into production and that RLS policies are strictly enforced in the new production Supabase project.

### Sub-Tasks
- [ ] Verify `profiles` table only contains production test users.
- [ ] Verify `user_avatars` storage bucket uses production CDN URLs.
- [ ] Confirm no "test" categories or listings from staging exist.

---

## TASK PROD-004: Implement and Validate Email Verification Flow

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** PROD-002

### Description
Implement a proper email verification flow for email/password users and ensure unverified users are clearly handled until they verify their inbox link.

### Sub-Tasks
- [ ] Configure Supabase Auth email verification settings for production (disable auto-confirm for email/password signups).
- [ ] Add app flow to trigger verification email resend from auth screens.
- [ ] Block full authenticated app access for unverified email/password users until `email_confirmed_at` is set.
- [ ] Add clear UI state/message for pending verification (check inbox + spam + resend option).
- [ ] Verify Admin panel reflects verification status only after confirmed implementation is complete.

### Verification Checklist
- [ ] New email/password signup creates user with `auth.users.email_confirmed_at IS NULL`.
- [ ] Verification link confirms email and sets `email_confirmed_at`.
- [ ] User can complete gated login/app entry only after successful email verification.
- [ ] Resend verification email flow works and is rate-limit safe.

---

## TASK PROD-005: Validate Social Login Provider Configuration and End-to-End Auth

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** PROD-002

### Description
Confirm Google, Apple, and Facebook login are correctly configured in production and working end-to-end on supported platforms.

### Sub-Tasks
- [ ] Verify Supabase Auth Providers are enabled for Google, Apple, and Facebook in production.
- [ ] Verify production OAuth client IDs/secrets are set (no staging credentials).
- [ ] Verify production redirect URLs match mobile app scheme and callback expectations.
- [ ] Execute live sign-in test for each provider on supported platform(s): Apple (iOS), Google (Android + iOS), Facebook (Android + iOS).
- [ ] Verify provider cancellation path returns user to Login/Signup screen without app crash.
- [ ] Verify provider error path (network/provider unavailable) shows user-friendly fallback to email login.

### Verification Checklist
- [ ] Google login succeeds and creates/uses the correct production user profile.
- [ ] Apple login succeeds on iOS and returns to app with authenticated session.
- [ ] Facebook login succeeds and returns to app with authenticated session.
- [ ] OAuth callback returns to the app reliably (no Safari/Chrome dead-end or localhost page).
- [ ] Existing-account linking behavior works as expected when provider email already exists.

---

## AI Prompt for QA Agent (Production Verify)

```typescript
/*
TASK: Perform production smoke testing for Auth and Account Management.

CONTEXT:
The app is now deployed to production. We need to verify that the social login configurations,
redirect URI schemes, and secure re-auth flows are correctly pointing to the production Supabase
environment, not staging.

REQUIREMENTS:
1. Follow [AUTH-V3-007-MANUAL-TESTING-GUIDE.md](../AUTH-V3-007-MANUAL-TESTING-GUIDE.md).
2. Follow [AUTH-V3-008-MANUAL-TESTING-GUIDE.md](../AUTH-V3-008-MANUAL-TESTING-GUIDE.md).
3. Follow [AUTH-V3-009-MANUAL-TESTING.md](../AUTH-V3-009-MANUAL-TESTING.md).
4. Check Supabase Dashboard (Production) for row creation.
5. Verify email notifications (if any) are sent via production Mailgun/SendGrid.

ENVIRONMENT: Production (NOT Staging)
*/
```
