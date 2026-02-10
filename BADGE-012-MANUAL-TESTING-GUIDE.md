# BADGE-012 Manual Testing Guide

**Task:** Admin Configurable Messages for ID Badge System  
**Module:** MODULE-10-ID-BADGE-VERIFICATION-V2.md  
**Date:** February 10, 2026  
**Environment:** iOS Simulator & Android Emulator  
**Database:** Supabase Production

---

## Prerequisites

### Database Setup
Run this SQL in Supabase SQL Editor (Production) **BEFORE** testing:

```sql
-- 1. Verify messages table exists with 12 rows
SELECT COUNT(*) as total_messages FROM id_badge_verification_messages;
-- Expected: 12

-- 2. Show all message keys and descriptions
SELECT 
  id, 
  message_key, 
  LEFT(message_text, 50) as preview, 
  description,
  supports_variables
FROM id_badge_verification_messages 
ORDER BY message_key;

-- 3. Verify RLS policies exist
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'id_badge_verification_messages';
-- Expected: SELECT (public), UPDATE (admin or service_role)

-- 4. Test template variable in one message
SELECT message_text 
FROM id_badge_verification_messages 
WHERE message_key = 'approved_email_body' 
  AND message_text LIKE '%{first_name}%';
-- Expected: 1 row (should contain {first_name} placeholder)
```

### Admin Portal Access
- URL: `http://localhost:3000` (or your staging URL)
- Ensure you're logged in as admin
- Navigate to top nav bar and verify "ID Messages" link exists

---

## Test Case 1: Page Load and Display

**Objective:** Verify messages configuration page loads correctly

**Steps:**
1. Open admin portal and login
2. Click "ID Messages" in top navigation bar
3. Observe page loads

**Expected Results:**
- ✅ Page title: "ID Badge Verification Messages"
- ✅ Template variables reference box displayed (blue background)
- ✅ All 4 template variables listed: `{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`
- ✅ All 12 messages displayed in cards
- ✅ Each card shows: message_key (code-style), description, current text, Edit button
- ✅ "Back to Queue" button visible in header
- ✅ No loading spinner after ~2 seconds
- ✅ No error messages

**Pass Criteria:** All items checked

---

## Test Case 2: Message Display Format

**Objective:** Verify each message card displays correctly

**Steps:**
1. Scroll through all 12 message cards
2. Inspect each card structure

**Expected Results for Each Card:**
- ✅ Message key in monospace font (e.g., `upload_disclaimer`)
- ✅ Description text readable and matches database
- ✅ Current message text displayed in gray box with monospace font
- ✅ "Edit" button visible and enabled
- ✅ If message supports variables: blue checkmark "✓ Supports template variables" text
- ✅ Last updated timestamp shown (if updated_at exists)
- ✅ No overlapping or truncated text

**Verify These Specific Message Keys Exist:**
- `upload_disclaimer`
- `submit_button_label`
- `pending_status_text`
- `in_app_submission_notification`
- `approved_email_subject`
- `approved_email_body`
- `rejected_email_subject`
- `rejected_email_body`
- `in_app_approved_notification`
- `in_app_rejected_notification`
- `web_push_approved`
- `web_push_rejected`

**Pass Criteria:** All 12 messages visible with proper formatting

---

## Test Case 3: Edit Message — Happy Path

**Objective:** Successfully edit and save a message

**Steps:**
1. Find the card for `upload_disclaimer` message
2. Click "Edit" button
3. Observe textarea appears with current text
4. Modify text to: "TEST: Please upload a clear photo of your government-issued ID."
5. Click "Save" button
6. Wait for save operation to complete

**Expected Results:**
- ✅ Textarea appears with current text pre-filled
- ✅ "Save" and "Cancel" buttons replace "Edit" button
- ✅ Button shows "Saving..." while processing
- ✅ Success message appears: "✓ Saved successfully" (green background)
- ✅ Textarea disappears, new text displayed in view mode
- ✅ Last updated timestamp updates
- ✅ Success message auto-dismisses after 3 seconds
- ✅ No error messages

**Verification Query (run in Supabase SQL Editor):**
```sql
SELECT message_text, updated_at 
FROM id_badge_verification_messages 
WHERE message_key = 'upload_disclaimer';
```
Expected: message_text starts with "TEST:" and updated_at is recent

**Pass Criteria:** Message saved successfully and visible in UI + database

---

## Test Case 4: Edit Message — Cancel

**Objective:** Verify cancel functionality reverts changes

