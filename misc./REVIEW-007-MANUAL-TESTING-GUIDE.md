# TASK REVIEW-007: Admin Moderation Queue - Manual Testing Guide

**Module:** MODULE-08-REVIEWS-RATINGS  
**Task:** REVIEW-007 - Create Admin Moderation Queue for Reported Reviews  
**Date:** January 18, 2026

---

## 📋 Pre-Test Setup

### Ban Action

The explicit "Ban User" action has been removed from the admin moderation UI and API. Tests and documentation for banning users have been deprecated.

If you need a replacement enforcement flow (e.g., soft-flagging, admin notes, or referral to moderation queue), open an issue describing required behavior.

---
  ('[PASTE_REVIEW_ID_HERE]', (SELECT user_id FROM profiles LIMIT 1), 'spam', 'This looks like spam'),
  ('[PASTE_REVIEW_ID_HERE]', (SELECT user_id FROM profiles LIMIT 1 OFFSET 1), 'offensive', 'Offensive language used'),
  ('[PASTE_REVIEW_ID_HERE]', (SELECT user_id FROM profiles LIMIT 1 OFFSET 2), 'false_info', 'Contains false information');

-- Verify data created
SELECT * FROM reviews WHERE id = '[PASTE_REVIEW_ID_HERE]';
SELECT * FROM review_reports WHERE review_id = '[PASTE_REVIEW_ID_HERE]';
```

---

### 3. Admin Portal Setup

1. **Open Admin Portal:**
   ```bash
   cd p2p-kids-admin
   npm run dev
   ```

2. **Login as Admin:**
   - Navigate to: http://localhost:3000/auth/login
   - Use your admin credentials
   - Verify you see the navigation menu

3. **Navigate to Reviews:**
   - Click "Reviews" in the top navigation
   - URL should be: http://localhost:3000/reviews

---

## 🧪 Test Cases

### TC-001: View Reported Reviews List

**Precondition:** At least one review has reports

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Wait for page to load

**Expected Results:**
- ✅ Page loads without errors
- ✅ Header shows "Review Moderation"
- ✅ Count shows "X of Y reviews" in top right
- ✅ Reviews table is visible
- ✅ Each row shows:
  - Review content (rating, comment, review ID)
  - Report count badge (🚩 number)
  - Report reasons as tags (e.g., "Spam", "Offensive Content")
  - Status badge (Hidden / Visible)
  - Action buttons (Approve, Hide, Ban User)

---

### TC-002: Filter Reviews by Reason (Spam)

**Precondition:** Reviews with different report reasons exist

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Locate the filter dropdown at the top (default: "All Reports")
3. Select "Spam" from dropdown

**Expected Results:**
- ✅ Dropdown changes to "Spam"
- ✅ Table refreshes to show only reviews with spam reports
- ✅ Count updates to show filtered count: "X of Y reviews"
- ✅ Each visible review has at least one "Spam" reason tag
- ✅ Pagination resets to page 1

---

### TC-003: Filter Reviews by Reason (Offensive Content)

**Precondition:** Reviews with offensive reports exist

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Select "Offensive Content" from filter dropdown

**Expected Results:**
- ✅ Table shows only reviews with offensive reports
- ✅ Each visible review has at least one "Offensive Content" reason tag
- ✅ Count updates correctly
- ✅ Other report reasons (spam, false_info) are not visible

---

### TC-004: Filter Shows No Results

**Precondition:** No reviews with "Other" reason exist

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Select "Other" from filter dropdown

**Expected Results:**
- ✅ Blue info box appears: "No reviews match this filter"
- ✅ Suggestion text: "Try selecting a different reason filter."
- ✅ No table visible
- ✅ Count shows "0 of Y reviews"

---

### TC-005: Pagination - Navigate Pages

**Precondition:** More than 10 reported reviews exist

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Scroll to bottom of page
3. Verify pagination controls visible
4. Click "Next" button
5. Click "Previous" button

**Expected Results:**
- ✅ Pagination shows "Page 1 of N"
- ✅ Text shows "Showing 1-10 of X reviews"
- ✅ "Previous" button is disabled on page 1
- ✅ After clicking "Next":
  - Page increments to "Page 2 of N"
  - Different reviews appear (items 11-20)
  - "Previous" button is enabled
- ✅ After clicking "Previous":
  - Returns to "Page 1 of N"
  - Original items 1-10 appear
  - "Previous" button is disabled again

---

### TC-006: Pagination - Last Page Partial

**Precondition:** Total reviews is not a multiple of 10 (e.g., 25 reviews)

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Navigate to last page (e.g., page 3 if 25 reviews)

**Expected Results:**
- ✅ Last page shows correct count (e.g., "Showing 21-25 of 25 reviews")
- ✅ "Next" button is disabled on last page
- ✅ Only remaining items visible (e.g., 5 items instead of 10)

---

### TC-007: Expand Reporter Details

**Precondition:** At least one review with multiple reports

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Click "Show Details" button under a report count badge

**Expected Results:**
- ✅ Expansion row appears below the review
- ✅ Shows "Report Details (N reports)" header
- ✅ Each report displays:
  - Report # (e.g., "Report #1")
  - Reporter ID
  - Reason (e.g., "Reason: Spam")
  - Description (if provided)
  - Date reported
- ✅ Reports are in separate white boxes with borders
- ✅ Click "Hide Details" collapses the expansion

---

### TC-008: Approve Review (Unhide + Delete Reports)

**Precondition:** At least one hidden review with reports

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Find a review with "Hidden" status
3. Click "Approve" button
4. Confirm in the alert dialog

**Expected Results:**
- ✅ Confirmation dialog appears: "This will unhide the review and delete all associated reports. Continue?"
- ✅ After confirming:
  - Alert: "Review approved" (or similar success message)
  - Row updates immediately:
    - Status badge changes to "Visible" (green)
    - Report count badge shows "🚩 0"
    - Reports array is empty
  - Page does NOT refresh (update is instant)

**Database Verification:**
```sql
-- Verify review is visible and report_count reset
SELECT id, is_hidden, report_count 
FROM reviews 
WHERE id = '[REVIEW_ID]';
-- Expected: is_hidden = false, report_count = 0

