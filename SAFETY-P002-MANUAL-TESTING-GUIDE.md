# SAFETY-P002: Image Picker and Upload - Manual Testing Guide

**Task:** Add Image Picker and Upload to CreateListingScreen (Mobile App)  
**Module:** MODULE-13 SAFETY-COMPLIANCE  
**Platform:** iOS & Android Simulators  
**Estimated Time:** 30 minutes  
**Prerequisites:**
- item-images bucket exists (SAFETY-P001 migration applied)
- Test user account with active session
- iOS and/or Android simulator running
- App built with latest code changes

---

## Pre-Test Setup

1. **Start the app in simulator:**
   ```bash
   cd p2p-kids-marketplace
   npm run start:android  # OR npm run start:ios
   ```

2. **Login with test user:**
   - Email: `testuser+maestro@example.com`
   - Password: `TestPassword123!`

3. **Navigate to Create Listing screen:**
   - Tap bottom nav "+" button or "Create" tab

---

## Test Cases

### TC-001: Verify Image Upload removed Picker UI Renders (Empty State)

**Preconditions:** User is on CreateListingScreen with no images selected

**Steps:**
1. Observe the form fields
2. Scroll down to Photos section

**Expected Results:**
- ✅ "Photos (0/5)" label is visible
- ✅ "Add from Gallery" button is visible
- ✅ "Take Photo" button is visible
- ✅ No image preview grid is shown
- ✅ Hint text: "First image will be the cover photo" NOT visible yet

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-002: Add Image from Gallery (Happy Path)

**Preconditions:** TC-001 passed

**Steps:**
1. Tap "📷 Add from Gallery" button
2. **On permission prompt:** Tap "Allow" or "OK"
3. Select the first photo from gallery
4. Wait for image to load

**Expected Results:**
- ✅ Permission prompt appears (first time only)
- ✅ Gallery picker opens
- ✅ After selection, image preview appears in horizontal scroll
- ✅ "Cover" badge is visible on the first image
- ✅ "Photos (1/5)" label updates
- ✅ Hint text: "First image will be the cover photo" is now visible
- ✅ Delete button (red X) appears on top-right of image preview
- ✅ "Add from Gallery" and "Take Photo" buttons still visible (not at limit)

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-003: Add Multiple Images (Up to 5)

**Preconditions:** TC-002 passed (1 image already selected)

**Steps:**
1. Tap "📷 Add from Gallery" again
2. Select a second photo
3. Repeat steps 1-2 to add a third photo
4. Observe the image preview grid

**Expected Results:**
- ✅ "Photos (3/5)" label updates correctly
- ✅ All 3 images are visible in horizontal scroll
- ✅ First image still shows "Cover" badge
- ✅ Images 2 and 3 do NOT show "Cover" badge
- ✅ Each image has a delete button (red X)
- ✅ Reorder buttons (← →) appear on images (except first has no ←, last has no →)
- ✅ "Add from Gallery" and "Take Photo" buttons still visible

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-004: Reorder Images (Change Cover Image)

**Preconditions:** TC-003 passed (3 images selected)

**Steps:**
1. Locate the second image in the preview grid
2. Tap the "←" (left arrow) button on the second image
3. Observe the result

**Expected Results:**
- ✅ Second image moves to first position
- ✅ "Cover" badge now appears on the new first image
- ✅ Original first image moves to second position and loses "Cover" badge
- ✅ "Photos (3/5)" count remains unchanged
- ✅ Reorder buttons update correctly (new first image has no ← button)

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-005: Remove an Image

**Preconditions:** TC-003 or TC-004 passed (3 images selected)

**Steps:**
1. Tap the red "×" button on the second image
2. Observe the result

**Expected Results:**
- ✅ Second image is removed from preview
- ✅ "Photos (2/5)" label updates
- ✅ Remaining images shift left in the grid
- ✅ First image still shows "Cover" badge
- ✅ "Add from Gallery" and "Take Photo" buttons remain visible

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-006: Add Image from Camera (iOS/Android Simulators)

**Preconditions:** User is on CreateListingScreen

