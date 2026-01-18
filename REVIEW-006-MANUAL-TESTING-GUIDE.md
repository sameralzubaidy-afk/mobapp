# REVIEW-006: Review Reporting and Flagging - Manual Testing Guide

**Module:** MODULE-08-REVIEWS-RATINGS  
**Task:** REVIEW-006 - Implement Review Reporting and Flagging  
**Status:** Ready for Testing  

---

## Prerequisites

Before testing, ensure:
- [ ] Migration `031_review_reports.sql` has been applied to Supabase
- [ ] Migration `032_review_admin_policies.sql` has been applied to Supabase
- [ ] App is running on device/emulator
- [ ] You have at least 2 test user accounts (one regular, one admin)
- [ ] You have completed at least one trade to create reviews

---

## Test Case 1: Report a Review (User Flow)

### Setup
1. Log in as **User A**
2. Navigate to another user's profile that has reviews
3. Find a review card

### Steps
1. Tap the 3-dot menu (ellipsis icon) on any review
2. Observe the report menu appears with 3 options:
   - "Report as Spam"
   - "Report as Offensive"
   - "Report False Information"

### Test 1.1: Report as Spam
**Steps:**
1. Tap "Report as Spam"
2. Confirm in the alert dialog
3. Wait for success message

**Expected Results:**
- ✅ Alert shows: "Report Review" with reason "Spam"
- ✅ After confirmation, success alert: "Thank you for reporting. We will review this content."
- ✅ Menu closes after reporting

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.2: Report as Offensive
**Steps:**
1. Tap 3-dot menu on another review
2. Tap "Report as Offensive"
3. Confirm in alert dialog

**Expected Results:**
- ✅ Alert shows reason "Offensive Content"
- ✅ Success message appears
- ✅ Report is saved to database

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

### Test 1.3: Report False Information
**Steps:**
1. Tap 3-dot menu on another review
2. Tap "Report False Information"
3. Confirm

**Expected Results:**
- ✅ Alert shows reason "False Information"
- ✅ Success message appears

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 2: Duplicate Report Prevention

### Setup
Use the same review from Test Case 1

### Steps
1. Tap 3-dot menu on the SAME review you already reported
2. Try to report it again with any reason
3. Confirm

**Expected Results:**
- ✅ Error alert: "You have already reported this review"
- ✅ Report is NOT saved again
- ✅ Database shows only 1 report from this user

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 3: Auto-Hide After 3 Reports

### Setup
You need 3 different user accounts to test this

### Steps
1. Log in as **User A**, report a review (reason: spam)
2. Log out, log in as **User B**, report the SAME review (reason: offensive)
3. Log out, log in as **User C**, report the SAME review (reason: false_info)
4. Refresh the profile page or navigate away and back

**Expected Results:**
- ✅ After 1st report: review still visible
- ✅ After 2nd report: review still visible
- ✅ After 3rd report: review disappears from profile
- ✅ In database, review has `is_hidden = true`
- ✅ In database, review has `report_count = 3`

**Verification Query (run in Supabase SQL Editor):**
```sql
SELECT id, is_hidden, report_count 
FROM reviews 
WHERE id = '<review_id>';
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 4: Admin Moderation Queue

### Setup
1. Log in as an **admin user** (user with `role = 'admin'` in profiles table)
2. Ensure there is at least 1 hidden review (from Test Case 3)

### Steps
1. Navigate to Admin Dashboard
2. Tap "Review Moderation" (or navigate directly to ReviewModeration screen)
3. Observe the list of reported reviews

**Expected Results:**
- ✅ Screen title: "Review Moderation"
- ✅ Subtitle shows count: "X reviews flagged"
- ✅ Each reported review shows:
  - Review content (rating, comment, reviewer name)
  - Flag icon with report count (e.g., "3 reports")
  - List of report reasons:
    - "• Spam"
    - "• Offensive Content"
    - "• False Information"
  - Report timestamps
  - Two buttons: "Approve" (green) and "Delete" (red)
- ✅ Reviews are sorted by report count (highest first)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 5: Admin Approve Review

### Setup
Use a reported review from Test Case 4

### Steps
1. In Review Moderation screen, tap "Approve" on a reported review
2. Read confirmation alert
3. Tap "Approve" to confirm

**Expected Results:**
- ✅ Alert shows: "Approve Review" with message "This will unhide the review and delete all reports..."
- ✅ After confirmation, success alert: "Review approved and unhidden"
- ✅ Review disappears from moderation queue
- ✅ Review becomes visible again on user's profile
- ✅ In database:
  - `reviews.is_hidden = false`
  - `reviews.report_count = 0`
  - All reports deleted from `review_reports` table

**Verification Query:**
```sql
SELECT is_hidden, report_count FROM reviews WHERE id = '<review_id>';
-- Should return: is_hidden = false, report_count = 0

SELECT COUNT(*) FROM review_reports WHERE review_id = '<review_id>';
-- Should return: 0
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 6: Admin Delete Review

### Setup
Use a different reported review

### Steps
1. In Review Moderation screen, tap "Delete" on a reported review
2. Read confirmation alert (warning: cannot be undone)
3. Tap "Delete" to confirm

**Expected Results:**
- ✅ Alert shows: "Delete Review" with message "This action cannot be undone..."
- ✅ After confirmation, success alert: "Review permanently deleted"
- ✅ Review disappears from moderation queue
- ✅ Review is permanently removed from database
- ✅ All associated reports are also deleted (CASCADE)

