# SAFETY-012: Liability Disclaimer System - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-012  
**Test Environment:** iOS Simulator / Android Emulator  
**Prerequisites:** Supabase staging instance with published liability disclaimer

---

## 📋 PRE-TESTING SETUP

### Step 1: Verify Database Migration Applied

Run in Supabase SQL Editor:

```sql
-- Verify trades table has disclaimer columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trades'
  AND column_name IN ('disclaimer_acknowledged', 'disclaimer_policy_id', 'disclaimer_acknowledged_at');

-- Expected: 3 rows returned
```

### Step 2: Ensure Liability Disclaimer Policy Exists

```sql
-- Check for published disclaimer
SELECT id, version, title, status, effective_date
FROM platform_policies
WHERE policy_type = 'liability_disclaimer'
  AND status = 'published'
ORDER BY created_at DESC
LIMIT 1;

-- If none exists, create one:
INSERT INTO platform_policies (
  policy_type,
  version,
  title,
  content,
  status,
  effective_date,
  published_at
) VALUES (
  'liability_disclaimer',
  '1.0',
  'Platform Liability Disclaimer',
  '# Liability Disclaimer

## Terms of Use

By engaging in trades on this platform, you acknowledge and agree to the following:

1. **No Warranty**: All items are sold "as-is" without any warranty.
2. **Buyer Responsibility**: Buyers are responsible for inspecting items before finalizing trades.
3. **Platform Liability**: The platform is not liable for disputes between buyers and sellers.
4. **User Conduct**: Users must comply with all applicable laws and platform policies.

For full terms, please review our [Terms of Service](#).

Last updated: March 2026',
  'published',
  NOW(),
  NOW()
);
```

### Step 3: Verify RPC Functions

```sql
-- Test get_current_policy
SELECT * FROM get_current_policy('liability_disclaimer');
-- Expected: Returns 1 row with policy details

-- Check acknowledge_trade_disclaimer function exists
SELECT proname FROM pg_proc WHERE proname = 'acknowledge_trade_disclaimer';
-- Expected: 1 row
```

---

## 🧪 TEST CASES

### TC-SAFETY-012-001: View Disclaimer from Settings

**Objective:** Verify users can view liability disclaimer from Settings menu

**Steps:**
1. Launch app and log in
2. Navigate to Profile tab
3. Tap "Settings"
4. Scroll down and tap "Liability Disclaimer"

**Expected Results:**
- ✅ Disclaimer screen opens with header "Liability Disclaimer"
- ✅ Version badge displayed (e.g., "Version 1.0")
- ✅ Effective date shown
- ✅ Full disclaimer content is rendered in Markdown
- ✅ Informational notice at bottom: "This disclaimer is shown before every purchase..."
- ✅ Back button works (returns to Settings)

**Test Data:**
- User: Any authenticated user (free or subscriber)

---

### TC-SAFETY-012-002: Disclaimer Modal During Trade (Happy Path)

**Objective:** Verify disclaimer modal appears during trade initiation and can be accepted

**Steps:**
1. Log in as authenticated user
2. Navigate to Browse/Discovery screen
3. Select an active listing
4. Tap "Buy Now" or "Initiate Trade"
5. On TradeInitiationScreen, tap "Confirm & Pay" button
6. **Expected:** Disclaimer modal appears
7. Observe modal content
8. Tap checkbox "I have read and understand this disclaimer"
9. Tap "Accept & Continue"

**Expected Results:**
- ✅ Modal appears with title "Liability Disclaimer"
- ✅ Disclaimer content is scrollable
- ✅ "Accept & Continue" button is DISABLED initially
- ✅ Checkbox can be tapped (visual feedback)
- ✅ "Accept & Continue" button becomes ENABLED after checkbox is checked
- ✅ Modal closes after accepting
- ✅ Trade proceeds to payment/completion flow

