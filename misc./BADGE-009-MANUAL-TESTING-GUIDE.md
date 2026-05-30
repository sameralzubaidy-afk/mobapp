# BADGE-009: ID Badge Upload Flow - Manual Testing Guide

**Task:** BADGE-009 - ID Badge Upload Flow (Mobile Screen)  
**Module:** MODULE-10-ID-BADGE-VERIFICATION-V2.md  
**Last Updated:** February 8, 2026  
**Status:** Ready for Testing

---

## Prerequisites

### Database
- ✅ Migration `20260208000000_id_badge_verification_system.sql` applied to Supabase production
- ✅ Table `id_badge_verification_requests` exists
- ✅ Table `id_badge_verification_messages` exists with 12 seeded messages
- ✅ Storage bucket `id-badge-verification-screenshots` created with RLS policies

### App Environment
- ✅ Mobile app built with latest code
- ✅ `IDVerificationUploadScreen` screen implemented
- ✅ `idBadgeService` service implemented
- ✅ Navigation route `IDVerificationUpload` added to AppNavigator
- ✅ Supabase production URL and anon key configured

### Test Accounts
- **Test User 1:** Create a normal user account (non-admin)
- **Test Admin:** Ensure admin role account exists for reviewing submissions

---

## Test Case 1: Disclaimer Text Display

**Objective:** Verify configurable disclaimer message loads from database

**Prerequisites:** None

**Steps:**
1. Open mobile app and log in as Test User 1
2. Navigate to Profile screen
3. Tap "Upgrade to Verified" or similar CTA
4. Observe the disclaimer box

**Expected Results:**
- ✅ Disclaimer box is visible with yellow/amber background
- ✅ Disclaimer title reads "Your Privacy is Important"
- ✅ Disclaimer text matches `id_badge_verification_messages.message_text` for key `upload_disclaimer`
- ✅ Default text appears if database fetch fails: "We will not store your ID image. It will be deleted after verification."

**Verification Query:**
```sql
SELECT message_text 
FROM id_badge_verification_messages 
WHERE message_key = 'upload_disclaimer';
```

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 2: Image Picker - Camera

**Objective:** Verify camera photo capture works

**Prerequisites:** Device with camera or iOS Simulator with simulated camera

**Steps:**
1. From ID Verification Upload Screen, tap "Take Photo" button
2. If prompted, grant camera permission
3. Camera interface opens
4. Take a photo of any document (simulated ID)
5. Optionally crop/adjust photo
6. Confirm selection

**Expected Results:**
- ✅ Permission prompt appears (first time only)
- ✅ Camera interface opens correctly
- ✅ Photo is captured and preview displays in upload screen
- ✅ Image fills the preview area (300px height, full width)
- ✅ "Change Image" button appears below preview

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 3: Image Picker - Gallery

**Objective:** Verify gallery image selection works

**Prerequisites:** Test device has at least one photo in gallery

**Steps:**
1. From ID Verification Upload Screen, tap "Choose from Gallery" button
2. If prompted, grant photo library permission
3. Photo library opens
4. Select any image (simulated ID photo)
5. Optionally crop/adjust photo
6. Confirm selection

**Expected Results:**
- ✅ Permission prompt appears (first time only)
- ✅ Photo library interface opens correctly
- ✅ Selected photo displays in upload screen preview
- ✅ Image fills the preview area
- ✅ "Change Image" button visible

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 4: Image Validation - No Image Selected

**Objective:** Verify submission fails when no image selected

**Prerequisites:** None

**Steps:**
1. Open ID Verification Upload Screen
2. Do NOT select any image
3. Tap "Submit for Verification" button

**Expected Results:**
- ✅ Error box appears with red background
- ✅ Error message reads: "Please select an image"
- ✅ No network request is made
- ✅ User remains on upload screen

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 5: Submit Verification Request - First Time

**Objective:** Verify successful submission flow for first-time user

**Prerequisites:**
- Test User 1 has NO existing requests in `id_badge_verification_requests`

