# BADGE-010: Admin ID Badge Queue & Review Page - Manual Testing Guide

**Module:** MODULE-10-ID-BADGE-VERIFICATION-V2.md  
**Task:** BADGE-010  
**Environment:** Supabase Production  
**Created:** February 8, 2026

---

## Prerequisites

Before testing, ensure:
- [ ] Supabase production database has `id_badge_verification_requests` table
- [ ] Storage bucket `id-badge-verification-screenshots` exists
- [ ] Admin user account with proper permissions
- [ ] Test user account(s) for submissions
- [ ] Admin portal accessible at production URL

---

## Test Cases

### TC-01: Admin Queue Page - Load & Display

**Objective:** Verify the ID Badge queue page loads and displays correctly

**Steps:**
1. Log in as admin user
2. Navigate to `/id-badges` (or click "ID Badges" in navigation)
3. Observe the page loads

**Expected Results:**
- ✅ Page title: "ID Badge Verification"
- ✅ Stats section visible with 4 cards:
  - Pending Review (yellow)
  - Approved (green)
  - Rejected (red)
  - Avg Review Time (blue)
- ✅ Filter buttons visible: All, Pending, Approved, Rejected
- ✅ Search bar visible with placeholder "Search by name or email..."
- ✅ Table with columns: User, Email, Phone, Node, Submitted, Status, Actions
- ✅ Default filter is "Pending"

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-02: Stats Display - Accurate Counts

**Objective:** Verify stats reflect actual database counts

