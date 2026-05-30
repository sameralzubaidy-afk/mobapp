# BADGES-V2-006: Badge Icon Management - Manual Testing Guide

**Task:** Badge Icon Management & Supabase Storage  
**Date:** January 11, 2026  
**Tester:** [Your Name]

---

## Prerequisites

1. **Database Setup:**
   ```sql
   -- Run this SQL in Supabase SQL Editor:
   -- filepath: supabase/migrations/20260111000001_badge_icons_storage.sql
   ```
   Execute the migration file to create the `badge-icons` bucket and RLS policies.

2. **Admin User Setup:**
   - Ensure you have an admin user account
   - Admin user must have `raw_user_meta_data->>'is_admin' = 'true'`

3. **Test Badge:**
   - Create a test badge in the database for upload testing

---

## Test Cases

### TC-001: Verify Badge-Icons Bucket Creation

**Objective:** Confirm that the badge-icons storage bucket exists with correct configuration.

**Steps:**
1. Open Supabase Dashboard → Storage
2. Look for `badge-icons` bucket in the list

**Expected Results:**
- ✅ Bucket named `badge-icons` exists
- ✅ Bucket is marked as "Public"
- ✅ File size limit: 5MB
- ✅ Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp, image/svg+xml

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-002: Verify RLS Policies on Badge-Icons Bucket

**Objective:** Confirm that RLS policies are correctly configured.

**Steps:**
1. Run this SQL query in Supabase SQL Editor:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
   FROM pg_policies
   WHERE tablename = 'objects'
     AND policyname LIKE '%badge icon%';
   ```

**Expected Results:**
- ✅ Policy: "Public read access for badge icons" (SELECT)
- ✅ Policy: "Admin users can upload badge icons" (INSERT)
- ✅ Policy: "Admin users can update badge icons" (UPDATE)
- ✅ Policy: "Admin users can delete badge icons" (DELETE)

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-003: Upload Badge Icon (Admin Portal)

**Objective:** Test badge icon upload functionality from admin portal.

**Prerequisites:**
- Admin portal running locally or on staging
- Admin user logged in

**Steps:**
1. Navigate to Badge Management page
2. Select a badge to edit
3. Click "Upload Icon" button
4. Select an image file (PNG, JPEG, or WebP)
   - Use a file < 5MB
5. Click "Upload"
6. Wait for upload confirmation

**Expected Results:**
- ✅ File upload succeeds
- ✅ Badge `icon_url` field is updated in database
- ✅ Icon displays in badge list immediately
- ✅ Icon is publicly accessible via URL

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- Badge ID: _________________
- Icon URL: _________________
- Upload Time: _______ ms

---

### TC-004: Upload Badge Icon (Mobile App - Admin Only)

**Objective:** Test badge icon upload from mobile app (admin functionality).

**Prerequisites:**
- Mobile app running on iOS Simulator or Android Emulator
- Admin user logged in

**Steps:**
1. Open Badge Management screen (admin-only)
2. Select a badge
3. Tap "Upload Icon"
4. Select photo from device/simulator
5. Confirm upload

**Expected Results:**
- ✅ Image picker opens
- ✅ Upload progress indicator shows
- ✅ Success message displays
- ✅ Icon updates in badge list
- ✅ Icon URL saved to database

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-005: Validate File Size Limit

**Objective:** Ensure files larger than 5MB are rejected.

**Steps:**
1. Attempt to upload a badge icon > 5MB

**Expected Results:**
- ✅ Upload rejected with error message
- ✅ Error message: "File size exceeds 5MB limit"
- ✅ No partial upload in storage

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-006: Validate File Type Restrictions

**Objective:** Ensure only allowed image types can be uploaded.

**Steps:**
1. Attempt to upload a PDF file as badge icon
2. Attempt to upload a GIF file as badge icon
3. Attempt to upload a valid PNG file

**Expected Results:**
- ✅ PDF upload rejected with error
- ✅ GIF upload rejected with error
- ✅ PNG upload succeeds
- ✅ Error message lists allowed types

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-007: Get Public URL for Badge Icon

**Objective:** Verify public URLs are correctly generated.

**Steps:**
1. Upload a badge icon (or use existing one)
2. Get the storage path from database
3. Call `getPublicBadgeIconUrl(path)` function
4. Open the URL in browser

**Expected Results:**
- ✅ Function returns valid URL
- ✅ URL format: `https://<supabase-url>/storage/v1/object/public/badge-icons/icons/<filename>`
- ✅ Image loads in browser without authentication
- ✅ Image displays correctly

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Generated URL:** _________________

