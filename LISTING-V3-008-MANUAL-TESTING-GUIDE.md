# Manual Testing Guide: LISTING-V3-008 Supporting Components

**Module:** MODULE-04-ITEM-LISTING-V3  
**Task:** LISTING-V3-008 - Supporting Components  
**Version:** 1.0  
**Last Updated:** April 27, 2026

---

## Prerequisites

- ✅ iOS Simulator OR Android Emulator running
- ✅ User logged in with active subscription
- ✅ Test photos available in device gallery (at least 10 photos)
- ✅ Database seeded with sample categories (run `supabase db seed`)

---

## Test Case 1: PhotoUploadManager

### TC-1.1: Initial State
**Steps:**
1. Navigate to "Create Item" screen
2. Observe the PhotoUploadManager component

**Expected:**
- ✅ "Photos *" title displayed
- ✅ "Add Photos" button visible
- ✅ "(0/10 photos)" count displayed
- ✅ Subtitle: "Add up to 10 photos. First photo will be your cover image."

**Actual:** ___________

---

### TC-1.2: Add Photos
**Steps:**
1. Tap "Add Photos" button
2. Select 3 photos from gallery
3. Confirm selection

**Expected:**
- ✅ 3 photos displayed in grid
- ✅ First photo shows "Cover" badge
- ✅ Count updates to "(3/10 photos)"
- ✅ Each photo has X (remove) button

**Actual:** ___________

---

### TC-1.3: Remove Photo
**Steps:**
1. Tap X button on second photo
2. Observe the grid

**Expected:**
- ✅ Photo removed
- ✅ Count updates to "(2/10 photos)"
- ✅ Remaining photos reflow

**Actual:** ___________

---

### TC-1.4: Max Photos (10)
**Steps:**
1. Add 8 more photos (total 10)
2. Observe UI changes

**Expected:**
- ✅ "Add Photos" button hidden
- ✅ Message "Maximum 10 photos reached" appears
- ✅ Count shows "(10/10 photos)"

**Actual:** ___________

---

### TC-1.5: Accessibility
**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through photo grid

**Expected:**
- ✅ "Add photos" button announced with hint "You can add X more photos"
- ✅ Remove buttons announced as "Remove photo 1", "Remove photo 2", etc.

**Actual:** ___________

---

## Test Case 2: AIAnalysisCard

### TC-2.1: AI Suggestions Appear
**Steps:**
1. Upload 1-3 photos
2. Wait 3-5 seconds for AI analysis

**Expected:**
- ✅ Card slides up from bottom with animation
- ✅ "🤖 AI Suggestions" title visible
- ✅ Subtitle: "Apply to auto-fill fields"
- ✅ Dismiss × button in top-right

**Actual:** ___________

---

### TC-2.2: Field Suggestions Display
**Steps:**
1. Observe suggested fields in card

**Expected:**
- ✅ Each field shows: Label, Value, Confidence badge (High/Medium/Low), "Use" button
- ✅ Confidence colors: Green (High ≥70%), Orange (Medium 40-69%), Red (Low <40%)
- ✅ Confidence percentage displayed

**Actual:** ___________

---

### TC-2.3: Apply Single Field
**Steps:**
1. Tap "Use" button next to "Title" field
2. Observe form

**Expected:**
- ✅ Title field populates with AI suggestion
- ✅ "Use" button changes to "Filled"
- ✅ Button becomes disabled

**Actual:** ___________

---

### TC-2.4: Apply All Button
**Steps:**
1. Manually fill "Brand" field
2. Tap "Apply All (Empty Fields Only)"

**Expected:**
- ✅ All empty fields populate with AI suggestions
- ✅ "Brand" field remains unchanged (already filled)
- ✅ All "Use" buttons change to "Filled" except for pre-filled fields

**Actual:** ___________

---

### TC-2.5: Dismiss AI Card
**Steps:**
1. Tap × button
2. Observe card behavior

**Expected:**
- ✅ Card slides down and disappears
- ✅ Form remains visible with filled fields

**Actual:** ___________

---

## Test Case 3: CategorySelectModal

### TC-3.1: Open Modal
**Steps:**
1. Scroll to "Category" section
2. Tap "Select Category" button

