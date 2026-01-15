# REVIEW-002 Manual Testing Guide
# MODULE-08-REVIEWS-RATINGS: Mutual Review Flow

**Task:** REVIEW-002 - Implement Mutual Review Flow (Both Users Review Each Other)  
**Status:** Ready for Testing  
**Last Updated:** January 14, 2026

---

## 📋 Prerequisites

### 1. Database Setup (IMPORTANT - Run SQL First)

**Run this SQL in Supabase Production SQL Editor:**

```sql
-- Verify reviews table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
ORDER BY ordinal_position;

-- Expected: id, trade_id, reviewer_id, reviewee_id, rating, comment, 
--           is_anonymous, is_hidden, report_count, created_at, updated_at
```

### 2. Test Users Setup

You need **TWO test users** to test mutual reviews:

- **User A (Buyer)**: Test buyer account
- **User B (Seller)**: Test seller account

### 3. Completed Trade Required

You need a **completed trade** between User A and User B:

1. Create listing as User B
2. Purchase as User A
3. Mark trade as completed (both users)

---

## 🧪 Test Cases

### TEST CASE 1: Buyer Reviews Seller

**Objective:** Verify buyer can submit review for seller

**Steps:**
1. Log in as **User A (Buyer)**
2. Navigate to **Dashboard** → **My Trades** tab
3. Find the completed trade
4. Tap on the trade to open **Trade Details**
5. Verify you see:
   - ✓ Review status section showing:
     - "You haven't reviewed the seller" (unchecked)
     - "The seller hasn't reviewed you" (unchecked)
   - ✓ "Review the Seller" button (enabled, orange)

**Action:** Tap "Review the Seller" button

**Expected Navigation:**
- Navigate to **Submit Review** screen
- Screen title: "Review [Seller Name]"
- Rating stars: 1-5 (selectable)
- Comment field: Optional, max 500 chars
- Anonymous checkbox: Unchecked by default
- Submit button: Enabled after selecting rating

**Action:** Submit Review
1. Select **5 stars**
2. Enter comment: "Great seller! Item as described."
3. Tap **Submit Review**

**Expected Results:**
- ✓ Success alert: "Review submitted!"
- ✓ Navigate back to Trade Details
- ✓ Review status updated:
  - "You have reviewed the seller" (green checkmark)
  - "The seller hasn't reviewed you" (still unchecked)
- ✓ "Review the Seller" button disabled or shows "Already Reviewed"

**Database Verification (Supabase SQL Editor):**
```sql
SELECT * FROM reviews 
WHERE trade_id = '[YOUR_TRADE_ID]' 
AND reviewer_id = '[BUYER_USER_ID]';

-- Expected: 1 row with rating=5, comment='Great seller! Item as described.'
```

---

### TEST CASE 2: Prevent Duplicate Buyer Review

**Objective:** Verify buyer cannot submit second review

**Steps:**
1. Still logged in as **User A (Buyer)**
2. On **Trade Details** screen
3. Verify "Review the Seller" button is:
   - ✓ Disabled (grayed out)
   - ✓ Shows "Already Reviewed" text

**Action:** Attempt to tap the button

**Expected Results:**
- ✓ Button is disabled, no action occurs
- ✓ No navigation to Submit Review screen

---

### TEST CASE 3: Seller Reviews Buyer (Independent)

**Objective:** Verify seller can submit review for buyer independently

**Steps:**
1. Log out from User A
2. Log in as **User B (Seller)**
3. Navigate to **Dashboard** → **My Trades** tab
4. Find the same completed trade
5. Tap on the trade to open **Trade Details**
6. Verify you see:
   - ✓ Review status section showing:
     - "You haven't reviewed the buyer" (unchecked)
     - "The buyer has reviewed you" (green checkmark) ← Important!
   - ✓ "Review the Buyer" button (enabled, orange)

**Action:** Tap "Review the Buyer" button

**Expected Navigation:**
- Navigate to **Submit Review** screen
- Screen title: "Review [Buyer Name]"

**Action:** Submit Review
1. Select **4 stars**
2. Enter comment: "Good buyer, smooth transaction."
3. Tap **Submit Review**

