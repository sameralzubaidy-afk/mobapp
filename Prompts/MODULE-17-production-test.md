# MODULE 17: PRODUCTION LIVE TEST (PRE-LAUNCH)

**Timeline:** Week 24-25  
**Total Tasks:** 2  
**Estimated Time:** ~8 hours

---

## Overview

This module defines the critical smoke tests and verification steps required immediately after the app is live in the production environment, but before the official public launch. These tests ensure that the production infrastructure (Auth, Database, Storage, Edge Functions) is working as expected with real network conditions and production secrets.

**Key Deliverables:**
- Production sanity check complete
- E2E flows verified in live environment (Social login, data integrity)
- Manual verification of critical security boundaries

---

## TASK PROD-001: Execute Auth V3 Production Sanity Checks (Social Login)

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

## TASK PROD-002: Production Data Layer Verification

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** PROD-001

### Description
Verify that no staging data has leaked into production and that RLS policies are strictly enforced in the new production Supabase project.

### Sub-Tasks
- [ ] Verify `profiles` table only contains production test users.
- [ ] Verify `user_avatars` storage bucket uses production CDN URLs.
- [ ] Confirm no "test" categories or listings from staging exist.

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
