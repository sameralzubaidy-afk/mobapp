# SUB-020 Manual Testing Guide: Trial Limit Control (Simplified)

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-020 - Trial Limit Control  
**Focus:** Two blocking rules for trial eligibility:
1. **Status-based block:** User must be in `free` or `expired` state (not `trial`, `active`, `cancelled`, `grace_period`)
2. **Lifetime limit block:** User's `trial_uses_count` must be less than `max_trial_uses` config

---

## Quick Setup

### 1. Verify Admin Config Exists
```sql
SELECT key, value, description FROM admin_config WHERE key = 'max_trial_uses';
-- Should return: key='max_trial_uses', value='1', description='...'
```

### 2. Seed Test Users
```sql
-- User A: Free, never trialed (count=0, max=1) → should ALLOW trial
INSERT INTO profiles (user_id, display_name, trial_uses_count) VALUES (..., 'test_free_user_a', 0);

-- User B: Free, at limit (count=1, max=1) → should BLOCK trial
INSERT INTO profiles (user_id, display_name, trial_uses_count) VALUES (..., 'test_free_user_b', 1);

-- User C: In grace_period → should BLOCK trial
-- Insert subscription with status='grace_period' for this user

-- User D: In expired state → should BLOCK trial (if count >= max) or ALLOW (if count < max)
-- Insert subscription with status='expired' and trial_uses_count=0 for this user
```

### 3. Build and Run App
```bash
cd p2p-kids-marketplace
yarn build:ios  # or build:android
```

---

## Core Test Cases

**Test Grouping:**
- **TC-001-003:** UI tests (free users, trial eligibility checks)
- **TC-004-007, TC-007-Extended:** Backend RPC tests (status-based safeguards; non-free users do NOT access trial UI)
- **TC-008-010:** Admin operations & config variants

---

### TC-001: Admin Config Field Visible in Admin Portal

**Setup:** Open admin portal at `/config`

**Steps:**
1. Login as admin
2. Navigate to Settings / Config page
3. Find `max_trial_uses` field

**Expected:**
- ✅ Field is visible and editable
- ✅ Description explains: "Lifetime number of free-trial starts allowed per user"
- ✅ Default value shows as `1`

**Verification:**
```sql
SELECT value FROM admin_config WHERE key = 'max_trial_uses';
```

---

### TC-002: Lifetime Limit — User Below Limit Can Start Trial

**Setup:** Sign in as `test_free_user_a` (count=0, max=1)

**Steps:**
1. Navigate to Subscription Choice screen (onboarding or home)
2. Look for "Start Free Trial" button
3. Tap "Start Free Trial"

**Expected:**
- ✅ Button is enabled (blue, not grayed out)
- ✅ No warning or limit-reached message
- ✅ Trial flow initiates (modal or next screen)
- ✅ Trial successfully starts

**Verification:**
```sql
SELECT trial_uses_count, status FROM profiles p
JOIN subscriptions s ON s.user_id = p.user_id
WHERE p.user_id = '<user_a_uuid>';
-- After trial: trial_uses_count should increment to 1, status should be 'trial'
```

---

### TC-003: Lifetime Limit — User At Limit Blocked

**Setup:** Sign in as `test_free_user_b` (count=1, max=1)

**Steps:**
1. Navigate to Subscription Choice screen
2. Observe button text and state

**Expected:**
- ✅ Button appears disabled (grayed out)
- ✅ Button text shows "Trial Limit Reached" or similar
- ✅ Warning card displayed: "You've already used your free trial. Subscribe now to access Kids Club+."
- ✅ CTA button "Subscribe Now" present
- ✅ Button is not tappable; trial does NOT start

**Verification:**
```sql
SELECT trial_uses_count, status FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.user_id
WHERE p.user_id = '<user_b_uuid>';
-- trial_uses_count = 1, status = 'free' (no trial subscription exists)
```

---

### TC-004: Backend Safeguard — Grace Period User Cannot Trigger Trial RPC

**Setup:** Test database with user in grace_period state
```sql
-- Verify grace_period user exists
SELECT id, status FROM subscriptions WHERE user_id = '<grace_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should return status = 'grace_period'
```

**Steps (Supabase SQL):**
```sql
-- Attempt to call trial eligibility RPC as grace_period user
SELECT public.is_user_trial_eligible('<grace_user_uuid>'::uuid);
```