**Steps:**
1. Tap "📸 Take Photo" button
2. **On permission prompt:** Tap "Allow" or "OK"
3. **Simulator camera:** Tap the shutter button (or select a photo from simulator's camera roll)
4. Wait for image to load

**Expected Results:**
- ✅ Camera permission prompt appears (first time only)
- ✅ Camera view opens (or simulator's camera roll)
- ✅ After taking/selecting photo, image preview appears
- ✅ "Photos (X/5)" label updates correctly
- ✅ "Cover" badge appears on first image if this is the first image added

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

**Note for iOS Simulator:** Camera may not work; simulator will show a placeholder or allow selecting from photo library instead.

---

### TC-007: Max Limit Enforcement (5 Images)

**Preconditions:** User has 4 images already selected

**Steps:**
1. Add a 5th image via "Add from Gallery"
2. Observe the UI after 5th image is added
3. Attempt to add a 6th image

**Expected Results:**
- ✅ After adding 5th image: "Photos (5/5)" label shows
- ✅ "Add from Gallery" button is NO LONGER visible
- ✅ "Take Photo" button is NO LONGER visible
- ✅ All 5 images are visible in horizontal scroll
- ✅ Alert appears: "Limit Reached - Maximum 5 images allowed"
- ✅ No 6th image is added

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-008: File Size Validation (>5 MB Rejection)

**Preconditions:** User has access to a large image (>5 MB) in simulator gallery

**Steps:**
1. Tap "Add from Gallery"
2. Select a very high-resolution image (>5 MB) if available
   - **Note:** Most simulator photos are small; you may need to add a large test image to simulator's photo library first
3. Observe the result

**Expected Results:**
- ✅ Alert appears: "File Too Large - Image [name] exceeds 5 MB"
- ✅ Image is NOT added to the preview grid
- ✅ "Photos (X/5)" count does not increment

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

**Note:** If simulator doesn't have a >5 MB image, skip this test and mark SKIP.

---

### TC-009: Permission Denied Handling (Gallery)

**Preconditions:** Reset photo library permissions for the app (iOS: Settings > Privacy > Photos > [App] > None; Android: Settings > Apps > [App] > Permissions > Photos > Deny)

**Steps:**
1. Tap "Add from Gallery"
2. On permission prompt, tap "Don't Allow" or "Deny"
3. Observe the result

**Expected Results:**
- ✅ Alert appears: "Permission Required - Photo library access is needed to select images"
- ✅ Gallery picker does NOT open
- ✅ User returns to CreateListingScreen
- ✅ No images are added

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-010: Permission Denied Handling (Camera)

**Preconditions:** Reset camera permissions for the app

**Steps:**
1. Tap "Take Photo"
2. On permission prompt, tap "Don't Allow" or "Deny"
3. Observe the result

**Expected Results:**
- ✅ Alert appears: "Permission Required - Camera access is needed to take photos"
- ✅ Camera does NOT open
- ✅ User returns to CreateListingScreen
- ✅ No images are added

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-011: Cancel Gallery Picker (User Changes Mind)

**Preconditions:** User is on CreateListingScreen

**Steps:**
1. Tap "Add from Gallery"
2. Gallery picker opens
3. **Do NOT select any photo** - tap "Cancel" or back button
4. Observe the result

**Expected Results:**
- ✅ Gallery picker closes
- ✅ User returns to CreateListingScreen
- ✅ No images are added
- ✅ "Photos (X/5)" count does not change
- ✅ No error alert appears

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-012: Create Listing with NO Images (Optional Images)

**Preconditions:** User is on CreateListingScreen with no images selected

**Steps:**
1. Fill in required fields:
   - Title: "Test Listing No Images"
   - Description: "Testing listing creation without images"
   - Price: "15.00"
   - Condition: Select "GOOD"
2. **Do NOT add any images**
3. Scroll down and tap "Create Listing" button
4. Wait for response

**Expected Results:**
- ✅ "Creating..." loading state appears on button
- ✅ Success alert: "Listing created successfully!"
- ✅ User navigates back to previous screen or listings feed
- ✅ No errors related to missing images

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-013: Create Listing with 1 Image (Upload Success)

**Preconditions:** User has filled in required listing fields and selected 1 image

**Steps:**
1. Fill in required fields (title, price, condition)
2. Add 1 image via gallery
3. Tap "Create Listing" button
4. Observe the button text during upload
5. Wait for completion

**Expected Results:**
- ✅ Button shows "Creating..." briefly
- ✅ Button then shows "Uploading images..." during image upload
- ✅ Upload completes within 5-10 seconds (for 1 small image)
- ✅ Success alert: "Listing created successfully!"
- ✅ User navigates back
- ✅ No errors

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-014: Create Listing with Multiple Images (Upload Success)

**Preconditions:** User has filled in required listing fields and selected 3 images

**Steps:**
1. Fill in required fields
2. Add 3 images via gallery
3. Tap "Create Listing" button
4. Observe upload progress
5. Wait for completion

**Expected Results:**
- ✅ Button shows "Creating..."
- ✅ Button shows "Uploading images..." during upload
- ✅ Upload completes within 15-20 seconds (for 3 images)
- ✅ Success alert: "Listing created successfully!"
- ✅ User navigates back
- ✅ No errors
- ✅ **Verify in DB (optional):** All 3 images exist in `item_images` table with correct `display_order` (0, 1, 2)

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-015: Partial Upload Failure (Graceful Degradation)

**Preconditions:** Simulate network instability (optional: enable airplane mode during upload)

**Steps:**
1. Fill in required listing fields
2. Add 2 images
3. **Optional:** Enable airplane mode or disable WiFi
4. Tap "Create Listing"
5. Wait for response

**Expected Results:**
- ✅ Listing creation succeeds (listing is saved to DB)
- ✅ Alert appears: "Partial Success - Listing created but some images failed to upload. You can add images later by editing the listing."
- ✅ User can tap "OK" to navigate back
- ✅ Listing exists in feed without images

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

**Note:** This test requires manual network disruption. Mark SKIP if not feasible.

---

### TC-016: Upload Progress Indicator Visibility

**Preconditions:** User has selected 3 images and is ready to submit

**Steps:**
1. Fill in required listing fields
2. Add 3 images
3. Tap "Create Listing"
4. Immediately observe the Create Listing button and image picker area

**Expected Results:**
- ✅ During upload: Button text changes to "Uploading images..."
- ✅ During upload: ImagePickerGrid shows "Uploading images..." with ActivityIndicator
- ✅ During upload: Add buttons are NOT visible
- ✅ After upload: Success alert appears

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-017: Verify Images in Database (Advanced - SQL Check)

**Preconditions:** TC-014 passed (listing created with 3 images)

**Steps:**
1. After successful listing creation, note the listing ID (from logs or DB)
2. Run SQL query in Supabase SQL Editor:
   ```sql
   SELECT * FROM item_images WHERE item_id = '<listing_id>' ORDER BY display_order;
   ```
3. Verify results

**Expected Results:**
- ✅ 3 rows returned
- ✅ `display_order` values: 0, 1, 2 (sequential)
- ✅ `url` contains: `item-images/{seller_id}/{listing_id}/0.jpg`, `1.jpg`, `2.jpg`
- ✅ `thumbnail_url` is populated (same as url for now)
- ✅ `created_at` is recent timestamp

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

### TC-018: Verify Storage Path Convention

**Preconditions:** TC-014 passed, images uploaded

**Steps:**
1. Navigate to Supabase Storage Dashboard
2. Go to `item-images` bucket
3. Browse to `{seller_id}/{listing_id}/`
4. Verify files exist

**Expected Results:**
- ✅ Storage path follows: `item-images/{seller_id}/{listing_id}/0.jpg`
- ✅ Files named: `0.jpg`, `1.jpg`, `2.jpg` (matching display_order)
- ✅ File sizes are reasonable (<5 MB each)
- ✅ Public URLs are accessible (copy URL and open in browser)

**Actual Results:** ___________

**Status:** ☐ PASS ☐ FAIL

---

## Summary

**Total Test Cases:** 18  
**Passed:** _______  
**Failed:** _______  
**Skipped:** _______  

**Critical Issues Found:**
- ___________________________________________
- ___________________________________________

**Minor Issues Found:**
- ___________________________________________
- ___________________________________________

**Tested By:** _______________________  
**Date:** _______________________  
**App Version:** _______________________  
**Simulator/Device:** iOS _____ / Android _____

---

## Regression Notes

**FLOW-04 (Listings) - Updated:**
- Image picker now integrated into CreateListingScreen
- Users can add 0-5 images per listing
- Images are uploaded to `item-images` bucket after listing creation
- Image order is preserved via `display_order` column

**Maestro Flow Updated:**
- `.maestro/listing-create.yaml` now tests:
  - Adding image from gallery
  - Image preview with "Cover" badge
  - Multi-image support with reorder buttons
  - Submit with images

**Flow Registry Updated:**
- FLOW-04 now includes SAFETY-P002 tasks and verification steps
