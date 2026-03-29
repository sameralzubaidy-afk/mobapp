# SAFETY-P001 Manual Testing Guide

**Module:** MODULE-13-SAFETY-COMPLIANCE  
**Task:** SAFETY-P001 - Create `item-images` Storage Bucket with RLS Policies  
**Date:** 2026-03-28  
**Platform:** iOS Simulator & Android Emulator

---

## Prerequisites

1. ✅ Migration `20260328000100_create_item_images_bucket.sql` applied to Supabase production
2. ✅ Test user account with authentication credentials
3. ✅ At least 2 test users (for RLS permission testing)
4. ✅ Mobile app running on iOS Simulator or Android Emulator

---

## Test Cases

### TC-001: Verify Bucket Creation in Supabase Dashboard

**Objective:** Confirm the `item-images` storage bucket exists with correct configuration

**Steps:**
1. Open Supabase Dashboard: https://app.supabase.com
2. Navigate to your project
3. Go to **Storage** section
4. Look for `item-images` bucket in the list

**Expected Results:**
- ✅ `item-images` bucket is visible
- ✅ Bucket is marked as **Public**
- ✅ File size limit: **5 MB** (5,242,880 bytes)
- ✅ Allowed MIME types: `image/jpeg, image/jpg, image/png, image/webp, image/gif`

**Pass/Fail:** ☐

---

### TC-002: Verify RLS Policies in SQL Editor

**Objective:** Confirm RLS policies are created correctly

**Steps:**
1. Open Supabase Dashboard → **SQL Editor**
2. Run this query:
```sql
SELECT 
  policyname, 
  cmd, 
  roles, 
  permissive,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND policyname LIKE '%item%image%'
ORDER BY policyname;
```

**Expected Results:**
| Policy Name | Command | Roles | Permissive | Has USING | Has WITH_CHECK |
|-------------|---------|-------|------------|-----------|----------------|
| Sellers can upload images for own listings | INSERT | authenticated | YES | NO | YES |
| Sellers can update images for own listings | UPDATE | authenticated | YES | YES | YES |
| Sellers can delete images for own listings | DELETE | authenticated | YES | YES | NO |
| Anyone can view item listing images | SELECT | public | YES | YES | NO |
| Service role full access to item images | ALL | service_role | YES | YES | YES |

**Pass/Fail:** ☐

---

### TC-003: Upload Item Image (Happy Path)

**Objective:** Verify authenticated seller can upload images to their own listing

**Prerequisites:**
- User A logged in
- User A has created at least one listing

**Steps:**
1. Open the mobile app on simulator
2. Log in as **User A**
3. Navigate to **Create Listing** or **Edit Listing**
4. Tap **Add Photos**
5. Select an image from device gallery or camera
6. Upload should complete successfully

**Expected Results:**
- ✅ Image upload progress indicator appears
- ✅ Upload completes without errors
- ✅ Image thumbnail appears in the listing form
- ✅ Image preview is clickable and shows full image
- ✅ In Supabase Dashboard → Storage → `item-images`, verify:
  - File exists at path: `{item_id}/{filename}`
  - File is accessible via public URL
  - File size is within 5MB limit

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-004: Upload Image Exceeding 5MB Limit

**Objective:** Verify file size limit is enforced

**Steps:**
1. Log in as **User A**
2. Navigate to **Create Listing** or **Edit Listing**
3. Attempt to upload an image larger than 5MB
   - *Tip: Use a high-res camera photo or download a large test image*

**Expected Results:**
- ✅ Upload fails with clear error message
- ✅ Error message mentions file size limit (e.g., "File too large. Maximum size is 5MB")
- ✅ No file is uploaded to storage bucket

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-005: Public Read Access to Item Images

**Objective:** Verify any user (even unauthenticated) can view listing images

**Steps:**
1. Log in as **User A** and create/edit a listing with at least one image
2. Note the listing ID
3. Log out (or use a different device/simulator)
4. Browse listings as **Guest** or **User B**
5. Open the listing created by User A

**Expected Results:**
- ✅ Listing images are visible and load correctly
- ✅ Images display without requiring authentication
- ✅ Public URL format: `https://{project-ref}.supabase.co/storage/v1/object/public/item-images/{item_id}/{filename}`

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-006: Upload Image to Another User's Listing (RLS Violation)

**Objective:** Verify RLS policy prevents unauthorized uploads

**Prerequisites:**
- User A has at least one listing
- User B is logged in

**Steps:**
1. Log in as **User B**
2. Use developer tools / API call (or attempt via exploit) to upload an image to User A's listing folder
   - Path format: `{user_a_item_id}/unauthorized.jpg`
