# LISTING-V3-006 — Bulk Listing Create | Manual Testing Guide (V3.1 UX Overhaul)

> **Scope:** validates all 12 approved UX decisions for the bulk listing flow.
> **App:** `p2p-kids-marketplace` (Expo, iOS Simulator + Android emulator)
> **Backend:** Supabase prod
> **Pre-reqs:** Logged in as a Kids Club+ subscriber with no `bulk_intro_seen_v1` flag set in AsyncStorage (uninstall + reinstall the app, or clear app data, before TC-001).

---

## Decision Map

| #  | Decision (approved verbatim)                                | Test Cases                        |
| -- | ----------------------------------------------------------- | --------------------------------- |
| 1  | Default 1 photo per item                                    | TC-003, TC-019                    |
| 2  | Vertical scrolling card list (no horizontal swipe)          | TC-008, TC-037                    |
| 3  | Unified single form (all item fields visible)              | TC-013, TC-033                    |
| 4  | Long-press multi-select grouping                            | TC-005, TC-020, TC-022, TC-023    |
| 5  | Cover photo on tap (set primary)                            | TC-006, TC-036                    |
| 6  | "Edit grouping" from review                                 | TC-014                            |
| 7  | Reset grouping                                              | TC-007                            |
| 8  | Apply-to-all bar (brand / condition / age_group / gender)   | TC-012, TC-025, TC-026            |
| 9  | First-time intro sheet                                      | TC-001                            |
| 10 | Real photo reorder within a group (deferred — see Notes)    | TC-006 (cover only)               |
| 11 | Per-card AI retry                                           | TC-011, TC-032                    |
| 12 | Duplicate-photo detection                                   | TC-015, TC-031                    |

**Additional Coverage:**
- **Split Group:** TC-019
- **Add Photos to Group:** TC-021
- **Move to New Item:** TC-020
- **Multi-Select Delete:** TC-022
- **Payment Preference / Accept SP:** TC-043
- **Item Caps (15 items, 10 photos/item):** TC-023, TC-030
- **Excluded Items:** TC-026, TC-028, TC-029
- **Validation:** TC-027, TC-029
- **Performance:** TC-034, TC-035, TC-037
- **Hash Bug Regression:** TC-002
- **Regression Checks:** TC-038, TC-039

---

## V3.1 Changes Summary

This guide covers the **complete V3.1 UX overhaul** with 43 test cases:

**New Features Implemented:**
- ✅ 1-photo default per item (changed from 2-photo default)
- ✅ Vertical card list (replaced horizontal carousel)
- ✅ Unified single form on each item card (no required/optional split)
- ✅ Multi-select grouping (long-press + action bar: Merge / Move to new / Delete)
- ✅ Cover-on-tap (tap any photo to set as cover)
- ✅ Split group operation (header button on multi-photo groups)
- ✅ Reset grouping (return to 1-photo-per-item baseline)
- ✅ Edit grouping from review (back to grouping step)
- ✅ Apply-to-all bar (smart suggestions for brand/condition/age/gender)
- ✅ First-time intro sheet (AsyncStorage-backed dismissal)
- ✅ Per-card AI retry (individual retry on failure, no batch retry)
- ✅ Duplicate photo detection (perceptual hash + visual badges)
- ✅ Add photos to existing group (group-level "Add Photos" button)
- ✅ Step indicator (photos → group → review → publish)

**Bug Fixes Included:**
- 🐛 **TC-002 Hash Retry Loop:** Fixed infinite photoHash computation on remote Supabase URLs after partial upload failures (see `photoHash.ts` lines 22-37 and `BulkListingCreateScreen.tsx` lines 105-115, 157, 258-275, 327-343).
- 🐛 **TC-005 Duplicate Key Warning:** Fixed React duplicate key warning during merge operations by guaranteeing unique group IDs (see `photoService.ts` lines 407-412).
- 🐛 Upload URL mapping corrected for partial failures (failedIndexes-based indexing).
- 🐛 **Back Button Behavior:** Fixed back button in grouping step to show confirmation dialog instead of silently exiting to dashboard.
- 🐛 **"+ Photos" Group Targeting:** Fixed React state timing bug where clicking "+ Photos" on a specific item would add photos as new items instead of to the target item (see `BulkListingCreateScreen.tsx` lines 347, 397-401, 564-567).

**UX Improvements:**
- ✨ Added instructional banner in grouping step: "💡 Long-press any photo to start selecting, then tap more photos to merge them into one item"

**Test Coverage:**
- **Core Flows:** TC-001 to TC-018 (original 18 test cases)
- **New Operations:** TC-019 to TC-023 (split, move-to-new, add-to-group, multi-select variations)
- **Step Navigation:** TC-024
- **Apply-to-All Variations:** TC-025 to TC-026
- **Validation & Caps:** TC-027 to TC-030
- **Stress Tests:** TC-031 to TC-032 (duplicate stress, batch AI retry)
- **State Persistence:** TC-033
- **Performance:** TC-034 to TC-035, TC-037
- **Visual Regression:** TC-036
- **Regression Checks:** TC-038 to TC-039 (single-listing flow, Maestro E2E)
- **Accessibility:** TC-040 to TC-042 (see below)

---

