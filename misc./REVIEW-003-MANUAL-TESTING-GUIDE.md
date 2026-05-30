# REVIEW-003: Anonymous Review Option - Manual Testing Guide

**Module:** MODULE-08-REVIEWS-RATINGS  
**Task:** REVIEW-003 - Implement Anonymous Review Option  
**Status:** ✅ Ready for Testing  
**Date:** January 15, 2026

---

## 📋 Overview

This document provides step-by-step manual testing procedures for the Anonymous Review feature. Anonymous reviews allow users to provide feedback while hiding their identity from the reviewee.

**Key Features:**
- Users can check "Post anonymously" when submitting a review
- Anonymous reviews display "Anonymous User" instead of real name
- Profile images are hidden for anonymous reviews
- Reviewer identity is still stored in database (for moderation purposes)

---

## 🔧 Prerequisites

Before testing, ensure:

1. ✅ Supabase connection configured
2. ✅ Test users created:
   - **User A:** test-reviewer-001 (will post anonymous review)
   - **User B:** test-reviewee-001 (will receive anonymous review)
3. ✅ At least 1 completed trade between User A and User B
4. ✅ `reviews` table exists with `is_anonymous` column
5. ✅ RLS policies enabled on reviews table
6. ✅ App running on iOS Simulator or Android Emulator

---

## 🧪 Test Cases

### **Test Case 1: Submit Anonymous Review**

**Objective:** Verify user can submit a review anonymously

**Steps:**

1. **Login as User A (Reviewer)**
   - Open app
   - Login with credentials for User A
   - Navigate to Dashboard

2. **Navigate to Completed Trade**
   - Tap "Trades" or "Activity" tab
   - Find completed trade with User B
   - Tap on the trade to view details

3. **Open Review Submission Screen**
   - Tap "Review User B" button
   - Verify screen title shows "Review [User B Name]"

4. **Select Rating**
   - Tap on 4th star to give 4-star rating
   - Verify all 4 stars turn yellow/gold
   - Verify selected rating visually clear

5. **Enter Comment**
   - Tap on comment field
   - Type: "This is anonymous feedback for privacy"
   - Verify character count updates (e.g., "45/500 characters")

6. **✅ Enable Anonymous Option**
   - Tap the checkbox next to "Post anonymously"
   - Verify checkbox is checked (blue checkmark)
   - Verify label "Post anonymously" is clear

7. **Submit Review**
   - Tap "Submit Review" button
   - Wait for submission (button may show loading indicator)

**Expected Results:**

- ✅ Success alert appears: "Your review has been submitted!"
- ✅ Screen navigates back to trade details
- ✅ No errors shown
- ✅ Review button no longer visible (already reviewed)

**Pass Criteria:**
- [ ] Review submitted without errors
- [ ] Success message shown
- [ ] Navigation works correctly

---

### **Test Case 2: View Anonymous Review as Reviewee**

**Objective:** Verify anonymous review displays correctly without revealing reviewer identity

**Steps:**

1. **Login as User B (Reviewee)**
   - Logout from User A account
   - Login with credentials for User B

2. **Navigate to Profile**
   - Tap "Profile" tab (bottom navigation)
   - Scroll down to "Reviews" section

3. **Locate Anonymous Review**
   - Find the review submitted by User A
   - Verify it appears in the list

