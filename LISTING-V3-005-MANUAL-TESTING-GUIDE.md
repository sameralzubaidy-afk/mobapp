# LISTING-V3-005 Manual Testing Guide: ItemCreateScreen Photo-First Rebuild

**Task:** MODULE-04-ITEM-LISTING-V3 TASK LISTING-V3-005
**Component:** `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx`
**Route:** `ItemCreate` (params: `{ draftId?: string }`)
**Purpose:** Verify photo-first listing creation flow with AI analysis, draft autosave, and category flagging.

---

## Preconditions

### Environment
- **Platforms:** iOS Simulator or Android Emulator (NO physical devices)
- **Supabase:** Production or Staging instance (NOT local)
- **Dependencies:**
  - LISTING-V3-001 migrations applied (item_drafts table)
  - LISTING-V3-002 Edge Functions deployed (AI analysis)
  - LISTING-V3-003 services deployed
  - MODULE-05 V3 columns (age_group, gender, brand, color)

### Test User Setup

```sql
-- Verify test user exists in staging
SELECT id, email, subscription_tier
FROM auth.users
WHERE email = 'testuser@example.com';

-- Verify user has active node
SELECT u.id, u.email, p.node_id, n.status
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
JOIN geographic_nodes n ON p.node_id = n.id
WHERE u.email = 'testuser@example.com';

-- If not exists, create test user via app signup flow
```

### Test Photos
- Prepare 3-5 test photos in device gallery (use iOS Simulator Photo Library or Android Emulator Gallery)
- Photos should be recognizable items (toys, clothes, shoes) for AI analysis
- At least one photo should be > 1MB for compression testing

---

## Test Cases

### TC-001: Screen Loads with Empty State

**Objective:** Verify ItemCreateScreen loads correctly from navigation.

**Steps:**
1. Login as test user
2. Navigate to "Create" (from dashboard or bottom nav)
3. If multiple create options exist, select "Create Listing" (V3 route)

**Expected Results:**
- ✅ Screen title: "Create Listing"
- ✅ "Photos *" section visible with "Add up to 10 photos" label
- ✅ "Add Photos" button visible
- ✅ Title input field visible (empty)
- ✅ Description input field visible (empty)
- ✅ Category selector visible with placeholder "Select category"
- ✅ Condition selector visible (no selection)
- ✅ Brand input visible (empty)
- ✅ Color picker visible (no selection)
- ✅ Age group selector visible (no selection)
- ✅ Gender selector visible (no selection)
- ✅ Price section visible (no suggestions yet)
- ✅ Publish button visible but **disabled** (missing required fields)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-002: Add Photos (Multi-Select up to 10)

**Objective:** Verify photo upload with multi-select.

**Steps:**
1. From TC-001 empty state, tap "Add Photos" button
2. **iOS Simulator:** In photo picker, select 3 photos
   - **Android Emulator:** Select 3 photos from gallery
3. Confirm selection

**Expected Results:**
- ✅ Photo picker opens
- ✅ Multi-select enabled (can select multiple photos)
- ✅ After selection, 3 photos appear in grid
- ✅ First photo has "Cover" badge
- ✅ "Add Photos" button still visible (not at max)
- ✅ AI analysis indicator appears in header (ActivityIndicator or "Analyzing..." text)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-003: Photo Cap Enforcement (Max 10)

**Objective:** Verify 10-photo maximum is enforced.

**Steps:**
1. From TC-002 with 3 photos, tap "Add Photos" button again
2. Select 7 more photos (total 10)
3. Confirm selection

**Expected Results:**
- ✅ Total 10 photos displayed in grid
- ✅ "Add Photos" button **hidden** (or disabled with "Maximum 10 photos reached" message)
- ✅ Attempting to add 11th photo should be prevented (or show error)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-004: AI Analysis Triggers After Photo Upload

**Objective:** Verify AI analysis runs automatically after photos added.

**Steps:**
1. From TC-002 with 3 photos, wait up to 15 seconds
2. Observe screen for AI analysis completion

**Expected Results:**
- ✅ During analysis: ActivityIndicator or "Analyzing..." text visible
- ✅ After completion: AI suggestions card slides in from bottom
- ✅ AI card displays suggested fields (title, category, condition, brand, color, age group, gender)
- ✅ Each suggestion shows confidence indicator (green/orange/red dot)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-005: AI Suggestions Card Displays

**Objective:** Verify AI card content and UI.

**Steps:**
1. From TC-004 after AI completes, review AI suggestions card