**Steps:**
1. Open ID Verification Upload Screen
2. Select an image (camera or gallery)
3. Tap "Submit for Verification" button
4. Wait for upload to complete

**Expected Results:**
- ✅ Submit button shows spinner during upload
- ✅ Submit button is disabled while uploading
- ✅ Alert appears: "Submitted Successfully" with 24-hour message
- ✅ Screen displays success confirmation with green checkmark
- ✅ Success message: "Your verification request has been submitted..."
- ✅ After ~2 seconds, screen auto-navigates back to Profile

**Database Verification:**
```sql
SELECT * FROM id_badge_verification_requests 
WHERE user_id = '<test-user-id>' 
ORDER BY submitted_at DESC LIMIT 1;
```

Expected DB state:
- ✅ `status = 'pending'`
- ✅ `screenshot_path` is NOT NULL (format: `<user_id>/<timestamp>.jpg`)
- ✅ `screenshot_upload_timestamp` is NOT NULL
- ✅ `submitted_at` is NOT NULL
- ✅ `first_name`, `last_name`, `email`, `phone_number`, `node_id` are populated (denormalized)
- ✅ `reviewed_at` is NULL
- ✅ `reviewed_by` is NULL

**Storage Verification:**
1. Navigate to Supabase Dashboard → Storage → `id-badge-verification-screenshots`
2. Check for folder matching `<user_id>`
3. File exists: `<user_id>/<timestamp>.jpg`
4. File is accessible by admin (download test)

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 6: Duplicate Submission Prevention - Pending Request Exists

**Objective:** Verify user cannot submit multiple pending requests

**Prerequisites:**
- Test User 1 has a `pending` request in database (from Test Case 5)

**Steps:**
1. Navigate back to Profile
2. Tap "Upgrade to Verified" again
3. Screen should detect pending request

**Expected Results:**
- ✅ Screen displays "Verification Pending" title
- ✅ Message reads: "You already have a pending verification request. We will review it within 24 hours..."
- ✅ "Back to Profile" button visible
- ✅ NO image picker buttons visible
- ✅ Submit button NOT visible
- ✅ User cannot upload a new image

**Database Verification:**
```sql
SELECT COUNT(*) FROM id_badge_verification_requests 
WHERE user_id = '<test-user-id>' AND status = 'pending';
```
Expected count: 1 (no duplicate created)

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 7: Upload Error Handling - Network Failure

**Objective:** Verify error handling for network/storage failures

**Prerequisites:** 
- Enable network throttling or airplane mode during upload (advanced testing)
- OR: Use invalid Supabase storage bucket (simulate error)

**Steps:**
1. Open ID Verification Upload Screen
2. Select an image
3. Enable airplane mode or network throttling
4. Tap "Submit for Verification"
5. Wait for upload to fail

**Expected Results:**
- ✅ Error box appears with red background
- ✅ Error message reads: "Upload failed. Please try again." (or similar)
- ✅ Submit button re-enables (no longer disabled)
- ✅ User can retry by tapping Submit again
- ✅ No partial database record created

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 8: Change Image After Selection

**Objective:** Verify user can change image before submitting

**Prerequisites:** None

**Steps:**
1. Open ID Verification Upload Screen
2. Select an image (camera or gallery)
3. Preview displays
4. Tap "Change Image" button
5. Preview clears
6. Select a different image
7. New image displays in preview

**Expected Results:**
- ✅ "Change Image" button removes selected image
- ✅ Image picker buttons reappear
- ✅ User can select a new image
- ✅ New image replaces old preview
- ✅ Submit button remains available

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 9: Admin Review - Pending Request Visible in Queue

**Objective:** Verify admin can see submitted request in queue

**Prerequisites:**
- Test User 1 has submitted a pending request (Test Case 5)
- Admin account with admin role

**Steps:**
1. Log in to admin panel as admin
2. Navigate to `/admin/ID-badges/` page
3. Filter by "Pending" status
4. Locate Test User 1's request in table

