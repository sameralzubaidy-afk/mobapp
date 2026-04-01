# SAFETY-010: TOS System - Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-010 - Implement Admin-Managed Terms of Service (TOS) System  
**Test Date:** ___________  
**Tester:** ___________  
**Environment:** □ iOS Simulator □ Android Emulator  

---

## Pre-Test Setup

### Database Setup
Before testing, run this SQL in Supabase SQL Editor:

```sql
-- Verify tables exist
SELECT COUNT(*) FROM platform_policies;
SELECT COUNT(*) FROM policy_acceptances;

-- Check if TOS is published
SELECT id, version, status, title FROM platform_policies 
WHERE policy_type = 'terms_of_service' AND status = 'published';

-- If no published TOS exists, create one:
-- INSERT INTO platform_policies (policy_type, version, title, content, status, effective_date, created_by)
-- VALUES ('terms_of_service', '1.0', 'Kids P2P Marketplace Terms of Service', 
--         '# Terms of Service\n\n## 1. Acceptance\n\nBy using this service...',
--         'published', NOW(), (SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1));
```

### Test Accounts Required
- ✅ Admin account (for admin portal testing)
- ✅ Fresh user account (for signup acceptance testing)
- ✅ Existing user account (for settings navigation)

---

## Admin Portal Test Cases

### TC-ADMIN-001: View Policies Dashboard
**Precondition:** Logged in as admin  
**Steps:**
1. Navigate to Admin Portal
2. Go to Settings → Policies
3. Verify tabs visible: "Terms of Service", "Privacy Policy", "Liability Disclaimer"

**Expected Result:**
- ✅ All three tabs visible and clickable
- ✅ Current published TOS (if any) shown with green border
- ✅ "Create New Version" button present

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-002: Create New TOS Draft
**Precondition:** On Policies page  
**Steps:**
1. Click "Create New Version" under Terms of Service tab
2. Fill in form:
   - Title: "Kids P2P Marketplace Terms of Service"
   - Version: "1.1"
   - Effective Date: [Future date]
   - Content: [Sample markdown content with headings, lists]
3. Click "Create Draft"

**Expected Result:**
- ✅ Draft created successfully
- ✅ Redirected back to Policies page
- ✅ New draft appears in "All Versions" list with "draft" status
- ✅ Alert/toast message: "Policy created successfully as draft"

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-003: View Draft Policy
**Precondition:** Draft policy exists  
**Steps:**
1. Click "View" button on draft policy
2. Verify policy details displayed

**Expected Result:**
- ✅ Policy title, version, status shown
- ✅ Full content displayed in readable format
- ✅ Metadata shown: Effective Date, Published status, Created date
- ✅ "Edit" and "Publish" buttons visible

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-004: Edit Draft Policy
**Precondition:** Viewing draft policy  
**Steps:**
1. Click "Edit" button
2. Modify title and content
3. Save changes

**Expected Result:**
- ✅ Changes saved successfully
- ✅ Updated title/content visible

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-005: Publish Policy
**Precondition:** Draft policy exists  
**Steps:**
1. Open draft policy
2. Click "Publish" button
3. Confirm in dialog

**Expected Result:**
- ✅ Confirmation dialog appears: "Are you sure you want to publish this policy?"
- ✅ After confirming, policy status changes to "published"
- ✅ Previous published version (if any) archived
- ✅ Alert: "Policy published successfully"
- ✅ Published_at timestamp set
- ✅ Effective_date populated (if not already set)

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-006: Published Policy Cannot Be Edited
**Precondition:** Policy is published  
**Steps:**
1. View published policy
2. Check for Edit button

**Expected Result:**
- ✅ No "Edit" button visible on published policy
- ✅ Only "View" button available
- ✅ Policy marked with green "Active" indicator

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-ADMIN-007: Version Uniqueness Validation
**Precondition:** On Create New Policy page  
**Steps:**
1. Create policy with version "1.0"
2. Try to create another policy with same version "1.0"