---

### TC-008: Get Signed URL for Badge Icon

**Objective:** Test signed URL generation for temporary access.

**Steps:**
1. Upload a badge icon
2. Call `getSignedBadgeIconUrl(path, 60)` (60 seconds expiry)
3. Open the signed URL immediately
4. Wait 2 minutes
5. Try to access the signed URL again

**Expected Results:**
- ✅ Signed URL generated successfully
- ✅ URL contains `token=` parameter
- ✅ Image loads immediately after generation
- ✅ After expiry, URL returns 403 or expired error

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-009: Delete Badge Icon

**Objective:** Test badge icon deletion.

**Steps:**
1. Upload a test badge icon
2. Note the storage path
3. Call `deleteBadgeIcon(path)` function
4. Verify deletion in Supabase Storage UI
5. Try to access the public URL

**Expected Results:**
- ✅ Deletion succeeds (returns `true`)
- ✅ File no longer appears in Storage browser
- ✅ Public URL returns 404
- ✅ Database record can be updated to remove `icon_url`

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-010: RLS Policy - Non-Admin Upload Restriction

**Objective:** Verify that non-admin users cannot upload badge icons.

**Steps:**
1. Log in as a regular (non-admin) user
2. Attempt to upload a badge icon via API or app

**Expected Results:**
- ✅ Upload fails with permission error
- ✅ Error message indicates admin-only access
- ✅ No file created in storage
- ✅ Console log shows RLS policy violation

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-011: RLS Policy - Public Read Access

**Objective:** Verify that anyone can read/view badge icons.

**Steps:**
1. Log out (unauthenticated)
2. Access a badge icon public URL directly in browser

**Expected Results:**
- ✅ Image loads without authentication
- ✅ No login redirect
- ✅ Image displays correctly

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-012: Badge List Displays Icons

**Objective:** Verify that badge icons display in badge list UI.

**Steps:**
1. Upload icons for 3-5 different badges
2. Navigate to badge list page (mobile or admin)
3. Observe badge cards/items

**Expected Results:**
- ✅ Each badge displays its icon (if available)
- ✅ Icons are sized appropriately (consistent dimensions)
- ✅ Missing icons show placeholder or default icon
- ✅ Icons load quickly (< 1 second)

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-013: Replace Existing Badge Icon

**Objective:** Test uploading a new icon to replace an existing one.

**Steps:**
1. Upload icon A for a badge
2. Upload icon B for the same badge (different file)
3. Check database and storage

**Expected Results:**
- ✅ New icon uploads successfully
- ✅ Badge `icon_url` updates to new file
- ✅ Old icon file remains in storage (not overwritten due to timestamp)
- ✅ Badge displays new icon

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-014: List All Badge Icons (Admin)

**Objective:** Test admin function to list all uploaded badge icons.

**Steps:**
1. Log in as admin
2. Call `listBadgeIcons()` function (admin portal)
3. Review returned list

**Expected Results:**
- ✅ Function returns array of file objects
- ✅ Each file has: name, created_at, size metadata
- ✅ Files sorted by created_at (descending)
- ✅ Limit: 100 files per page

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Files Returned:** _______ files

---

## Test Summary

**Total Test Cases:** 14  
**Passed:** _______  
**Failed:** _______  
**Blocked:** _______  
**Pass Rate:** _______% 

---

## Issues Found

| Issue # | Test Case | Severity | Description | Status |
|---------|-----------|----------|-------------|--------|
| 1       |           |          |             |        |
| 2       |           |          |             |        |
| 3       |           |          |             |        |

---

## Notes

- Include any additional observations or recommendations
- List any environment-specific issues
- Suggest improvements to the test process

---

**Tested By:** _________________  
**Date:** _________________  
**Environment:** [ ] Local [ ] Staging [ ] Production  
**App Version:** _________________
