# BADGES-V2-007: Admin Portal Badge Management - Manual Testing Guide

**Task:** BADGES-V2-007 - Admin Portal UI (Management & Manual Awards)  
**Date:** January 12, 2026  
**Tester:** [Your Name]

---

## Prerequisites

### 1. Database Setup (SQL Migration)

**⚠️ IMPORTANT: Run this SQL in Supabase SQL Editor BEFORE testing:**

```sql
-- Verify badge-icons storage bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'badge-icons';

-- If not found, run this migration:
-- filepath: supabase/migrations/20260111000001_badge_icons_storage.sql
```

**Expected Result:** Bucket `badge-icons` should exist with public=true, file_size_limit=5242880 (5MB)

### 2. Admin User Setup

Ensure you have an admin user account:
- Admin user must have `raw_user_meta_data->>'is_admin' = 'true'`
- Use the admin credentials in `.env.local`

### 3. Start Admin Portal

```bash
cd p2p-kids-admin
npm run dev
```

**URL:** http://localhost:3001

---

## Test Cases

### TC-001: Navigate to Badge Management Page

**Objective:** Verify navigation link is visible and accessible.

**Steps:**
1. Log in to admin portal at http://localhost:3001/auth/login
2. Look for "Badges" link in the navigation menu
3. Click on "Badges" link

**Expected Results:**
- ✅ "Badges" link is visible in the navigation menu
- ✅ Clicking navigates to `/badges` page
- ✅ Page displays "Badge Management" heading
- ✅ Page displays list of badges in a table

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-002: View Badge List

**Objective:** Verify all badges are displayed with correct information.

**Steps:**
1. Navigate to `/badges` page
2. Observe the badge table

**Expected Results:**
- ✅ Table displays columns: Icon, Name, Category, Threshold, Status, Actions
- ✅ Each badge row shows:
  - Badge icon (or placeholder if no icon)
  - Badge name and description
  - Category badge (color-coded)
  - Threshold value
  - Active/Inactive status toggle
  - Edit button
- ✅ Badges are sorted by sort_order

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Badge Count:** _______ badges displayed

---

### TC-003: Upload Badge Icon (Admin Portal) ⭐ PRIMARY TEST

**Objective:** Test badge icon upload functionality from admin portal.

**Prerequisites:**
- Have a test PNG image file ready (< 5MB)
- Note a badge ID for testing

**Steps:**
1. Navigate to `/badges` page
2. Click "Edit" button for any badge
3. Badge Editor modal opens
4. In the "Badge Icon" section, click "Upload New Icon"
5. Select a PNG/JPEG image file (< 5MB)
6. Wait for upload to complete

**Expected Results:**
- ✅ File input opens when clicking "Upload New Icon"
- ✅ Upload progress message displays: "Uploading icon..."
- ✅ Progress updates: "Generating public URL..."
- ✅ Progress updates: "Updating badge record..."
- ✅ Success message: "Icon uploaded successfully!"
- ✅ Modal closes automatically after 1.5 seconds
- ✅ Badge list reloads and shows new icon
- ✅ Icon is publicly accessible via URL

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- Badge ID: _________________
- Icon URL: _________________
- Upload Time: _______ ms
- File Size: _______ KB

---

### TC-004: Validate File Size Limit (5MB)

**Objective:** Ensure files larger than 5MB are rejected.

**Steps:**
1. Open Badge Editor for any badge
2. Click "Upload New Icon"
3. Select a file > 5MB

**Expected Results:**
- ✅ Error message displays: "File size exceeds 5MB limit"
- ✅ Upload does not proceed
- ✅ No file created in storage

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-005: Validate File Type Restrictions

**Objective:** Ensure only allowed image types can be uploaded.

**Steps:**
1. Open Badge Editor for any badge
2. Try to upload a PDF file
3. Try to upload a GIF file
4. Try to upload a valid PNG file

**Expected Results:**
- ✅ PDF upload rejected with error: "Invalid file type. Allowed: PNG, JPEG, WebP, SVG"
- ✅ GIF upload rejected with same error
- ✅ PNG upload succeeds

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-006: Update Badge Details

**Objective:** Test updating badge name, description, threshold, sort_order.

**Steps:**
1. Click "Edit" on any badge
2. Update the following fields:
   - Name: Add " (Updated)" suffix
   - Description: Add "Test update"
   - Threshold: Change to different value
   - Sort Order: Change to different value
3. Click "Save Changes"

**Expected Results:**
- ✅ "Saving..." indicator shows
- ✅ Modal closes on success
- ✅ Success message displays: "Badge updated successfully"
- ✅ Badge list reloads
- ✅ Updated values are visible in the table
- ✅ Database record is updated

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-007: Toggle Badge Active/Inactive