**Expected Result:**
- ✅ Second creation fails
- ✅ Error message: "A policy with this type and version already exists"

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

## Mobile App Test Cases

### TC-MOBILE-001: View TOS from Settings
**Precondition:** Logged in user  
**Steps:**
1. Navigate to Profile tab
2. Tap Settings
3. Tap "Terms of Service"

**Expected Result:**
- ✅ TOS screen opens
- ✅ Policy title displayed
- ✅ Version number shown (e.g., "Version 1.0")
- ✅ Effective date shown
- ✅ Full content scrollable
- ✅ NO "Accept" or "Decline" buttons (read-only mode)
- ✅ Back button returns to Settings

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-002: TOS Link on Signup Screen
**Precondition:** Fresh app install or logged out  
**Steps:**
1. Open app
2. Navigate to Signup screen
3. Scroll to bottom

**Expected Result:**
- ✅ Text visible: "By signing up, you agree to our Terms of Service and Privacy Policy"
- ✅ "Terms of Service" is a tappable link (different styling)

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-003: Open TOS from Signup Link
**Precondition:** On signup screen  
**Steps:**
1. Tap "Terms of Service" link

**Expected Result:**
- ✅ TOS screen opens
- ✅ Policy content displayed
- ✅ Accept and Decline buttons visible at bottom
- ✅ Content scrollable

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-004: Accept TOS from Signup
**Precondition:** TOS screen open from signup with acceptance required  
**Steps:**
1. Scroll through TOS content
2. Tap "I Accept" button
3. Wait for processing

**Expected Result:**
- ✅ Button shows loading indicator briefly
- ✅ Returns to Signup screen
- ✅ Alert (optional): "You have accepted the Terms of Service"
- ✅ No error displayed

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-005: Decline TOS from Signup
**Precondition:** TOS screen open from signup  
**Steps:**
1. Tap "Decline" button

**Expected Result:**
- ✅ Returns to Signup screen immediately
- ✅ No acceptance recorded
- ✅ User can re-open TOS

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-006: TOS Acceptance Persisted
**Precondition:** User accepted TOS from signup  
**Steps:**
1. Check database:
   ```sql
   SELECT * FROM policy_acceptances 
   WHERE user_id = '[USER_ID]' 
   AND policy_type = 'terms_of_service';
   ```

**Expected Result:**
- ✅ Record exists in policy_acceptances table
- ✅ policy_id matches current published TOS
- ✅ accepted_at timestamp is recent
- ✅ policy_version matches current version

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-MOBILE-007: Scroll TOS Content
**Precondition:** TOS screen open  
**Steps:**
1. Scroll down through all content
2. Scroll back up
3. Verify content loads smoothly

**Expected Result:**
- ✅ Content scrolls smoothly
- ✅ No performance issues
- ✅ All text readable
- ✅ Formatting preserved (headings, paragraphs)

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

## Edge Cases & Error Handling

### TC-EDGE-001: No Published TOS Available
**Precondition:** Archive all published TOS in database  
**Steps:**
1. Try to open TOS from app

**Expected Result:**
- ✅ Error message displayed: "Terms of Service not available"
- ✅ App does not crash
- ✅ User can navigate back

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-EDGE-002: Network Error During TOS Load
**Precondition:** Enable airplane mode  
**Steps:**
1. Try to open TOS from app

**Expected Result:**
- ✅ Error message displayed: "Failed to load Terms of Service"
- ✅ App does not crash
- ✅ User can retry or go back

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-EDGE-003: Accept TOS While Offline
**Precondition:** TOS screen open, then enable airplane mode  
**Steps:**
1. Tap "I Accept"

**Expected Result:**
- ✅ Error message: "Failed to record acceptance. Please try again."
- ✅ Button re-enables for retry
- ✅ App remains functional

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-EDGE-004: Very Long TOS Content
**Precondition:** Create TOS with 10,000+ words  
**Steps:**
1. Open TOS screen
2. Scroll through entire content

