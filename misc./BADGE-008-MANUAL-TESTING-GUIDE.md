# BADGE-008 Manual Testing Guide

**Module:** MODULE-10-ID-BADGE-VERIFICATION-V2.md  
**Task:** BADGE-008 - ID Badge Verification System Schema  
**Created:** February 8, 2026

---

## Pre-Test Setup

### Required Accounts
- **Test User**: `testuser@example.com` (regular user, no admin role)
- **Test Admin**: `admin@example.com` (user with `role='admin'` in users table)

### Database Verification
Run these queries in Supabase SQL Editor to confirm setup:

```sql
-- Verify tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'id_badge%';
-- Expected: 2 tables (requests + messages)

-- Verify enums
SELECT enumtypid::regtype::text AS enum_name 
FROM pg_enum 
WHERE enumtypid::regtype::text LIKE 'id_badge%' 
GROUP BY enum_name;
-- Expected: 2 enums (status + rejection_reason)

-- Verify messages seeded
SELECT COUNT(*) FROM id_badge_verification_messages;
-- Expected: 12

-- Verify admin config
SELECT key, value FROM admin_config WHERE key LIKE 'id_badge%';
-- Expected: 2 rows

-- Verify Storage bucket exists
-- Go to Storage → should see "id-badge-verification-screenshots"
```

---

## Test Case 1: User Submits ID Verification

**Duration:** ~5 minutes  
**User:** `testuser@example.com`

### Steps:
1. Open mobile app and login as test user
2. Navigate to **Profile** screen
3. Scroll down to "Identity Verification" section
4. Tap **"Upgrade to Verified"** button
5. ✅ **Verify**: Disclaimer text displays (yellow box)
6. Read disclaimer: "We will not store or keep your ID image..."
7. Tap **"Take Photo"** or **"Choose from Gallery"**
8. Select a test ID image (any photo)
9. ✅ **Verify**: Image preview shows
10. Tap **"Submit for Verification"**
11. ✅ **Verify**: Loading spinner shows
12. ✅ **Verify**: Success message appears: "Submitted Successfully"
13. Navigate back to Profile
14. ✅ **Verify**: "Pending Approval" badge shows below avatar

### Database Verification:
```sql
SELECT id, user_id, status, screenshot_path, first_name, email
FROM id_badge_verification_requests
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com')
ORDER BY submitted_at DESC LIMIT 1;
-- Expected: 1 row, status='pending', screenshot_path NOT NULL
```

### Storage Verification:
```sql
-- In Supabase Dashboard → Storage → id-badge-verification-screenshots
-- Expected: Folder with user_id containing 1 .jpg file
```

---

## Test Case 2: Duplicate Submission Prevention

**Duration:** ~2 minutes  
**User:** Same test user from Test Case 1

### Steps:
1. While request is still pending, navigate to Profile again
2. Tap **"Upgrade to Verified"**
3. ✅ **Verify**: Screen shows "Verification Pending" message
4. ✅ **Verify**: Submit button is NOT visible
5. Message should say: "You already have a pending verification request..."
6. Tap **"Back to Profile"**

---

## Test Case 3: Admin Reviews and Approves Request

**Duration:** ~5 minutes  
**User:** Admin (`admin@example.com`)

### Steps:
1. Open admin portal at `http://localhost:3000/id-badges`
2. Login as admin
3. ✅ **Verify**: Queue page loads with stats cards
4. ✅ **Verify**: "Pending Review" count shows 1
5. ✅ **Verify**: Table shows the test user's request
6. Click **"Review"** link on the pending request
7. ✅ **Verify**: Review page loads with user info
8. ✅ **Verify**: Screenshot displays (ID image uploaded)
9. ✅ **Verify**: "Download Full Size" link works
10. Select **"Approve"** radio button
11. (Optional) Add approval notes: "ID verified successfully"
12. Click **"Submit"** button
13. ✅ **Verify**: Loading spinner shows
14. ✅ **Verify**: Redirects back to queue page
15. ✅ **Verify**: Request status changed to "Approved"
16. ✅ **Verify**: "Pending Review" count decreased to 0
17. ✅ **Verify**: "Approved" count increased to 1

### Database Verification:
```sql
SELECT status, reviewed_at, approval_notes, screenshot_path
FROM id_badge_verification_requests
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com')
ORDER BY submitted_at DESC LIMIT 1;
-- Expected: status='approved', reviewed_at NOT NULL, screenshot_path=NULL (deleted)
```

### Storage Verification:
```
-- In Supabase Dashboard → Storage → id-badge-verification-screenshots
-- Expected: Screenshot file DELETED (folder may be empty or removed)
```

---

## Test Case 4: User Sees Approved Status

**Duration:** ~2 minutes  
**User:** `testuser@example.com`

### Steps:
1. Open mobile app as test user
2. Navigate to **Profile** screen
3. ✅ **Verify**: "Verified" badge shows (green checkmark)
4. ✅ **Verify**: ID Badge section shows "✓ Verified"
5. ✅ **Verify**: Approval date displays
6. ✅ **Verify**: "Upgrade to Verified" button is GONE

---

## Test Case 5: Admin Rejects Request