4. **Verify Anonymous Display**
   - Check reviewer name shows: **"Anonymous User"**
   - Check profile image: **Generic placeholder avatar** (NOT User A's photo)
   - Check rating: **4 stars** displayed correctly
   - Check comment: **"This is anonymous feedback for privacy"**
   - Check timestamp: Reasonable date/time shown

**Expected Results:**

- ✅ Review visible in list
- ❌ User A's name **NOT shown**
- ❌ User A's profile image **NOT shown**
- ✅ "Anonymous User" displayed instead
- ✅ Generic avatar placeholder shown
- ✅ Rating and comment correct
- ✅ Date/time shown

**Pass Criteria:**
- [ ] "Anonymous User" shown (not real name)
- [ ] Generic avatar shown (not real profile image)
- [ ] Rating and comment match submission
- [ ] No way to identify reviewer from UI

---

### **Test Case 3: Submit Non-Anonymous Review**

**Objective:** Verify default (non-anonymous) review behavior still works

**Steps:**

1. **Login as User B (Reviewer)**
   - Use User B credentials

2. **Navigate to Trade and Review Screen**
   - Find completed trade with User A
   - Tap "Review User A" button

3. **Submit Public Review**
   - Select 5 stars
   - Enter comment: "Great experience with this trade!"
   - ❌ **UNCHECK** "Post anonymously" (or leave default)
   - Tap "Submit Review"

**Expected Results:**

- ✅ Review submitted successfully
- ✅ Success message shown

**Pass Criteria:**
- [ ] Review submitted without errors
- [ ] Success confirmation shown

---

### **Test Case 4: View Non-Anonymous Review**

**Objective:** Verify non-anonymous reviews show reviewer identity correctly

**Steps:**

1. **Login as User A (Reviewee)**
   - Switch to User A account

2. **View Profile Reviews**
   - Navigate to Profile → Reviews section
   - Locate review from User B

3. **Verify Public Review Display**
   - Check reviewer name: **User B's real name shown**
   - Check profile image: **User B's real photo shown**
   - Check rating: **5 stars**
   - Check comment: **"Great experience with this trade!"**

**Expected Results:**

- ✅ User B's real name displayed
- ✅ User B's profile image displayed
- ✅ Rating and comment correct
- ✅ Timestamp shown

**Pass Criteria:**
- [ ] Reviewer identity fully visible
- [ ] Profile image matches User B
- [ ] Rating and comment accurate

---

### **Test Case 5: Mixed Anonymous and Public Reviews**

**Objective:** Verify profile can display both anonymous and public reviews correctly

**Steps:**

1. **Setup Multiple Reviews**
   - Ensure User A's profile has:
     - At least 1 anonymous review
     - At least 1 public (non-anonymous) review

2. **View Profile with Mixed Reviews**
   - Login as User A
   - Navigate to own profile
   - Scroll to reviews section

3. **Verify Mixed Display**
   - Identify which reviews are anonymous ("Anonymous User")
   - Identify which reviews are public (real names)
   - Verify no confusion between the two types
   - Verify both display correctly side-by-side

**Expected Results:**

- ✅ Anonymous reviews show "Anonymous User"
- ✅ Public reviews show real names
- ✅ No visual confusion
- ✅ Both types coexist correctly

**Pass Criteria:**
- [ ] Both anonymous and public reviews visible
- [ ] Clear distinction between types
- [ ] No UI glitches or overlap

---

### **Test Case 6: Anonymous Review Without Comment**

**Objective:** Verify anonymous reviews work without optional comment field

**Steps:**

1. **Submit Anonymous Review (No Comment)**
   - Login as User C (new reviewer)
   - Navigate to completed trade
   - Tap "Review" button
   - Select 3 stars
   - **Do NOT enter comment** (leave blank)
   - ✅ Check "Post anonymously"
   - Tap "Submit Review"

**Expected Results:**

- ✅ Review submitted successfully
- ✅ No errors about missing comment

**Pass Criteria:**
- [ ] Anonymous review saved without comment
- [ ] No validation errors

---

### **Test Case 7: Toggle Anonymous Checkbox**

**Objective:** Verify anonymous checkbox can be toggled on/off

**Steps:**

1. **Open Review Screen**
   - Navigate to review submission

2. **Toggle Checkbox Multiple Times**
   - Tap checkbox: Verify checkmark appears
   - Tap again: Verify checkmark disappears
   - Tap again: Verify checkmark appears
   - Repeat 3-4 times

3. **Submit with Final State**
   - Leave checkbox **checked**
   - Submit review
   - Verify review is anonymous

**Expected Results:**

- ✅ Checkbox toggles smoothly
- ✅ Visual feedback clear (checkmark visible/hidden)
- ✅ Final state respected (checked = anonymous)

**Pass Criteria:**
- [ ] Checkbox toggles correctly
- [ ] Final state determines review type
- [ ] No UI glitches

---

## 🗄️ Database Verification

### **Test Case 8: Verify Database Record (Admin)**

**Objective:** Ensure anonymous review data stored correctly in database

**Steps:**

1. **Open Supabase Dashboard**
   - Login to Supabase project
   - Navigate to Table Editor
   - Select `reviews` table

2. **Find Anonymous Review**
   - Filter by `is_anonymous = true`
   - Locate the test review submitted earlier

3. **Verify Fields**
   - `id`: Valid UUID
   - `trade_id`: Matches test trade
   - `reviewer_id`: **User A's ID stored** (for moderation)
   - `reviewee_id`: User B's ID
   - `rating`: 4
   - `comment`: "This is anonymous feedback for privacy"
   - `is_anonymous`: **true**
   - `is_hidden`: false
   - `report_count`: 0
   - `created_at`: Reasonable timestamp
   - `updated_at`: Reasonable timestamp

**Expected Results:**

- ✅ `is_anonymous` field set to `true`
- ✅ `reviewer_id` still stored (not null)
- ✅ All fields populated correctly

**Pass Criteria:**
- [ ] is_anonymous = true
- [ ] reviewer_id exists (for moderation)
- [ ] All other fields correct

---

## 🚨 Error Cases

### **Test Case 9: Submit Review Without Rating**

**Objective:** Verify validation requires rating even for anonymous reviews

**Steps:**

1. **Attempt Submission Without Rating**
   - Open review screen
   - Do NOT select any stars (0 stars)
   - Enter comment
   - Check "Post anonymously"
   - Tap "Submit Review"

**Expected Results:**

- ❌ Alert shown: "Please select a star rating"
- ❌ Review NOT submitted

**Pass Criteria:**
- [ ] Validation error shown
- [ ] Review not saved to database

---

### **Test Case 10: Exceed Character Limit**

**Objective:** Verify comment character limit enforced for anonymous reviews

**Steps:**

1. **Enter Long Comment**
   - Open review screen
   - Select rating
   - Paste a 600-character comment (exceeds 500 limit)
   - Check "Post anonymously"
   - Attempt to submit

**Expected Results:**

- ✅ Character count shows "500/500" (capped)
- ✅ Input field truncates/prevents typing beyond 500
- ✅ Review submitted with 500 characters max

**Pass Criteria:**
- [ ] Character limit enforced (500 chars)
- [ ] No error on submission
- [ ] Comment truncated correctly

---

## 📊 Test Summary

### Checklist

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Submit Anonymous Review | ⬜ | |
| TC2: View Anonymous Review | ⬜ | |
| TC3: Submit Non-Anonymous Review | ⬜ | |
| TC4: View Non-Anonymous Review | ⬜ | |
| TC5: Mixed Anonymous and Public | ⬜ | |
| TC6: Anonymous Without Comment | ⬜ | |
| TC7: Toggle Anonymous Checkbox | ⬜ | |
| TC8: Database Verification | ⬜ | |
| TC9: Validation Error (No Rating) | ⬜ | |
| TC10: Character Limit | ⬜ | |

### Sign-Off

**Tester Name:** _________________________  
**Date:** _________________________  
**Environment:** iOS Simulator / Android Emulator / Physical Device  
**Build Version:** _________________________

**Overall Result:** ⬜ Pass  ⬜ Fail  ⬜ Pass with Issues

**Issues Found:**
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

---

## 🐛 Known Issues / Limitations

- None currently documented

---

## 📝 Notes for Developers

**Implementation Details:**
- `is_anonymous` column added in migration `030_reviews.sql`
- Submit review form includes checkbox in [SubmitReviewScreen.tsx](p2p-kids-marketplace/src/screens/review/SubmitReviewScreen.tsx)
- Display logic in [ReviewCard.tsx](p2p-kids-marketplace/src/components/ReviewCard.tsx) checks flag and shows "Anonymous User"

**Database Schema:**
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL,
  reviewer_id UUID NOT NULL, -- Still stored for moderation
  reviewee_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE, -- Key field for REVIEW-003
  is_hidden BOOLEAN DEFAULT FALSE,
  report_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**RLS Policies:**
- Users can view reviews about themselves (even if anonymous)
- Users can view reviews they wrote
- Admins can view all reviews (including reviewer_id for moderation)

---

**END OF MANUAL TESTING GUIDE**