**Verification Query:**
```sql
SELECT * FROM reviews WHERE id = '<review_id>';
-- Should return: no rows

SELECT * FROM review_reports WHERE review_id = '<review_id>';
-- Should return: no rows
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 7: Non-Admin Cannot Access Moderation

### Setup
Log in as a **regular user** (not admin)

### Steps
1. Try to navigate to ReviewModeration screen (if link exists)
   OR try to call admin functions directly
2. Observe error/permission denied

**Expected Results:**
- ✅ Regular users cannot see "Review Moderation" link
- ✅ If they try to access directly, RLS policies prevent viewing
- ✅ Error message or empty list shown

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 8: User Cannot Report Own Review

### Setup
1. Log in as **User A**
2. Navigate to a profile where User A has left a review

### Steps
1. Find User A's own review card
2. Check if 3-dot menu is visible

**Expected Results:**
- ✅ 3-dot menu should NOT be visible on own reviews
- ✅ User cannot report their own review

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 9: Hidden Reviews Excluded from Profile

### Setup
Ensure there is at least 1 hidden review for a user

### Steps
1. Log in as any regular user (not admin)
2. Navigate to the profile of the user who was reviewee of the hidden review
3. Observe the reviews list

**Expected Results:**
- ✅ Hidden reviews do NOT appear in the list
- ✅ Only visible reviews are shown
- ✅ Rating stats exclude hidden reviews

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 10: Refresh Admin Queue

### Setup
Admin is viewing Review Moderation screen with some reported reviews

### Steps
1. Pull down to refresh (or use refresh control)
2. Wait for loading indicator
3. Observe updated list

**Expected Results:**
- ✅ Loading indicator shows
- ✅ List refreshes with latest data
- ✅ New reports appear if any
- ✅ Approved/deleted reviews no longer in list

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 11: Empty Moderation Queue

### Setup
Admin has approved/deleted all reported reviews

### Steps
1. Navigate to Review Moderation screen
2. Observe empty state

**Expected Results:**
- ✅ Green checkmark icon shown
- ✅ Message: "No reported reviews"
- ✅ Subtitle: "All reviews are in good standing"

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 12: Report Reasons Are Categorized Correctly

### Setup
Use different report reasons

### Steps
1. Report 3 different reviews with 3 different reasons:
   - Review 1: spam
   - Review 2: offensive
   - Review 3: false_info
2. As admin, view moderation queue
3. Check reason labels

**Expected Results:**
- ✅ Spam → "Spam"
- ✅ Offensive → "Offensive Content"
- ✅ False_info → "False Information"
- ✅ Other → "Other"

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Test Case 13: Database Constraints

### Verification Queries (run in Supabase SQL Editor)

**Test 13.1: Unique report per user per review**
```sql
-- Try to insert duplicate report (should fail)
INSERT INTO review_reports (review_id, reporter_id, reason)
VALUES ('<existing_review_id>', '<existing_reporter_id>', 'spam');
-- Expected: ERROR: duplicate key value violates unique constraint
```

**Test 13.2: Invalid reason constraint**
```sql
-- Try to insert invalid reason (should fail)
INSERT INTO review_reports (review_id, reporter_id, reason)
VALUES (gen_random_uuid(), auth.uid(), 'invalid_reason');
-- Expected: ERROR: new row violates check constraint
```

**Test 13.3: Cascade delete on review deletion**
```sql
-- Delete a review with reports
DELETE FROM reviews WHERE id = '<review_with_reports_id>';

-- Check reports are also deleted
SELECT COUNT(*) FROM review_reports WHERE review_id = '<deleted_review_id>';
-- Expected: 0 reports (cascade deleted)
```

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: _______________

---

## Summary Checklist

After completing all tests, verify:

- [ ] Users can report reviews with valid reasons
- [ ] Duplicate reports are prevented
- [ ] Reviews auto-hide after 3 reports
- [ ] Admin can view all reported reviews
- [ ] Admin can approve reviews (unhide + delete reports)
- [ ] Admin can delete reviews permanently
- [ ] Non-admin cannot access moderation features
- [ ] Users cannot report own reviews
- [ ] Hidden reviews excluded from public view
- [ ] All UI elements display correctly
- [ ] All error messages are user-friendly
- [ ] Database constraints work as expected

---

## Known Issues / Notes

Document any issues found during testing:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Testing Sign-Off

**Tested by:** _______________  
**Date:** _______________  
**Environment:** [ ] Development / [ ] Staging / [ ] Production  
**Device/Emulator:** _______________  
**Overall Result:** [ ] Pass / [ ] Fail / [ ] Pass with Issues  

---

## SQL Verification Commands

Run these in Supabase SQL Editor to verify migrations:

```sql
-- Verify review_reports table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'review_reports'
ORDER BY ordinal_position;

-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'review_reports';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('reviews', 'review_reports');

-- Verify admin policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('reviews', 'review_reports')
  AND policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- Check reviews with reports
SELECT 
  r.id,
  r.rating,
  r.is_hidden,
  r.report_count,
  COUNT(rr.id) as actual_report_count
FROM reviews r
LEFT JOIN review_reports rr ON rr.review_id = r.id
WHERE r.report_count > 0 OR rr.id IS NOT NULL
GROUP BY r.id, r.rating, r.is_hidden, r.report_count
ORDER BY r.report_count DESC;
```

---

**End of Manual Testing Guide**