-- Verify reports deleted
SELECT COUNT(*) FROM review_reports WHERE review_id = '[REVIEW_ID]';
-- Expected: 0
```

---

### TC-009: Hide Review

**Precondition:** At least one visible review

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Find a review with "Visible" status
3. Click "Hide" button
4. Confirm in the alert dialog

**Expected Results:**
- ✅ Confirmation dialog appears: "Are you sure you want to hide this review?"
- ✅ After confirming:
  - Row updates immediately:
    - Status badge changes to "Hidden" (gray)
  - Reports are NOT deleted (report_count unchanged)
  - Page does NOT refresh

**Database Verification:**
```sql
-- Verify review is hidden
SELECT id, is_hidden, report_count 
FROM reviews 
WHERE id = '[REVIEW_ID]';
-- Expected: is_hidden = true, report_count = [original count]

-- Verify reports still exist
SELECT COUNT(*) FROM review_reports WHERE review_id = '[REVIEW_ID]';
-- Expected: [original count]
```

---

### TC-010: Ban User

**Precondition:** At least one review with a valid reviewer_id

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Click "Ban User" button (red button in actions column)
3. Enter ban reason in prompt: "Test ban - offensive reviews"
4. Confirm in second alert dialog

**Expected Results:**
- ✅ First prompt appears: "Ban user [username]? Enter reason:"
- ✅ After entering reason, second confirmation appears: "PERMANENT ACTION: Ban [username] ([user_id])?"
- ✅ After confirming:
  - Success alert: "User [username] has been banned"
  - Page refreshes to reload list
  - (Note: Banned user's reviews may still appear in moderation queue)

**Database Verification:**
```sql
-- Verify user profile is banned
SELECT user_id, status 
FROM profiles 
WHERE user_id = '[USER_ID]';
-- Expected: status = 'banned'

