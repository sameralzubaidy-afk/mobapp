# MODULE-10-ID-BADGE-VERIFICATION VERIFICATION CHECKLIST

**Module:** ID Badge Manual Verification System  
**Last Updated:** February 8, 2026  
**Verification Status:** ⏳ Ready for Implementation Testing  
**Expected Completion:** After BADGE-008 through BADGE-013 implementation

---

## PRE-DEPLOYMENT VERIFICATION

### Database Schema Verification (BADGE-008)

- [ ] `id_badge_verification_requests` table created with all required columns:
  - `id` (UUID PK)
  - `user_id` (UUID FK to users)
  - `status` (enum: pending, approved, rejected)
  - `screenshot_path` (TEXT, nullable)
  - `screenshot_upload_timestamp` (TIMESTAMPTZ, nullable)
  - `submitted_at` (TIMESTAMPTZ)
  - `reviewed_at` (TIMESTAMPTZ, nullable)
  - `reviewed_by` (UUID FK to users, nullable)
  - `rejection_reason` (enum: 6 reasons)
  - `rejection_notes` (TEXT)
  - `approval_notes` (TEXT)
  - `node_id` (UUID, denormalized)
  - `first_name`, `last_name`, `email`, `phone_number` (denormalized)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- [ ] Indexes created on:
  - `user_id` (fast user lookups)
  - `status` (filter by pending/approved/rejected)
  - `submitted_at DESC` (recent submissions first)
  - `reviewed_by` (admin submissions)
  - `node_id` (node-level filtering)
  - Composite: `status, submitted_at DESC` (queue sorting)

- [ ] RLS policies enabled:
  - Users can SELECT own requests
  - Admins can SELECT all requests
  - Users can INSERT own requests
  - Admins can UPDATE requests

- [ ] `id_badge_verification_messages` table created:
  - 12 seed messages inserted
  - All message keys correct: `upload_disclaimer`, `submit_button_label`, `pending_status_text`, `in_app_submission_notification`, `approved_email_subject`, `approved_email_body`, `rejected_email_subject`, `rejected_email_body`, `in_app_approved_notification`, `in_app_rejected_notification`, `web_push_approved`, `web_push_rejected`

- [ ] RLS on messages table:
  - Everyone can READ messages
  - Admins can UPDATE messages

- [ ] Enums created:
  - `id_badge_request_status` with 3 values
  - `id_badge_rejection_reason` with 6 values

- [ ] Admin config entries created:
  - `id_badge_verification_enabled` (boolean)
  - `id_badge_verification_approval_sla_hours` (integer)

- [ ] Update triggers created:
  - `update_id_badge_requests_updated_at` function
  - `update_id_badge_messages_updated_at` function

### Supabase Storage Setup (BADGE-008)

- [ ] Storage bucket created: `id-badge-verification-screenshots`
- [ ] RLS policies on bucket:
  - Users can upload to `auth.uid()/{filename}` only
  - Admins can download any file
  - Proper deletion permissions set
- [ ] Bucket is private (not public read)

---

## MOBILE APP VERIFICATION (BADGE-009, BADGE-013)

### ID Verification Upload Screen

- [ ] `IDVerificationUploadScreen` component created
- [ ] Screenshot shows disclaimer text (fetched from configurable messages)
- [ ] Image picker works (camera + gallery options)
- [ ] Image validation implemented:
  - Size check (max 5MB, configurable)
  - Format validation (JPEG/PNG)
  - Quality settings applied
- [ ] Upload to Supabase Storage functional:
  - Correct bucket name used
  - Path structure: `{user_id}/{timestamp}.jpg`
  - Error handling on upload failure
- [ ] Database record created:
  - `id_badge_verification_requests` record inserted
  - Status set to `pending`
  - User info denormalized (first_name, email, phone, node_id)
  - `submitted_at` timestamp set
- [ ] Duplicate submission prevention:
  - Check for pending request before allowing new submission
  - Show "Pending" message if check returns result
  - Prevent submit button if pending exists
- [ ] Success flow:
  - Show success confirmation message
  - Auto-navigate back to profile after 2 seconds
- [ ] Error handling:
  - Network errors caught and displayed
  - User-friendly error messages
  - Retry option provided
- [ ] Loading states:
  - Spinner shown during upload
  - Submit button disabled during upload
- [ ] Accessibility:
  - Disclaimer text clearly visible (warning color)
  - Touch targets >= 44x44 points
  - Proper labels on buttons

### ID Badge Service

- [ ] `idBadgeService.getMessage(key)` working:
  - Fetches from `id_badge_verification_messages`
  - Returns message text
  - Handles missing messages gracefully
  