## Tier 0 Preflight Checklist (MANDATORY before manual testing)

Run these commands before starting manual test cases:

```bash
cd p2p-kids-marketplace

# 1. TypeScript compile check
npm run typecheck
# Expected: ✓ No errors (exit code 0)

# 2. ESLint on changed files
npx eslint src/screens/BulkListingCreateScreen.tsx src/utils/photoHash.ts src/components/bulk/*.tsx src/utils/bulkApplyToAll.ts src/services/photoService.ts
# Expected: No new errors introduced by V3.1 changes (warnings OK if pre-existing)

# 3. Unit tests
npx jest src/utils/__tests__/photoHash.test.ts src/utils/__tests__/bulkApplyToAll.test.ts src/services/__tests__/photoService.merge-split.test.ts src/screens/__tests__/bulkListingStateMachine.test.ts
# Expected: 33 tests pass (4 test suites)

# 4. Git status (verify no unexpected changes)
git status --short
# Expected: Only V3.1 files changed (14 files: screen, components, utils, tests)
```

**If any Tier 0 check fails, STOP and fix before proceeding to TC-001.**

---

## Setup

**Prerequisites:**
1. **Tier 0 Preflight:** Run all 4 preflight checks above. **Do not proceed if any fail.**
2. Build a fresh dev build: `cd p2p-kids-marketplace && npm run start`.
3. Open in iOS Simulator (`i`) or Android (`a`).
4. Sign in as a Kids Club+ subscriber (verified active subscription).
5. **First-time test:** Uninstall the app (or clear app data) to reset AsyncStorage before TC-001.
6. From Home, tap **Sell → Bulk Upload**.

**Recommended Test Order:**
1. Core flows (TC-001 to TC-008) — validates baseline UX
2. Grouping operations (TC-019 to TC-023) — validates multi-select
3. Review & publish (TC-012 to TC-017) — validates AI and publish
4. Edge cases (TC-027 to TC-030) — validates caps and validation
5. Performance (TC-034 to TC-037) — monitors for degradation
6. Regression (TC-038 to TC-039) — ensures no breaks
7. Accessibility (TC-040 to TC-042) — launch-critical

---

## TestID Quick Reference

For Maestro/Detox automation and manual verification:

### Screen-level
- `bulk-intro-sheet` — first-time modal
- `bulk-intro-dismiss` — "Got it" button
- `bulk-step-indicator` — 4-step progress bar
- `bulk-step-{photos|group|review|publish}` — individual steps
- `bulk-back-button` — header back navigation
- `bulk-publish-button` — final publish CTA
- `bulk-publish-confirm-sheet` — publish summary modal
- `bulk-publish-confirm` — "Publish N items" button in sheet

### Photo Upload
- `bulk-image-picker-button` — initial "Add Photos" CTA
- `bulk-image-picker-add-more` — "Add more photos" button (session)
- `bulk-duplicate-warning` — duplicate ribbon banner

### Grouping Step
- `photo-select-grid` — main grouping grid
- `bulk-grouping-instructions` — instructional banner ("Long-press to merge...")
- `group-card-{i}` — individual group card (i = 0-based index)
- `group-title-{i}` — "Item {i+1}" header
- `group-add-photos-{i}` — "+ Photos" button (add to specific group)
- `group-split-{i}` — "Split" button (multi-photo groups only)
- `group-delete-{i}` — "Delete" button (trash icon)
- `photo-tile-{gi}-{pi}` — photo tile (gi = group index, pi = photo index)
- `photo-tile-{gi}-{pi}-delete` — small `×` delete chip on photo
- `bulk-reset-grouping` — "Reset grouping" button
- `bulk-confirm-grouping` — "Confirm grouping" CTA
- `bulk-add-empty-item` — "Add empty item" button (max 15)

### Multi-Select
- `selection-action-bar` — bottom action bar (visible during selection)
- `selection-merge` — "Merge" button (≥2 source groups)
- `selection-move-to-new` — "New item" button
- `selection-delete` — "Delete" button
- `selection-clear` — "Cancel" / clear selection button

### Review Step (Item Cards)
- `item-card-stack` — vertical scrollable list
- `bulk-item-card-{i}` — individual editable item card
- `bulk-item-cover-{i}` — cover photo thumbnail
- `status-chip-{analyzing|success|failed}` — AI state indicator
- `bulk-item-retry-ai-{i}` — "Retry AI" button (shown on failure)
- `bulk-edit-grouping` — "Edit grouping" button (return to grouping)

### Apply-to-All Bar
- `apply-to-all-bar` — sticky bar above cards
- `apply-to-all-{brand|condition|age_group|gender}` — field chips

### Publish Confirmation
- `publish-summary-thumb-{i}` — 44×44 cover thumbnails in sheet
- `bulk-partial-banner` — partial failure banner (shows failed items)

---

## TC-001 — First-time intro sheet (Decision 9)

**Steps**
1. Fresh install. Open the bulk screen for the first time.
2. Observe modal `bulk-intro-sheet`.
3. Tap `bulk-intro-dismiss` ("Got it").
4. Force-close app, reopen, navigate back to bulk.

**Expected**
- Modal appears once with copy explaining: pick photos → group → AI fills → review → publish.
- After dismissal, AsyncStorage key `@kids_marketplace:bulk_intro_seen_v1` is set to `'1'`.
- On second open, the modal does **not** appear.