**Verification in Database (after acceptance):**
```sql
SELECT 
  t.id,
  t.disclaimer_acknowledged,
  t.disclaimer_policy_id,
  t.disclaimer_acknowledged_at,
  pp.version as disclaimer_version
FROM trades t
LEFT JOIN platform_policies pp ON pp.id = t.disclaimer_policy_id
WHERE t.buyer_id = '<test-user-id>'
ORDER BY t.created_at DESC
LIMIT 1;

-- Expected: disclaimer_acknowledged = TRUE, policy_id populated, timestamp set
```

---

### TC-SAFETY-012-003: Disclaimer Modal - Cancel Path

**Objective:** Verify user can cancel disclaimer and return to trade screen

**Steps:**
1. Log in and navigate to an item
2. Tap "Buy Now"
3. On TradeInitiationScreen, tap "Confirm & Pay"
4. Modal appears
5. Tap "Cancel" button (do NOT check the checkbox)

**Expected Results:**
- ✅ Modal closes
- ✅ User returns to TradeInitiationScreen
- ✅ Trade is NOT initiated (no row in trades table)
- ✅ User can tap "Confirm & Pay" again to retry

---

### TC-SAFETY-012-004: Disclaimer Modal - Close Button

**Objective:** Verify close button (X) works same as Cancel

**Steps:**
1. Navigate to trade confirmation
2. Show disclaimer modal
3. Tap the "✕" close button in header

**Expected Results:**
- ✅ Modal closes
- ✅ Returns to TradeInitiationScreen
- ✅ No trade initiated

---

### TC-SAFETY-012-005: Disclaimer Checkbox Resets on Reopen

**Objective:** Verify checkbox state resets when modal is reopened

**Steps:**
1. Show disclaimer modal
2. Check the "I understand" checkbox
3. Tap "Cancel"
4. Tap "Confirm & Pay" again to reopen modal

**Expected Results:**
- ✅ Checkbox is UNCHECKED (reset)
- ✅ "Accept & Continue" button is DISABLED again
- ✅ User must re-check to proceed

---

### TC-SAFETY-012-006: Disclaimer Loading State

**Objective:** Verify loading indicator shows while fetching disclaimer

**Steps:**
1. (Optional: Throttle network in emulator to simulate slow connection)
2. Trigger disclaimer modal
3. Observe initial state

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Text: "Loading disclaimer..."
- ✅ After load completes, content appears

---

### TC-SAFETY-012-007: Disclaimer Error State - No Policy

**Objective:** Verify error handling when no published disclaimer exists

**Setup:**
```sql
-- Archive all disclaimers temporarily
UPDATE platform_policies
SET status = 'archived'
WHERE policy_type = 'liability_disclaimer';
```

**Steps:**
1. Trigger disclaimer modal
2. Observe error state

**Expected Results:**
- ✅ Error icon (⚠️) displayed
- ✅ Error message: "Liability Disclaimer not available. Please contact support."
- ✅ No "Accept" button shown

**Cleanup:**
```sql
-- Restore disclaimer
UPDATE platform_policies
SET status = 'published'
WHERE policy_type = 'liability_disclaimer'
  AND version = '1.0';
```

---

### TC-SAFETY-012-008: Admin - Create Liability Disclaimer

**Objective:** Verify admin can create new disclaimer versions

**Steps:**
1. Log in to Admin Portal (p2p-kids-admin)
2. Navigate to Settings → Policies
3. Switch to "Liability Disclaimer" tab
4. Tap "Create New Version"
5. Fill in:
   - Version: "1.1"
   - Title: "Updated Liability Disclaimer"
   - Content: (Add markdown content)
   - Effective Date: (Select future date)
6. Tap "Save Draft"
7. Tap "Publish"

**Expected Results:**
- ✅ New version appears in list
- ✅ Status: "published"
- ✅ Previous version auto-archived
- ✅ Mobile app now shows v1.1 when fetching disclaimer

---

### TC-SAFETY-012-009: Accessibility - Disclaimer Modal

**Objective:** Verify screen reader support

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Open disclaimer modal
3. Navigate through elements