**Expected:**
- ✅ RPC returns `FALSE` (not eligible)
- ✅ Rationale: Grace period is recovery state; user must re-subscribe first, not start new trial

**Verification:**
```sql
-- Confirm status is grace_period
SELECT status FROM subscriptions WHERE user_id = '<grace_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should be 'grace_period'
```

---

### TC-005: Backend Safeguard — Active Subscription User Cannot Trigger Trial RPC

**Setup:** Test database with user in active subscription state
```sql
-- Verify active user exists
SELECT id, status FROM subscriptions WHERE user_id = '<active_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should return status = 'active'
```

**Steps (Supabase SQL):**
```sql
SELECT public.is_user_trial_eligible('<active_user_uuid>'::uuid);
```

**Expected:**
- ✅ RPC returns `FALSE` (not eligible)
- ✅ Rationale: Already subscribed; no trial needed

**Verification:**
```sql
SELECT status FROM subscriptions WHERE user_id = '<active_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should be 'active'
```

---

### TC-006: Backend Safeguard — Trial User Cannot Trigger Second Trial RPC

**Setup:** Test database with user currently in trial state
```sql
-- Verify trial user exists
SELECT id, status FROM subscriptions WHERE user_id = '<trial_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should return status = 'trial'
```

**Steps (Supabase SQL):**
```sql
SELECT public.is_user_trial_eligible('<trial_user_uuid>'::uuid);
```

**Expected:**
- ✅ RPC returns `FALSE` (not eligible)
- ✅ Rationale: User already in active trial; cannot start two trials simultaneously

**Verification:**
```sql
SELECT status FROM subscriptions WHERE user_id = '<trial_user_uuid>' ORDER BY created_at DESC LIMIT 1;
-- Should be 'trial'
```

---

### TC-007: Backend Safeguard — Expired User (At Lifetime Limit) Cannot Trigger Trial RPC

**Setup:** Test database with user in expired state AND at trial limit
```sql
-- Verify expired user with count >= max
SELECT s.status, p.trial_uses_count 
FROM subscriptions s
JOIN profiles p ON p.user_id = s.user_id
WHERE s.user_id = '<expired_limit_user_uuid>'
ORDER BY s.created_at DESC LIMIT 1;
-- Should return status = 'expired', trial_uses_count >= 1 (assuming max=1)
```

**Steps (Supabase SQL):**
```sql
SELECT public.is_user_trial_eligible('<expired_limit_user_uuid>'::uuid);
```

**Expected:**
- ✅ RPC returns `FALSE` (not eligible)
- ✅ Rationale: Even though expired, user has exhausted lifetime trial limit

**Verification:**
```sql
SELECT s.status, p.trial_uses_count, ac.value as max_trial_uses
FROM subscriptions s
JOIN profiles p ON p.user_id = s.user_id
CROSS JOIN admin_config ac
WHERE s.user_id = '<expired_limit_user_uuid>' AND ac.key = 'max_trial_uses'
ORDER BY s.created_at DESC LIMIT 1;
-- Should show: status='expired', trial_uses_count >= max_trial_uses
```

---

### TC-007-Extended: Backend Safeguard — Expired User (Below Lifetime Limit) CAN Trigger Trial RPC

**Setup:** Test database with user in expired state WITH trial budget available
```sql
-- Verify expired user with count < max
SELECT s.status, p.trial_uses_count 
FROM subscriptions s
JOIN profiles p ON p.user_id = s.user_id
WHERE s.user_id = '<expired_available_user_uuid>'
ORDER BY s.created_at DESC LIMIT 1;
-- Should return status = 'expired', trial_uses_count = 0 (assuming max=1)
```

**Steps (Supabase SQL):**
```sql
SELECT public.is_user_trial_eligible('<expired_available_user_uuid>'::uuid);
```

**Expected:**
- ✅ RPC returns `TRUE` (eligible)
- ✅ Rationale: Expired users with trial budget remaining can restart with a fresh trial

**Verification:**
```sql
SELECT s.status, p.trial_uses_count, ac.value as max_trial_uses
FROM subscriptions s
JOIN profiles p ON p.user_id = s.user_id
CROSS JOIN admin_config ac
WHERE s.user_id = '<expired_available_user_uuid>' AND ac.key = 'max_trial_uses'
ORDER BY s.created_at DESC LIMIT 1;
-- Should show: status='expired', trial_uses_count < max_trial_uses
```

---

### TC-008: Admin Override — Reset Trial Uses Count

**Setup:** User B (at limit, count=1) needs trial reactivated