**Expected Results:**
- ✅ Request visible in admin queue
- ✅ Table row shows: User name, Email, Phone, Node, Submitted date, Status badge
- ✅ Status badge displays "Pending" with yellow/amber background
- ✅ "Review" action link visible
- ✅ Stats section shows `pending_count >= 1`

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 10: Screenshot Display in Admin Review Page

**Objective:** Verify admin can view and download screenshot

**Prerequisites:**
- Test User 1 has pending request with screenshot

**Steps:**
1. As admin, navigate to `/admin/ID-badges/`
2. Click "Review" on Test User 1's pending request
3. Review page opens
4. Screenshot section displays image preview
5. Click "Download Full Size" link

**Expected Results:**
- ✅ Screenshot preview loads and displays correctly
- ✅ Image is clear and readable
- ✅ Download link works and opens full-size image
- ✅ User info displayed: name, email, phone, node, submission timestamp

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 11: Admin Approval Flow

**Objective:** Verify admin can approve request and screenshot is deleted

**Prerequisites:**
- Test User 1 has pending request

**Steps:**
1. As admin, open review page for Test User 1's request
2. Select "Approve" radio button
3. Optionally add notes: "Great ID photo"
4. Click "Submit" button
5. Wait for processing
6. Check admin queue for status change
7. Check Supabase Storage for screenshot deletion

**Expected Results:**
- ✅ Submit button shows "Approving..." during processing
- ✅ Success alert appears
- ✅ Navigates back to admin queue
- ✅ Request status changed to "Approved" with green badge
- ✅ Screenshot file DELETED from storage bucket (path no longer exists)
- ✅ `reviewed_at` timestamp set in database
- ✅ `reviewed_by` set to admin user ID

**Database Verification:**
```sql
SELECT status, reviewed_at, reviewed_by, screenshot_path 
FROM id_badge_verification_requests 
WHERE user_id = '<test-user-id>' 
ORDER BY reviewed_at DESC LIMIT 1;
```

Expected:
- `status = 'approved'`
- `reviewed_at` is NOT NULL
- `reviewed_by` is NOT NULL

**Storage Verification:**
- Screenshot path from DB should NOT exist in storage bucket

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 12: User Notification - Approval

**Objective:** Verify user receives approval notification

**Prerequisites:**
- Test User 1's request was approved by admin (Test Case 11)

**Steps:**
1. Log in to mobile app as Test User 1
2. Check in-app notifications
3. Check email inbox for Test User 1
4. Check profile for "Verified" badge

**Expected Results:**
- ✅ In-app notification appears: "Great! Your ID has been verified. You now have the Verified badge."
- ✅ Email received with subject: "Your ID Verification is Approved! 🎉"
- ✅ Email body contains first name and congratulatory message
- ✅ Profile screen shows "Verified" badge next to avatar (green checkmark)
- ✅ "Upgrade to Verified" CTA is hidden or replaced with "Verified" status

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 13: Admin Rejection Flow

**Objective:** Verify admin can reject request with reason

**Prerequisites:**
- Create a second pending request (use Test User 2 or resubmit with Test User 1)

**Steps:**
1. As admin, open review page for pending request
2. Select "Reject" radio button
3. Select rejection reason: "unclear_photo"
4. Add rejection notes: "Please retake with better lighting"
5. Click "Submit" button
6. Wait for processing

**Expected Results:**
- ✅ Rejection reason dropdown visible after selecting "Reject"
- ✅ 6 rejection reasons available: unclear_photo, id_expired, name_mismatch, multiple_ids, not_government_id, other
- ✅ Submit button shows "Rejecting..." during processing
- ✅ Success alert appears
- ✅ Navigates back to admin queue
- ✅ Request status changed to "Rejected" with red badge
- ✅ Screenshot DELETED from storage
- ✅ `rejection_reason` and `rejection_notes` populated in database

**Database Verification:**
```sql
SELECT status, reviewed_at, rejection_reason, rejection_notes 
FROM id_badge_verification_requests 
WHERE user_id = '<test-user-id>' 
ORDER BY reviewed_at DESC LIMIT 1;
```