- [ ] `idBadgeService.checkPendingRequest(userId)` working:
  - Returns pending request or null
  - Filters by status='pending'
  - Returns null if no pending

- [ ] `idBadgeService.submitVerificationRequest(userId, imageUri)` working:
  - Uploads image to Storage
  - Creates DB record
  - Returns request ID
  - Throws errors properly

- [ ] `idBadgeService.getVerificationStatus(userId)` working:
  - Returns current status
  - Includes relevant timestamps
  - Includes rejection reason if applicable

### User Profile Screen

- [ ] Profile loads ID badge status on mount
- [ ] "Pending Approval" subtle badge shows:
  - Position below/beside avatar
  - Yellow/amber color scheme
  - Text readable at all sizes
- [ ] "Verified" badge shows on approval:
  - Green checkmark style
  - Clear and prominent
- [ ] ID Badge section displays:
  - Current status (None, Pending, Verified, Rejected)
  - Submission date (if pending)
  - Review date (if decided)
  - Rejection reason (if rejected)
- [ ] "Upgrade to Verified" CTA visible:
  - Only shown if not verified and system enabled
  - Green button, clear copy
  - Navigates to upload screen
- [ ] "Resubmit Verification" button visible:
  - Only shown if status = rejected
  - Navigates to upload screen with clear message

---

## ADMIN PANEL VERIFICATION (BADGE-010, BADGE-012)

### Admin ID Badge Queue Page (`/admin/ID-badges/`)

- [ ] Page loads and displays queue
- [ ] Table columns present:
  - User name (first + last)
  - Email
  - Phone number
  - Node ID
  - Submitted date/time
  - Status badge
  - Action link
- [ ] Status filters working:
  - "All" shows all requests
  - "Pending" shows only pending
  - "Approved" shows only approved
  - "Rejected" shows only rejected
- [ ] Search functionality working:
  - Search by user name (first/last)
  - Search by email
  - Debounced (300-500ms)
  - Results update in real-time
- [ ] Stats section displays:
  - Pending count
  - Approved count
  - Rejected count
  - Average review time (hours)
  - Approval rate (percentage)
- [ ] Stats update after decisions:
  - Counts change when approval/rejection happens
  - Avg review time recalculated
- [ ] Pagination (if table > 50 items):
  - "Next/Previous" buttons
  - Page indicators
  - Items per page dropdown
- [ ] Sorting working:
  - By submission date (newest first default)
  - By status
  - By user name
- [ ] Action links functional:
  - "Review" link on pending requests
  - "View" link on decided requests
  - Proper navigation to detail pages

### Admin ID Badge Review Page (`/admin/ID-badges/[requestId]/review/`)

- [ ] Page loads request details:
  - User info displayed (name, email, phone, node)
  - Submission timestamp shown
  - Status displayed
- [ ] Screenshot viewer functional:
  - Image loads from Supabase Storage
  - Image fits in preview area
  - Zoom functionality (if implemented)
  - Download button present
  - Download link works
- [ ] Decision form functional:
  - Radio buttons for Approve/Reject
  - Selection updates form state
- [ ] Rejection reason dropdown:
  - All 6 reasons displayed
  - Disabled until "Reject" selected
  - Default blank selection
  - Can be changed after selection
- [ ] Notes textarea:
  - Visible for both approve/reject
  - Placeholder changes based on decision
  - Character limit (if any) enforced
  - Optional (can be empty)
- [ ] Submit button:
  - Disabled until decision made
  - Shows spinner during submission
  - Changes color based on decision (green for approve, red for reject)
  - Disabled state is clear
- [ ] Decision submission:
  - POST to `/api/admin/id-badges/{requestId}/decide`
  - Includes: decision, rejection_reason, rejection_notes, approval_notes
  - Returns success/error
  - Navigates back to queue on success
- [ ] Screenshot auto-deletion:
  - Confirmed deleted from Storage after decision
  - No errors if already deleted (idempotent)

### Admin Messages Configuration Page (`/admin/ID-badges/messages/`)

- [ ] Page loads all 12 messages
- [ ] Each message displays:
  - Message key (code-style)
  - Description
  - Current text
  - Edit button (if not editing)
- [ ] Template variables reference shown:
  - All 4 variables listed (`{first_name}`, `{rejection_reason}`, `{admin_notes}`, `{approval_timeframe_hours}`)
  - Clear descriptions for each
- [ ] Edit functionality:
  - Click "Edit" opens textarea
  - Current text pre-filled
  - Character count shown (if applicable)
  - "Save" and "Cancel" buttons appear