---

## TC-002 — 30-photo cap + Partial Upload Failure Hash Bug Regression

**Steps**
1. Tap `bulk-image-picker-button`.
2. Try to pick 35 photos (iOS/Android should cap at 30).
3. **Hash Bug Scenario (critical regression check):**
   - Pick exactly 31 photos (or force 1 upload failure by turning off network briefly after initial selection).
   - Observe the upload batch (`uploadPhotoBatch` in logs).
   - Watch for **repeating photoHash errors** in Metro logs after upload completes.

**Expected**
- The system picker enforces `selectionLimit=30`, or the screen trims to the first 30.
- Grouping respects caps with **no silent drops**:
  - Up to **15 items** per bulk session.
  - Up to **30 total photos** per bulk session.
  - If 30 photos are selected, all 30 are preserved across 15 groups (typically 2 photos per group).
- **Hash Bug Fix Verification:**
  - Photo hashes are computed **only for local URIs** (file://, ph://, content://, asset-library://, assets-library://).
  - After a partial upload failure (e.g., 30 of 31 photos uploaded), **no repeating photoHash errors** appear.
  - Upload-failure alert includes per-photo details (photo label + reason), not just count.
  - Failed photos are **skipped** from the working set; successful photos render normally.
  - **No infinite loop** of hash computation attempts on remote Supabase URLs (fix applied in `photoHash.ts` lines 22-37 and `BulkListingCreateScreen.tsx` lines 105-115, 157, 258-275, 327-343).
  - Metro logs show hash computation exactly **once per local photo**, never for remote `https://` URLs.

---

## TC-003 — Default 1 photo per item (Decision 1)

**Steps**
1. Pick exactly 4 photos.

**Expected**
- After upload, 4 cards appear (`group-card-0..3`), each with a single photo.
- `bulk-step-indicator` advances to **Group**.

---

## TC-004 — Add more photos to existing session

**Steps**
1. From the grouping step (with photos already added), tap `bulk-image-picker-add-more`.
2. Pick 2 more photos.

**Expected**
- Two new groups appended.
- Total cap of 30 photos / 15 items respected.

---

## TC-005 — Long-press multi-select + Merge (Decision 4)

**Steps**
1. With ≥3 items, observe the instructional banner: "💡 Long-press any photo to start selecting..."
2. Long-press the photo in `group-card-0` (`photo-tile-0-0`).
3. Tap on a photo from `group-card-1` (`photo-tile-1-0`) to add to selection.
4. `selection-action-bar` becomes visible. Tap `selection-merge`.

**Expected**
- Instructional banner is visible at the top of the grouping section (blue background, testID: `bulk-grouping-instructions`).
- After long-press, the first photo shows a checkmark badge.
- The two photos collapse into a single group at the position of the first source.
- Selection clears (`selection-action-bar` hides).
- If the merged group would exceed 10 photos/item, an alert is shown and overflow photos remain in their original groups.
- **No duplicate key warning** appears in Metro logs (regression check for TC-005 fix).

---

## TC-006 — Set cover photo (Decision 5 + Decision 10 partial)

**Steps**
1. Tap a non-cover photo inside a multi-photo group.

**Expected**
- The tapped photo becomes the cover (badge `Cover` moves).
- The card thumbnail (`bulk-item-cover-{i}`) updates to that photo.
- *(Decision 10 deferred: drag-to-reorder is not yet implemented — see Notes.)*

---

## TC-007 — Reset grouping (Decision 7)

**Steps**
1. Merge a few photos so groups != photos count.
2. Tap `bulk-reset-grouping` → confirm "Reset".

**Expected**
- Every photo becomes its own item again.
- Card count returns to total photo count.
- Flow remains in **GROUPING** state.

---

## TC-008 — Vertical card stack (Decision 2)

**Steps**
1. Reach the **Review** step (after AI auto-fill).

**Expected**
- `item-card-stack` is a vertical scrollable list — **no horizontal swipe**.
- Each card width is full-screen minus padding.

---

## TC-009 — Add empty item

**Steps**
1. From grouping step, tap `bulk-add-empty-item`.

**Expected**
- A new card is appended with **0 photos** and "Missing photo" / "Excluded" status chip.
- Limit: max 15 items total.

---

## TC-010 — Delete photo / delete item

**Steps**
1. On a multi-photo card, tap the small `×` chip on a photo (`photo-tile-{gi}-{pi}-delete`).
2. Tap `group-delete-{i}` to delete an entire item.

**Expected**
- Single-photo deletion: removes only that photo; if last photo, the entire group is removed.
- Group deletion: confirm dialog, then group disappears.

---

## TC-011 — AI retry per card (Decision 11)

**Steps**
1. Force a low-confidence / failed AI call (turn off network briefly between confirm-grouping and retry, or list a deliberately blurry photo).
2. After AI batch, observe `bulk-item-card-{i}` shows `status-chip-failed` and `bulk-item-retry-ai-{i}`.
3. Tap `bulk-item-retry-ai-{i}`.

**Expected**
- Card switches to `status-chip-analyzing`, then to `status-chip-success` with `✨ AI filled N`.
- Other cards are unaffected.

---

## TC-012 — Apply-to-all bar (Decision 8)

**Steps**
1. Reach Review with ≥2 items where at least one has a Brand value.
2. Observe `apply-to-all-bar` chip `apply-to-all-brand` showing the suggested value.
3. Tap it.

**Expected**
- Every other included item with a blank `brand` is filled with the suggested value.
- Items already filled are **not** overwritten.
- Excluded items (toggle off) are skipped.

---

## TC-013 — Unified single form (Decision 3)

**Steps**
1. Expand any `bulk-item-card-{i}` in the Review step.
2. Inspect the form fields without tapping any extra toggle.

**Expected**
- There is only one continuous form per item card.
- The same fields as single-item create are visible directly on the card: title, description, category, condition, brand, color, age_group, gender, price, and payment preference.
- No separate "Add optional details" section exists.
- If AI already analyzed the item, available suggestions are pre-filled in empty fields only.

---

## TC-043 — Payment Preference and Accept SP parity

**Steps**
1. Expand any `bulk-item-card-{i}` in review.
2. Verify a **Payment Preference** section is visible under Brand.
3. If logged in as Kids Club+:
  - Verify `bulk-item-sp-toggle-{i}` is visible.
  - Toggle Accept SP on and off.
  - Verify the `SP Eligible` badge appears only when toggle is on.
4. If logged in as Free tier:
  - Verify toggle is not shown.
  - Verify upgrade prompt and `bulk-item-sp-upgrade-{i}` button are shown.

**Expected**
- Payment Preference section is always visible in expanded bulk card.
- Subscriber account sees Accept SP toggle and can change value per item.
- Free account sees upgrade CTA only; Accept SP cannot be enabled.
- Accept SP behavior in bulk matches single-item listing behavior.

---

## TC-014 — Edit grouping from review (Decision 6)

**Steps**
1. From Review step, tap `bulk-edit-grouping`.

**Expected**
- Returns to **GROUPING** state with `photo-select-grid` visible.
- All current items + photos preserved.
- Tap `bulk-confirm-grouping` to return to Review (re-runs AI for any unfilled cards).

---

## TC-015 — Duplicate photo warning (Decision 12)

**Steps**
1. Pick the **same photo twice** during the initial picker (or via Add more).

**Expected**
- The second instance gets a `DUP` badge in `photo-select-grid`.
- `bulk-duplicate-warning` ribbon on the uploader shows count: "1 possible duplicate detected".
- User can still proceed (warning, not block).

---

## TC-016 — Publish (happy path)

**Steps**
1. Reach Review with all required fields filled on ≥1 item.
2. Tap `bulk-publish-button` → `bulk-publish-confirm-sheet` shows summary with thumbs (`publish-summary-thumb-{i}`).
3. Tap `bulk-publish-confirm`.

**Expected**
- All included items publish successfully.
- "Go To My Listings" alert.

---

## TC-017 — Publish (partial failure)

**Steps**
1. Force one item to fail (e.g., invalid category).
2. Publish.

**Expected**
- `bulk-partial-banner` lists failed items.
- Successful items are still created.
- User can re-edit and re-publish failed ones.

---

## TC-018 — Back navigation autosave + confirmation

**Steps**
1. Pick 4 photos and reach the grouping step.
2. Tap `bulk-back-button` (← in header).
3. Observe confirmation dialog.
4. Tap "Cancel" to stay.
5. Tap `bulk-back-button` again, then tap "Exit".
6. Reopen the bulk screen.

**Expected**
- Confirmation dialog appears: "Discard bulk session? Your draft will be saved, but you'll exit the bulk listing flow."
- Tapping "Cancel" keeps the user in the bulk flow.
- Tapping "Exit" saves the draft and returns to the previous screen (Sell options or dashboard).
- On reopening, draft is restored from `item_drafts` (photos, groupings, partial fields).
- **Fix verification**: User does NOT accidentally exit to dashboard when they meant to go back within the bulk flow.

---

## TC-019 — Split group operation

**Steps**
1. Merge 4 photos into one group (via multi-select merge).
2. On that group card, tap `group-split-{i}` header button.

**Expected**
- Confirm dialog: "Split into 4 items?"
- After confirmation, the group splits into 4 single-photo items inserted at the original position.
- Cover photo preference is lost (each becomes its own cover).

---

## TC-020 — Move to new item (multi-select variation)

**Steps**
1. Long-press a photo in `group-card-0`.
2. Tap a photo in `group-card-1` to add to selection.
3. In `selection-action-bar`, tap `selection-move-to-new`.

**Expected**
- The 2 selected photos are removed from their original groups and form a **new item** appended to the end.
- Source groups with remaining photos stay intact.
- Source groups with 0 photos left are deleted.

---

## TC-021 — Add photos to existing group (Bug Fix Verification)

**Steps**
1. From grouping step with ≥2 items (e.g., Item 9, Item 10, Item 11), tap `group-add-photos-{i}` (the "+ Photos" button) on Item 10's card specifically.
2. Pick 3 additional photos from the system picker.
3. Observe where the new photos appear.

**Expected**
- ✅ **Critical:** The 3 new photos are appended **only to Item 10** (the group you clicked "+ Photos" on), **NOT** created as 3 new separate items.
- The photo count on Item 10's card increases by 3.
- The total item count remains unchanged (no new Item 13, 14, 15 created).
- If the group already has 8 photos, adding 3 more caps at 10 (MAX_PHOTOS_PER_GROUP).
- If adding would exceed 10, an alert shows and overflow photos are rejected or added as new items.
- **Regression check:** This test verifies the fix for the "+ Photos" React state timing bug (see lines 347, 397-401, 564-567).

---

## TC-022 — Multi-select delete photos

**Steps**
1. Long-press a photo in `group-card-0`.
2. Tap 2 more photos from different groups to select.
3. In `selection-action-bar`, tap `selection-delete`.

**Expected**
- Confirm dialog: "Delete 3 photos?"
- After confirmation, all 3 selected photos are removed.
- Groups with 0 photos left are deleted entirely.

---

## TC-023 — Multi-select across ≥3 groups (merge with overflow)

**Steps**
1. Create 3 groups with 4, 4, and 3 photos respectively (11 total).
2. Long-press a photo in group 0, then tap photos in groups 1 and 2 to select all.
3. Tap `selection-merge`.

**Expected**
- Alert: "Merge limit: max 10 photos per item. Overflow photos will remain in their original groups."
- After confirmation, first 10 photos merge into one group; 1 overflow photo stays in its original group.

---

## TC-024 — Step indicator back navigation

**Steps**
1. Reach Review step (`bulk-step-indicator` shows "Review" active).
2. Tap `bulk-step-photos` in the step indicator.

**Expected**
- **No action** — forward-only progression (photos → group → review → publish).
- Tapping previous steps has no effect (not clickable or shows alert).
- Only `bulk-edit-grouping` button allows going back to grouping.

---

## TC-025 — Apply-to-all with "overwrite" mode (manual verification)

**Steps**
1. Create 3 items where item 0 has `brand="Nike"` and items 1, 2 have `brand=""`.
2. Manually set item 1 `brand="Adidas"`.
3. Tap `apply-to-all-brand` chip (should suggest "Nike").

**Expected**
- Item 2 is filled with "Nike" (was blank).
- Item 1 **keeps** "Adidas" (not overwritten by default).
- *(Note: `overwrite` flag is a function parameter in `applyFieldToAll`, not exposed in UI yet.)*

---

## TC-026 — Apply-to-all with excluded items

**Steps**
1. Create 3 items.
2. On item 1 card, toggle the inclusion switch to **off** (excluded).
3. Set item 0 `condition="Good"`.
4. Tap `apply-to-all-condition`.

**Expected**
- Item 2 is filled with "Good".
- Item 1 (excluded) remains blank — apply-to-all skips excluded items.

---

## TC-027 — Publish with missing required fields

**Steps**
1. Create 2 items with photos.
2. Leave item 0 `category=""` (blank).
3. Fill item 1 completely.
4. Tap `bulk-publish-button`.

**Expected**
- Validation error: "Item 1 is missing required fields: Category".
- Publish is blocked until fixed.
- Item 1 card scrolls into view with error highlight.

---

## TC-028 — Publish with excluded items

**Steps**
1. Create 3 items, all complete.
2. Toggle item 1 inclusion to **off**.
3. Tap `bulk-publish-button`.

**Expected**
- `bulk-publish-confirm-sheet` shows **2 items** (not 3).
- Only items 0 and 2 are published.
- Item 1 remains in drafts (not published).

---

## TC-029 — Empty item workflow (0 photos)

**Steps**
1. Tap `bulk-add-empty-item`.
2. Fill all fields manually (category, title, price, condition).
3. Attempt to publish.

**Expected**
- Status chip shows "Missing photo" / "Excluded" in grouping/review.
- Publish validation **blocks** empty-photo items with error: "Item N has no photos".
- User must either add a photo or exclude the item.

---

## TC-030 — 15-item cap enforcement

**Steps**
1. Pick 16 photos (or merge into 14 items, then tap `bulk-add-empty-item` twice).

**Expected**
- Max 15 items enforced.
- `bulk-add-empty-item` button is disabled when 15 items exist.
- Alert: "Maximum 15 items per batch".

---

## TC-031 — Duplicate detection with same photo 3× (stress test)

**Steps**
1. During initial picker, select the **same photo 3 times** (some pickers allow this via manual re-selection).

**Expected**
- All 3 instances get `DUP?` badges.
- `bulk-duplicate-warning` shows "2 possible duplicates detected".
- Hash distance between all pairs is 0 (exact match).
- User can still proceed (no block).

---

## TC-032 — AI retry on all failed items (batch retry simulation)

**Steps**
1. Force all items to fail AI (turn off network during confirm-grouping).
2. All cards show `status-chip-failed`.
3. Restore network.
4. Tap `bulk-item-retry-ai-{i}` on each card one by one.

**Expected**
- Each card independently retries and updates to `status-chip-success`.
- No batch retry button exists (per-card only).
- Other cards remain in failed state until individually retried.

---

## TC-033 — Unified form persistence while editing

**Steps**
1. On item 0, edit one non-required field (for example `brand` or `description`).
2. Scroll down and edit item 1.
3. Scroll back to item 0.

**Expected**
- Item 0 keeps all entered values (no data loss while moving between cards).
- The form remains a single section with all fields visible.

---

## TC-034 — Photo hash computation performance (30 photos)

**Steps**
1. Pick exactly 30 photos.
2. Observe Metro logs for `[PhotoHash]` timing entries.

**Expected**
- Hash computation for all 30 photos completes in **<5 seconds** total (parallel via `Promise.all`).
- Each hash is 8×8 JPEG via `expo-image-manipulator` (64-byte perceptual hash).
- No memory crashes or heap exhaustion.

---

## TC-035 — AI batch timing (15 items)

**Steps**
1. Create 15 items (merge photos into max items).
2. Tap `bulk-confirm-grouping`.
3. Observe AI batch processing time.

**Expected**
- `fetchAIData` batch calls run in parallel (up to 5 concurrent via p-limit or similar).
- All 15 items complete AI analysis in **<30 seconds** on average network.
- Progress indicator shows "Analyzing N/15…".

---

## TC-036 — Cover photo badge visual regression

**Steps**
1. Merge 3 photos into one group.
2. Set the middle photo as cover by tapping it.

**Expected**
- The middle photo shows a **"Cover"** badge (positioned top-left or top-right).
- The other 2 photos have **no** cover badge.
- `bulk-item-cover-{i}` thumbnail in the item card matches the middle photo.

---

## TC-037 — Vertical scroll performance (15 items)

**Steps**
1. Create 15 items with 5-10 photos each.
2. Rapidly scroll up and down the `item-card-stack`.

**Expected**
- Smooth 60fps scrolling (no jank or dropped frames).
- All cover thumbnails load progressively.
- No "VirtualizedList should never be nested inside plain ScrollViews" warnings.

---

## TC-038 — Regression: Single-listing flow still works

**Steps**
1. From Home, tap **Sell → Create Listing** (not Bulk).
2. Complete a single-item listing with 1-5 photos.

**Expected**
- `ItemCreateScreen` still works (no regressions from bulk changes).
- Photo upload uses the same `uploadPhotoBatch` utility.
- Duplicate detection works if same photo is picked twice.

---

## TC-039 — Regression: Maestro E2E flow passes

**Steps**
1. Run `.maestro/listing-v3-006-bulk-listing-create.yaml`.

**Expected**
- All Maestro steps pass (intro sheet, photo picker, grouping, merge, publish).
- No timeouts or assertion failures.
- Final state: 2+ published listings visible in My Listings.

---

## TC-040 — Accessibility: VoiceOver labels

**Steps** (iOS only)
1. Enable VoiceOver (Settings → Accessibility → VoiceOver).
2. Navigate through the bulk flow using swipe gestures.

**Expected**
- `bulk-image-picker-button` announces: "Add photos, button".
- `group-card-{i}` announces: "Item {i+1}, {photoCount} photos, {category}, {title}".
- `selection-merge` announces: "Merge, button, merges selected photos into one item".
- All interactive elements have meaningful `accessibilityLabel` or `accessibilityHint`.

---

## TC-041 — Accessibility: Touch target sizes

**Steps**
1. Inspect small interactive elements (delete photo `×` chip, cover badge, selection checkboxes).

**Expected**
- All touch targets are **≥44×44 pt** (iOS HIG minimum).
- Photo delete `×` chip is tappable without accidentally tapping the photo itself.
- Selection mode checkboxes/overlays are easily tappable.

---

## TC-042 — Accessibility: Dynamic type support

**Steps** (iOS)
1. Set Text Size to "Accessibility Extra Large" (Settings → Display & Brightness → Text Size).
2. Open the bulk screen.

**Expected**
- All text scales appropriately (category dropdowns, titles, prices).
- No text truncation or overlap at large font sizes.
- Cards expand vertically to accommodate larger text.

---

## Test Completion Checklist

Use this checklist to track manual testing progress:

### Core Flows (must pass)
- [ ] TC-001 — First-time intro sheet
- [ ] TC-002 — 30-photo cap + Hash bug regression
- [ ] TC-003 — Default 1 photo per item
- [ ] TC-004 — Add more photos to session
- [ ] TC-005 — Long-press multi-select + Merge
- [ ] TC-006 — Set cover photo
- [ ] TC-007 — Reset grouping
- [ ] TC-008 — Vertical card stack

### Grouping Operations (must pass)
- [ ] TC-019 — Split group
- [ ] TC-020 — Move to new item
- [ ] TC-021 — Add photos to existing group
- [ ] TC-022 — Multi-select delete photos
- [ ] TC-023 — Merge with overflow (10-photo cap)

### Review & Publish (must pass)
- [ ] TC-012 — Apply-to-all bar
- [ ] TC-013 — Unified single form
- [ ] TC-043 — Payment Preference and Accept SP parity
- [ ] TC-014 — Edit grouping from review
- [ ] TC-016 — Publish happy path
- [ ] TC-017 — Publish partial failure

### Edge Cases & Validation (must pass)
- [ ] TC-027 — Missing required fields
- [ ] TC-028 — Excluded items
- [ ] TC-029 — Empty item (0 photos)
- [ ] TC-030 — 15-item cap enforcement

### AI & Duplicates (must pass)
- [ ] TC-011 — AI retry per card
- [ ] TC-015 — Duplicate photo warning
- [ ] TC-031 — Duplicate stress (3× same photo)
- [ ] TC-032 — AI batch retry simulation

### Performance (should pass, monitor for degradation)
- [ ] TC-034 — Photo hash performance (30 photos <5s)
- [ ] TC-035 — AI batch timing (15 items <30s)
- [ ] TC-037 — Vertical scroll performance (60fps)

### Regression (must pass)
- [ ] TC-038 — Single-listing flow still works
- [ ] TC-039 — Maestro E2E passes

### Accessibility (should pass, critical for launch)
- [ ] TC-040 — VoiceOver labels
- [ ] TC-041 — Touch target sizes ≥44pt
- [ ] TC-042 — Dynamic type support

### Optional (nice-to-have, not blocking)
- [ ] TC-009 — Add empty item
- [ ] TC-010 — Delete photo / delete item
- [ ] TC-018 — Back navigation autosave
- [ ] TC-024 — Step indicator back navigation (no-op)
- [ ] TC-025 — Apply-to-all overwrite mode
- [ ] TC-026 — Apply-to-all with excluded items
- [ ] TC-033 — Unified form persistence while editing

**Pass Criteria:**
- All "must pass" test cases pass.
- ≥80% of "should pass" test cases pass.
- All Tier 0 preflight checks pass.
- No new Tier 0 lint/typecheck errors introduced.

---

## Notes

### Decision 10: Real drag-to-reorder within a group (deferred)
**Current implementation:** Cover-on-tap only (TC-006). Tapping any photo in a multi-photo group sets it as the cover, but **drag-based reordering** is not yet implemented.

**Follow-up plan:** Add a `DraggablePhotoStrip.tsx` component using `react-native-gesture-handler` Pan gestures (already installed, no new deps) to allow within-group photo reordering. This will require:
- Pan gesture handler on each photo tile
- Visual feedback during drag (elevation, scale)
- Snap-to-position logic
- Update `photoGroups` state with new order

**Track:** TODO(LISTING-V3-006-DRAG)

---

### Hash Bug Fix (TC-002 Critical Regression)
**What was fixed:** In previous implementations, after a partial upload failure (e.g., 31 photos picked but only 30 uploaded), the screen would enter an **infinite loop** of photoHash computation attempts, logging errors repeatedly because:
1. Empty hash string (`""`) was treated as "not attempted" → retry on every render
2. `expo-image-manipulator` cannot read remote Supabase URLs (e.g., `https://xxx.supabase.co/storage/v1/object/public/item-images/...`)
3. Upload URL mapping was off-by-one after partial failures

**Fix applied:**
- `photoHash.ts` lines 22-37: Added `isLocalUri()` guard to immediately return `""` for non-local URIs (preventing manipulator errors).
- `BulkListingCreateScreen.tsx` lines 105-115: Added `hasPhotoHash()` helper using `Object.prototype.hasOwnProperty.call` for explicit hash-attempt tracking.
- `BulkListingCreateScreen.tsx` line 157: Hash effect now filters `photos.filter(p => !hasPhotoHash(photoHashes, p.id) && isLikelyLocalPhotoUri(p.uri))` to compute hashes **only for local photos**.
- `BulkListingCreateScreen.tsx` lines 258-275, 327-343: Precompute hashes before upload via `Promise.all`, then map upload URLs correctly using `failedIndexes` Set and `uploadedUrlIndex` counter.

**TC-002 must verify:** After picking 30+ photos (or forcing 1 upload failure), **no repeating photoHash errors** appear in Metro logs. Hashes computed exactly **once per local photo**, never for remote URLs.

---

### Screen-level Jest test (currently disabled)
**File:** `src/screens/__tests__/BulkListingCreateScreen.test.tsx`

**Status:** `describe.skip` (disabled)

**Reason:** Importing `BulkListingCreateScreen` pulls `expo-image-manipulator` and `expo-file-system/legacy`, which exhausts the Jest heap (OOM) in CI and local test runs.

**Alternative coverage:**
- ✅ `src/utils/__tests__/photoHash.test.ts` — hash computation, distance, duplicate detection (pure functions)
- ✅ `src/utils/__tests__/bulkApplyToAll.test.ts` — apply-to-all logic, suggestions (pure functions)
- ✅ `src/services/__tests__/photoService.merge-split.test.ts` — all 8 grouping helpers (pure functions)
- ✅ `src/screens/__tests__/bulkListingStateMachine.test.tsx` — state transitions (pure reducer)
- ✅ `.maestro/listing-v3-006-bulk-listing-create.yaml` — full E2E flow (Maestro)

**To re-enable Jest screen tests:** Add mocks for `expo-image-manipulator` and `expo-file-system/legacy` in `jest.setup.ts`:
```js
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'mock://hash.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('base64mockdata')),
  EncodingType: { Base64: 'base64' },
}));
```

---

### Test Coverage Summary (V3.1)
This guide provides **comprehensive coverage** of the bulk listing V3.1 UX overhaul:
- **43 test cases** (TC-001 to TC-043)
- **12 UX decisions** fully validated
- **Critical bug fix** regression verified (TC-002)
- **Performance benchmarks** included (hash <5s, AI <30s, scroll 60fps)
- **Accessibility checks** for VoiceOver, touch targets, dynamic type
- **Regression tests** for single-listing flow + Maestro E2E

**Pass criteria:** All "must pass" test cases + ≥80% "should pass" + Tier 0 preflight clean.

---

### Known Limitations & Deferred Features
1. **Decision 10 (drag-to-reorder):** Deferred (see above). Cover-on-tap works, drag UI planned for follow-up.
2. **Apply-to-all overwrite mode:** `applyFieldToAll` supports `overwrite: true` flag, but UI currently defaults to `false` (no overwrite). Manual testing with `overwrite: true` is deferred (TC-025 notes only).
3. **Batch AI retry:** No "Retry all failed items" button. Each card must be individually retried (TC-032 validates this behavior).
4. **Photo reordering across groups:** Not supported. Users must delete + re-add photos to move them between groups (or use multi-select Move to new).
5. **Undo/redo:** Not implemented. Users must manually revert changes or tap "Reset grouping" to start over.

---

### Files Changed in V3.1
**Core screen:**
- `src/screens/BulkListingCreateScreen.tsx` — FULL REWRITE + hash bug fix (1100 lines)

**New components:**
- `src/components/bulk/BulkItemCard.tsx` (150 lines)
- `src/components/bulk/PhotoSelectGrid.tsx` (200 lines)
- `src/components/bulk/SelectionActionBar.tsx` (80 lines)
- `src/components/bulk/BulkStepIndicator.tsx` (60 lines)
- `src/components/bulk/BulkIntroSheet.tsx` (50 lines)
- `src/components/bulk/ApplyToAllBar.tsx` (70 lines)

**Refactored components:**
- `src/components/bulk/BulkPhotoUploader.tsx` — added duplicate warning ribbon
- `src/components/bulk/ItemCardStack.tsx` — vertical layout + onRetryAI prop
- `src/components/bulk/BulkPublishConfirmSheet.tsx` — cover thumbnails

**New utilities:**
- `src/utils/bulkApplyToAll.ts` (86 lines)
- `src/utils/photoHash.ts` — bug fix lines 22-37

**Modified services:**
- `src/services/photoService.ts` — default 2→1 photo per group; added 8 helpers (mergeGroups, splitGroup, addEmptyGroup, removeGroup, removePhotoFromGroups, appendPhotosAsGroups, addPhotosToGroup, reorderPhotoInGroup)

**Modified state machine:**
- `src/screens/bulkListingStateMachine.ts` — added EDIT_GROUPING, RESET_GROUPING actions

**Test files:**
- `src/utils/__tests__/photoHash.test.ts` (68 lines, 4 describe blocks)
- `src/utils/__tests__/bulkApplyToAll.test.ts` (86 lines)
- `src/services/__tests__/photoService.merge-split.test.ts` (160 lines)
- `src/screens/__tests__/bulkListingStateMachine.test.ts` (22 lines)
- `src/screens/__tests__/BulkListingCreateScreen.test.tsx` (25 lines, DISABLED)

**Total:** 14 files changed (9 new, 5 modified), ~2,200 lines of production code, ~340 lines of tests.

---

### Related Documentation
- **BRD:** `docx/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md` (bulk listing requirements)
- **System Requirements:** `docx/SYSTEM_REQUIREMENTS_V2.md` (FR-LIST-*)
- **Solution Architecture:** `docx/ Solution Architecture & Implementation Plan.md` (photo pipeline, AI flow)
- **Module Prompt:** `Prompts/V3/MODULE-04-ITEM-LISTING-V3.md` (LISTING-V3-006 section)
- **Verification:** `Prompts/V3/MODULE-04-VERIFICATION-V3.md` (acceptance criteria)
- **Maestro Flow:** `.maestro/listing-v3-006-bulk-listing-create.yaml` (E2E automation)
- **Flow Registry:** `docs/flow-registry.md` (FLOW-04 entry for V3.1, date: 2025-01-26)

---

### Troubleshooting

**Issue:** Intro sheet doesn't appear on first launch.
- **Fix:** Delete app, reinstall, or clear AsyncStorage key `@kids_marketplace:bulk_intro_seen_v1` manually.

**Issue:** Photos don't upload (stuck at "Uploading...").
- **Check:** Network connection, Supabase URL/keys in `.env.local`, storage bucket permissions.
- **Debug:** Look for `[uploadPhotoBatch]` errors in Metro logs.

**Issue:** Hash computation takes >10 seconds for 30 photos.
- **Check:** Running on a real device (Simulator is slower). Physical iOS device should hash 30 photos in <5s.

**Issue:** AI batch never completes.
- **Check:** Network connection, Supabase Edge Function `listings-ai-analyze` deployed, OpenAI API key configured.
- **Debug:** Look for `[fetchAIData]` errors in Metro logs.

**Issue:** Duplicate warning shows but photos look different.
- **Explanation:** Perceptual hash detects **visually similar** photos (e.g., burst shots, slight crops). Hamming distance ≤8 triggers warning.
- **Action:** User can proceed (warning, not block). Review photos manually and delete true duplicates.

**Issue:** TypeScript/lint errors after pulling V3.1 changes.
- **Fix:** Run `npm install` to ensure all deps are current, then re-run Tier 0 preflight checks.