**Expected:**
- ✅ Full-screen modal opens
- ✅ "Select Category" title at top
- ✅ Search input visible
- ✅ Close × button in top-right

**Actual:** ___________

---

### TC-3.2: Recent Categories
**Steps:**
1. Observe "Recent" section (if user has created listings before)

**Expected:**
- ✅ "Recent" heading visible
- ✅ Up to 3 recent categories shown as chips
- ✅ Tapping a recent chip selects that category and closes modal

**Actual:** ___________

---

### TC-3.3: Search Categories
**Steps:**
1. Tap search input
2. Type "Shoes"

**Expected:**
- ✅ Category list filters to show only "Shoes"
- ✅ Other categories hidden
- ✅ "Recent" section hidden while searching

**Actual:** ___________

---

### TC-3.4: No Results
**Steps:**
1. Type "NonexistentCategory"

**Expected:**
- ✅ "No categories found" message displayed
- ✅ Empty state shown

**Actual:** ___________

---

### TC-3.5: Select Category
**Steps:**
1. Clear search
2. Tap on "Clothing" category

**Expected:**
- ✅ Modal closes
- ✅ "Clothing" appears in category field
- ✅ Search is cleared for next use

**Actual:** ___________

---

### TC-3.6: "Other" Custom Category
**Steps:**
1. Open modal again
2. Scroll to bottom
3. Tap "Other"
4. Enter "Custom Test Category"
5. Tap "Submit"

**Expected:**
- ✅ "Other" input field appears
- ✅ Custom name accepted
- ✅ Modal closes
- ✅ "Custom Test Category" appears in category field
- ✅ Admin review flag set (verify in admin portal later)

**Actual:** ___________

---

## Test Case 4: ConditionSelector

### TC-4.1: Condition Options Display
**Steps:**
1. Scroll to "Condition" section

**Expected:**
- ✅ 5 condition rows visible: New, Like New, Good, Fair, Worn
- ✅ Each row shows: Radio button, Label, Description
- ✅ Each row has 📸 photo guide button

**Actual:** ___________

---

### TC-4.2: Select Condition
**Steps:**
1. Tap on "Good" row

**Expected:**
- ✅ Radio button fills for "Good"
- ✅ Other radio buttons clear
- ✅ Accessibility: VoiceOver announces "Select condition: Good" and state as "checked"

**Actual:** ___________

---

### TC-4.3: Photo Guide
**Steps:**
1. Tap 📸 button next to "Good"

**Expected:**
- ✅ ConditionGuideOverlay modal opens (see TC-5)

**Actual:** ___________

---

## Test Case 5: ConditionGuideOverlay

### TC-5.1: Guide Content for "Good"
**Steps:**
1. Open guide for "Good" condition

**Expected:**
- ✅ Modal title: "Good Condition"
- ✅ Description: "Gently used with minor wear"
- ✅ Example photo displayed
- ✅ "Example photo" caption shown

**Actual:** ___________

---

### TC-5.2: Tips Section
**Steps:**
1. Scroll down in guide

**Expected:**
- ✅ "What to look for:" heading
- ✅ 4 bullet points:
  - • Minor signs of wear
  - • Small stains or marks possible
  - • No major defects
  - • Fully functional

**Actual:** ___________

---

### TC-5.3: Tip Note
**Steps:**
1. Scroll to bottom

**Expected:**
- ✅ 💡 Tip section visible
- ✅ Helpful tip text displayed

**Actual:** ___________

---

### TC-5.4: Close Guide
**Steps:**
1. Tap × button

**Expected:**
- ✅ Modal closes
- ✅ Returns to condition selector
- ✅ Selected condition remains unchanged

**Actual:** ___________

---

## Test Case 6: ColorPicker

### TC-6.1: Initial State
**Steps:**
1. Scroll to "Colors" section

**Expected:**
- ✅ "Colors" title visible
- ✅ "0/3 selected" count displayed
- ✅ 12 color swatches visible in grid
- ✅ Colors: Red, Pink, Purple, Blue, Green, Yellow, Orange, Brown, Gray, Black, White, Multicolor

**Actual:** ___________

---

### TC-6.2: Select Colors
**Steps:**
1. Tap Red swatch
2. Tap Blue swatch
3. Tap Green swatch

