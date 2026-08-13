# MODULE-08-REVIEWS-RATINGS: TASK REVIEW-001 Manual Testing Guide

**Task:** Create Review Submission UI (Star Rating + Comment)  
**Test Date:** _________  
**Tester:** _________  
**Environment:** Production Supabase

---

## Prerequisites

Before testing, ensure:
- [ ] Migration `030_reviews.sql` has been applied to Supabase production
- [ ] Mobile app is running on device/simulator
- [ ] Test user is logged in
- [ ] At least one completed trade exists for the test user

---

## Setup Instructions

### 1. Apply Database Migration

**IMPORTANT: Run this SQL in Supabase production SQL Editor before testing**

```sql
-- Apply the reviews migration
-- File: supabase/migrations/030_reviews.sql
-- Copy and paste the entire contents of that file into Supabase SQL Editor and execute
```

**Verification Query:**
```sql
-- Verify reviews table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
ORDER BY ordinal_position;

-- Expected output: 11 columns (id, trade_id, reviewer_id, reviewee_id, rating, comment, is_anonymous, is_hidden, report_count, created_at, updated_at)
```

### 2. Create Test Data (if needed)

If you don't have completed trades, create test data:

```sql
-- Create a test completed trade
-- Replace USER_ID_1, USER_ID_2, ITEM_ID with actual IDs from your database
INSERT INTO trades (id, buyer_id, seller_id, item_id, status, completed_at, created_at)
VALUES (
  gen_random_uuid(),
  'USER_ID_1', -- Your test user ID
  'USER_ID_2', -- Another user ID
  'ITEM_ID',   -- An item ID
  'completed',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '2 days'
);
```

---

## Test Cases

### TC-001: Submit Review with Rating and Comment

**Objective:** Verify user can submit a review with a star rating and comment

**Prerequisites:**
- User has a completed trade
- User has NOT yet reviewed this trade

**Steps:**
1. Open the app and log in as test user
2. Navigate to "My Trades" or "Trade History"
3. Find a completed trade
4. Tap on the trade to view trade details
5. Locate and tap the "Review [User Name]" button
6. On the Submit Review screen:
   - Tap the 5th star (5-star rating)
   - Type in the comment field: "Great experience! Would trade again."
   - Do NOT check the "Post anonymously" checkbox
7. Tap "Submit Review" button
8. Wait for confirmation alert

**Expected Results:**
- ✅ Submit Review screen opens successfully
- ✅ Title shows "Review [User Name]"
- ✅ Star rating is selectable (stars fill when tapped)
- ✅ Comment field accepts text input
- ✅ Character counter shows "41/500 characters"
- ✅ Submit button is enabled (blue)
- ✅ Success alert appears: "Your review has been submitted!"
- ✅ Screen navigates back to trade details
- ✅ Review button is no longer visible or shows "Already Reviewed"

**Verification Query:**
```sql
-- Verify review was created
SELECT * FROM reviews
WHERE reviewer_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: rating = 5, comment = 'Great experience! Would trade again.', is_anonymous = false
```

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-002: Submit Review with Rating Only (No Comment)

**Objective:** Verify user can submit a review with only a star rating

**Prerequisites:**
- User has a different completed trade to review

**Steps:**
1. Navigate to a different completed trade
2. Tap "Review [User Name]" button
3. On the Submit Review screen:
   - Tap the 4th star (4-star rating)
   - DO NOT enter any comment
4. Tap "Submit Review" button

**Expected Results:**
- ✅ Review submits successfully
- ✅ Success alert appears
- ✅ Screen navigates back

**Verification Query:**
```sql
SELECT rating, comment FROM reviews
WHERE reviewer_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: rating = 4, comment = NULL
```

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-003: Validation - Submit Without Rating

**Objective:** Verify app prevents submission without selecting a rating

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to a completed trade
2. Tap "Review [User Name]" button
3. On the Submit Review screen:
   - DO NOT select any star rating
   - Type in comment field: "Good experience"
4. Observe the Submit button state
5. Try to tap "Submit Review" button

**Expected Results:**
- ✅ Submit button is disabled (gray color)
- ✅ Alert appears: "Rating Required" with message "Please select a star rating before submitting."
- ✅ Review is NOT submitted
- ✅ User remains on Submit Review screen

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-004: Character Count Validation (500 char limit)

**Objective:** Verify comment field enforces 500 character limit

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to a completed trade
2. Tap "Review [User Name]" button
3. Select 5-star rating
4. Copy and paste this 550-character text into comment field:
```
This is a test comment to verify the 500 character limit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Additional text to exceed 500 characters.
```
5. Observe character counter

**Expected Results:**
- ✅ Comment field only accepts 500 characters (text is truncated)
- ✅ Character counter shows "500/500 characters"
- ✅ Cannot type beyond 500 characters

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-005: Submit Anonymous Review

**Objective:** Verify user can submit an anonymous review

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to a completed trade
2. Tap "Review [User Name]" button
3. On the Submit Review screen:
   - Tap the 4th star (4-star rating)
   - Type comment: "Prefer to stay anonymous"
   - Tap the "Post anonymously" checkbox (checkmark should appear)
4. Tap "Submit Review" button

**Expected Results:**
- ✅ Checkbox toggles when tapped (checkmark visible)
- ✅ Review submits successfully
- ✅ Success alert appears