- [ ] Save functionality:
  - Validates message not empty
  - Shows error if validation fails
  - Shows loading spinner during save
  - Calls PUT to `/api/admin/id-badges/messages/{messageId}`
  - Shows success confirmation
  - Updates UI immediately on success
- [ ] Cancel functionality:
  - Closes editor without saving
  - Reverts to original text
- [ ] Changes persist:
  - Reload page shows saved changes
  - Changes reflected in notifications (test after implementation)

---

## NOTIFICATIONS VERIFICATION (BADGE-011)

### On Submission

- [ ] In-app notification created:
  - Category: 'badges'
  - User receives "Submission received" message
  - Message from configurable table
  - Shows in app notification center

- [ ] Email sent:
  - To user's registered email
  - Subject line customizable
  - Body text customizable
  - HTML formatted email

### On Approval

- [ ] In-app notification:
  - Category: 'badges'
  - User receives approval message
  - Includes "Verified badge awarded" copy
  - Shows in notification center

- [ ] Web push notification:
  - Sent to Expo push token
  - Title: "ID Verification Approved"
  - Body from configurable template
  - Deep link to profile (shows new badge)

- [ ] Email notification:
  - Subject: "Your ID Verification is Approved! 🎉"
  - Body customizable with template variables
  - Contains: first_name, approval_timeframe_hours
  - Professional formatting

- [ ] Badge awarded on approval:
  - Verified badge visible on profile immediately
  - Or visible after refresh
  - Profile shows status = approved

### On Rejection

- [ ] In-app notification:
  - Category: 'badges'
  - User receives rejection message
  - Includes reason and notes

- [ ] Web push notification:
  - Sent to Expo push token
  - Title: "ID Verification Request"
  - Body from configurable template
  - Deep link to profile with "Resubmit" option

- [ ] Email notification:
  - Subject: "ID Verification Request - Action Required"
  - Body customizable with variables:
    - `{first_name}`
    - `{rejection_reason}` (formatted)
    - `{admin_notes}` (included)
  - Includes clear instructions to resubmit

### Admin Notifications

- [ ] Admin receives web push on new submission:
  - Only if admin has enabled badge notifications
  - Title: "New ID Verification Submission"
  - User name + submission time
  - Deep link to review page

---

## API ENDPOINT VERIFICATION

- [ ] `GET /api/admin/id-badges?status=pending&search=john`
  - Returns list of requests with filters
  - Pagination metadata included
  - 200 response on success

- [ ] `GET /api/admin/id-badges/stats`
  - Returns stats object
  - pending_count, approved_count, rejected_count
  - avg_review_time_hours (float)
  - approval_rate (percentage)

- [ ] `GET /api/admin/id-badges/{requestId}`
  - Returns full request details
  - User info included
  - 404 if not found

- [ ] `GET /api/admin/id-badges/{requestId}/screenshot-url`
  - Returns signed URL for screenshot
  - URL expires in appropriate time (1 hour)
  - 404 if no screenshot

- [ ] `POST /api/admin/id-badges/{requestId}/decide`
  - Accepts: decision, rejection_reason, rejection_notes, approval_notes
  - Updates request status
  - Sends notifications
  - Deletes screenshot
  - Logs to admin_activity_log
  - 200 on success

- [ ] `GET /api/admin/id-badges/messages`
  - Returns all 12 message templates
  - Includes: id, message_key, message_text, description, supports_variables

- [ ] `PUT /api/admin/id-badges/messages/{messageId}`
  - Accepts: message_text
  - Updates in database
  - 200 on success

---

## INTEGRATION TESTING

### End-to-End Flow: Approval

- [ ] 1. User navigates to profile
- [ ] 2. Clicks "Upgrade to Verified" CTA
- [ ] 3. Disclaimer displayed (from configurable messages)
- [ ] 4. User picks image from gallery
- [ ] 5. Image uploaded to Storage
- [ ] 6. Record created in database (status='pending')
- [ ] 7. User sees success message
- [ ] 8. User receives submission in-app + email notification
- [ ] 9. Admin navigates to `/admin/ID-badges/`
- [ ] 10. Admin sees new request in queue (pending count incremented)
- [ ] 11. Admin clicks "Review"
- [ ] 12. Admin sees screenshot and user info
- [ ] 13. Admin clicks "Approve" and submits
- [ ] 14. Screenshot deleted from Storage
- [ ] 15. User receives approval notification (in-app + push + email)
- [ ] 16. User profile shows "Verified" badge
- [ ] 17. Admin queue shows request as "Approved"

### End-to-End Flow: Rejection