3. Attempt upload via Supabase client in console or API

**Expected Results:**
- ✅ Upload is **rejected** by RLS policy
- ✅ Error message: `new row violates row-level security policy` or similar
- ✅ No file appears in User A's listing folder

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-007: Delete Own Item Image (Happy Path)

**Objective:** Verify seller can delete images from their own listings

**Steps:**
1. Log in as **User A**
2. Navigate to an existing listing with uploaded images
3. Tap **Edit Listing**
4. Tap the **Delete/Remove** icon on an image thumbnail
5. Confirm deletion

**Expected Results:**
- ✅ Image is removed from the listing preview
- ✅ Image is deleted from Supabase Storage bucket
- ✅ Corresponding `item_images` DB row is deleted (if applicable)
- ✅ Listing remains functional with remaining images

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-008: Delete Image from Another User's Listing (RLS Violation)

**Objective:** Verify RLS policy prevents unauthorized deletions

**Prerequisites:**
- User A has a listing with at least one image
- User B is logged in

**Steps:**
1. Log in as **User B**
2. Use developer tools / API call to attempt deletion of User A's listing image
   - Path: `{user_a_item_id}/{filename}`
3. Call Supabase storage delete in console

**Expected Results:**
- ✅ Delete is **rejected** by RLS policy
- ✅ Error message: `policy violation` or similar
- ✅ User A's image remains in storage

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-009: CDN Cache Purge After Delete (If Configured)

**Objective:** Verify CDN cache is purged when image is deleted

**Prerequisites:**
- `SUPABASE_PURGE_ENDPOINT` and `SUPABASE_PURGE_X_API_KEY` environment variables are set

**Steps:**
1. Upload an image to a listing as **User A**
2. Copy the public URL of the uploaded image
3. Open the public URL in a browser (should load)
4. Delete the image from the listing
5. Wait 2-3 seconds
6. Reload the public URL in the browser

**Expected Results:**
- ✅ Image initially loads before deletion
- ✅ After deletion, image URL returns **404 Not Found**
- ✅ CDN purge request is logged in app console (check logs)

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)
- [ ] Skipped (CDN not configured)

**Screenshot:** ☐

---

### TC-010: Service Role Full Access (Admin/Moderation)

**Objective:** Verify service_role can perform all operations on any item image

**Prerequisites:**
- Access to Supabase service role key (for admin/backend operations)

**Steps:**
1. Use Supabase Admin Client with service_role key in a backend script or SQL function
2. Attempt to:
   - Upload an image to any item folder
   - Read/list images from any item folder
   - Delete an image from any item folder

**Expected Results:**
- ✅ All operations succeed regardless of item ownership
- ✅ This enables AI image moderation and admin content review

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot/Logs:** ☐

---

### TC-011: Multiple Image Upload

**Objective:** Verify multiple images can be uploaded to a single listing

**Steps:**
1. Log in as **User A**
2. Navigate to **Create Listing** or **Edit Listing**
3. Upload 3-5 images in sequence
4. Submit the listing

**Expected Results:**
- ✅ All images upload successfully
- ✅ Images appear in correct order (display_order)
- ✅ Listing detail page shows all images in a carousel/gallery
- ✅ DB: `item_images` table has 3-5 rows for this listing with correct paths and display_order

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

### TC-012: Allowed MIME Types Validation

**Objective:** Verify only allowed image formats are accepted

**Steps:**
1. Attempt to upload the following file types to a listing:
   - ✅ JPEG (.jpg, .jpeg)
   - ✅ PNG (.png)
   - ✅ WebP (.webp)
   - ✅ GIF (.gif)
   - ❌ PDF (.pdf) - should be rejected
   - ❌ Video (.mp4) - should be rejected
   - ❌ Text (.txt) - should be rejected

**Expected Results:**
- ✅ JPEG, PNG, WebP, GIF uploads succeed
- ✅ PDF, MP4, TXT uploads fail with error: "Invalid file type. Only images are allowed."

**Actual Result:**
- [ ] Pass
- [ ] Fail (Reason: _____________)

**Screenshot:** ☐

---

## Test Summary

**Total Test Cases:** 12  
**Passed:** ___  
**Failed:** ___  
**Skipped:** ___  

**Overall Status:** ☐ Pass ☐ Fail

---

## Notes & Issues

*Document any bugs, unexpected behavior, or clarification needed:*

---

## Sign-Off

**Tester Name:** _____________________  
**Date:** _____________________  
**Build/Version:** _____________________  
**Platform:** ☐ iOS Simulator ☐ Android Emulator