**Expected Result:**
- ✅ Content loads without lag
- ✅ Scroll performs smoothly
- ✅ Memory usage reasonable
- ✅ Accept button remains accessible at bottom

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

## RPC Function Tests

### TC-RPC-001: get_current_policy
**Steps:**
1. Run in Supabase SQL Editor:
   ```sql
   SELECT * FROM get_current_policy('terms_of_service');
   ```

**Expected Result:**
- ✅ Returns current published TOS
- ✅ Includes: id, policy_type, version, title, content, effective_date
- ✅ Returns only ONE policy (latest)

**Result:** □ PASS □ FAIL  
**SQL Output:** _________________________________

---

### TC-RPC-002: has_accepted_current_policy
**Steps:**
1. Run after user accepts TOS:
   ```sql
   SELECT has_accepted_current_policy('[USER_ID]', 'terms_of_service');
   ```

**Expected Result:**
- ✅ Returns TRUE after acceptance
- ✅ Returns FALSE before acceptance
- ✅ Returns TRUE if no published policy exists

**Result:** □ PASS □ FAIL  
**SQL Output:** _________________________________

---

### TC-RPC-003: record_policy_acceptance
**Steps:**
1. Run:
   ```sql
   SELECT record_policy_acceptance(
     '[USER_ID]',
     '[POLICY_ID]',
     '192.168.1.1',
     'Mozilla/5.0 Test'
   );
   ```

**Expected Result:**
- ✅ Returns acceptance UUID
- ✅ Record inserted into policy_acceptances
- ✅ Idempotent (can run twice without error)

**Result:** □ PASS □ FAIL  
**SQL Output:** _________________________________

---

### TC-RPC-004: publish_policy (Admin Only)
**Steps:**
1. As admin user:
   ```sql
   SELECT publish_policy('[POLICY_ID]', '[ADMIN_USER_ID]');
   ```
2. As non-admin user (should fail):
   ```sql
   SELECT publish_policy('[POLICY_ID]', '[REGULAR_USER_ID]');
   ```

**Expected Result:**
- ✅ Admin: Returns TRUE, policy published
- ✅ Non-admin: Error "Unauthorized: Only admins can publish policies"

**Result:** □ PASS □ FAIL  
**SQL Output:** _________________________________

---

## RLS Policy Tests

### TC-RLS-001: Published Policies Visible to All
**Steps:**
1. As unauthenticated user:
   ```sql
   SELECT * FROM platform_policies WHERE status = 'published';
   ```

**Expected Result:**
- ✅ Returns published policies
- ✅ No authentication error

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-RLS-002: Draft Policies Hidden from Non-Admins
**Steps:**
1. As regular user (not admin):
   ```sql
   SELECT * FROM platform_policies WHERE status = 'draft';
   ```

**Expected Result:**
- ✅ Returns empty result (or only admin-created visible to admins)
- ✅ Regular users cannot see drafts

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

### TC-RLS-003: Users Can View Own Acceptances
**Steps:**
1. As user:
   ```sql
   SELECT * FROM policy_acceptances WHERE user_id = auth.uid();
   ```

**Expected Result:**
- ✅ Returns user's own acceptances
- ✅ Does NOT return other users' acceptances

**Result:** □ PASS □ FAIL  
**Notes:** _________________________________

---

## Summary

**Total Test Cases:** 20+ (Admin: 7, Mobile: 7, Edge: 4, RPC: 4, RLS: 3)  
**Passed:** ____  
**Failed:** ____  
**Blocked:** ____  

**Critical Issues Found:**
_________________________________________
_________________________________________

**Sign-off:**
- □ All critical paths tested and passing
- □ RLS policies verified
- □ Admin functions working
- □ Mobile UX acceptable
- □ Ready for production

**Tester Signature:** _______________ **Date:** ___________