- [ ] 1. User submits ID verification
- [ ] 2. Admin reviews and selects "Reject"
- [ ] 3. Admin selects rejection reason "unclear_photo"
- [ ] 4. Admin adds optional notes "Please retake with better lighting"
- [ ] 5. Admin submits decision
- [ ] 6. Screenshot deleted from Storage
- [ ] 7. User receives rejection notification with:
    - Reason displayed
    - Admin notes shown
    - Instructions to resubmit
- [ ] 8. User profile shows rejection status
- [ ] 9. "Resubmit Verification" button appears
- [ ] 10. User clicks resubmit and submits new image
- [ ] 11. Admin reviews second request
- [ ] 12. Second request shows in admin history

### Duplicate Submission Prevention

- [ ] 1. User submits ID verification (status='pending')
- [ ] 2. User navigates back to upload screen
- [ ] 3. Screen detects pending request
- [ ] 4. "Pending Approval" message displayed
- [ ] 5. Submit button disabled
- [ ] 6. User cannot submit second request
- [ ] 7. After admin approval, submit button becomes available again

---

## PERFORMANCE TESTING

- [ ] Admin queue page loads <2 seconds:
  - With 100+ requests in database
  - With filters applied
  
- [ ] Search debounce working:
  - No API call until 300ms pause
  - Prevents excessive requests

- [ ] Stats calculation efficient:
  - No N+1 queries
  - Uses indexes on status, submitted_at

- [ ] Screenshot upload <5 seconds:
  - For ~5MB image on 4G network
  - Progress indicator shown

- [ ] Admin decision submission <2 seconds:
  - Includes screenshot deletion
  - Includes notification sending
  - Includes audit logging

---

## SECURITY TESTING

- [ ] RLS policies enforced:
  - User can only see own requests
  - Admin can see all requests
  - Regular user cannot UPDATE requests

- [ ] Storage bucket RLS:
  - Users can upload to own folder only
  - Users cannot access other users' screenshots
  - Admins can access all screenshots

- [ ] Screenshot deleted immediately:
  - No lingering data after decision
  - Idempotent (no error if already deleted)

- [ ] Admin auth required:
  - Review pages 403 without admin role
  - Decision API 403 without admin role
  - Message edit 403 without admin role

- [ ] XSS prevention:
  - Admin notes don't execute as code
  - Message templates properly escaped
  - User names sanitized in notifications

- [ ] CSRF protection:
  - All POST requests use CSRF tokens (Next.js default)
  - State-changing operations protected

---

## MOBILE APP BUILD VERIFICATION

- [ ] TypeScript compilation passes:
  - `yarn typecheck` returns exit code 0
  - No unused imports
  - No type errors

- [ ] ESLint passes:
  - `yarn lint` returns exit code 0
  - No warnings or errors

- [ ] App builds in Expo:
  - `eas build --platform ios` succeeds
  - `eas build --platform android` succeeds

---

## ADMIN PANEL BUILD VERIFICATION

- [ ] Next.js TypeScript compilation passes:
  - `yarn build` succeeds
  - No build errors

- [ ] ESLint passes:
  - `yarn lint` returns exit code 0

---

## SMOKE TEST CHECKLIST (Automated)

Create `scripts/smoke/id-badge-verification.mjs`:

```javascript
// ✅ Test 1: Submit ID verification request
// ✅ Test 2: Query pending requests
// ✅ Test 3: Admin approves request
// ✅ Test 4: Screenshot deleted
// ✅ Test 5: User receives approval notification
// ✅ Test 6: Admin rejects with reason
// ✅ Test 7: User receives rejection notification
// ✅ Test 8: User resubmits after rejection
// ✅ Test 9: Search and filter in admin queue
// ✅ Test 10: Update configurable message
```

---

## MANUAL VERIFICATION CHECKLIST (if smoke test not available)

### Test Environment Setup
- [ ] Use staging or test Supabase instance
- [ ] Create test users:
  - `test_user_1@example.com` (free tier)
  - `test_admin@example.com` (admin role)
- [ ] Ensure notifications can be sent (SendGrid/Mailgun configured)

### Manual Test 1: Basic Submission Flow
**Time: ~5 minutes**

1. Log in as `test_user_1@example.com`
2. Navigate to profile
3. Click "Upgrade to Verified"
4. Read disclaimer (verify text from database)
5. Take or pick test photo
6. Click submit
7. ✅ Verify success message shows
8. ✅ Verify record in `id_badge_verification_requests` table with status='pending'
9. ✅ Verify screenshot in `id-badge-verification-screenshots` bucket