-- Verify audit log (if audit_logs table exists)
SELECT action, user_id, metadata 
FROM audit_logs 
WHERE action = 'ban_user' AND user_id = '[USER_ID]'
ORDER BY created_at DESC 
LIMIT 1;
-- Expected: action = 'ban_user', metadata contains reason
```

---

### TC-011: Ban User - Cancel at Reason Prompt

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Click "Ban User" button
3. Click "Cancel" in the reason prompt (or leave empty and click OK)

**Expected Results:**
- ✅ No ban action occurs
- ✅ No database changes
- ✅ User remains active

---

### TC-012: Ban User - Cancel at Confirmation

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Click "Ban User" button
3. Enter reason: "Test cancel"
4. Click "Cancel" in confirmation dialog

**Expected Results:**
- ✅ No ban action occurs
- ✅ No database changes
- ✅ User remains active

---

### TC-013: Error Handling - Network Failure

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Open browser DevTools → Network tab
3. Enable "Offline" mode
4. Try to perform any action (Approve, Hide, Ban)

**Expected Results:**
- ✅ Alert appears with error message (e.g., "Error approving review: Failed to fetch")
- ✅ No database changes occur
- ✅ Page state remains consistent

---

### TC-014: Empty State - No Reports

**Precondition:** No reviews have reports

**Steps:**
1. Navigate to http://localhost:3000/reviews

**Expected Results:**
- ✅ Green success box appears
- ✅ Text: "✓ No reported reviews"
- ✅ Subtext: "All reviews are following community guidelines."
- ✅ No table visible
- ✅ No filter dropdown visible

---

### TC-015: Loading State

**Steps:**
1. Navigate to http://localhost:3000/reviews
2. Observe loading behavior (may be very fast)

**Expected Results:**
- ✅ Initially shows: "Loading reported reviews..."
- ✅ After data loads, loading text disappears
- ✅ Table or empty state appears

---

### TC-016: Navigation Link

**Steps:**
1. Navigate to http://localhost:3000 (admin dashboard)
2. Verify "Reviews" link exists in top navigation
3. Click "Reviews" link

**Expected Results:**
- ✅ "Reviews" link is visible in navigation bar
- ✅ Clicking navigates to http://localhost:3000/reviews
- ✅ Review moderation page loads

---

## 🔍 API Endpoint Tests

### API-001: GET /api/reviews/reported

**Test with curl:**
```bash
curl -X GET http://localhost:3000/api/reviews/reported \
  -H "Cache-Control: no-cache"
```

**Expected Response:**
```json
[
  {
    "id": "review_id_1",
    "review_id": "review_id_1",
    "report_count": 3,
    "is_hidden": true,
    "created_at": "2026-01-01T10:00:00Z",
    "review": {
      "id": "review_id_1",
      "reviewee_id": "user_id_1",
      "reviewer_id": "user_id_2",
      "rating": 5,
      "comment": "Test review"
    },
    "reports": [
      {
        "id": "report_id_1",
        "reporter_id": "user_id_3",
        "reason": "spam",
        "description": "This is spam",
        "created_at": "2026-01-01T10:00:00Z"
      }
    ]
  }
]
```

---

### API-002: POST /api/reviews/:reviewId/hide

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/reviews/[REVIEW_ID]/hide
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Review hidden successfully"
}
```

---

### API-003: POST /api/reviews/:reviewId/approve

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/reviews/[REVIEW_ID]/approve
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Review approved successfully"
}
```

---

<!-- Ban-user endpoint removed -->
---

## 📊 Test Summary Template

After completing tests, fill in this summary:

```
TASK REVIEW-007 - Manual Testing Summary
Date: [DATE]
Tester: [YOUR_NAME]

✅ PASSED:
- TC-001: View Reported Reviews List
- TC-002: Filter by Spam
- TC-003: Filter by Offensive
- TC-004: Filter No Results
- TC-005: Pagination Navigation
- TC-006: Pagination Last Page
- TC-007: Expand Reporter Details
- TC-008: Approve Review
- TC-009: Hide Review
-- TC-013: Error Handling
- TC-013: Error Handling
- TC-014: Empty State
- TC-015: Loading State
- TC-016: Navigation Link

❌ FAILED:
[List any failed test cases with details]

⚠️ BLOCKERS:
[List any issues that prevent further testing]

📝 NOTES:
[Any additional observations or issues]
```

---

## 🚀 Commands Reference

### Start Admin Portal
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run dev
```

### Run Unit Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm test review-moderation.unit.test.ts
```

### Run E2E Tests
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm test review-moderation.e2e.test.ts
```

### Typecheck
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run type-check
# OR
npx tsc --noEmit
```

### Lint
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run lint
```

---

## ✅ Verification Checklist

Before marking REVIEW-007 complete, verify:

### Code Implementation
- [x] Admin reviews page upgraded with filters
- [x] Pagination implemented (10 items per page)
- [x] Reporter details expansion works
 - [ ] Ban user API endpoint removed (deprecated)
- [x] Navigation updated with Reviews link

### Tests
- [x] Unit tests created for filter/pagination logic
- [x] E2E tests created for API endpoints
- [x] Manual test cases documented

### Database
- [x] `review_reports` table exists
- [x] `reviews.is_hidden` column exists
- [x] `reviews.report_count` column exists
- [x] RLS policies allow admin access

### Documentation
- [x] Manual testing guide created
- [x] API endpoints documented
- [x] Test summary template provided

---

**Testing complete! 🎉**

If all test cases pass, TASK REVIEW-007 is verified and ready for deployment.