**Expected Results:**
- ✅ Card title: "AI Suggestions" or similar
- ✅ At least 3 fields suggested (title, category, condition minimum)
- ✅ Each field has:
  - Field name (e.g., "Title")
  - Suggested value (e.g., "Nike Sneakers")
  - Confidence indicator (green ≥0.7, orange ≥0.4, red <0.4)
  - "Use" button
- ✅ "Apply All" button visible at top or bottom of card
- ✅ Card is scrollable if >5 suggestions

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-006: Apply All AI Suggestions

**Objective:** Verify "Apply All" populates empty fields only.

**Steps:**
1. From TC-005 with AI card visible, tap "Apply All" button
2. Scroll through form fields

**Expected Results:**
- ✅ Title field populated (if AI suggested title)
- ✅ Category field populated (if AI suggested category)
- ✅ Condition field selected (if AI suggested condition)
- ✅ Brand field populated (if AI suggested brand)
- ✅ Color swatch(es) selected (if AI suggested color)
- ✅ Age group pill selected (if AI suggested age_group)
- ✅ Gender pill selected (if AI suggested gender)
- ✅ AI card dismisses or collapses after apply
- ✅ If user had already filled a field before "Apply All", that field **unchanged** (preserves user edits)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-007: Apply Individual AI Field

**Objective:** Verify individual "Use" button works.

**Steps:**
1. Clear test: Start fresh (or navigate back and create new listing)
2. Add 1 photo, wait for AI
3. Do NOT tap "Apply All"
4. Tap "Use" button next to **Title** suggestion only

**Expected Results:**
- ✅ Title field populated with AI suggestion
- ✅ Other fields remain empty
- ✅ Can still manually tap "Use" for other fields

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-008: Fill Title Manually

**Objective:** Verify title input accepts text.

**Steps:**
1. From empty state (or after clearing title), tap title input
2. Type: "Test Item Title Manual Entry"

**Expected Results:**
- ✅ Keyboard appears
- ✅ Text appears in title field as typed
- ✅ No character limit errors (should support up to 200 chars)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-009: Select Category

**Objective:** Verify category selection modal.

**Steps:**
1. From any state, tap "Select category" button
2. Category modal opens

**Expected Results:**
- ✅ Full-screen modal or bottom sheet appears
- ✅ Search bar visible at top
- ✅ "Recent" section visible (if user has selected categories before)
- ✅ All categories list visible
- ✅ Categories grouped or alphabetical
- ✅ Tap "Toys" category

**After Selection:**
- ✅ Modal closes
- ✅ Category button shows "Toys" (or selected category)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-010: Select Condition

**Objective:** Verify condition selector (radio buttons).

**Steps:**
1. From any state, scroll to "Condition" section
2. Tap "Like New" radio button

**Expected Results:**
- ✅ 5 condition options visible: New, Like New, Good, Fair, Worn
- ✅ Each has radio button (circle) on left
- ✅ Tapping "Like New" selects it (filled circle)
- ✅ Only one condition can be selected at a time
- ✅ "View Photo Guide" button visible
- ✅ Tapping photo guide button opens overlay with example photos

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-011: Fill Brand

**Objective:** Verify brand input (with autocomplete if implemented).

**Steps:**
1. From any state, tap "Brand" input
2. Type: "Nike"

**Expected Results:**
- ✅ Text appears in brand field
- ✅ (Optional) If autocomplete implemented, suggestions appear as you type
- ✅ No errors for unrecognized brands (accepts custom input)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-012: Select Color (Max 3)

**Objective:** Verify color picker with 3-color limit.

**Steps:**
1. From any state, scroll to "Color" section
2. Tap "Blue" swatch
3. Tap "Red" swatch
4. Tap "Green" swatch
5. Attempt to tap "Yellow" swatch (4th color)

**Expected Results:**
- ✅ 12 color swatches visible (Red, Pink, Purple, Blue, Green, Yellow, Orange, Brown, Gray, Black, White, Multicolor)
- ✅ After tapping Blue: check mark appears on Blue swatch
- ✅ After tapping Red: check marks on Blue + Red
- ✅ After tapping Green: check marks on Blue + Red + Green
- ✅ After tapping Yellow (4th): Error message or Yellow not selected (max 3 enforced)
- ✅ To select Yellow, must deselect one of the first 3

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-013: Select Age Group

**Objective:** Verify age group selector (5 pills).

**Steps:**
1. From any state, scroll to "Age Group" section
2. Tap "6-8" pill

**Expected Results:**
- ✅ 5 pills visible: 0-2, 3-5, 6-8, 9-12, 13+
- ✅ Tapping "6-8" selects it (highlighted background)
- ✅ Only one age group can be selected at a time
- ✅ Tapping another pill deselects previous

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-014: Select Gender

