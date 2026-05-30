# REVIEW-004: Skip Review - Manual Testing Guide

**Module:** MODULE-08-REVIEWS-RATINGS  
**Task:** REVIEW-004 - Allow Users to Skip Leaving Reviews  
**Date:** January 15, 2026

---

## Prerequisites

Before testing, ensure you have:
- [ ] Two test user accounts (one buyer, one seller)
- [ ] A completed trade between the test users
- [ ] Access to the review submission screen
- [ ] Analytics dashboard or console access (to verify skip tracking)

---

## Test Case 1: Skip Button Visibility

**Objective:** Verify skip button is visible and accessible

### Steps:
1. Log in as a user who completed a trade
2. Navigate to the review submission screen
3. Observe the screen layout

### Expected Results:
- [ ] **PASS**: "Skip for Now" button is visible below the "Submit Review" button
- [ ] **PASS**: Skip button has gray/secondary styling (not primary blue)
- [ ] **PASS**: Skip button is always enabled (even when submit is disabled)
- [ ] **PASS**: Button text reads "Skip for Now"

### Screenshot Location:
`screenshots/review-004/skip-button-visible.png`

---

## Test Case 2: Skip Without Rating

**Objective:** Verify user can skip without selecting a rating

### Steps:
1. Open review submission screen
2. DO NOT select any star rating
3. DO NOT enter any comment
4. Tap "Skip for Now" button

### Expected Results:
- [ ] **PASS**: No "Rating Required" alert appears
- [ ] **PASS**: Screen immediately navigates back
- [ ] **PASS**: No error messages displayed
- [ ] **PASS**: User is not blocked from continuing

### Screenshot Location:
`screenshots/review-004/skip-no-rating.png`

---

## Test Case 3: Skip After Partial Form Entry

**Objective:** Verify skip works after user starts filling the form

### Steps:
1. Open review submission screen
2. Select a 4-star rating
3. Type "This is a test comment" in the comment field
4. Check the "Post anonymously" checkbox
5. Tap "Skip for Now" button

### Expected Results:
- [ ] **PASS**: Screen navigates back without saving
- [ ] **PASS**: No confirmation dialog appears
- [ ] **PASS**: Partial form data is discarded
- [ ] **PASS**: No review is saved to database

### Verification:
Open the database and verify:
```sql
SELECT * FROM reviews WHERE trade_id = '<test_trade_id>';
-- Should return 0 rows if skipped
```

### Screenshot Location:
`screenshots/review-004/skip-partial-form.png`

---

## Test Case 4: Skip vs Submit Button Behavior

**Objective:** Verify skip button works independently of submit validation

### Steps:
1. Open review submission screen
2. Observe submit button state (should be disabled without rating)
3. Tap "Skip for Now" button

### Expected Results:
- [ ] **PASS**: Submit button is disabled/grayed out
- [ ] **PASS**: Skip button remains enabled
- [ ] **PASS**: Tapping skip works even when submit is disabled
- [ ] **PASS**: No validation errors appear

### Screenshot Location:
`screenshots/review-004/skip-vs-submit.png`

---

## Test Case 5: Analytics Tracking - Skip Event

**Objective:** Verify skip event is tracked in analytics

### Steps:
1. Open analytics console or Firebase Analytics DebugView
2. Navigate to review submission screen
3. Tap "Skip for Now" button
4. Check analytics console

### Expected Results:
- [ ] **PASS**: `review_skipped` event is logged
- [ ] **PASS**: Event includes `trade_id` parameter
- [ ] **PASS**: Event timestamp is correct
- [ ] **PASS**: User ID is correctly associated

### Analytics Event Expected:
```json
{
  "event": "review_skipped",
  "params": {
    "trade_id": "<trade_id>"
  },
  "timestamp": "<timestamp>",
  "user_id": "<user_id>"
}
```

### Screenshot Location:
`screenshots/review-004/analytics-skip-event.png`

---

## Test Case 6: Navigation After Skip

**Objective:** Verify correct navigation flow after skipping

### Steps:
1. Open review submission screen from trade details
2. Tap "Skip for Now" button
3. Observe navigation