**Steps:**
1. Find any message card
2. Click "Edit" button
3. Change text to: "THIS SHOULD NOT BE SAVED"
4. Click "Cancel" button
5. Observe UI

**Expected Results:**
- ✅ Textarea disappears immediately
- ✅ Original text restored (no "THIS SHOULD NOT BE SAVED" visible)
- ✅ "Edit" button restored
- ✅ No changes saved to database
- ✅ No error or success messages

**Verification Query:**
```sql
SELECT message_text 
FROM id_badge_verification_messages 
WHERE message_text LIKE '%THIS SHOULD NOT BE SAVED%';
```
Expected: 0 rows

**Pass Criteria:** Cancel reverts without saving

---

## Test Case 5: Edit Message — Empty Text Validation

**Objective:** Verify validation prevents empty messages

**Steps:**
1. Click "Edit" on any message
2. Delete all text in textarea (make it completely empty)
3. Click "Save" button
4. Observe behavior

**Expected Results:**
- ✅ Alert dialog appears: "Message text cannot be empty"
- ✅ Save operation does NOT proceed
- ✅ Textarea remains in edit mode
- ✅ User can add text and try again
- ✅ Database not updated with empty text

**Verification Query:**
```sql
SELECT COUNT(*) 
FROM id_badge_verification_messages 
WHERE message_text = '' OR message_text IS NULL;
```
Expected: 0 rows

**Pass Criteria:** Validation prevents empty message saves

---

## Test Case 6: Edit Message with Template Variables

**Objective:** Verify template variables can be added and saved

**Steps:**
1. Find the `approved_email_body` message
2. Click "Edit"
3. Change text to include variables:
   ```
   Hi {first_name}, your ID verification is approved! Thank you for submitting. Verification completed within {approval_timeframe_hours} hours.
   ```
4. Click "Save"
5. Reload page

**Expected Results:**
- ✅ Save succeeds
- ✅ Template variables `{first_name}` and `{approval_timeframe_hours}` visible in saved text
- ✅ Variables NOT replaced with actual values (remain as placeholders)
- ✅ Blue checkmark "✓ Supports template variables" still shown
- ✅ After reload: text persists with variables intact

**Verification Query:**
```sql
SELECT message_text 
FROM id_badge_verification_messages 
WHERE message_key = 'approved_email_body';
```
Expected: Contains `{first_name}` and `{approval_timeframe_hours}` exactly as typed

**Pass Criteria:** Template variables saved as placeholders

---

## Test Case 7: Character Count Display

**Objective:** Verify character count updates dynamically

**Steps:**
1. Click "Edit" on any message
2. Type additional text in textarea
3. Observe character count below textarea

**Expected Results:**
- ✅ Character count displayed as "Character count: X"
- ✅ Count updates in real-time as user types
- ✅ Count accurate (matches actual text length)
- ✅ No lag or freezing

**Pass Criteria:** Character count working correctly

---

## Test Case 8: Multiple Messages Edit Sequence

**Objective:** Verify editing multiple messages in sequence

**Steps:**
1. Edit `upload_disclaimer` and save with "TEST 1"
2. Edit `submit_button_label` and save with "TEST 2"
3. Edit `pending_status_text` and save with "TEST 3"
4. Reload page
5. Verify all 3 changes persisted

**Expected Results:**
- ✅ Each save completes successfully
- ✅ No interference between edits
- ✅ All changes visible after reload
- ✅ No stale data displayed

**Verification Query:**
```sql
SELECT message_key, message_text 
FROM id_badge_verification_messages 
WHERE message_key IN ('upload_disclaimer', 'submit_button_label', 'pending_status_text');
```
Expected: All 3 contain "TEST" prefix

**Pass Criteria:** Multiple sequential edits work correctly

---

## Test Case 9: Back Navigation

**Objective:** Verify navigation back to ID Badges queue

**Steps:**
1. On messages page, click "← Back to Queue" button in header
2. Observe navigation

**Expected Results:**
- ✅ Navigates to `/id-badges` (queue page)
- ✅ Queue page loads successfully
- ✅ No console errors

**Pass Criteria:** Back navigation works

---

## Test Case 10: Template Variables Reference Box

**Objective:** Verify template variables help section

**Steps:**
1. Scroll to top of messages page
2. Locate blue box titled "📝 Template Variables"
3. Read all variable descriptions

**Expected Results:**
- ✅ Box has blue background (bg-blue-50)
- ✅ All 4 variables listed:
  - `{first_name}` — User's first name
  - `{rejection_reason}` — Reason for rejection (e.g., "unclear photo")
  - `{admin_notes}` — Additional notes from admin
  - `{approval_timeframe_hours}` — Expected approval time (default: 24)