**Expected Results:**
- ✅ Modal title announced: "Liability Disclaimer"
- ✅ Checkbox label announced: "I have read and understand this disclaimer"
- ✅ Accept button: "Accept and continue" (with disabled state announced)
- ✅ Cancel button: "Cancel purchase"
- ✅ Close button: "Close disclaimer"

---

### TC-SAFETY-012-010: Policy Acceptance Audit Trail

**Objective:** Verify acceptances are tracked in policy_acceptances table

**Steps:**
1. Complete a trade (accept disclaimer)
2. Query database:

```sql
SELECT 
  pa.id,
  pa.user_id,
  pa.policy_type,
  pa.policy_version,
  pa.accepted_at,
  pa.ip_address,
  pa.user_agent
FROM policy_acceptances pa
WHERE pa.user_id = '<test-user-id>'
  AND pa.policy_type = 'liability_disclaimer'
ORDER BY pa.accepted_at DESC
LIMIT 1;
```

**Expected Results:**
- ✅ Row exists with correct user_id
- ✅ policy_type = 'liability_disclaimer'
- ✅ policy_version matches current version
- ✅ accepted_at timestamp set
- ✅ (Optional) ip_address and user_agent populated

---

### TC-SAFETY-012-011: Multiple Acceptances (Same User, Different Trades)

**Objective:** Verify disclaimer can be accepted multiple times for different trades

**Steps:**
1. Complete Trade 1 (accept disclaimer)
2. Complete Trade 2 (accept disclaimer again)
3. Query database:

```sql
SELECT COUNT(*) as acceptance_count
FROM policy_acceptances
WHERE user_id = '<test-user-id>'
  AND policy_type = 'liability_disclaimer';

SELECT 
  t.id as trade_id,
  t.disclaimer_policy_id,
  t.disclaimer_acknowledged_at
FROM trades t
WHERE t.buyer_id = '<test-user-id>'
  AND t.disclaimer_acknowledged = TRUE
ORDER BY t.created_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ Each trade has disclaimer_acknowledged = TRUE
- ✅ policy_acceptances may have multiple rows (one per version accepted)
- ✅ All trades link to correct policy_id

---

### TC-SAFETY-012-012: Disclaimer Not Shown for Non-Trade Actions

**Objective:** Verify disclaimer only appears during trade initiation (not listing creation, etc.)

**Steps:**
1. Create a new listing
2. Edit profile
3. Browse items
4. View SP Wallet

**Expected Results:**
- ✅ Disclaimer modal does NOT appear for non-trade actions
- ✅ Disclaimer ONLY appears when initiating a purchase/trade

---

## 🚨 KNOWN ISSUES / LIMITATIONS

1. **Network Errors:** If RPC fails mid-modal, user sees error screen with Retry button
2. **SP Wallet State:** Disclaimer acceptance is independent of wallet state (not gated)
3. **Admin Edits:** Changing disclaimer content does NOT retroactively affect past acceptances (by design)

---

## 📊 TEST SUMMARY CHECKLIST

**Pre-Testing Setup:**
- [ ] Database migration 307 applied
- [ ] Published liability disclaimer exists
- [ ] RPC functions verified

**Core Functionality:**
- [ ] TC-001: View from Settings
- [ ] TC-002: Accept during trade (happy path)
- [ ] TC-003: Cancel disclaimer
- [ ] TC-004: Close button
- [ ] TC-005: Checkbox reset
- [ ] TC-006: Loading state
- [ ] TC-007: Error state
- [ ] TC-008: Admin create/publish

**Advanced:**
- [ ] TC-009: Accessibility
- [ ] TC-010: Audit trail
- [ ] TC-011: Multiple acceptances
- [ ] TC-012: Disclaimer scope (trade only)

**Test Platforms:**
- [ ] iOS Simulator
- [ ] Android Emulator

---

## 🐛 REPORTING ISSUES

If any test fails, report with:
- Test Case ID
- Platform (iOS/Android)
- Steps to reproduce
- Expected vs Actual result
- Screenshots/logs if applicable

---

**Testing Complete:** ___________  
**Tester Name:** ___________  
**Date:** ___________