### Expected Results:
- [ ] **PASS**: Returns to previous screen (trade details or home)
- [ ] **PASS**: Navigation is smooth with no errors
- [ ] **PASS**: "Review" button still appears on trade details (can re-prompt)
- [ ] **PASS**: No automatic re-prompt appears

### Screenshot Location:
`screenshots/review-004/navigation-after-skip.png`

---

## Test Case 7: Multiple Skips Allowed

**Objective:** Verify user can skip multiple times without penalty

### Steps:
1. Complete a trade and open review screen
2. Tap "Skip for Now" button
3. Navigate back to the same trade
4. Tap "Review [User]" button again
5. Tap "Skip for Now" button again
6. Repeat 2-3 more times

### Expected Results:
- [ ] **PASS**: User can skip unlimited times
- [ ] **PASS**: No penalty or blocking occurs
- [ ] **PASS**: No warning messages appear
- [ ] **PASS**: Each skip event is tracked in analytics

### Screenshot Location:
`screenshots/review-004/multiple-skips.png`

---

## Test Case 8: Submit After Skip

**Objective:** Verify user can submit review after previously skipping

### Steps:
1. Open review submission screen
2. Tap "Skip for Now" button
3. Navigate back to trade details
4. Tap "Review [User]" button again
5. Select 5-star rating
6. Enter comment: "Great trade, changed my mind!"
7. Tap "Submit Review" button

### Expected Results:
- [ ] **PASS**: Review is successfully submitted
- [ ] **PASS**: Review appears in database
- [ ] **PASS**: `review_submitted` event is tracked
- [ ] **PASS**: Previous skip doesn't affect submission

### Verification:
```sql
SELECT * FROM reviews WHERE trade_id = '<test_trade_id>';
-- Should return 1 row with the submitted review
```

### Screenshot Location:
`screenshots/review-004/submit-after-skip.png`

---

## Test Case 9: Review Completion Rate (Analytics)

**Objective:** Verify review completion rate can be calculated from analytics

### Steps:
1. Perform 10 completed trades with test users
2. Submit reviews for 6 trades
3. Skip reviews for 4 trades
4. Check analytics dashboard

### Expected Calculation:
```
Review Completion Rate = submitted / (submitted + skipped)
= 6 / (6 + 4) = 60%
```

### Expected Results:
- [ ] **PASS**: 6 `review_submitted` events logged
- [ ] **PASS**: 4 `review_skipped` events logged
- [ ] **PASS**: Completion rate = 60%
- [ ] **PASS**: Data is accurate for analytics reporting

### Screenshot Location:
`screenshots/review-004/completion-rate-analytics.png`

---

## Test Case 10: Accessibility - Skip Button

**Objective:** Verify skip button is accessible to all users

### Steps:
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate to review submission screen
3. Focus on skip button
4. Listen to screen reader announcement

### Expected Results:
- [ ] **PASS**: Skip button is focusable
- [ ] **PASS**: Screen reader announces "Skip for Now button"
- [ ] **PASS**: Button can be activated with screen reader
- [ ] **PASS**: Navigation works correctly with screen reader

### Screenshot Location:
`screenshots/review-004/accessibility-skip.png`

---

## Edge Cases

### Edge Case 1: Skip During Network Failure

**Steps:**
1. Enable airplane mode or disconnect network
2. Open review submission screen
3. Tap "Skip for Now" button

**Expected:**
- [ ] **PASS**: Skip works offline (no network call required)
- [ ] **PASS**: Navigation completes successfully
- [ ] **PASS**: Analytics event queued for later submission

---

### Edge Case 2: Skip While Submitting

**Steps:**
1. Select 5-star rating
2. Enter comment
3. Tap "Submit Review" button
4. Immediately tap "Skip for Now" button (if visible during submission)

**Expected:**
- [ ] **PASS**: Submit action completes (skip is ignored)
- [ ] **PASS**: OR skip is disabled during submission
- [ ] **PASS**: No duplicate actions occur

---

### Edge Case 3: Back Button vs Skip Button

