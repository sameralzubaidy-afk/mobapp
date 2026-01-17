# REVIEW-005 Manual Testing Guide
## Display Average Rating and Reviews on User Profile

**Module:** MODULE-08-REVIEWS-RATINGS  
**Task:** REVIEW-005  
**Status:** ✅ ALREADY IMPLEMENTED  
**Date:** January 15, 2026

---

## 📋 Pre-Test Setup

### 1. Database Verification

**Run this SQL in Supabase SQL Editor:**

```sql
-- Verify reviews table exists with required columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reviews'
ORDER BY ordinal_position;

-- Check if you have test data
SELECT 
  reviewee_id,
  COUNT(*) as review_count,
  AVG(rating) as avg_rating
FROM reviews
WHERE is_hidden = false
GROUP BY reviewee_id;
```

**Expected Results:**
- ✅ `reviews` table exists with columns: `id`, `trade_id`, `reviewer_id`, `reviewee_id`, `rating`, `comment`, `is_anonymous`, `is_hidden`, `report_count`, `created_at`, `updated_at`
- ✅ At least one user has reviews (if not, create test reviews first)

---

### 2. Create Test Reviews (If Needed)

**If you don't have test data, run this in Supabase SQL Editor:**

```sql
-- Insert sample reviews for a test user
-- Replace 'YOUR_USER_ID' with an actual user ID from your users table

INSERT INTO reviews (trade_id, reviewer_id, reviewee_id, rating, comment, is_anonymous)
VALUES
  ('test-trade-1', (SELECT id FROM users LIMIT 1 OFFSET 1), 'YOUR_USER_ID', 5, 'Excellent trader! Fast and reliable.', false),
  ('test-trade-2', (SELECT id FROM users LIMIT 1 OFFSET 2), 'YOUR_USER_ID', 4, 'Good experience overall.', false),
  ('test-trade-3', (SELECT id FROM users LIMIT 1 OFFSET 3), 'YOUR_USER_ID', 5, 'Highly recommended!', false),
  ('test-trade-4', (SELECT id FROM users LIMIT 1 OFFSET 4), 'YOUR_USER_ID', 3, 'It was okay.', false),
  ('test-trade-5', (SELECT id FROM users LIMIT 1 OFFSET 5), 'YOUR_USER_ID', 4, NULL, false),
  ('test-trade-6', (SELECT id FROM users LIMIT 1 OFFSET 6), 'YOUR_USER_ID', 5, 'Perfect transaction!', true); -- Anonymous

-- Verify insertions
SELECT * FROM reviews WHERE reviewee_id = 'YOUR_USER_ID';
```

---

## 🧪 Test Cases

### Test Case 1: Display Average Rating

**Objective:** Verify that the user's average rating is displayed correctly on their profile.

**Steps:**
1. Open the app and log in as a user
2. Navigate to **Profile** screen (bottom navigation bar)
3. Scroll to the **Reviews** section

**Expected Results:**
- ✅ Reviews section is visible
- ✅ Large average rating number is displayed (e.g., "4.5")
- ✅ Average is rounded to 1 decimal place
- ✅ Star rating component shows filled stars matching the average (rounded)
- ✅ Text says "Based on X reviews" where X is the correct count

**Pass/Fail:** ⬜

**Notes:**
```
Average Rating Displayed: _______
Total Reviews Count: _______
Stars Displayed Correctly: Yes / No
```

---

### Test Case 2: Rating Breakdown Chart

**Objective:** Verify that the rating breakdown chart displays correct percentages.

**Steps:**
1. From the Profile screen, locate the rating breakdown section
2. Observe the horizontal bars for each star level (5-1 stars)
3. Check that counts and percentages match

**Expected Results:**
- ✅ Breakdown shows all 5 star levels (5★, 4★, 3★, 2★, 1★)
- ✅ Each row shows: star label, progress bar, count number
- ✅ Progress bar width represents percentage (e.g., if 50% are 5-star, bar should be half-width)
- ✅ Count numbers match actual reviews
- ✅ Sum of all counts equals total reviews