**Objective:** Test toggling badge active status.

**Steps:**
1. Find an active badge (green "Active" badge)
2. Click on the "Active" badge
3. Wait for status change
4. Observe badge status
5. Click again to toggle back

**Expected Results:**
- ✅ Status changes from "Active" to "Inactive" (green → gray)
- ✅ Success message displays: "Badge deactivated successfully"
- ✅ Page reloads automatically
- ✅ Database is_active field is updated
- ✅ Can toggle back to "Active"

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-008: Manual Badge Award - Search User

**Objective:** Test user search functionality in manual award modal.

**Steps:**
1. Click "Manual Award" button (top right)
2. Manual Award modal opens
3. Enter a valid user email in search field
4. Click "Search" button

**Expected Results:**
- ✅ Modal opens with title "Manual Badge Award"
- ✅ Search input field is present
- ✅ "Search" button is present
- ✅ After clicking Search, "Searching..." text displays
- ✅ User card appears with display_name and email
- ✅ Badge selection dropdown appears

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Test User Email:** _________________

---

### TC-009: Manual Badge Award - Award Badge

**Objective:** Test manual badge awarding flow.

**Prerequisites:**
- Found a user via TC-008

**Steps:**
1. After searching for user (TC-008)
2. Select a badge from dropdown
3. Enter optional reason: "Manual award for testing"
4. Click "Award Badge" button

**Expected Results:**
- ✅ "Awarding..." indicator shows
- ✅ Modal closes on success
- ✅ Success message: "Badge awarded successfully"
- ✅ RPC `manual_award_badge` is called
- ✅ Badge appears in user's badge list
- ✅ Audit log entry is created

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- User Email: _________________
- Badge Awarded: _________________
- Reason: _________________

---

### TC-010: Manual Badge Award - User Not Found

**Objective:** Test error handling when user doesn't exist.

**Steps:**
1. Click "Manual Award"
2. Enter invalid email: "nonexistent@test.com"
3. Click "Search"

**Expected Results:**
- ✅ Error message displays: "User not found"
- ✅ No user card appears
- ✅ Badge dropdown does not appear

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-011: Manual Badge Award - Duplicate Badge

**Objective:** Test error handling when user already has badge.

**Steps:**
1. Search for a user who already has a specific badge
2. Select that same badge
3. Click "Award Badge"

**Expected Results:**
- ✅ Error message displays from RPC
- ✅ Message indicates badge already awarded
- ✅ No duplicate entry created in user_badges

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-012: Icon Display in Badge List

**Objective:** Verify uploaded icons display correctly in the badge list.

**Steps:**
1. Upload icons for 3 different badges (TC-003)
2. Return to badge list page
3. Observe badge icons

**Expected Results:**
- ✅ Each uploaded icon displays in the "Icon" column
- ✅ Icons are sized at 40x40px (h-10 w-10)
- ✅ Icons are rounded (rounded-full)
- ✅ Badges without icons show "No Icon" placeholder
- ✅ Icons load quickly (< 1 second)

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-013: Error Handling - Network Failure

**Objective:** Test error handling during network issues.

**Steps:**
1. Open Browser DevTools → Network tab
2. Set network throttling to "Offline"
3. Try to load `/badges` page or upload an icon

**Expected Results:**
- ✅ Error message displays: "Failed to load badges" or similar
- ✅ No JavaScript errors in console
- ✅ Page doesn't crash
- ✅ User can retry after network restore

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

## Verification Queries (Run in Supabase SQL Editor)

### Verify Badge Record Updated
```sql
SELECT id, name, description, threshold, icon_url, is_active
FROM badges
WHERE id = '<BADGE_ID>';
```

### Verify Icon File in Storage
```sql
SELECT name, created_at, metadata
FROM storage.objects
WHERE bucket_id = 'badge-icons'
ORDER BY created_at DESC
LIMIT 10;
```

### Verify Manual Award Created Audit Log
```sql
SELECT *
FROM badge_audit_logs
WHERE action_type = 'manual_award'
ORDER BY created_at DESC
LIMIT 5;
```

### Verify User Has Badge
```sql
SELECT ub.*, b.name
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
WHERE ub.user_id = '<USER_ID>'
ORDER BY ub.awarded_at DESC;
```

---

## Test Summary

**Total Test Cases:** 13  
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

- All tests assume badge-icons storage bucket is properly configured
- Upload requires admin authentication (raw_user_meta_data->>'is_admin' = 'true')
- Icon URLs are public and CDN-cacheable
- File size limit (5MB) is enforced client-side AND server-side (bucket config)

---

**Tested By:** _________________  
**Date:** _________________  
**Environment:** [ ] Local [ ] Staging [ ] Production  
**Admin Portal Version:** _________________  
**Supabase Project:** _________________