**Expected:**
- ✅ Count updates: "1/3" → "2/3" → "3/3"
- ✅ Selected swatches show ✓ check mark
- ✅ Selected swatches have blue border
- ✅ "Maximum 3 colors" message appears

**Actual:** ___________

---

### TC-6.3: Max Limit Enforcement
**Steps:**
1. With 3 colors selected, tap Yellow

**Expected:**
- ✅ Yellow does NOT get selected
- ✅ Count remains "3/3"
- ✅ No change to existing selection

**Actual:** ___________

---

### TC-6.4: Deselect Color
**Steps:**
1. Tap Red (already selected)

**Expected:**
- ✅ Red deselects
- ✅ ✓ check mark disappears
- ✅ Blue border removed
- ✅ Count updates to "2/3"
- ✅ Can now select another color

**Actual:** ___________

---

### TC-6.5: Special Colors
**Steps:**
1. Observe White and Multicolor swatches

**Expected:**
- ✅ White swatch has visible gray border
- ✅ Multicolor swatch shows rainbow stripes (Red, Yellow, Green, Blue)

**Actual:** ___________

---

## Test Case 7: AgeGroupSelector

### TC-7.1: Age Group Options
**Steps:**
1. Scroll to "Age Group" section

**Expected:**
- ✅ "Age Group" title visible
- ✅ 5 pill buttons: 0-2, 3-5, 6-8, 9-12, 13+
- ✅ Pills arranged in row with wrapping

**Actual:** ___________

---

### TC-7.2: Select Age Group
**Steps:**
1. Tap "6-8" pill

**Expected:**
- ✅ "6-8" pill highlights (blue background, blue border)
- ✅ Other pills remain unhighlighted (gray background)
- ✅ Accessibility: state changes to selected: true

**Actual:** ___________

---

### TC-7.3: Change Selection
**Steps:**
1. Tap "13+" pill

**Expected:**
- ✅ "6-8" unhighlights
- ✅ "13+" highlights
- ✅ Only one pill selected at a time

**Actual:** ___________

---

### TC-7.4: Enum Values (Developer Verification)
**Steps:**
1. Check console logs for onChange values

**Expected:**
- ✅ Values match MODULE-05 V3 enum exactly: '0-2', '3-5', '6-8', '9-12', '13+'
- ✅ NOT: "0 to 2", "0-2 years", etc.

**Actual:** ___________

---

## Test Case 8: GenderSelector

### TC-8.1: Gender Options
**Steps:**
1. Scroll to "Gender" section

**Expected:**
- ✅ "Gender" title visible
- ✅ 4 pill buttons: Boy, Girl, Unisex, Any
- ✅ Pills arranged in row

**Actual:** ___________

---

### TC-8.2: Select Gender
**Steps:**
1. Tap "Boy" pill

**Expected:**
- ✅ "Boy" pill highlights (blue background, blue border)
- ✅ Text becomes blue and bold
- ✅ Accessibility: state changes to selected: true

**Actual:** ___________

---

### TC-8.3: CRITICAL: "Any" Maps to Null
**Steps:**
1. Tap "Any" pill
2. Check dev console for onChange value

**Expected:**
- ✅ onChange receives `null` (NOT "any" or "Any" string)
- ✅ "Any" pill highlights
- ✅ Form can be submitted with gender = null

**Actual:** ___________

---

### TC-8.4: Switch Between Options
**Steps:**
1. Tap "Girl"
2. Tap "Unisex"
3. Tap "Any"

**Expected:**
- ✅ Each tap switches selection correctly
- ✅ Only one pill highlighted at a time
- ✅ Transition smooth

**Actual:** ___________

---

## Test Case 9: PriceSuggestionCard

### TC-9.1: With Price Suggestions
**Steps:**
1. Fill category, condition fields
2. Scroll to "Price" section
3. Wait for price suggestions to load

**Expected:**
- ✅ "Price" title with ? FAQ button
- ✅ Subtitle: "Suggested pricing based on similar items:"
- ✅ 4 tier cards visible: Great Deal, Fair Price, Asking Price, Almost New
- ✅ Each card shows: Label, Price, Description
- ✅ "OR" divider below tiers
- ✅ "Set custom price" section with $ input