**Pass/Fail:** ⬜

**Manual Verification:**
```
5★: Count _____ (Expected: _____)
4★: Count _____ (Expected: _____)
3★: Count _____ (Expected: _____)
2★: Count _____ (Expected: _____)
1★: Count _____ (Expected: _____)

Total: _____ (Should match total reviews)
```

**Calculate Expected Percentages:**
- If total = 10 reviews
  - 5★: 6 reviews → 60% bar width
  - 4★: 3 reviews → 30% bar width
  - 3★: 1 review → 10% bar width
  - 2★: 0 reviews → 0% bar width
  - 1★: 0 reviews → 0% bar width

---

### Test Case 3: Recent Reviews List

**Objective:** Verify that recent reviews are displayed correctly.

**Steps:**
1. Scroll down to the "Recent Reviews" section
2. Check the list of reviews
3. Verify up to 5 reviews are shown

**Expected Results:**
- ✅ Section title says "Recent Reviews"
- ✅ Up to 5 most recent reviews are displayed
- ✅ Each review shows:
  - Reviewer avatar (or placeholder if anonymous)
  - Reviewer name (or "Anonymous User" if anonymous)
  - Star rating (1-5 stars)
  - Date (formatted as "Mon DD, YYYY")
  - Comment text (if provided)
- ✅ Reviews are ordered by date (most recent first)
- ✅ If no reviews, shows "No reviews yet"

**Pass/Fail:** ⬜

**Notes:**
```
Number of Reviews Displayed: _______
First Review Date: _______
Last Review Date: _______
Are reviews in descending order? Yes / No
```

---

### Test Case 4: Anonymous Review Display

**Objective:** Verify that anonymous reviews hide reviewer identity.

**Steps:**
1. Locate an anonymous review in the recent reviews list (if you created one in setup)
2. Check the reviewer information

**Expected Results:**
- ✅ Reviewer name shows "Anonymous User"
- ✅ Avatar shows placeholder (letter "A" in circle)
- ✅ No profile image is displayed
- ✅ Rating and comment are still visible
- ✅ Anonymous review is counted in total reviews and average rating

**Pass/Fail:** ⬜

**Notes:**
```
Anonymous review found: Yes / No
Displays "Anonymous User": Yes / No
Avatar hidden: Yes / No
```

---

### Test Case 5: Profile with No Reviews

**Objective:** Verify behavior when user has no reviews.

**Steps:**
1. Log in as a different user (or create a new test user)
2. Navigate to their Profile screen
3. Check for reviews section

**Expected Results:**
- ✅ Reviews section is NOT displayed (conditional rendering)
- ✅ No "0.0 average rating" shown
- ✅ Profile still shows other sections (avatar, name, bio, badges, etc.)

**Pass/Fail:** ⬜

**Notes:**
```
User with no reviews: _______
Reviews section hidden: Yes / No
```

---

### Test Case 6: Average Rating Calculation Accuracy

**Objective:** Verify that average rating calculation is mathematically correct.

**Steps:**
1. From Supabase SQL Editor, calculate expected average:
   ```sql
   SELECT 
     reviewee_id,
     AVG(rating) as avg_rating,
     COUNT(*) as total_reviews
   FROM reviews
   WHERE reviewee_id = 'YOUR_USER_ID'
     AND is_hidden = false
   GROUP BY reviewee_id;
   ```
2. Compare SQL result with displayed average on Profile screen
3. Verify rounding (should round to 1 decimal place)

**Expected Results:**
- ✅ Displayed average matches SQL calculation (±0.1 due to rounding)
- ✅ Rounding is correct (e.g., 4.333 → 4.3, 4.666 → 4.7)

**Pass/Fail:** ⬜

**Manual Calculation:**
```
SQL Average: _______
Displayed Average: _______
Match: Yes / No

Example:
Ratings: 5, 5, 4, 3, 5 = 22 / 5 = 4.4
Should display: 4.4
```