- ✅ Variables displayed in monospace code style
- ✅ Descriptions clear and helpful

**Pass Criteria:** Help section complete and readable

---

## Test Case 11: Error Handling — Network Failure

**Objective:** Verify graceful error handling on save failure

**Steps:**
1. Open browser DevTools → Network tab
2. Enable "Offline" mode (simulate network failure)
3. Click "Edit" on any message
4. Change text and click "Save"
5. Observe error handling
6. Disable "Offline" mode

**Expected Results:**
- ✅ Save fails with error message
- ✅ Error message displayed in red box: "⚠️ Failed to save message"
- ✅ Textarea remains in edit mode (user doesn't lose changes)
- ✅ User can try again after network restored
- ✅ No app crash or blank screen

**Pass Criteria:** Error handled gracefully without data loss

---

## Test Case 12: RLS Policy Enforcement (Database Level)

**Objective:** Verify admin-only update permissions via RLS

**Steps:**
1. In Supabase SQL Editor, run as SERVICE_ROLE:
   ```sql
   -- This should succeed (service role bypasses RLS)
   UPDATE id_badge_verification_messages 
   SET message_text = 'RLS Test' 
   WHERE message_key = 'upload_disclaimer';
   ```

2. Create a test user with NO admin role
3. Attempt update as non-admin using anon key:
   ```sql
   -- This should FAIL with RLS policy violation
   UPDATE id_badge_verification_messages 
   SET message_text = 'Should Fail' 
   WHERE message_key = 'upload_disclaimer';
   ```

**Expected Results:**
- ✅ Service role update succeeds
- ✅ Non-admin update FAILS with RLS error
- ✅ Message text remains "RLS Test" (not "Should Fail")

**Pass Criteria:** RLS policies enforced correctly

---

## Test Case 13: Load Test — 12+ Messages Performance

**Objective:** Verify page performance with all messages

**Steps:**
1. Open browser DevTools → Performance tab
2. Start recording
3. Navigate to `/id-badges/messages`
4. Wait for full page load
5. Stop recording and review timeline

**Expected Results:**
- ✅ Initial page load < 2 seconds
- ✅ All 12 messages visible without scrolling performance issues
- ✅ No React render loops or excessive re-renders
- ✅ Smooth scrolling through cards
- ✅ Edit/Save actions < 1 second response time

**Pass Criteria:** Page performs well with all messages

---

## Test Case 14: Responsive Design (Optional)

**Objective:** Verify layout on different screen sizes

**Steps:**
1. Resize browser window to mobile width (375px)
2. Observe layout
3. Resize to tablet width (768px)
4. Resize back to desktop (1280px+)

**Expected Results:**
- ✅ Template variables box adapts to width
- ✅ Message cards stack vertically on mobile
- ✅ Text remains readable at all sizes
- ✅ Buttons accessible without horizontal scroll
- ✅ No overlapping content

**Pass Criteria:** Layout responsive across sizes

---

## Test Case 15: Integration with Notifications

**Objective:** Verify saved messages appear in actual notifications

**Prerequisites:**
- Complete BADGE-011 (Notifications) implementation
- Have a test user with pending ID verification

**Steps:**
1. Edit `in_app_approved_notification` message to: "CUSTOM: Your ID is verified! 🎉"
2. Save the change
3. As admin, approve a pending ID verification request
4. As the user, check in-app notifications

**Expected Results:**
- ✅ User receives notification with text "CUSTOM: Your ID is verified! 🎉"
- ✅ Confirms messages table is used for live notifications
- ✅ No fallback to hardcoded strings

**Verification Query:**
```sql
SELECT 
  n.title, 
  n.body,
  n.created_at
FROM notifications n
WHERE n.category = 'badges' 
  AND n.body LIKE '%CUSTOM%'
ORDER BY n.created_at DESC 
LIMIT 1;
```
Expected: Most recent notification contains "CUSTOM" text

**Pass Criteria:** Custom message appears in actual notification

---

## Test Case 16: Concurrency — Multiple Admins Editing

**Objective:** Verify behavior when multiple admins edit same message

**Steps:**
1. Open admin portal in two different browser tabs (Tab A and Tab B)
2. In Tab A: Edit `upload_disclaimer` and change to "VERSION A"
3. In Tab B: Edit `upload_disclaimer` (before refreshing) and change to "VERSION B"
4. Tab A: Click Save
5. Tab B: Click Save
6. Refresh both tabs

**Expected Results:**
- ✅ Both saves succeed (no locking error)
- ✅ Last save wins (VERSION B is persisted)
- ✅ After refresh, both tabs show VERSION B
- ✅ No data corruption
- ✅ Timestamp reflects latest save

**Note:** This is "last write wins" behavior (no optimistic locking implemented)

**Pass Criteria:** Concurrent edits handled without errors

---

## Test Case 17: SQL Injection Prevention

**Objective:** Verify input sanitization

**Steps:**
1. Click "Edit" on any message
2. Paste this malicious input:
   ```
   '; DROP TABLE id_badge_verification_messages; --
   ```
3. Click "Save"

**Expected Results:**
- ✅ Save succeeds (treating input as literal text)
- ✅ Message text contains the literal string (not executed as SQL)
- ✅ Table `id_badge_verification_messages` still exists
- ✅ No SQL injection vulnerability

**Verification Query:**
```sql
-- Table should still exist with 12 rows
SELECT COUNT(*) FROM id_badge_verification_messages;
```
Expected: 12 rows (table not dropped)

**Pass Criteria:** SQL injection prevented

---

## Test Case 18: XSS Prevention

**Objective:** Verify XSS protection in message display

**Steps:**
1. Edit any message and paste:
   ```html
   <script>alert('XSS')</script>Hello {first_name}
   ```
2. Save
3. Reload page
4. Observe displayed text

**Expected Results:**
- ✅ No JavaScript alert appears
- ✅ Text displayed as literal string: `<script>alert('XSS')</script>Hello {first_name}`
- ✅ Script tags escaped or sanitized
- ✅ Template variable `{first_name}` remains as placeholder

**Pass Criteria:** XSS attack prevented

---

## Test Case 19: Empty Database State (Edge Case)

**Objective:** Verify UI handles empty messages table gracefully

**Steps:**
1. In Supabase SQL Editor, temporarily delete all messages:
   ```sql
   -- DO NOT RUN IN PRODUCTION!
   -- DELETE FROM id_badge_verification_messages;
   ```
2. Reload messages page
3. Observe empty state
4. Re-seed messages:
   ```sql
   -- Re-run seed SQL from migration
   ```

**Expected Results:**
- ✅ Empty state message: "No messages found. Please run the seed SQL script."
- ✅ No errors or crashes
- ✅ Page remains functional
- ✅ After re-seeding: messages reappear

**Pass Criteria:** Graceful empty state handling

---

## Test Case 20: Browser Compatibility

**Objective:** Verify compatibility across browsers

**Steps:**
1. Test in Chrome/Edge (iOS Simulator default)
2. Test in Safari (if available)
3. Test in Firefox (if available)

**Expected Results:**
- ✅ Page loads correctly in all browsers
- ✅ Edit/Save functionality works
- ✅ Styling consistent across browsers
- ✅ No console errors specific to any browser

**Pass Criteria:** Cross-browser compatibility confirmed

---

## Regression Checklist

After completing all test cases, verify:

- [ ] All 12 messages visible
- [ ] Edit/Save/Cancel functionality working
- [ ] Template variables preserved in saves
- [ ] Validation prevents empty messages
- [ ] RLS policies enforced
- [ ] Navigation works (back to queue)
- [ ] Character count updates dynamically
- [ ] Multiple sequential edits work
- [ ] Error handling graceful on network failure
- [ ] Changes persist after reload
- [ ] No SQL injection or XSS vulnerabilities
- [ ] Performance acceptable (<2s page load)
- [ ] Integration with notifications working (if BADGE-011 complete)

---

## Known Limitations

- **Concurrency:** Last write wins (no optimistic locking)
- **Audit Trail:** No history of previous message versions (future enhancement)
- **Undo:** No undo button after save (must manually revert)
- **Admin Auth:** Currently relies on service role key; proper admin role check not implemented (TODO)

---

## Environment Cleanup

After testing, optionally revert test messages:

```sql
-- Restore original upload_disclaimer message
UPDATE id_badge_verification_messages 
SET message_text = 'Please upload a clear photo of your government-issued ID. We do not store this image after verification.'
WHERE message_key = 'upload_disclaimer';

-- Remove any test prefixes
UPDATE id_badge_verification_messages 
SET message_text = REPLACE(message_text, 'TEST:', '')
WHERE message_text LIKE 'TEST:%';
```

---

## Sign-Off

**Tester Name:** _________________________  
**Test Date:** ___________________________  
**Environment:** Production / Staging (circle one)  
**Result:** PASS / FAIL (circle one)  

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

