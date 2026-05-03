# LISTING-V3-004 Manual Testing Guide

**Module:** Item Listing V3
**Task:** LISTING-V3-004 - Types & Hooks
**Test Date:** ******\_\_\_******
**Tester:** ******\_\_\_******
**Platform:** ☐ iOS Simulator ☐ Android Emulator

---

## Prerequisites

- [ ] Supabase staging migrations applied (LISTING-V3-001)
- [ ] Edge Functions deployed (analyze-item-image, batch-analyze-items)
- [ ] Test user logged in with active session
- [ ] At least 3 test photos available in device gallery

---

## TC-001: useItemDraft - Create New Draft

**Objective:** Verify draft creation and auto-save functionality

### Steps:

1. Open app and navigate to "List Item" screen
2. Wait for screen to load
3. Check console logs for draft creation

### Expected Results:

- [ ] No errors in console
- [ ] Draft created with status "photo"
- [ ] Draft ID visible in console logs
- [ ] Draft has seller_id matching current user

### Actual Results:

```
_____________________________________________
```

**Status:** ☐ PASS ☐ FAIL

**Notes:**

```
_____________________________________________
```

---

## TC-002: useItemDraft - Auto-Save After 30s

**Objective:** Verify automatic saving after 30 seconds

### Steps:

1. Open "List Item" screen (creates new draft)
2. Enter title: "Test Item Auto Save"
3. Enter price: $25
4. Wait 30 seconds without touching the screen
5. Check console logs for save operation
6. Check Supabase Dashboard → item_drafts table

### Expected Results:

- [ ] Save operation triggered after 30s
- [ ] Console shows "Draft saved" or similar message
- [ ] Database updated with title "Test Item Auto Save"
- [ ] Database shows price = 25
- [ ] No save errors in console

### Actual Results:

```
Draft ID: _____________
Title in DB: _____________
Price in DB: _____________
Save errors: _____________
```

**Status:** ☐ PASS ☐ FAIL

**Notes:**

```
_____________________________________________
```

---

## TC-003: useItemDraft - Immediate Save

**Objective:** Verify saveNow() method

### Steps:

1. Open "List Item" screen
2. Enter description: "Immediate save test"
3. Tap "Save Draft" button (or navigate back)
4. Check console logs immediately
5. Check Supabase Dashboard

### Expected Results:

- [ ] Save operation triggered immediately (< 1s)
- [ ] Database updated with description
- [ ] No 30-second wait
- [ ] isSaving state changes: false → true → false

### Actual Results:

```
_____________________________________________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-004: useItemDraft - Background Flush

**Objective:** Verify save on app backgrounding

### Steps:

1. Open "List Item" screen
2. Enter title: "Background Save Test"
3. **Do not wait 30 seconds**
4. Press home button to background the app (iOS: swipe up, Android: home button)
5. Wait 2 seconds
6. Re-open app
7. Check Supabase Dashboard

### Expected Results:

- [ ] Draft saved when app went to background
- [ ] Database has title "Background Save Test"
- [ ] No data lost
- [ ] Draft reloads correctly when app reopens

### Actual Results:

```
_____________________________________________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-005: useItemDraft - Navigation Blur Flush

**Objective:** Verify save on screen blur

### Steps:

1. Open "List Item" screen
2. Enter price: $99
3. Immediately navigate back (< 30 seconds)
4. Check console logs for save operation
5. Return to draft list screen
6. Open the same draft again

### Expected Results:

- [ ] Save triggered on navigation blur
- [ ] Price persisted as $99
- [ ] Draft reloads with correct price
- [ ] No save errors

### Actual Results:

```
_____________________________________________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-006: useItemDraft - Discard Draft

**Objective:** Verify draft deletion

### Steps:

1. Open "List Item" screen (creates draft)
2. Note the draft ID from console
3. Tap "Discard Draft" button
4. Confirm discard in modal
5. Check Supabase Dashboard → item_drafts table

### Expected Results:

- [ ] Draft deleted from database
- [ ] User navigated away from screen
- [ ] No errors in console
- [ ] Draft does not appear in "My Drafts" list

### Actual Results:

```
Draft ID: _____________
Still in DB: ☐ Yes ☐ No
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-007: useAIAnalysis - Analyze Single Photo

**Objective:** Verify AI photo analysis

### Steps:

1. Open "List Item" screen
2. Add one photo from gallery (select a clear product photo)
3. Wait for AI analysis to complete
4. Observe AI status indicator
5. Check console logs for analysis result

### Expected Results:

- [ ] Status changes: idle → analyzing → ready
- [ ] Analysis completes within 10 seconds
- [ ] Result contains at least one field (title, category, or color)
- [ ] Confidence scores present for each field
- [ ] No error status
- [ ] UI shows AI suggestions card

### Actual Results:

```
Analysis time: _____________
Fields returned: _____________
Confidence scores: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-008: useAIAnalysis - Error Handling

**Objective:** Verify AI error handling and retry

### Steps:

1. Temporarily disconnect from internet
2. Open "List Item" screen
3. Add one photo
4. Wait for analysis to fail
5. Reconnect to internet
6. Tap "Retry Analysis" button

### Expected Results:

- [ ] Status changes to "error" when offline
- [ ] Error message displayed to user
- [ ] Retry button visible
- [ ] After reconnect + retry, analysis succeeds
- [ ] Status becomes "ready" after retry

### Actual Results:

```
Error message: _____________
Retry successful: ☐ Yes ☐ No
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-009: useAIAnalysis - Photo Change Cancellation