---

### Test Case 7: Hidden Reviews Excluded

**Objective:** Verify that hidden reviews are not displayed or counted.

**Steps:**
1. In Supabase SQL Editor, hide a review:
   ```sql
   UPDATE reviews
   SET is_hidden = true
   WHERE id = 'TEST_REVIEW_ID';
   ```
2. Refresh the Profile screen (pull to refresh or reopen app)
3. Check that the hidden review is not visible
4. Verify that average rating excludes the hidden review

**Expected Results:**
- ✅ Hidden review does not appear in recent reviews list
- ✅ Total review count excludes hidden review
- ✅ Average rating calculation excludes hidden review
- ✅ Rating breakdown excludes hidden review

**Pass/Fail:** ⬜

**Notes:**
```
Hidden review ID: _______
Total reviews before hiding: _______
Total reviews after hiding: _______
Average before: _______ After: _______
```

---

### Test Case 8: Loading States

**Objective:** Verify loading indicators are shown while fetching reviews.

**Steps:**
1. Log out and log back in (to force profile reload)
2. Navigate to Profile screen
3. Observe loading behavior

**Expected Results:**
- ✅ Loading indicator shows while reviews are being fetched
- ✅ "Loading profile..." text appears initially
- ✅ Reviews section appears after data loads
- ✅ No visual glitches or empty states during loading

**Pass/Fail:** ⬜

---

### Test Case 9: Reviewer Profile Information

**Objective:** Verify that reviewer names and avatars are correctly displayed for non-anonymous reviews.

**Steps:**
1. Locate a non-anonymous review in the recent reviews list
2. Check the reviewer name and avatar
3. Verify it matches the actual reviewer's profile

**Expected Results:**
- ✅ Reviewer name is displayed correctly (first name + last name)
- ✅ Reviewer avatar loads (if they have one)
- ✅ If no avatar, placeholder shows correct initial letter
- ✅ Avatar images resolve correctly (CDN links work)

**Pass/Fail:** ⬜

**Notes:**
```
Reviewer name displayed: _______
Avatar loaded: Yes / No
Matches actual reviewer: Yes / No
```

---

### Test Case 10: Large Number of Reviews with View All Toggle

**Objective:** Verify display when user has many reviews (10+ reviews) and test the new "View All" button functionality.

**Steps:**
1. If needed, create additional test reviews (see Setup section) to have 10+ reviews
2. Navigate to Profile screen
3. Scroll to the "Recent Reviews" section
4. Verify button appears and works correctly

**Expected Results:**
- ✅ By default, only 5 most recent reviews are displayed
- ✅ A "View All (N)" button appears (where N = total number of reviews)
- ✅ Button has blue text on light blue background
- ✅ Clicking "View All (N)" expands to show ALL reviews
- ✅ Section title changes to "All Reviews" when expanded
- ✅ "View All (N)" button changes to "Show Less" when expanded
- ✅ Clicking "Show Less" collapses back to first 5 reviews
- ✅ Section title changes back to "Recent Reviews" when collapsed
- ✅ Average rating and breakdown include ALL reviews (not just displayed 5)
- ✅ No performance issues or lag when expanding to show many reviews
- ✅ Scroll works smoothly through all reviews
- ✅ Reviews remain ordered by date (most recent first) when viewing all

**Pass/Fail:** ⬜

**Notes:**
```
Total reviews in database: _______
Reviews displayed initially: _______ (should be 5)
View All button visible: Yes / No
Total shown when expanded: _______ (should match total)
Average includes all reviews: Yes / No
Button toggle works smoothly: Yes / No
```

**Visual Verification:**
```
Initial State:
  - Reviews shown: 5
  - Title: "Recent Reviews"
  - Button: "View All (X)"

After clicking "View All":
  - Reviews shown: All (e.g., 15)
  - Title: "All Reviews"
  - Button: "Show Less"

After clicking "Show Less":
  - Reviews shown: 5
  - Title: "Recent Reviews"
  - Button: "View All (X)"
```