**Objective:** Verify gender selector (4 pills).

**Steps:**
1. From any state, scroll to "Gender" section
2. Tap "Boy" pill

**Expected Results:**
- ✅ 4 pills visible: Boy, Girl, Unisex, Any
- ✅ Tapping "Boy" selects it (highlighted background)
- ✅ Only one gender can be selected at a time
- ✅ "Any" option is allowed (maps to null in DB)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-015: Price Suggestions Display

**Objective:** Verify price suggestion card with 4 tiers.

**Prerequisites:** Category and condition must be selected first for price suggestions to appear.

**Steps:**
1. Ensure category = "Toys" and condition = "Like New" selected
2. Scroll to "Price" section
3. Wait 2-3 seconds for price suggestions to load

**Expected Results:**
- ✅ 4 price tiers visible:
  - Great Deal (45% of avg)
  - Fair Price (60% of avg)
  - Asking Price (75% of avg)
  - Almost New (90% of avg)
- ✅ Each tier shows: Label + Price + Description
- ✅ If insufficient data (<5 comparable sales), message: "Not enough data for suggestions"
- ✅ Manual price input field visible below tiers

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-016: Manual Price Input

**Objective:** Verify manual price entry.

**Steps:**
1. From TC-015, tap manual price input field
2. Type: "25.00"

**Expected Results:**
- ✅ Numeric keyboard appears
- ✅ Price displays with $ symbol: "$25.00"
- ✅ Only numeric + decimal allowed
- ✅ Max 2 decimal places enforced

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-017: Publish Button Validation (Disabled When Missing Required)

**Objective:** Verify publish button enabled/disabled logic.

**Steps:**
1. Start fresh listing with NO fields filled
2. Verify publish button disabled
3. Add 1 photo → still disabled
4. Fill title → still disabled
5. Select category → still disabled
6. Select condition → still disabled
7. Enter price → **should now be ENABLED**

**Expected Results:**
- ✅ Publish button disabled when missing:
  - Photos (≥1 required)
  - Title
  - Category
  - Condition
  - Price
- ✅ Publish button **enabled** when all required fields present
- ✅ Button color changes to indicate enabled state

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-018: Publish Success Flow

**Objective:** Verify end-to-end publish flow.

**Prerequisites:** All required fields filled from TC-017.

**Steps:**
1. From TC-017 with all fields filled, tap "Publish" button
2. Wait for publish to complete (5-10 seconds)

**Expected Results:**
- ✅ Publish button shows loading spinner during upload
- ✅ Button disabled during publish
- ✅ After success:
  - Navigate to Listing Detail screen (or My Listings)
  - New item visible in list
  - Item title matches what was entered
- ✅ Draft is deleted from item_drafts table (if draft was created)

**Database Verification (optional):**
```sql
-- Verify item created
SELECT id, title, seller_id, status, category_id, condition, price
FROM items
WHERE title = 'Test Item Title Manual Entry'
ORDER BY created_at DESC
LIMIT 1;

-- Verify draft deleted
SELECT COUNT(*) FROM item_drafts WHERE seller_id = '<test_user_id>';
-- Should be 0 or less than before publish
```

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-019: Category "Other" Flow with Flagging

**Objective:** Verify custom category flagging for admin review.

**Steps:**
1. Start new listing
2. Add 1 photo
3. Fill title: "Custom Board Game"
4. Tap category selector
5. Scroll to bottom, tap "Other"
6. Enter custom category name: "Board Games"
7. Tap "Save"
8. Select condition, enter price
9. Tap "Publish"

**Expected Results:**
- ✅ After tapping "Other", text input appears for custom category name
- ✅ Custom input accepts up to 100 characters
- ✅ After saving, category button shows "Other"
- ✅ Publish succeeds
- ✅ Database verification:
  ```sql
  -- Verify item created
  SELECT id, title, requested_category_name FROM items
  WHERE title = 'Custom Board Game';
  -- requested_category_name should be 'Board Games'
  
  -- Verify review flag created
  SELECT * FROM review_flags
  WHERE item_id = '<item_id_from_above>';
  -- Should have 1 row with flag_type = 'category_review'
  ```

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-020: Draft Autosave (30-Second Interval)

**Objective:** Verify draft saves automatically every 30 seconds.

**Prerequisites:** This test requires waiting 30+ seconds.

**Steps:**
1. Start new listing
2. Fill title: "Draft Autosave Test"
3. Do NOT navigate away or tap publish
4. Wait 31 seconds (use timer)
5. Check database