**Steps (via Supabase SQL):**
```sql
SELECT public.admin_reset_trial_uses(
  p_user_id => '<user_b_uuid>'::uuid,
  p_reason => 'support_override_testing'
);
```

**Expected:**
- ✅ RPC returns success
- ✅ `trial_uses_count` reset to 0
- ✅ Audit event created in `subscription_events` table

**Steps (in Mobile App):**
1. Sign out and sign back in as User B
2. Navigate to Subscription Choice screen
3. "Start Free Trial" button now ENABLED

**Verification:**
```sql
-- Check reset applied
SELECT trial_uses_count FROM profiles WHERE user_id = '<user_b_uuid>';
-- Should return 0

-- Check audit event
SELECT event_type, user_id, metadata FROM subscription_events
WHERE event_type = 'trial_uses_reset'
ORDER BY created_at DESC LIMIT 1;
-- Should show reset event with reason='support_override_testing'
```

---

### TC-009: Config Variant — max_trial_uses = 2 (Two Trials Allowed)

**Setup:** Update admin config
```sql
UPDATE admin_config SET value = '2' WHERE key = 'max_trial_uses';
```

**Test User:** Fresh user with count=0

**Steps:**
1. Start trial #1: Navigate to Subscription Choice, tap "Start Free Trial"
2. Complete or cancel trial #1
3. After trial #1 ends, navigate back to Subscription Choice
4. Start trial #2: "Start Free Trial" button still enabled, tap it
5. Complete trial #2
6. Navigate back to Subscription Choice for trial #3 attempt

**Expected:**
- ✅ Trial #1: Button enabled, trial starts, count increments to 1
- ✅ Trial #2: Button still enabled (1 < 2), trial starts, count increments to 2
- ✅ Trial #3: Button disabled, message "Trial Limit Reached"

**Verification:**
```sql
-- After each trial
SELECT trial_uses_count FROM profiles WHERE user_id = '<test_user_uuid>';
-- Should show: 1 → 2 → 2 (stops at max)

-- Verify config
SELECT value FROM admin_config WHERE key = 'max_trial_uses';
-- Should return '2'
```

---

### TC-010: Config Variant — max_trial_uses = 0 (Unlimited Trials)

**Setup:** Update admin config
```sql
UPDATE admin_config SET value = '0' WHERE key = 'max_trial_uses';
```

**Test Users:**
- User X: count=0 (new user)
- User Y: count=10 (many prior trials)

**Steps for User X:**
1. Navigate to Subscription Choice
2. "Start Free Trial" button state?

**Steps for User Y:**
1. Navigate to Subscription Choice
2. "Start Free Trial" button state?

**Expected (both users):**
- ✅ "Start Free Trial" button ENABLED
- ✅ No limit-reached message
- ✅ Can start trials without restriction

**Rationale:** `max_trial_uses <= 0` means unlimited; both new and returning users can trial.

**Verification:**
```sql
SELECT value FROM admin_config WHERE key = 'max_trial_uses';
-- Should return '0'

SELECT public.get_trial_limit_status('<any_user_uuid>'::uuid);
-- Should include unlimited = true
```

---

## Test Summary Checklist

- [ ] Admin config `max_trial_uses` field visible in admin portal (TC-001)
- [ ] User below limit (count=0, max=1) can start trial (TC-002)
- [ ] User at limit (count=1, max=1) blocked (TC-003)
- [ ] Grace_period user RPC returns FALSE (TC-004)
- [ ] Active subscription user RPC returns FALSE (TC-005)
- [ ] Trial user RPC returns FALSE (TC-006)
- [ ] Expired user (at limit) RPC returns FALSE (TC-007)
- [ ] Expired user (below limit) RPC returns TRUE (TC-007-Extended)
- [ ] Admin reset RPC works and audit logged (TC-008)
- [ ] max_trial_uses=2 allows exactly 2 trials, blocks 3rd (TC-009)
- [ ] max_trial_uses=0 allows unlimited trials (TC-010)
- [ ] No console errors or crashes during tests
- [ ] All frontend CTAs navigate to correct screens (TC-002, TC-003)

---

## Quick Rollback (if needed)

```sql
-- Reset admin config to default
UPDATE admin_config SET value = '1' WHERE key = 'max_trial_uses';

-- Reset a test user's trial count
SELECT public.admin_reset_trial_uses('<user_uuid>'::uuid, 'test_rollback');
```
