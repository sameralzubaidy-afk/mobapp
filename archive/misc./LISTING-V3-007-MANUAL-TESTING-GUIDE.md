# LISTING-V3-007: Draft Resume Banner + FAB Bottom Sheet - Manual Testing Guide

**Module:** MODULE-04-ITEM-LISTING-V3  
**Task:** LISTING-V3-007  
**Test Environment:** iOS Simulator + Android Emulator  
**Prerequisites:** Supabase production (not local)

---

## Pre-Test Setup

1. **Start the app:**
   ```bash
   cd p2p-kids-marketplace
   npm run start:android:dev  # For Android
   # OR
   npm run ios  # For iOS
   ```

2. **Login Credentials:**
   - Email: `test-listing-v3-007@example.com`
   - Password: `Test123456!`
   - (Create this user if it doesn't exist)

3. **Reset State:**
   - Go to My Listings → Drafts tab
   - Discard all existing drafts
   - Return to Dashboard

---

## Test Cases

### TC-001: Resume Draft Banner - Not Visible When No Drafts

**Precondition:** No active drafts exist for the user  
**Steps:**
1. Login
2. Navigate to Dashboard (Home screen)
3. Observe the screen below the header

**Expected Result:**
- ✅ Resume Draft Banner is NOT visible
- ✅ Dashboard shows normal content (recommendations, categories, etc.)

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-002: Create Draft Auto-Save (Single Item)

**Precondition:** No active drafts exist  
**Steps:**
1. Go to My Listings screen
2. Tap the FAB (+ button) at bottom-right
3. Observe the bottom sheet modal
4. Tap "List One Item"
5. On ItemCreate screen, upload at least 1 photo
6. Navigate back using the back button (DO NOT complete the listing)

**Expected Result:**
- ✅ FAB bottom sheet appears with two options:
  - "List One Item"
  - "Bulk Upload"
- ✅ ItemCreate screen loads
- ✅ On navigating back after photo upload, draft is auto-saved (no confirmation needed)
- ✅ If user navigates back before uploading any photo, no draft is saved

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-003: Resume Draft Banner - Visible When Drafts Exist

**Precondition:** TC-002 completed (1 draft exists)  
**Steps:**
1. Return to Dashboard (Home screen)
2. Observe the banner below the header

**Expected Result:**
- ✅ Resume Draft Banner is visible with:
  - 📝 Icon
  - Title: "You have 1 unfinished listing"
  - Subtitle: "Continue where you left off"
  - "Continue" button
  - "×" dismiss button (top-right)

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-004: Resume Draft from Banner (Single Item)

**Precondition:** TC-003 passed  
**Steps:**
1. On Dashboard, tap "Continue" button on Resume Draft Banner
2. Observe navigation

**Expected Result:**
- ✅ App navigates to ItemCreate screen
- ✅ Draft data is pre-filled (photos, title, description if entered)
- ✅ User can continue editing from where they left off

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-005: Dismiss Resume Draft Banner

**Precondition:** TC-003 passed (banner visible)  
**Steps:**
1. On Dashboard, tap the "×" dismiss button on Resume Draft Banner
2. Observe the banner disappears
3. DO NOT restart app - just navigate to another tab and back to Dashboard

**Expected Result:**
- ✅ Banner disappears immediately (session-level dismiss)
- ✅ Banner remains hidden within the same app session
- ✅ (DO NOT test yet) Banner reappears on next app launch

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-006: Drafts Tab - View Active Drafts

**Precondition:** 1+ drafts exist  
**Steps:**
1. Navigate to My Listings screen
2. Tap on "Drafts" tab (next to "Listings" tab)
3. Observe the list

**Expected Result:**
- ✅ Tab switcher visible with "Listings (X)" and "Drafts (Y)" counts
- ✅ Drafts tab shows list of active drafts
- ✅ Each draft card shows:
  - Title (or "Untitled Draft")
  - Type: "📦 Bulk Upload" or "📝 Single Item"
  - Photo count: "X photo(s)"
  - Time ago: "30m ago" / "1h ago" / "2d ago" etc.
  - "Resume" button
  - "Discard" button

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-007: Resume Draft from Drafts Tab

**Precondition:** TC-006 passed  
**Steps:**
1. In Drafts tab, tap "Resume" button on any draft
2. Observe navigation

**Expected Result:**
- ✅ Navigates to ItemCreate or BulkListingCreate depending on draft type
- ✅ Draft data is pre-filled

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-008: Discard Draft from Drafts Tab

**Precondition:** TC-006 passed  
**Steps:**
1. In Drafts tab, tap "Discard" button on a draft
2. Observe confirmation dialog
3. Tap "Discard" to confirm

**Expected Result:**
- ✅ Confirmation alert appears: "Discard Draft - Are you sure..."
- ✅ Alert has "Cancel" and "Discard" buttons
- ✅ On confirm, draft is removed from the list
- ✅ Drafts count updates in tab label

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-009: FAB Bottom Sheet - List One Item

**Precondition:** None  
**Steps:**
1. Go to My Listings screen
2. Tap FAB (+ button)
3. Observe bottom sheet
4. Tap "List One Item"

**Expected Result:**
- ✅ Bottom sheet slides up from bottom
- ✅ Sheet has handle bar at top
- ✅ Title: "Create New Listing"
- ✅ Two options visible:
  - 📝 List One Item (title + description)
  - 📦 Bulk Upload (title + description)
- ✅ "Cancel" button at bottom
- ✅ Tapping "List One Item" navigates to ItemCreate screen
- ✅ Bottom sheet dismisses

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-010: FAB Bottom Sheet - Bulk Upload

**Precondition:** None  
**Steps:**
1. Go to My Listings screen
2. Tap FAB (+ button)
3. Tap "Bulk Upload" option

**Expected Result:**
- ✅ Navigates to BulkListingCreate screen
- ✅ Bottom sheet dismisses

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-011: FAB Bottom Sheet - Cancel

**Precondition:** None  
**Steps:**
1. Go to My Listings screen
2. Tap FAB (+ button)
3. Tap "Cancel" button in bottom sheet

**Expected Result:**
- ✅ Bottom sheet dismisses
- ✅ Remains on My Listings screen

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-012: FAB Bottom Sheet - Dismiss by Overlay Tap

**Precondition:** None  
**Steps:**
1. Go to My Listings screen
2. Tap FAB (+ button)
3. Tap anywhere on the dark overlay (outside the sheet)

**Expected Result:**
- ✅ Bottom sheet dismisses
- ✅ Remains on My Listings screen

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-013: Multiple Drafts - Banner Uses Most Recent

**Precondition:** Create 3 drafts (via incomplete listing flows)  
**Steps:**
1. Create Draft A, then Draft B, then Draft C (most recent)
2. Return to Dashboard
3. Tap "Continue" on Resume Draft Banner
4. Observe which draft loads

**Expected Result:**
- ✅ Banner shows "You have 3 unfinished listings"
- ✅ Tapping "Continue" loads Draft C (most recent)

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-014: Bulk Draft Resume

**Precondition:** None  
**Steps:**
1. Go to My Listings
2. Tap FAB → "Bulk Upload"
3. Add 2-3 photos (or start grouping)
4. Navigate back WITHOUT publishing
5. Return to Dashboard
6. Tap "Continue" on Resume Draft Banner

**Expected Result:**
- ✅ Banner appears with "1 unfinished listing"
- ✅ Tapping "Continue" navigates to BulkListingCreate (not ItemCreate)
- ✅ Bulk upload state is restored (photos, grouping)

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-015: Banner Reappears on App Restart

**Precondition:** 1+ drafts exist, banner dismissed in TC-005  
**Steps:**
1. Fully close the app (kill process)
2. Relaunch the app
3. Login
4. Navigate to Dashboard

**Expected Result:**
- ✅ Resume Draft Banner is visible again (dismiss was session-only)
- ✅ Banner shows correct draft count

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-016: Max 5 Drafts Enforcement

**Precondition:** None  
**Steps:**
1. Create 6 incomplete listings (start and abandon 6 times)
2. Go to My Listings → Drafts tab
3. Count the drafts

**Expected Result:**
- ✅ Only 5 drafts are visible (most recent 5)
- ✅ Oldest draft is automatically evicted

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-017: Draft Time Ago Display

**Precondition:** Create drafts at different times  
**Steps:**
1. Create a draft
2. Wait 2 minutes
3. Create another draft
4. Go to Drafts tab
5. Observe time stamps

**Expected Result:**
- ✅ Recent draft shows "just now" or "2m ago"
- ✅ Older draft shows appropriate time ("1h ago", "2d ago", etc.)
- ✅ Time format is relative and easy to read

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-018: Empty Drafts Tab

**Precondition:** Discard all drafts  
**Steps:**
1. Go to My Listings → Drafts tab
2. Discard all drafts
3. Observe empty state

**Expected Result:**
- ✅ Shows empty state with:
  - "No drafts yet" message
  - Subtitle: "Start creating a listing and it will be saved here automatically"
- ✅ No list is shown
- ✅ Tab label shows "Drafts (0)"

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-019: Tab Switching Preserves State

**Precondition:** Have some listings and some drafts  
**Steps:**
1. Go to My Listings
2. View Listings tab (scroll down if needed)
3. Switch to Drafts tab
4. Switch back to Listings tab

**Expected Result:**
- ✅ Listings tab scroll position is preserved (or resets to top - both acceptable)
- ✅ No data loss
- ✅ Tab switching is smooth with no flicker

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### TC-020: Accessibility - VoiceOver/TalkBack

**Precondition:** Enable VoiceOver (iOS) or TalkBack (Android)  
**Steps:**
1. Navigate with accessibility features enabled
2. Test:
   - Resume Draft Banner buttons
   - Drafts tab items
   - FAB button and bottom sheet options

**Expected Result:**
- ✅ All interactive elements are focusable
- ✅ Accessibility labels are descriptive:
  - "Resume listing" / "Resume bulk listing"
  - "Dismiss banner"
  - "Create new listing"
- ✅ Accessibility hints provide context

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

## Post-Test Cleanup

1. Discard all test drafts
2. Verify Dashboard shows no banner
3. Logout

---

## Summary

**Total Test Cases:** 20  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___

**Tested By:** _______________  
**Date:** _______________  
**Platform:** [ ] iOS Simulator [ ] Android Emulator [ ] Both

**Overall Result:** [ ] PASS [ ] FAIL  

---

## Known Issues / Notes

(Add any observations, bugs found, or notes here)