**Expected Results:**
- ✅ After 30 seconds, draft saved to item_drafts table
- ✅ Database verification:
  ```sql
  SELECT id, seller_id, draft_data, updated_at
  FROM item_drafts
  WHERE seller_id = '<test_user_id>'
  ORDER BY updated_at DESC
  LIMIT 1;
  -- draft_data JSONB should contain {"title": "Draft Autosave Test"}
  ```
- ✅ No visual feedback required (silent autosave)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-021: Draft Flush on Background (AppState)

**Objective:** Verify draft saves when app goes to background.

**Steps:**
1. Start new listing
2. Fill title: "Background Flush Test"
3. Press iOS Home button (or Android back to home)
4. Re-open app
5. Check database

**Expected Results:**
- ✅ Draft saved immediately when app backgrounded
- ✅ Database verification:
  ```sql
  SELECT draft_data FROM item_drafts
  WHERE seller_id = '<test_user_id>'
  ORDER BY updated_at DESC LIMIT 1;
  -- Should contain "Background Flush Test"
  ```

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-022: Draft Flush on Navigation Blur

**Objective:** Verify draft saves when navigating away from screen.

**Steps:**
1. Start new listing
2. Fill title: "Navigation Blur Test"
3. Tap "Back" button (or navigate to another screen)
4. Check database

**Expected Results:**
- ✅ Draft saved immediately on navigation blur
- ✅ Database verification (same as TC-021)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-023: Error Handling - AI Analysis Failure

**Objective:** Verify graceful degradation when AI fails.

**Prerequisites:** Simulate AI failure by disconnecting network or using invalid photo URL.

**Steps:**
1. Start new listing
2. Add 1 photo
3. Disconnect network (Airplane mode)
4. Wait for AI analysis to fail

**Expected Results:**
- ✅ AI analysis enters "error" state
- ✅ Error message displayed: "AI analysis failed. Please try again."
- ✅ Retry button visible
- ✅ Can still manually fill form fields
- ✅ Publish still works (AI optional)

**Pass/Fail:** [ ]

**Notes:**
```


```

---

### TC-024: Error Handling - Publish Failure

**Objective:** Verify error handling when publish fails.

**Prerequisites:** Simulate publish failure by disconnecting network before publish.

**Steps:**
1. Fill all required fields
2. Disconnect network
3. Tap "Publish"

**Expected Results:**
- ✅ Error message displayed: "Failed to publish listing. Please try again."
- ✅ User remains on ItemCreateScreen (does NOT navigate away)
- ✅ Form data preserved
- ✅ Retry button or ability to tap "Publish" again

**Pass/Fail:** [ ]

**Notes:**
```


```

---

## Cleanup

### Remove Test Items

```sql
-- Delete test items created during manual testing
DELETE FROM items
WHERE title IN (
  'Test Item Title Manual Entry',
  'Custom Board Game',
  'Draft Autosave Test',
  'Background Flush Test',
  'Navigation Blur Test'
);

-- Delete any remaining drafts
DELETE FROM item_drafts
WHERE seller_id = '<test_user_id>';
```

---

## Troubleshooting

### Issue: AI analysis never completes
- **Check:** Supabase Edge Function logs for errors
- **Check:** Google Vision API key configured in Edge Function secrets
- **Solution:** Test Edge Function directly via Supabase dashboard

### Issue: Photos not uploading
- **Check:** Network connection
- **Check:** Supabase storage bucket `item-images` exists and has correct RLS policies
- **Solution:** Test storage upload via Supabase dashboard

### Issue: Publish button always disabled
- **Check:** All required fields filled: title, category_id, condition, price, photos.length >= 1
- **Debug:** Add console.log to `canPublish` logic in ItemCreateScreen

### Issue: Draft not saving
- **Check:** `item_drafts` table exists (LISTING-V3-001 migration applied)
- **Check:** RLS policies allow seller to insert own drafts
- **Solution:** Test `createItemDraft` RPC directly in Supabase SQL Editor

---

## Sign-Off Checklist

**Tester:** __________________
**Date:** __________________
**Platform:** [ ] iOS Simulator [ ] Android Emulator
**Environment:** [ ] Staging [ ] Production

- [ ] All 24 test cases passed
- [ ] No critical bugs found
- [ ] Performance acceptable (screen loads <2s, AI analysis <15s, publish <10s)
- [ ] Navigation flows correctly (back button, publish navigation)
- [ ] Draft autosave working (30s + AppState + blur)
- [ ] AI suggestions applied correctly
- [ ] Category "Other" flagging works
- [ ] Cleanup SQL executed

**Notes:**
```


```

**Approved by:** __________________
**Date:** __________________
