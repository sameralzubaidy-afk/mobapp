# BADGE-013: ID Badge Status Display on User Profile - Manual Testing Guide

**Module:** MODULE-10-ID-BADGE-VERIFICATION-V2.md  
**Task:** BADGE-013 - ID Badge Status Display on User Profile  
**Last Updated:** February 10, 2026  
**Platform:** iOS & Android Simulators  
**Test Environment:** Supabase Production

---

## 📋 Prerequisites

Before starting manual testing, ensure:

- ✅ **App installed** on iOS Simulator or Android Emulator
- ✅ **Supabase Production** configured (`.env.local` with correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`)
- ✅ **Database migration** `20260208000000_id_badge_verification_system.sql` applied to production
- ✅ **Test users created** (at least 2: 1 regular user, 1 admin)
- ✅ **IDVerificationUploadScreen** navigation working (tested in BADGE-009)
- ✅ **Admin panel** accessible at your admin URL (tested in BADGE-010)

### Test User Setup

Create these test users in Supabase:

1. **Regular User** (for profile display testing)
   - Email: `test-user-badge13@example.com`
   - Password: `Test123!@#`
   - Role: `user` (default)

2. **Admin User** (for approval/rejection testing)
   - Email: `admin-badge13@example.com`
   - Password: `Admin123!@#`
   - Role: `admin` (set in `profiles.role` or `users.role`)

---

## 🧪 Test Cases

### **TC1: Default State - No Verification Request**

**Purpose:** Verify profile displays "Upgrade to Verified" CTA when user has no verification request

**Steps:**
1. Login as `test-user-badge13@example.com`
2. Navigate to **Profile** tab (bottom navigation)
3. Scroll down to **Identity Verification** section

**Expected Results:**
- ✅ Section title: "Identity Verification"
- ✅ Shield emoji (🛡️) displayed
- ✅ Button text: "Upgrade to Verified"
- ✅ Subtext: "Build trust and unlock exclusive features"
- ✅ Background color: Light blue (`#EFF6FF`)
- ✅ Border color: Blue (`#3B82F6`)
- ✅ Button is tappable (no disabled state)

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC2: Navigation to Upload Screen from CTA**

**Purpose:** Verify tapping "Upgrade to Verified" navigates to upload screen

**Steps:**
1. From Profile screen (TC1 state)
2. Tap **"Upgrade to Verified"** button

**Expected Results:**
- ✅ Navigates to `IDVerificationUploadScreen`
- ✅ Upload screen displays disclaimer text
- ✅ Camera/Gallery picker options visible
- ✅ Back button returns to Profile screen

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC3: Pending Status Display**

**Purpose:** Verify profile displays "Pending Approval" badge when user has submitted verification request

**Setup:**
1. Login as test user
2. Navigate to Profile → **Upgrade to Verified**
3. Upload an ID photo and submit
4. Wait for submission confirmation
5. Return to Profile screen

**Steps:**
1. From Profile screen, locate **Identity Verification** section

**Expected Results:**
- ✅ Hourglass emoji (⏳) displayed
- ✅ Text: "Verification Pending"
- ✅ Subtext: Dynamic text from `pending_status_text` configurable message (default: "We're reviewing your ID. Usually within 24h.")
- ✅ Background color: Light yellow (`#FFFBEB`)
- ✅ Border color: Orange (`#F59E0B`)
- ✅ Section is tappable (navigates to upload screen with "Already Pending" message)

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC4: Pending Status - Submission Date Display**

**Purpose:** Verify submission date is shown for pending requests

**Steps:**
1. Stay on Profile screen with pending status (TC3)
2. Check if submission timestamp is visible

**Expected Results:**
- ✅ Subtext includes submission date context (e.g., "We're reviewing your ID. Usually within 24h.")
- ✅ Text updates dynamically from database configurable message

**Note:** Current implementation does NOT display explicit submission date in the pending badge subtext. The date is available in the backend (`submitted_at`) but not rendered in UI. This follows the module spec's "subtle badge" requirement.

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC5: Approved Status Display**

**Purpose:** Verify profile displays "Identity Verified" badge after admin approval

**Setup:**
1. While user has pending request (TC3)
2. Login to **Admin Panel** as admin
3. Navigate to `/id-badges` queue
4. Find the test user's pending request
5. Click **Review** → **Approve** with optional notes → Submit
6. Return to mobile app

**Steps:**
1. Force close and reopen the app (or pull to refresh Profile screen)
2. Navigate to Profile tab
3. Locate **Identity Verification** section

**Expected Results:**
- ✅ Green checkmark emoji (✅) displayed
- ✅ Text: "Identity Verified"
- ✅ Subtext: "Your account is shielded with ultimate trust"
- ✅ Background color: Light green (`#ECFDF5`)
- ✅ Border color: Green (`#10B981`)
- ✅ Section is NOT tappable (no navigation on tap)
- ✅ "Upgrade to Verified" CTA is hidden

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC6: Approved Status - Review Date Display**

**Purpose:** Verify approved status shows review completion date

**Steps:**
1. Stay on Profile screen with approved status (TC5)
2. Check if reviewed date is visible

**Expected Results:**
- ✅ Subtext displays static message (does NOT include explicit date)
- ✅ Approved badge persists across app restarts

**Note:** Current implementation does NOT display `reviewed_at` timestamp in the approved badge UI. The date is stored in the database but not rendered on the profile screen for approved status. This is intentional per the minimal UI spec.

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC7: Rejected Status Display**

**Purpose:** Verify profile displays rejection badge with reason after admin rejection

**Setup:**
1. Create a new test user or delete existing verification requests for test user
2. Submit a new ID verification request
3. Login to Admin Panel
4. Navigate to `/id-badges` queue → Find request → **Review**
5. Select **Reject** → Choose reason: **"unclear_photo"** → Add notes: "Please retake with better lighting" → Submit
6. Return to mobile app

**Steps:**
1. Force close and reopen the app (or pull to refresh Profile screen)
2. Navigate to Profile tab
3. Locate **Identity Verification** section

**Expected Results:**
- ✅ Red X emoji (❌) displayed
- ✅ Text: "Verification Rejected"
- ✅ Subtext: "Reason: [unclear photo]. Tap to try again."
- ✅ Background color: Light red (`#FEF2F2`)
- ✅ Border color: Red (`#EF4444`)
- ✅ Section is tappable (navigates to upload screen)
- ✅ Rejection reason formatted with spaces (e.g., "unclear photo" instead of "unclear_photo")

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC8: Rejected Status - Admin Notes Display**

**Purpose:** Verify admin rejection notes are displayed to user

**Steps:**
1. Stay on Profile screen with rejected status (TC7)
2. Read the subtext carefully

**Expected Results:**
- ✅ Subtext displays: "Reason: [rejection_reason]. Tap to try again."
- ✅ If `rejection_notes` is present, it SHOULD be visible (check implementation)

**Note:** Current ProfileScreen.tsx implementation shows `rejectionReason` in subtext but does NOT show `rejection_notes`. The notes are stored in DB but not displayed on profile. Users see notes in rejection email/notification instead.

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC9: Resubmit Flow after Rejection**

**Purpose:** Verify tapping rejected badge navigates to upload screen for resubmission

**Steps:**
1. From Profile screen with rejected status (TC7)
2. Tap the **Verification Rejected** section

**Expected Results:**
- ✅ Navigates to `IDVerificationUploadScreen`
- ✅ Upload screen allows new photo selection
- ✅ User can submit a new verification request
- ✅ Old rejected request remains in history (database)
- ✅ New request creates a separate row in `id_badge_verification_requests` with `status='pending'`

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC10: Dynamic Pending Text from Configurable Messages**

**Purpose:** Verify pending status subtext loads from `id_badge_verification_messages` table

**Setup:**
1. Before submitting verification, update the `pending_status_text` in database:
   ```sql
   UPDATE id_badge_verification_messages
   SET message_text = 'Custom pending message for testing!'
   WHERE message_key = 'pending_status_text';
   ```

**Steps:**
1. Submit ID verification request as test user
2. Return to Profile screen

**Expected Results:**
- ✅ Pending badge subtext displays: "Custom pending message for testing!"
- ✅ Text updates dynamically without app rebuild

**Cleanup:**
```sql
UPDATE id_badge_verification_messages
SET message_text = 'We''re reviewing your ID. Usually within 24h.'
WHERE message_key = 'pending_status_text';
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC11: Multiple Verification Requests - Most Recent Display**

**Purpose:** Verify profile shows the most recent verification request status

**Setup:**
1. Create multiple verification requests for same user in database:
   ```sql
   -- Old rejected request (2 days ago)
   INSERT INTO id_badge_verification_requests (user_id, status, submitted_at, reviewed_at, rejection_reason, first_name, last_name, email)
   VALUES ('[test-user-id]', 'rejected', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'unclear_photo', 'Test', 'User', 'test@example.com');

   -- New pending request (now)
   INSERT INTO id_badge_verification_requests (user_id, status, submitted_at, first_name, last_name, email)
   VALUES ('[test-user-id]', 'pending', NOW(), 'Test', 'User', 'test@example.com');
   ```

**Steps:**
1. Login as test user
2. Navigate to Profile tab

**Expected Results:**
- ✅ Profile displays **Pending** status (most recent request)
- ✅ Old rejected request is NOT displayed
- ✅ History of old requests is preserved in database

**Cleanup:**
```sql
DELETE FROM id_badge_verification_requests WHERE user_id = '[test-user-id]';
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC12: App Restart Persistence**

**Purpose:** Verify verification status persists across app restarts

**Steps:**
1. From Profile screen with any status (pending/approved/rejected)
2. Force close the app completely
3. Reopen the app
4. Navigate to Profile tab

**Expected Results:**
- ✅ Verification status loads correctly from database
- ✅ Badge displays same state as before restart
- ✅ No loading flicker or "Upgrade to Verified" flash before status loads

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC13: Loading State Handling**

**Purpose:** Verify profile handles loading state gracefully

**Steps:**
1. Logout from app
2. Login as test user
3. Immediately navigate to Profile tab (before full profile load completes)

**Expected Results:**
- ✅ Profile screen shows loading indicator OR default state (not error)
- ✅ Verification section renders after profile data loads
- ✅ No crash or blank screen during load

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC14: Error Handling - Network Failure**

**Purpose:** Verify profile handles network errors gracefully

**Setup:**
1. Enable airplane mode or disable Wi-Fi on simulator

**Steps:**
1. Login as test user (cache may work)
2. Navigate to Profile tab
3. Observe verification section

**Expected Results:**
- ✅ Profile screen does NOT crash
- ✅ Verification section either:
  - Shows cached status (if available), OR
  - Shows default "Upgrade to Verified" CTA, OR
  - Shows error message
- ✅ No infinite loading spinner
- ✅ User can retry by pulling to refresh

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC15: UI Styling Consistency**

**Purpose:** Verify all badge states follow design specifications

**Steps:**
1. Test each status state (none, pending, approved, rejected)
2. Verify colors, spacing, typography

**Expected Results:**

| Status | Icon | Background | Border | Text Color | Font Weight |
|--------|------|------------|--------|------------|-------------|
| None (Upgrade) | 🛡️ | `#EFF6FF` | `#3B82F6` | `#3B82F6` | Bold (700) |
| Pending | ⏳ | `#FFFBEB` | `#F59E0B` | `#D97706` | Bold (700) |
| Approved | ✅ | `#ECFDF5` | `#10B981` | `#10B981` | Bold (700) |
| Rejected | ❌ | `#FEF2F2` | `#EF4444` | `#EF4444` | Bold (700) |

- ✅ Padding: 16px on all sides
- ✅ Border radius: 12px
- ✅ Border width: 1px
- ✅ Icon size: 24pt (fontSize)
- ✅ Main text: 16pt
- ✅ Subtext: 12pt

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC16: Accessibility - Screen Reader Support**

**Purpose:** Verify verification badge is accessible to screen readers

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate to Profile screen
3. Focus on Identity Verification section

**Expected Results:**
- ✅ Section is focusable by screen reader
- ✅ Button/section announces status correctly (e.g., "Upgrade to Verified, button" or "Verification Pending, button")
- ✅ Subtext is read aloud

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC17: Edge Case - Missing Database Record**

**Purpose:** Verify app handles missing verification status gracefully

**Setup:**
1. In database, delete ALL verification requests for test user:
   ```sql
   DELETE FROM id_badge_verification_requests WHERE user_id = '[test-user-id]';
   ```

**Steps:**
1. Login as test user
2. Navigate to Profile tab

**Expected Results:**
- ✅ Profile displays "Upgrade to Verified" CTA (default state)
- ✅ No error or crash

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC18: Rapid Status Changes**

**Purpose:** Verify profile updates correctly when admin changes status quickly

**Steps:**
1. Submit verification request as user
2. Go to Admin Panel → Approve request
3. Return to app → Verify status = "Approved"
4. Go to Admin Panel → Manually update request to `status='rejected'` in database
5. Return to app → Force refresh profile (pull to refresh)

**Expected Results:**
- ✅ Profile updates to show rejected status
- ✅ No stale "Approved" badge persists

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC19: Android-Specific Styling**

**Purpose:** Verify badge displays correctly on Android

**Platform:** Android Emulator

**Steps:**
1. Repeat TC1, TC3, TC5, TC7 on Android emulator

**Expected Results:**
- ✅ All badge states render correctly on Android
- ✅ Emojis display properly (no missing glyphs)
- ✅ Border radius and shadows render consistently
- ✅ Touch targets are >= 48dp (Android accessibility)

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

### **TC20: iOS-Specific Styling**

**Purpose:** Verify badge displays correctly on iOS

**Platform:** iOS Simulator

**Steps:**
1. Repeat TC1, TC3, TC5, TC7 on iOS simulator

**Expected Results:**
- ✅ All badge states render correctly on iOS
- ✅ Emojis display properly
- ✅ Border radius and shadows render consistently (iOS shadow vs Android elevation)
- ✅ Touch targets are >= 44pt (iOS accessibility)

**Actual Results:**
- [ ] Pass / [ ] Fail
- **Notes:**

---

## 📊 Test Summary

| Test Case | Description | Status | Notes |
|-----------|-------------|--------|-------|
| TC1 | Default State - No Verification | ⬜ | |
| TC2 | Navigation to Upload Screen | ⬜ | |
| TC3 | Pending Status Display | ⬜ | |
| TC4 | Pending Status - Submission Date | ⬜ | |
| TC5 | Approved Status Display | ⬜ | |
| TC6 | Approved Status - Review Date | ⬜ | |
| TC7 | Rejected Status Display | ⬜ | |
| TC8 | Rejected Status - Admin Notes | ⬜ | |
| TC9 | Resubmit Flow after Rejection | ⬜ | |
| TC10 | Dynamic Pending Text | ⬜ | |
| TC11 | Multiple Requests - Most Recent | ⬜ | |
| TC12 | App Restart Persistence | ⬜ | |
| TC13 | Loading State Handling | ⬜ | |
| TC14 | Error Handling - Network Failure | ⬜ | |
| TC15 | UI Styling Consistency | ⬜ | |
| TC16 | Accessibility - Screen Reader | ⬜ | |
| TC17 | Edge Case - Missing Record | ⬜ | |
| TC18 | Rapid Status Changes | ⬜ | |
| TC19 | Android-Specific Styling | ⬜ | |
| TC20 | iOS-Specific Styling | ⬜ | |

**Legend:**
- ⬜ Not Tested
- ✅ Pass
- ❌ Fail

---

## 🐛 Known Issues / Limitations

1. **Submission Date Not Displayed:** The pending badge does not show explicit submission date/time. Only dynamic message from `pending_status_text`.

2. **Admin Notes Not in Profile:** Rejection notes are stored in DB but NOT displayed in profile badge subtext. Users see notes in rejection email/notification only.

3. **No Inline History:** Profile does not show full verification history. Only the most recent request status is displayed.

---

## ✅ Acceptance Criteria

All test cases (TC1-TC20) must pass with no critical failures before marking BADGE-013 as **VERIFIED**.

**Blocker Issues:**
- Profile crash on status load
- Incorrect status display (shows approved when rejected)
- Navigation failure (CTA does not navigate)
- Data persistence failure (status does not load after restart)

**Non-Blocker Issues:**
- Minor styling inconsistencies (color shade off by 1-2%)
- Loading delay > 1 second (with network connectivity)
- Emoji rendering differences between platforms

---

## 📝 Test Execution Log

**Tester:** _______________________  
**Date:** _____________  
**Environment:** Staging / Production (circle one)  
**Devices Tested:**
- [ ] iOS Simulator (version: _______)
- [ ] Android Emulator (version: _______)

**Overall Result:**
- [ ] All tests passed ✅
- [ ] Some tests failed (list below) ⚠️
- [ ] Critical failures (blocker) ❌

**Failed Tests:**
- _______________________________________
- _______________________________________

**Additional Notes:**
________________________________________________________________________
________________________________________________________________________
________________________________________________________________________

---

**BADGE-013 Manual Testing Complete**