Expected:
- `status = 'rejected'`
- `rejection_reason = 'unclear_photo'`
- `rejection_notes = 'Please retake with better lighting'`

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 14: User Notification - Rejection

**Objective:** Verify user receives rejection notification with reason

**Prerequisites:**
- Test User 1's request was rejected (Test Case 13)

**Steps:**
1. Log in to mobile app as Test User 1
2. Check in-app notifications
3. Check email inbox
4. Navigate to Profile screen

**Expected Results:**
- ✅ In-app notification appears: "Your ID verification was not approved. Please submit a new request with clearer details."
- ✅ Email received with subject: "ID Verification Request - Action Required"
- ✅ Email body contains rejection reason: "unclear photo"
- ✅ Email body contains admin notes: "Please retake with better lighting"
- ✅ Profile shows rejection status
- ✅ "Resubmit Verification" button visible

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 15: Resubmission After Rejection

**Objective:** Verify user can resubmit after rejection

**Prerequisites:**
- Test User 1 has a rejected request

**Steps:**
1. Navigate to Profile as Test User 1
2. Tap "Resubmit Verification" button
3. Upload Screen opens
4. Select a new image
5. Submit for verification

**Expected Results:**
- ✅ "Resubmit Verification" button navigates to Upload Screen
- ✅ No "Pending" blocking message (previous request is decided)
- ✅ New submission creates a NEW row in database
- ✅ Old rejected request preserved (history maintained)
- ✅ New request has `status = 'pending'`

**Database Verification:**
```sql
SELECT COUNT(*), status 
FROM id_badge_verification_requests 
WHERE user_id = '<test-user-id>' 
GROUP BY status;
```

Expected:
- At least 2 rows total (1 rejected, 1 pending)

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 16: Configurable Message Update

**Objective:** Verify admin can update disclaimer message and it reflects in app

**Prerequisites:** Admin access to admin panel

**Steps:**
1. As admin, navigate to `/admin/ID-badges/messages/`
2. Locate `upload_disclaimer` message
3. Click "Edit"
4. Change text to: "TEST DISCLAIMER - We do not store your ID."
5. Save changes
6. As Test User 1, navigate to Upload Screen
7. Read disclaimer text

**Expected Results:**
- ✅ Admin message edit interface works
- ✅ Save button updates database
- ✅ Mobile app displays updated disclaimer: "TEST DISCLAIMER - We do not store your ID."
- ✅ Change persists after app refresh

**Database Verification:**
```sql
SELECT message_text 
FROM id_badge_verification_messages 
WHERE message_key = 'upload_disclaimer';
```

Expected: `message_text` matches updated value

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 17: Deep Link Navigation

**Objective:** Verify direct navigation to Upload Screen works

**Prerequisites:** None

**Steps:**
1. Open app to Home/Dashboard
2. Use navigation: `navigation.navigate('IDVerificationUpload')`
3. OR: Use deep link URL: `p2pkidsmarketplace://id-verification-upload`

**Expected Results:**
- ✅ Upload Screen opens directly
- ✅ Disclaimer loads
- ✅ Image picker buttons visible
- ✅ No crashes or errors

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 18: Permission Denied Handling

**Objective:** Verify graceful handling when user denies camera/photo permissions

**Prerequisites:** Reset app permissions before test

**Steps:**
1. Open Upload Screen
2. Tap "Take Photo"
3. When permission prompt appears, tap "Don't Allow" or "Deny"
4. Observe app behavior

**Expected Results:**
- ✅ Alert appears: "Permission Required - Please allow camera access."
- ✅ App does not crash
- ✅ User remains on Upload Screen
- ✅ User can retry or use gallery instead

**Repeat for Gallery:**
1. Tap "Choose from Gallery"
2. Deny photo library permission
3. Alert appears: "Permission Required - Please allow access to your photos."
4. App does not crash

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 19: RLS Policy - User Can Only See Own Requests

**Objective:** Verify RLS prevents users from seeing other users' requests

**Prerequisites:**
- Test User 1 has pending request
- Test User 2 has pending request