**Expected Results:**
- ✓ Success alert: "Review submitted!"
- ✓ Navigate back to Trade Details
- ✓ Review status updated:
  - "You have reviewed the buyer" (green checkmark)
  - "The buyer has reviewed you" (green checkmark)
- ✓ Both parties now show as "reviewed"

**Database Verification:**
```sql
SELECT * FROM reviews 
WHERE trade_id = '[YOUR_TRADE_ID]'
ORDER BY created_at;

-- Expected: 2 rows
-- Row 1: Buyer → Seller (rating=5)
-- Row 2: Seller → Buyer (rating=4)
```

---

### TEST CASE 4: View Reviews on Seller Profile

**Objective:** Verify buyer's review appears on seller's profile

**Steps:**
1. Log in as **User B (Seller)** (or User A)
2. Navigate to **Profile** screen
3. Scroll down to **Reviews** section

**Expected Results:**
- ✓ Reviews section visible
- ✓ Average rating: **5.0** (if this is the only review for seller)
- ✓ Total reviews: **1 review**
- ✓ Rating breakdown:
  - 5 ★: 100% (1 review)
  - 4 ★: 0%
  - 3 ★: 0%
  - 2 ★: 0%
  - 1 ★: 0%
- ✓ Recent Reviews list:
  - Shows **1 review card**
  - Reviewer name: "User A" (or anonymous if checked)
  - Rating: 5 stars
  - Comment: "Great seller! Item as described."
  - Date: Today's date

---

### TEST CASE 5: View Reviews on Buyer Profile

**Objective:** Verify seller's review appears on buyer's profile

**Steps:**
1. Log in as **User A (Buyer)** (or User B)
2. Navigate to **Profile** screen
3. Scroll down to **Reviews** section

**Expected Results:**
- ✓ Reviews section visible
- ✓ Average rating: **4.0** (if this is the only review for buyer)
- ✓ Total reviews: **1 review**
- ✓ Rating breakdown:
  - 5 ★: 0%
  - 4 ★: 100% (1 review)
  - 3 ★: 0%
  - 2 ★: 0%
  - 1 ★: 0%
- ✓ Recent Reviews list:
  - Shows **1 review card**
  - Reviewer name: "User B" (or anonymous if checked)
  - Rating: 4 stars
  - Comment: "Good buyer, smooth transaction."
  - Date: Today's date

---

### TEST CASE 6: Anonymous Review Display

**Objective:** Verify anonymous reviews hide reviewer identity

**Steps:**
1. Create another completed trade between User A and User B
2. Log in as **User A (Buyer)**
3. Navigate to Trade Details
4. Tap "Review the Seller"
5. Select **5 stars**
6. Enter comment: "Another great transaction!"
7. **Check "Post anonymously" checkbox** ← Important!
8. Submit review

**Expected Results:**
- ✓ Review submitted successfully
- ✓ On seller's profile:
  - Reviewer name: "Anonymous User"
  - Profile image: Generic placeholder (first letter "A")
  - Rating and comment still visible

---

### TEST CASE 7: Multiple Reviews Calculation

**Objective:** Verify average rating updates with multiple reviews

**Steps:**
1. Ensure seller (User B) has 2 reviews:
   - Review 1: 5 stars
   - Review 2: 5 stars (anonymous)
2. Navigate to User B's profile
3. Check Reviews section

**Expected Results:**
- ✓ Average rating: **5.0**
- ✓ Total reviews: **2 reviews**
- ✓ Rating breakdown:
  - 5 ★: 100% (2 reviews)
- ✓ Recent Reviews list: Shows both reviews

**Add a 3-star review:**
4. Create third completed trade
5. Submit 3-star review
6. Refresh profile

**Expected Results:**
- ✓ Average rating: **4.3** (rounded)
- ✓ Total reviews: **3 reviews**
- ✓ Rating breakdown:
  - 5 ★: 67% (2 reviews)
  - 3 ★: 33% (1 review)

---

## ✅ Verification Checklist

### Database (Supabase SQL Editor)