**Steps:**
1. On ID Badge queue page, note the stats values
2. Query database directly:
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'pending') as pending,
     COUNT(*) FILTER (WHERE status = 'approved') as approved,
     COUNT(*) FILTER (WHERE status = 'rejected') as rejected
   FROM id_badge_verification_requests;
   ```
3. Compare stats UI with database results

**Expected Results:**
- ✅ Pending count matches database
- ✅ Approved count matches database
- ✅ Rejected count matches database
- ✅ Avg review time displays (format: X.Xh)
- ✅ Stats update after approving/rejecting requests

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-03: Filter Functionality

**Objective:** Verify filter buttons work correctly

**Steps:**
1. On ID Badge queue page, click "All" filter
2. Note the number of requests shown
3. Click "Pending" filter
4. Note the number of requests shown
5. Click "Approved" filter
6. Note the number of requests shown
7. Click "Rejected" filter
8. Note the number of requests shown

**Expected Results:**
- ✅ "All" shows all requests regardless of status
- ✅ "Pending" shows only status='pending' rows
- ✅ "Approved" shows only status='approved' rows
- ✅ "Rejected" shows only status='rejected' rows
- ✅ Active filter button is highlighted (blue background)
- ✅ Inactive filter buttons are gray
- ✅ Table updates without page reload

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-04: Search Functionality

**Objective:** Verify search filters results by name/email

**Steps:**
1. On ID Badge queue page, type a test user's first name in search
2. Wait 500ms (debounce)
3. Observe table updates
4. Clear search, type email address
5. Wait 500ms
6. Observe table updates
7. Type non-existent text
8. Observe results

**Expected Results:**
- ✅ Search by first name returns matching results
- ✅ Search by last name returns matching results
- ✅ Search by email returns matching results
- ✅ Search is case-insensitive
- ✅ Search debounces (no request until typing stops ~300ms)
- ✅ Empty search shows all results
- ✅ Non-existent search shows "No requests found"

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-05: Table Display - Correct Data

**Objective:** Verify table displays correct user information

**Steps:**
1. On ID Badge queue page, select a row
2. Compare displayed values with database:
   ```sql
   SELECT first_name, last_name, email, phone_number, node_id, 
          submitted_at, status
   FROM id_badge_verification_requests
   WHERE id = '<request_id>';
   ```

**Expected Results:**
- ✅ User name: `{first_name} {last_name}`
- ✅ Email matches database
- ✅ Phone displays or shows "-" if null
- ✅ Node displays or shows "-" if null
- ✅ Submitted timestamp formatted correctly
- ✅ Status badge color matches:
  - Pending = yellow background
  - Approved = green background
  - Rejected = red background

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-06: Action Links - Navigation

**Objective:** Verify action links navigate correctly

**Steps:**
1. On ID Badge queue, find a pending request
2. Click "Review" link
3. Verify redirects to review page
4. Go back to queue
5. Find an approved or rejected request
6. Click "View" link
7. Verify redirects to details page

**Expected Results:**
- ✅ Pending requests show "Review" link (blue)
- ✅ Approved/Rejected requests show "View" link (gray)
- ✅ "Review" link navigates to `/id-badges/{id}/review`
- ✅ "View" link navigates to `/id-badges/{id}/details`
- ✅ Back button returns to queue
- ✅ Queue preserves filter state on return

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-07: Review Page - Load Request Details

**Objective:** Verify review page loads request information

**Steps:**
1. Navigate to a pending request review page
2. Observe user information section
3. Observe screenshot section (if available)

**Expected Results:**
- ✅ Page title: "Review ID Badge Request"
- ✅ User Information section displays:
  - Name (first + last)
  - Email
  - Phone (or "-")
  - Node (or "-")
  - Submitted date/time (formatted)
- ✅ Screenshot section visible if screenshot_path exists
- ✅ Screenshot image loads correctly
- ✅ "Download Full Size" link visible
- ✅ Decision form visible below

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-08: Screenshot Display & Download

**Objective:** Verify screenshot can be viewed and downloaded

**Steps:**
1. On review page with screenshot
2. Verify image displays in preview
3. Click "Download Full Size" link
4. Verify opens in new tab or downloads

**Expected Results:**
- ✅ Screenshot displays in container (max-width, centered)
- ✅ Image is clear and readable
- ✅ Download link opens signed URL
- ✅ URL expires after ~1 hour (Supabase default)
- ✅ If no screenshot: shows placeholder or error message

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-09: Decision Form - Approve Flow

**Objective:** Verify admin can approve a request

**Steps:**
1. On review page, select "Approve" radio button
2. Enter optional approval notes: "Photo is clear and matches profile"
3. Click submit button
4. Wait for response

**Expected Results:**
- ✅ "Approve" radio button selectable
- ✅ Notes textarea visible and editable
- ✅ Submit button enabled
- ✅ Submit button shows "Approve" text in green
- ✅ On submit, button shows "Submitting..." with spinner
- ✅ Success alert: "Request approved successfully"
- ✅ Redirects to `/id-badges` queue
- ✅ Request status changed to 'approved' in database
- ✅ Screenshot deleted from storage bucket
- ✅ `reviewed_at` timestamp set
- ✅ `approval_notes` saved if provided

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-10: Decision Form - Reject Flow

**Objective:** Verify admin can reject a request

**Steps:**
1. On review page, select "Reject" radio button
2. Select rejection reason: "unclear_photo"
3. Enter rejection notes: "Please retake with better lighting"
4. Click submit button
5. Wait for response

**Expected Results:**
- ✅ "Reject" radio button selectable
- ✅ Rejection reason dropdown appears when "Reject" selected
- ✅ Dropdown has 6 options:
  - Unclear photo
  - ID expired
  - Name does not match profile
  - Multiple IDs in photo
  - Not a government-issued ID
  - Other (please explain in notes)
- ✅ Notes textarea visible
- ✅ Submit button enabled only when reason selected
- ✅ Submit button shows "Reject" text in red
- ✅ On submit, button shows "Submitting..." with spinner
- ✅ Success alert: "Request rejected successfully"
- ✅ Redirects to `/id-badges` queue
- ✅ Request status changed to 'rejected' in database
- ✅ Screenshot deleted from storage bucket
- ✅ `reviewed_at` timestamp set
- ✅ `rejection_reason` saved
- ✅ `rejection_notes` saved

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-11: Decision Validation

**Objective:** Verify validation prevents invalid submissions

**Steps:**
1. On review page, click submit without selecting decision
2. Select "Reject" but don't select reason
3. Try to submit
4. Select reason, submit successfully

**Expected Results:**
- ✅ Alert: "Please select approve or reject" if no decision
- ✅ Alert: "Please select a rejection reason" if reject without reason
- ✅ Submit button disabled until valid selection
- ✅ Submission succeeds once valid

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-12: Screenshot Deletion After Decision

**Objective:** Verify screenshot is deleted immediately after decision

**Steps:**
1. Note screenshot_path from database for a pending request
2. Approve or reject the request
3. Check storage bucket for the file:
   ```
   Check Supabase Storage dashboard
   OR query: SELECT screenshot_path FROM id_badge_verification_requests WHERE id='<id>';
   ```
4. Try to access the signed URL again

**Expected Results:**
- ✅ Screenshot file removed from storage bucket
- ✅ `screenshot_path` column set to NULL (or unchanged)
- ✅ Accessing old signed URL returns 404 or error
- ✅ No error in logs if file already deleted (idempotent)

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-13: Queue Updates After Decision

**Objective:** Verify queue reflects changes after decision

**Steps:**
1. Note pending count before decision
2. Approve a request
3. Return to queue page
4. Observe stats and table

**Expected Results:**
- ✅ Pending count decreased by 1
- ✅ Approved count increased by 1
- ✅ Request moved from "Pending" to "Approved" filter
- ✅ Action link changed from "Review" to "View"
- ✅ Status badge changed from yellow to green
- ✅ Avg review time updated

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-14: Multiple Requests Handling

**Objective:** Verify system handles multiple requests correctly

**Steps:**
1. Create 3 test ID badge submissions
2. Go to queue, verify all 3 visible
3. Approve 1, reject 1, leave 1 pending
4. Filter by each status
5. Verify counts and display

**Expected Results:**
- ✅ All 3 requests visible in "All" filter
- ✅ Approved filter shows 1 request
- ✅ Rejected filter shows 1 request
- ✅ Pending filter shows 1 request
- ✅ Stats reflect: pending=1, approved=1, rejected=1

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

### TC-15: Error Handling

**Objective:** Verify graceful error handling

**Steps:**
1. Try to access non-existent request ID: `/id-badges/00000000-0000-0000-0000-000000000000/review`
2. Try to submit decision with network disabled
3. Try to load queue with database error

**Expected Results:**
- ✅ Non-existent request: shows "Request not found"
- ✅ Network error: shows friendly error message
- ✅ No uncaught exceptions in console
- ✅ User can retry or go back

**Status:** ☐ Pass ☐ Fail

**Notes:**
_______________________________________

---

## Database Verification Queries

### Check Request Details
```sql
SELECT * FROM id_badge_verification_requests 
WHERE id = '<request_id>';
```

### Check Screenshot Exists
```sql
SELECT screenshot_path 
FROM id_badge_verification_requests 
WHERE id = '<request_id>';
```

### Check Counts by Status
```sql
SELECT 
  status,
  COUNT(*) as count
FROM id_badge_verification_requests
GROUP BY status;
```

### Check Avg Review Time
```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600) as avg_hours
FROM id_badge_verification_requests
WHERE reviewed_at IS NOT NULL;
```

---

## Testing Summary

**Total Test Cases:** 15  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

**Overall Status:** ☐ Pass ☐ Fail  

**Tested By:** _______________________  
**Date:** _______________________  
**Environment:** Production

---

## Issues Found

| Issue # | Test Case | Description | Severity | Status |
|---------|-----------|-------------|----------|--------|
| 1       |           |             |          |        |
| 2       |           |             |          |        |
| 3       |           |             |          |        |

---

## Sign-Off

- [ ] All test cases passed
- [ ] No critical issues found
- [ ] Documentation updated
- [ ] Stakeholder approval obtained

**Approved By:** _______________________  
**Date:** _______________________