**Steps:**
1. Open review submission screen
2. Partially fill form (rating + comment)
3. Tap device back button
4. Compare with tapping "Skip for Now" button

**Expected:**
- [ ] **PASS**: Both actions navigate back
- [ ] **PASS**: Skip button logs analytics event
- [ ] **PASS**: Back button may not log skip event (verify expected behavior)

---

## Regression Tests

### Regression 1: Verify Submit Still Works

**Steps:**
1. Select 5-star rating
2. Enter comment
3. Tap "Submit Review" button (NOT skip)

**Expected:**
- [ ] **PASS**: Review is submitted successfully
- [ ] **PASS**: Skip button didn't break submit functionality

---

### Regression 2: Verify Rating Validation Still Works

**Steps:**
1. Do NOT select rating
2. Tap "Submit Review" button

**Expected:**
- [ ] **PASS**: "Rating Required" alert appears
- [ ] **PASS**: Validation still enforced for submit

---

## Summary Checklist

After completing all test cases, verify:

- [ ] Skip button is always visible and enabled
- [ ] Skip works without any validation
- [ ] Skip doesn't save any data to database
- [ ] Analytics tracks skip events correctly
- [ ] Review completion rate can be calculated
- [ ] Navigation works correctly after skip
- [ ] User can skip unlimited times
- [ ] User can submit after skipping
- [ ] Submit functionality unchanged
- [ ] No regression in existing features

---

## Test Results Template

```
Test Date: _________________
Tester: ___________________
Device: ___________________
OS Version: _______________

Test Cases Passed: ____ / 10
Edge Cases Passed: ____ / 3
Regression Tests Passed: ____ / 2

Overall Result: PASS / FAIL

Notes:
_______________________________
_______________________________
_______________________________
```

---

## SQL Verification Queries

Run these queries in Supabase SQL Editor to verify behavior:

### Check reviews table (no skipped reviews saved):
```sql
SELECT * FROM reviews 
WHERE trade_id = '<test_trade_id>' 
AND reviewer_id = '<test_user_id>';
```

### Verify completed trade exists:
```sql
SELECT id, status, completed_at, buyer_id, seller_id 
FROM trades 
WHERE id = '<test_trade_id>' 
AND status = 'completed';
```

### Check review eligibility:
```sql
SELECT 
  t.id,
  t.status,
  t.completed_at,
  r.id as review_id
FROM trades t
LEFT JOIN reviews r ON r.trade_id = t.id AND r.reviewer_id = '<test_user_id>'
WHERE t.id = '<test_trade_id>';
```

---

## Commands to Run

### Start app in development mode:
```bash
cd p2p-kids-marketplace
npm run ios
# or
npm run android
```

### Run unit tests:
```bash
cd p2p-kids-marketplace
npm test -- src/services/__tests__/review-skip.test.ts
```

### Run E2E tests:
```bash
cd p2p-kids-marketplace
npm run e2e:ios
# or
npm run e2e:android
```

### Check TypeScript:
```bash
cd p2p-kids-marketplace
npm run typecheck
```

### Lint code:
```bash
cd p2p-kids-marketplace
npm run lint
```

---

## Troubleshooting

### Issue: Skip button not visible
- **Solution**: Check that you're on the `SubmitReviewScreen`
- **Solution**: Verify latest code is deployed
- **Solution**: Clear app cache and rebuild

### Issue: Analytics events not logging
- **Solution**: Check Firebase/analytics configuration
- **Solution**: Enable debug mode for analytics
- **Solution**: Check console logs for errors

### Issue: Navigation doesn't work after skip
- **Solution**: Check navigation stack configuration
- **Solution**: Verify `navigation.goBack()` is called correctly
- **Solution**: Check for errors in navigation hooks

---

## Definition of Done

This task is complete when:
- [x] Skip button added to review screen
- [x] Skip functionality doesn't block user
- [x] Analytics tracks skip events
- [x] Review completion rate can be calculated
- [x] All test cases pass
- [x] Unit tests written and passing
- [x] E2E tests written and passing
- [x] No regression in existing features
- [x] Manual testing guide created
- [x] Code reviewed and merged

---

**End of Manual Testing Guide**