**Objective:** Verify abort on photo change

### Steps:

1. Open "List Item" screen
2. Add photo #1
3. Immediately (within 2 seconds) remove photo #1 and add photo #2
4. Check console logs for abort signal

### Expected Results:

- [ ] First analysis aborted
- [ ] Second analysis started
- [ ] Only one result returned (for photo #2)
- [ ] No duplicate analysis calls
- [ ] No memory leaks or stale callbacks

### Actual Results:

```
_____________________________________________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-010: usePhotoGroups - Add Photos

**Objective:** Verify photo grouping

### Steps:

1. Open "Bulk Listing" screen (or test screen for this hook)
2. Add 5 photos
3. Observe group creation
4. Check totalPhotos count

### Expected Results:

- [ ] Photos added to group
- [ ] Group created with all 5 photos
- [ ] Primary photo set to first photo
- [ ] totalPhotos = 5
- [ ] No errors

### Actual Results:

```
Groups count: _____________
Total photos: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-011: usePhotoGroups - Enforce 10 Photos Per Group

**Objective:** Verify per-group photo cap

### Steps:

1. Create new photo group
2. Add 10 photos to the group
3. Observe group state
4. Try to add 1 more photo to the same group

### Expected Results:

- [ ] First 10 photos added successfully
- [ ] 11th photo creates a new group (or shows error if adding to specific group)
- [ ] Error message if trying to add to full group
- [ ] Group cap enforced: max 10 photos/group

### Actual Results:

```
Photos in group 1: _____________
Photos in group 2: _____________
Error shown: ☐ Yes ☐ No
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-012: usePhotoGroups - Enforce 30 Photos Total

**Objective:** Verify total photo cap

### Steps:

1. Add 30 photos across multiple groups
2. Observe totalPhotos count
3. Try to add 1 more photo

### Expected Results:

- [ ] First 30 photos added successfully
- [ ] totalPhotos = 30
- [ ] 31st photo rejected
- [ ] Error added to errors array
- [ ] Error type = 'max_photos_total'
- [ ] Error message shown to user

### Actual Results:

```
Total photos: _____________
Error message: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-013: usePhotoGroups - Regroup Photos

**Objective:** Verify moving photos between groups

### Steps:

1. Create 2 groups with photos:
   - Group A: 3 photos
   - Group B: 2 photos
2. Drag photo #1 from Group A to Group B
3. Observe updated groups

### Expected Results:

- [ ] Photo removed from Group A
- [ ] Photo added to Group B
- [ ] Group A now has 2 photos
- [ ] Group B now has 3 photos
- [ ] No errors
- [ ] Photo IDs preserved

### Actual Results:

```
Group A photos: _____________
Group B photos: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-014: usePhotoGroups - Set Cover Photo

**Objective:** Verify primary photo selection

### Steps:

1. Create group with 3 photos
2. Tap photo #3 to set as cover
3. Observe primaryPhotoIndex

### Expected Results:

- [ ] primaryPhotoIndex changes to 2 (0-indexed)
- [ ] UI shows photo #3 with "Cover" badge
- [ ] No errors

### Actual Results:

```
Primary index: _____________
Cover photo: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-015: usePhotoGroups - Remove Photo

**Objective:** Verify photo removal and group cleanup

### Steps:

1. Create group with 1 photo
2. Remove the photo
3. Observe groups array

### Expected Results:

- [ ] Photo removed
- [ ] Group automatically removed (empty groups deleted)
- [ ] groups array length = 0
- [ ] totalPhotos = 0

### Actual Results:

```
Groups remaining: _____________
Total photos: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## TC-016: Full Workflow Integration

**Objective:** Verify all three hooks working together

### Steps:

1. Open "List Item" screen
2. Add 2 photos
3. Wait for AI analysis to complete
4. Apply AI suggestions to title field
5. Enter price manually: $40
6. Wait 30 seconds (auto-save)
7. Navigate away (blur flush)
8. Return to drafts list
9. Open the draft
10. Verify all data persisted

### Expected Results:

- [ ] Photos added and analyzed successfully
- [ ] AI suggestions applied
- [ ] Auto-save triggered at 30s
- [ ] Blur flush triggered on navigation
- [ ] Draft appears in drafts list
- [ ] Draft reloads with:
  - [ ] Title from AI
  - [ ] Price = $40
  - [ ] 2 photos
  - [ ] AI suggestions still available

### Actual Results:

```
Draft ID: _____________
Title: _____________
Price: _____________
Photos: _____________
AI suggestions: _____________
```

**Status:** ☐ PASS ☐ FAIL

---

## Summary

**Total Test Cases:** 16

**Passed:** **\_**
**Failed:** **\_**
**Blocked:** **\_**
**Not Tested:** **\_**

**Overall Status:** ☐ PASS ☐ FAIL

**Critical Issues:**

```
_____________________________________________
_____________________________________________
```

**Notes:**

```
_____________________________________________
_____________________________________________
```

**Sign-off:**

Tester: **********\_********** Date: ****\_****