**Actual:** ___________

---

### TC-9.2: Select Price Tier
**Steps:**
1. Tap "Fair Price" card

**Expected:**
- ✅ Card highlights (blue border)
- ✅ Manual input clears
- ✅ Accessibility: state changes to selected: true

**Actual:** ___________

---

### TC-9.3: Manual Price Input
**Steps:**
1. Tap manual input field
2. Type "25.99"

**Expected:**
- ✅ Keyboard shows decimal pad
- ✅ $ symbol remains visible
- ✅ Value displays as "25.99"
- ✅ Tier selections clear

**Actual:** ___________

---

### TC-9.4: Manual-Only Mode (No Suggestions)
**Steps:**
1. Create new item in a category with < 5 comparable items
2. Scroll to Price section

**Expected:**
- ✅ NO tier cards displayed
- ✅ Message: "Not enough data to suggest pricing. Set your price below."
- ✅ Manual input field visible
- ✅ NO "OR" divider

**Actual:** ___________

---

### TC-9.5: FAQ Button
**Steps:**
1. Tap ? button next to "Price"

**Expected:**
- ✅ FAQ modal/sheet opens
- ✅ Pricing guidelines displayed

**Actual:** ___________

---

## Test Case 10: PublishButton

### TC-10.1: Normal State
**Steps:**
1. Scroll to bottom of form
2. Observe publish button

**Expected:**
- ✅ Large green button visible
- ✅ Text: "Publish Item"
- ✅ Button elevated (shadow visible)
- ✅ Min height ~56px

**Actual:** ___________

---

### TC-10.2: Disabled State
**Steps:**
1. Remove all required fields (e.g., clear photos)
2. Observe button

**Expected:**
- ✅ Button grays out (background: #E0E0E0)
- ✅ Text still visible
- ✅ Shadow removed
- ✅ Tap does nothing
- ✅ Accessibility: state disabled: true

**Actual:** ___________

---

### TC-10.3: Loading State
**Steps:**
1. Fill all required fields
2. Tap "Publish Item"
3. Observe button immediately

**Expected:**
- ✅ Text disappears
- ✅ Loading spinner appears (white color)
- ✅ Button remains green
- ✅ Button disabled during load
- ✅ Accessibility: state busy: true

**Actual:** ___________

---

### TC-10.4: Success
**Steps:**
1. Wait for publish to complete

**Expected:**
- ✅ Success confirmation appears
- ✅ Navigation to listing details or My Listings
- ✅ Loading spinner disappears

**Actual:** ___________

---

## Test Case 11: Component Layering (No Direct Service Calls)

### TC-11.1: Components Are Presentational
**Steps:**
1. Review component source code
2. Search for direct imports from `src/services/`

**Expected:**
- ✅ NO component directly imports `supabase` client
- ✅ NO component calls API functions
- ✅ All data passed via props
- ✅ All actions emitted via callbacks

**Actual:** ___________

---

## Test Case 12: TypeScript Strictness

### TC-12.1: Run Type Check
**Steps:**
```bash
cd p2p-kids-marketplace
npm run typecheck
```

**Expected:**
- ✅ No TypeScript errors
- ✅ No `any` types in component files
- ✅ All props interfaces exported

**Actual:** ___________

---

## Test Case 13: Accessibility Compliance

### TC-13.1: VoiceOver/TalkBack Navigation
**Steps:**
1. Enable screen reader
2. Navigate through each component

**Expected:**
- ✅ All interactive elements have `accessibilityLabel`
- ✅ All interactive elements have `accessibilityRole`
- ✅ Selected states announced correctly
- ✅ Hints provided where helpful

**Actual:** ___________

---

## Test Summary

**Total Test Cases:** 13 major groups (~60 individual tests)  
**Passed:** _____ / 60  
**Failed:** _____ / 60  
**Blocked:** _____ / 60  
**Skipped:** _____ / 60

**Severity of Failures:**
- Critical: _____
- High: _____
- Medium: _____
- Low: _____

**Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

**Tested By:** _____________________  
**Date:** _____________________  
**Platform:** iOS ☐  Android ☐  Both ☐  
**Build:** _____________________