**Duration:** ~8 minutes  
**User:** Admin + different test user

### Steps (User):
1. Create new test user or use different account
2. Submit ID verification (repeat Test Case 1)
3. Wait for admin review

### Steps (Admin):
1. Go to admin portal `/id-badges`
2. Click **"Review"** on new pending request
3. Select **"Reject"** radio button
4. ✅ **Verify**: Rejection reason dropdown appears
5. Select reason: **"Unclear photo"**
6. Add rejection notes: "Please retake with better lighting"
7. Click **"Submit"**
8. ✅ **Verify**: Redirects to queue
9. ✅ **Verify**: Status shows "Rejected"
10. ✅ **Verify**: Screenshot deleted from Storage

### Database Verification:
```sql
SELECT status, rejection_reason, rejection_notes, screenshot_path
FROM id_badge_verification_requests
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testuser2@example.com')
ORDER BY submitted_at DESC LIMIT 1;
-- Expected: status='rejected', rejection_reason='unclear_photo', screenshot_path=NULL
```

---

## Test Case 6: User Sees Rejection and Resubmits

**Duration:** ~5 minutes  
**User:** Rejected test user from Test Case 5

### Steps:
1. Open mobile app as rejected user
2. Navigate to **Profile** screen
3. ✅ **Verify**: "✗ Request Rejected" section shows
4. ✅ **Verify**: Rejection reason displays: "Unclear photo"
5. ✅ **Verify**: Rejection notes display: "Please retake with better lighting"
6. ✅ **Verify**: **"Resubmit Verification"** button shows
7. Tap **"Resubmit Verification"**
8. Upload screen opens
9. Select new ID image
10. Submit again
11. ✅ **Verify**: New pending request created
12. ✅ **Verify**: Old rejected request still in history

### Database Verification:
```sql
SELECT status, submitted_at FROM id_badge_verification_requests
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testuser2@example.com')
ORDER BY submitted_at DESC;
-- Expected: 2 rows (1 rejected, 1 pending)
```

---

## Test Case 7: Admin Search and Filter

**Duration:** ~3 minutes  
**User:** Admin

### Steps:
1. Go to admin portal `/id-badges`
2. Create multiple test requests (approved, pending, rejected)
3. Click **"Pending"** filter
4. ✅ **Verify**: Only pending requests show
5. Click **"Approved"** filter
6. ✅ **Verify**: Only approved requests show
7. Click **"All"** filter
8. ✅ **Verify**: All requests show
9. Type test user name in search box
10. ✅ **Verify**: Results filter in real-time (300ms debounce)
11. Type email address
12. ✅ **Verify**: Results update

---

## Test Case 8: Admin Configurable Messages (BADGE-012)

**Duration:** ~5 minutes  
**User:** Admin

### Steps:
1. Go to admin portal `/id-badges/messages`
2. ✅ **Verify**: 12 message templates display
3. Click **"Edit"** on `upload_disclaimer` message
4. Change text to: "TESTING: Custom disclaimer message"
5. Click **"Save"**
6. ✅ **Verify**: Success message shows
7. Reload page
8. ✅ **Verify**: New text persists
9. As user, go to upload screen
10. ✅ **Verify**: New disclaimer text displays

---

## Performance Checks

### Admin Queue Page Load Time
- **Target:** < 2 seconds with 100+ requests
- **Test:** Create 100+ test requests, reload queue page
- **Measure:** Use browser DevTools Network tab

### Mobile Upload Time
- **Target:** < 5 seconds for ~5MB image on 4G
- **Test:** Upload large ID image (resize to ~5MB)
- **Measure:** Time from tap "Submit" to success message

### Search Debounce
- **Target:** No API call until 300ms pause
- **Test:** Type quickly in search box, watch Network tab
- **Verify:** Only 1 API call after typing stops

---

## Edge Cases to Test

### Edge Case 1: Missing Screenshot
- Delete screenshot manually from Storage
- Try to review request
- Expected: Shows error or placeholder

### Edge Case 2: Network Failure During Upload
- Enable airplane mode mid-upload
- Expected: Error message shows, can retry

### Edge Case 3: Admin Decision Without Selection
- Try to submit without selecting approve/reject
- Expected: "Please select approve or reject" alert

### Edge Case 4: Empty Rejection Notes
- Select reject, leave notes empty, submit
- Expected: Allowed (notes are optional)

---

## Rollback Plan

If critical issues found:

1. Disable feature via admin config:
```sql
UPDATE admin_config 
SET value = 'false' 
WHERE key = 'id_badge_verification_enabled';
```

2. Hide UI elements by checking config in mobile app
3. Preserve all data (do NOT drop tables)
4. Fix issues and re-enable

---

## Sign-Off Checklist

- [ ] All 8 test cases pass
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Screenshot deletion confirmed in all cases
- [ ] RLS policies prevent unauthorized access
- [ ] Performance targets met
- [ ] Edge cases handled gracefully
- [ ] Admin can configure all messages
- [ ] Mobile UI matches design intent

**Tested by:** _____________  
**Date:** _____________  
**Status:** ⬜ Pass ⬜ Fail ⬜ Needs Fixes