**Steps:**
1. As Test User 1, query `id_badge_verification_requests` via service
2. Count returned rows

**Expected Results:**
- ✅ Test User 1 only sees their own request
- ✅ Test User 1 cannot see Test User 2's request
- ✅ Count of visible requests = 1 (only own request)

**Manual DB Query (as authenticated user):**
```sql
SELECT * FROM id_badge_verification_requests 
WHERE user_id = auth.uid();
```

**Pass/Fail:** [ ]

**Notes:**

---

## Test Case 20: Admin Stats Calculation

**Objective:** Verify admin stats calculate correctly

**Prerequisites:**
- At least 3 requests: 1 pending, 1 approved, 1 rejected

**Steps:**
1. As admin, navigate to `/admin/ID-badges/`
2. Check stats section at top of page

**Expected Results:**
- ✅ `Pending Review` count shows correct number (at least 1)
- ✅ `Approved` count shows correct number (at least 1)
- ✅ `Rejected` count shows correct number (at least 1)
- ✅ `Avg Review Time` shows calculated hours (or N/A if no decided requests)

**Database Verification:**
```sql
-- Pending count
SELECT COUNT(*) FROM id_badge_verification_requests WHERE status = 'pending';

-- Approved count
SELECT COUNT(*) FROM id_badge_verification_requests WHERE status = 'approved';

-- Rejected count
SELECT COUNT(*) FROM id_badge_verification_requests WHERE status = 'rejected';

-- Avg review time (hours)
SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600) AS avg_hours
FROM id_badge_verification_requests
WHERE reviewed_at IS NOT NULL;
```

**Pass/Fail:** [ ]

**Notes:**

---

## Summary Checklist

### Core Functionality
- [ ] TC1: Disclaimer displays from database
- [ ] TC2: Camera capture works
- [ ] TC3: Gallery selection works
- [ ] TC4: No image error validation
- [ ] TC5: Successful first submission
- [ ] TC6: Duplicate submission prevention
- [ ] TC7: Network error handling
- [ ] TC8: Change image after selection

### Admin Review
- [ ] TC9: Request visible in admin queue
- [ ] TC10: Screenshot display in admin review
- [ ] TC11: Admin approval flow + deletion
- [ ] TC12: User approval notification
- [ ] TC13: Admin rejection flow
- [ ] TC14: User rejection notification
- [ ] TC15: Resubmission after rejection

### Configuration & Permissions
- [ ] TC16: Configurable message update
- [ ] TC17: Deep link navigation
- [ ] TC18: Permission denied handling
- [ ] TC19: RLS policy enforcement
- [ ] TC20: Admin stats calculation

---

## Environment Commands

### Build App for Testing
```bash
cd p2p-kids-marketplace
npm install
npm run ios  # or npm run android
```

### Run Unit Tests
```bash
cd p2p-kids-marketplace
npm test -- idBadge.test.ts
```

### Run E2E Tests (requires Supabase credentials)
```bash
cd p2p-kids-marketplace
export SUPABASE_E2E_ENABLED=true
npm test -- idBadgeUpload.e2e.test.ts
```

### TypeScript Compile Check (Tier 0)
```bash
cd p2p-kids-marketplace
npm run typecheck  # or: npx tsc -p tsconfig.json --noEmit
```

### Lint Check (Tier 0)
```bash
cd p2p-kids-marketplace
npm run lint  # or: npx eslint .
```

---

## Rollback Instructions

If critical issues are found during testing:

1. **Remove navigation route** (temporarily):
   - Comment out `IDVerificationUpload` screen import and route in `AppNavigator.tsx`

2. **Disable feature flag**:
   ```sql
   UPDATE admin_config 
   SET value = 'false' 
   WHERE key = 'id_badge_verification_enabled';
   ```

3. **Report issues** with:
   - Test case number that failed
   - Expected vs actual behavior
   - Screenshots/logs if applicable

---

## Sign-Off

**Tester Name:** _______________________  
**Date:** _______________________  
**Overall Pass/Fail:** [ ] Pass [ ] Fail  
**Notes:**