**Verification Query:**
```sql
SELECT rating, comment, is_anonymous FROM reviews
WHERE reviewer_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: is_anonymous = true
```

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-006: Prevent Duplicate Review

**Objective:** Verify user cannot review the same trade twice

**Prerequisites:**
- User has already submitted a review for a specific trade

**Steps:**
1. Navigate to a trade that you've already reviewed
2. View trade details
3. Look for the "Review [User Name]" button

**Expected Results:**
- ✅ Review button is NOT visible
- ✅ OR: Review button shows "Already Reviewed" and is disabled
- ✅ OR: Tapping review button shows alert: "You have already reviewed this trade"

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-007: Review Button Only for Completed Trades

**Objective:** Verify review button only appears for completed trades

**Prerequisites:**
- User has at least one trade that is NOT completed (pending, in_progress, etc.)

**Steps:**
1. Navigate to "My Trades"
2. Find a trade with status NOT "completed"
3. Tap on the trade to view details
4. Look for the "Review" button

**Expected Results:**
- ✅ Review button is NOT visible for non-completed trades
- ✅ Only completed trades show the review option

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-008: Cancel Review Submission

**Objective:** Verify user can cancel review submission without saving

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to a completed trade
2. Tap "Review [User Name]" button
3. On the Submit Review screen:
   - Tap the 3rd star (3-star rating)
   - Type comment: "Starting review but will cancel..."
4. Tap the back button (or swipe back on iOS)
5. Navigate back to the same trade
6. Try to submit a review again

**Expected Results:**
- ✅ User navigates back to previous screen without submitting
- ✅ No review is saved to database
- ✅ User can still review this trade (button still visible)
- ✅ No success or error alert appears

**Verification Query:**
```sql
-- Verify no review was created for this trade
SELECT COUNT(*) FROM reviews
WHERE trade_id = 'TRADE_ID_HERE'
AND reviewer_id = 'YOUR_USER_ID';

-- Expected: 0
```

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-009: UI/UX Validation

**Objective:** Verify UI elements display correctly

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to Submit Review screen
2. Inspect all UI elements

**Expected Results:**
- ✅ Title displays: "Review [User Name]" with correct name
- ✅ Subtitle displays: "Share your experience with this trade"
- ✅ Star rating component shows 5 stars (all outlined/empty initially)
- ✅ Stars turn yellow/filled when tapped
- ✅ Label shows: "Rating *" (with red asterisk)
- ✅ Comment input placeholder: "Share your experience with this trade..."
- ✅ Character counter shows: "0/500 characters" initially
- ✅ Anonymous checkbox with label: "Post anonymously"
- ✅ Submit button: Blue background, white text "Submit Review"
- ✅ Note at bottom: "You can edit your review within 24 hours of submission."
- ✅ Submit button turns gray when no rating selected
- ✅ Loading spinner appears when submitting

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-010: Star Rating Interaction

**Objective:** Verify star rating is interactive and updates correctly

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to Submit Review screen
2. Tap each star in sequence (1, 2, 3, 4, 5)
3. Observe star fill state

**Expected Results:**
- ✅ Tapping star 1: Only star 1 is filled
- ✅ Tapping star 2: Stars 1-2 are filled
- ✅ Tapping star 3: Stars 1-3 are filled
- ✅ Tapping star 4: Stars 1-4 are filled
- ✅ Tapping star 5: All 5 stars are filled
- ✅ Tapping same star again does nothing (rating stays selected)
- ✅ Can change rating by tapping different star

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-011: Loading State During Submission

**Objective:** Verify loading indicator appears during review submission

**Prerequisites:**
- User has a completed trade to review
- Slow network (optional: enable network throttling)

**Steps:**
1. Navigate to Submit Review screen
2. Select 5-star rating
3. Tap "Submit Review" button
4. Observe the button state immediately after tapping

**Expected Results:**
- ✅ Submit button shows loading spinner
- ✅ Submit button is disabled during submission
- ✅ User cannot tap button multiple times
- ✅ Loading state clears after submission completes

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-012: Comment Trimming

**Objective:** Verify leading/trailing whitespace is trimmed from comments

**Prerequisites:**
- User has a completed trade to review

**Steps:**
1. Navigate to Submit Review screen
2. Select 5-star rating
3. Type comment with spaces: "   Great experience!   "
4. Submit review

**Expected Results:**
- ✅ Review submits successfully

**Verification Query:**
```sql
SELECT comment FROM reviews
WHERE reviewer_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: 'Great experience!' (no leading/trailing spaces)
```

**Actual Results:**
_[Record actual results here]_

**Status:** ⬜ Pass / ⬜ Fail

---

## Summary

**Total Test Cases:** 12  
**Passed:** _____  
**Failed:** _____  
**Pass Rate:** _____%

---

## Issues Found

| Issue ID | Test Case | Description | Severity | Status |
|----------|-----------|-------------|----------|--------|
| REVIEW-001-001 | TC-XXX | [Description] | High/Medium/Low | Open/Fixed |

---

## Notes

_[Add any additional observations, edge cases, or suggestions]_

---

## Sign-Off

**Tester Signature:** _________  
**Date:** _________  

**Reviewer:** _________  
**Date:** _________