### Manual Test 2: Admin Approval
**Time: ~5 minutes**

1. Log in as `test_admin@example.com`
2. Navigate to `/admin/ID-badges/`
3. ✅ Verify pending count = 1
4. ✅ Verify request visible in table
5. Click "Review" on the request
6. ✅ Verify screenshot displays
7. Select "Approve"
8. Add optional notes: "Great ID photo"
9. Click submit
10. ✅ Verify redirects to queue
11. ✅ Verify screenshot deleted from Storage
12. ✅ Verify request status changed to 'approved'

### Manual Test 3: User Approval Notification
**Time: ~3 minutes**

1. Log in as `test_user_1@example.com`
2. Check email for approval notification
3. ✅ Verify subject line matches configurable message
4. ✅ Verify body contains first name
5. Return to app
6. ✅ Verify profile shows "Verified" badge
7. ✅ Verify "Upgrade to Verified" CTA gone

### Manual Test 4: Admin Rejection
**Time: ~5 minutes**

1. As admin, go to `/admin/ID-badges/`
2. Create new test submission from different user
3. Click "Review"
4. Select "Reject"
5. Select reason: "unclear_photo"
6. Add notes: "Please submit with better lighting"
7. Click submit
8. ✅ Verify status changed to 'rejected'
9. ✅ Verify screenshot deleted

### Manual Test 5: User Rejection Notification & Resubmit
**Time: ~5 minutes**

1. Log in as the rejected user
2. Check email
3. ✅ Verify rejection email received with reason "Unclear photo"
4. ✅ Verify admin notes included
5. Return to app
6. ✅ Verify profile shows "Rejected" status
7. ✅ Verify "Resubmit Verification" button visible
8. Click resubmit
9. Take new photo
10. Submit again
11. ✅ Verify new request created
12. ✅ Verify old request still shows rejection history

### Manual Test 6: Admin Message Customization
**Time: ~5 minutes**

1. As admin, go to `/admin/ID-badges/messages/`
2. Click "Edit" on `upload_disclaimer` message
3. Change text to: "Testing custom disclaimer message"
4. Save
5. ✅ Verify success message shows
6. Reload page
7. ✅ Verify new text persists
8. As user, go to upload screen
9. ✅ Verify new disclaimer text displays

### Manual Test 7: Search and Filter
**Time: ~5 minutes**

1. As admin, go to `/admin/ID-badges/`
2. Create several test submissions
3. Filter by "Pending"
4. ✅ Verify only pending requests shown
5. Search by first name
6. ✅ Verify results filtered correctly
7. Filter by "Approved"
8. ✅ Verify only approved requests shown
9. Click "All"
10. ✅ Verify all requests visible

---

## SIGN-OFF CRITERIA

**All of the following must be true to mark MODULE-10-PART-2 as COMPLETE:**

- ✅ All database tables and indexes created (BADGE-008)
- ✅ All RLS policies verified (BADGE-008)
- ✅ Mobile upload screen working end-to-end (BADGE-009)
- ✅ Mobile profile display updated (BADGE-013)
- ✅ Admin queue page functional (BADGE-010)
- ✅ Admin review/decision page functional (BADGE-010)
- ✅ Notifications sent on submission, approval, rejection (BADGE-011)
- ✅ Messages configurable via admin UI (BADGE-012)
- ✅ Screenshots deleted after decision (BADGE-008, BADGE-011)
- ✅ Duplicate submission prevention working (BADGE-009)
- ✅ TypeScript compilation passes (no errors)
- ✅ ESLint passes (no warnings)
- ✅ At least 1 automated smoke test OR manual test checklist completed
- ✅ No sensitive data in logs or error messages
- ✅ Performance baseline met (<2s for admin queue, <5s for upload)

**Module is READY FOR PRODUCTION when all items checked.**

---

## DEPLOYMENT CHECKLIST

- [ ] Feature flag `id_badge_verification_enabled` created in admin_config
- [ ] Supabase Storage bucket created in production
- [ ] Configurable messages seeded in production
- [ ] CORS configured if using external CDN
- [ ] Email provider (SendGrid/Mailgun) configured
- [ ] FCM configured for push notifications
- [ ] Expo push tokens configured
- [ ] Admin role assigned to appropriate team members
- [ ] Database backups verified
- [ ] Rollback plan documented
- [ ] Monitoring/alerts configured for:
  - Upload failures
  - Notification failures
  - Admin decision processing
- [ ] User communication prepared (if applicable)

---

**Verification Checklist Version:** 2.0  
**Last Updated:** February 8, 2026  
**Status:** Ready for Implementation