```sql
-- 1. Verify both reviews exist
SELECT 
  r.id,
  r.trade_id,
  r.rating,
  r.comment,
  r.is_anonymous,
  reviewer.name AS reviewer_name,
  reviewee.name AS reviewee_name
FROM reviews r
LEFT JOIN profiles reviewer ON r.reviewer_id = reviewer.user_id
LEFT JOIN profiles reviewee ON r.reviewee_id = reviewee.user_id
WHERE r.trade_id = '[YOUR_TRADE_ID]'
ORDER BY r.created_at;

-- Expected: 2 rows (buyer→seller, seller→buyer)

-- 2. Verify unique constraint works
-- Try to insert duplicate (should fail):
INSERT INTO reviews (trade_id, reviewer_id, reviewee_id, rating)
VALUES ('[TRADE_ID]', '[BUYER_ID]', '[SELLER_ID]', 3);

-- Expected error: duplicate key value violates unique constraint "unique_review_per_trade"
```

### UI Components

- [ ] ✓ Review status indicators update in real-time
- [ ] ✓ Green checkmarks show correctly for completed reviews
- [ ] ✓ Gray circles show for pending reviews
- [ ] ✓ Review button disables after submitting
- [ ] ✓ Button text changes to "Already Reviewed"
- [ ] ✓ Average rating displays correctly (1 decimal place)
- [ ] ✓ Total review count updates immediately
- [ ] ✓ Rating breakdown bars update correctly
- [ ] ✓ Review cards display in order (newest first)
- [ ] ✓ Anonymous reviews show "Anonymous User"
- [ ] ✓ Date formatting is correct (e.g., "Jan 14, 2026")

### Navigation

- [ ] ✓ "Review" button navigates to Submit Review screen
- [ ] ✓ Submit Review navigates back to Trade Details
- [ ] ✓ Profile screen shows Reviews section
- [ ] ✓ Clicking on reviews doesn't crash app

---

## 🐛 Common Issues & Fixes

### Issue 1: "Reviews section not showing on profile"

**Cause:** User has 0 reviews  
**Fix:** This is expected. Reviews section only appears when user has at least 1 review.

### Issue 2: "Review button doesn't show after trade completion"

**Cause:** Trade status is not 'completed'  
**Fix:** Verify trade status in database:
```sql
SELECT id, status, completed_at FROM trades WHERE id = '[TRADE_ID]';
```
Status must be 'completed' and completed_at must not be null.

### Issue 3: "Can't see other user's review"

**Cause:** RLS policies or review fetch logic  
**Fix:** Check console logs for errors. Verify:
```sql
SELECT * FROM reviews WHERE reviewee_id = '[YOUR_USER_ID]' AND is_hidden = false;
```

### Issue 4: "Average rating calculation wrong"

**Cause:** Hidden reviews included or rounding issue  
**Fix:** Verify calculation:
```sql
SELECT 
  AVG(rating) as avg_rating,
  COUNT(*) as total_reviews
FROM reviews 
WHERE reviewee_id = '[USER_ID]' AND is_hidden = false;
```

---

## 📊 Test Summary Template

Copy this template to document your test results:

```
=== REVIEW-002 Manual Testing Results ===
Date: [DATE]
Tester: [YOUR_NAME]
Environment: [Production/Staging]

Test Case 1 - Buyer Reviews Seller: ✅ / ❌
Test Case 2 - Prevent Duplicate: ✅ / ❌
Test Case 3 - Seller Reviews Buyer: ✅ / ❌
Test Case 4 - Seller Profile Reviews: ✅ / ❌
Test Case 5 - Buyer Profile Reviews: ✅ / ❌
Test Case 6 - Anonymous Review: ✅ / ❌
Test Case 7 - Multiple Reviews: ✅ / ❌

Issues Found:
- [List any issues or bugs]

Notes:
- [Any additional observations]
```

---

## 🚀 Next Steps After Testing

1. If all tests pass:
   - ✅ Mark REVIEW-002 as complete
   - ✅ Proceed to REVIEW-003 (Anonymous Review Option - already implemented in REVIEW-001)
   - ✅ Proceed to REVIEW-004 (Skip Review Option)

2. If issues found:
   - Document issues in test summary
   - Create bug tickets
   - Retest after fixes

---

**End of Manual Testing Guide**