---

## 🔍 Edge Cases to Test

### Edge Case 1: All Same Rating
- Create 5 reviews all with 5-star rating
- Expected: Average = 5.0, breakdown shows 100% for 5★

### Edge Case 2: Extreme Ratings
- Create reviews with only 1★ and 5★ (no middle ratings)
- Expected: Average calculated correctly, breakdown shows gaps

### Edge Case 3: Single Review
- User has only 1 review
- Expected: Average matches that single rating, text says "1 review" (singular)

### Edge Case 4: Very Long Comment
- Review with 500-character comment
- Expected: Comment displays fully, wraps correctly, no truncation (unless designed)

### Edge Case 5: Special Characters in Comments
- Review with emojis, quotes, apostrophes
- Expected: Displays correctly without escaping issues

---

## 📊 Performance Checklist

- [ ] Profile loads in < 2 seconds
- [ ] Reviews section loads without blocking UI
- [ ] Smooth scrolling through reviews
- [ ] Avatar images load progressively
- [ ] No memory leaks (can view profile multiple times)
- [ ] Works on slow network (test with Network Link Conditioner)

---

## 🐛 Known Issues to Check

1. **Avatar URL Resolution:** Ensure `resolveAvatarUrl()` works for reviewer avatars
2. **Date Formatting:** Verify dates display in correct format for user's locale
3. **Percentage Rounding:** Check that bar widths round correctly (no 0.5% bars)
4. **Anonymous Reviews:** Confirm that anonymous reviews don't leak reviewer ID

---

## ✅ Verification Checklist (MODULE-08-REVIEWS & RATINGS-VERIFICATION.md)

### Satisfied Items:

- ✅ **Profile with reviews (Deliverables - Frontend Components)**
  - Average rating display
  - Total review count
  - Rating breakdown chart
  - Recent reviews list
  - Pagination handled (first 5 shown)

- ✅ **Feature Flows - Display Reviews on Profile Flow**
  - User views profile → stats displayed
  - Average rating calculated correctly
  - Breakdown chart shows percentages
  - Recent reviews listed

- ✅ **UI/UX Tests - UserProfileScreen**
  - Average rating displayed prominently
  - Total review count shown
  - Rating breakdown chart displays correctly
  - Recent reviews listed
  - Anonymous reviews handled correctly

- ✅ **Database Implications**
  - Query reviews filtered by `reviewee_id`
  - Exclude hidden reviews: `is_hidden = false`
  - Order by `created_at DESC`

---

## 📝 Test Execution Summary

**Tester Name:** _________________________  
**Date:** _________________________  
**App Version:** _________________________  
**Device/Emulator:** _________________________

**Overall Result:**
- [ ] All tests passed
- [ ] Some tests failed (see notes)
- [ ] Blocked (unable to test)

**Critical Issues Found:**
```
1. _________________________________
2. _________________________________
3. _________________________________
```

**Sign-off:** _________________________

---

## 🔗 Related Files

**Implementation Files:**
- `/p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx` (Lines 220-275)
- `/p2p-kids-marketplace/src/services/review.ts` (Lines 138-260)
- `/p2p-kids-marketplace/src/components/ReviewCard.tsx` (Complete)
- `/p2p-kids-marketplace/src/components/StarRating.tsx` (Complete)

**Test Files:**
- `/p2p-kids-marketplace/src/__tests__/services/review-profile-display.test.ts` (NEW)
- `/p2p-kids-marketplace/src/__tests__/e2e/review-005-profile-display.e2e.ts` (NEW)

---

## 📞 Support

If you encounter issues during testing:
1. Check Supabase logs for database errors
2. Verify RLS policies allow reading reviews
3. Check network tab for failed API calls
4. Review console logs for JavaScript errors

**Common Fixes:**
- Clear app cache and restart
- Verify test user has reviews in database
- Check that `is_hidden = false` for test reviews
- Ensure reviewer profiles exist in `profiles` table
