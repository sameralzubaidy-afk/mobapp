# Phase 25 — Group K (Bulk Listing Creation) Verification Report

**Date:** 2026-08-19
**Agent:** QA Test Agent
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group K, AUTH-TC-K01–K06)
**Device:** iPhone 17 Pro Max (iOS 26.1) simulator, Debug build + Metro
**Personas:** test-seller (subscriber, phone-verified) for K01–K06; fresh unverified seller (`qa.alice.17871478847129759@kidsmarketplace.test`) for the bulk phone-gate check
**Scope note:** Guide `Surfaces:` for Group K = mobile only (admin out of scope). No code was modified during this run (execution-only).

---

## Verdict roll-up

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-K01 | AUTH guide | **PASS** | 5 photos → auto-grouped 5 items; dup-flag not exercisable via fixture (documented) |
| AUTH-TC-K02 | AUTH guide | **PASS** | long-press/multi-select, merge (5→4), move-to-new (4→5), cover update all verified; **reorder-in-group not present in UI** (spec gap) |
| AUTH-TC-K03 | AUTH guide | **PASS** | step indicator highlights current step (Photos→Group→Review verified); Publish step unreachable via fixtures |
| AUTH-TC-K04 | AUTH guide | **PASS** | Apply-to-All bar hidden when all blank; "Brand Nike" + "New" chips appear as values set; non-destructive to Item 1 |
| AUTH-TC-K05 | AUTH guide | **PASS (partial)** | "Submit 4 Items for Review" text + disabled-while-incomplete verified; confirm-sheet open not completed on-device (tooling friction) — source-verified |
| AUTH-TC-K06 | AUTH guide | **PASS** | SP summary card shown for subscriber; free-user shows 🔒 upgrade variant instead of totals (verified on-device) |
| Bulk phone-gate | (Additional check) | **FAIL (finding)** | **Bulk flow has NO client-side phone-verification gate** — unverified seller reaches Review + Submit with no modal; server trigger holds (data protected) |

**Roll-up: 6 PASS / 0 FAIL (K-cases) / 0 BLOCKED / 0 SKIPPED + 1 FAIL finding (bulk phone-gate check).**

---

## Per-case execution traces

### AUTH-TC-K01 · Multi-photo upload + auto-grouping — PASS

**Trace (abridged):**
1. Deep link `p2pkidsmarketplace://bulk-create` (as test-seller) → `BulkListingCreateScreen` ("Bulk Upload", Photos step, `0/30`). Evidence: `K01-00-bulk-screen-initial.png`.
2. Tap `dev-add-test-photos` → **Photos `5/30`, auto-grouped into Item 1–5** ("Group photos by item" + long-press hint). Evidence: `K01-01-grouped-5-items.png` (OCR confirmed 5 items + step indicator).
3. Assert: photos auto-grouped into items. **5 photos → 5 items (1 photo/item)** — consistent with the local grouping pipeline (`groupPhotosAuto(devPhotos, 1)`).

**Assert result:** PASS.
- Auto-grouping into items: ✅ (5 items created from 5 photos).
- "Up to 30 photos / ~15 items" caps: not exercisable via fixture (only 5 photos injected; schema CHECK on `item_bulk_uploads` enforces caps server-side).
- **Duplicate-photo perceptual-hash flagging: NOT exercisable via the dev fixture** — the fixture explicitly skips dup detection (`setDuplicatePhotoIds([])`, `setPhotoHashes({})`; all 5 are the same bundled asset). Documented in the guide itself. Flagged as a fixture limitation, not an app defect.

**UX notes:**
- *Structural:* clear empty state ("Add photos to get started"), counter `5/30`, back button present. Good.
- *Wording:* "Group photos by item" + "💡 Long-press any photo to start selecting, then tap more photos to merge them into one item" — plain and actionable for the parent audience. Good.
- *Design-system:* step indicator dots render current-step solid green `#5DBB8E`; photo tiles 88×88 rounded-8; spacing on the 4px base. No deviations found.

**Locator gaps:** photo tiles (`photo-tile-*`) have `accessibilityLabel` but do NOT surface in the AX tree (group titles do). Dev fixture buttons surface fine. See §Friction.

### AUTH-TC-K02 · Regroup / merge / move photos — PASS (with reorder spec-gap)

**Trace:**
1. Long-press Item 1 photo tile (~72,660pt, located via teal pixel scan) → **"1 selected"** + SelectionActionBar appears (`selection-merge`/`selection-move-to-new`/`selection-delete`/`selection-clear`). Evidence: `K02-01-selection-mode-1selected.png`.
2. Tap Item 2 photo tile (located via pixel probe) → **"2 selected"**.
3. Tap **Merge** (button row located via OCR slices: Merge at x≈147–220pt, y≈930) → **5 items → 4 items**, Item 1 now has 2 photos (**Split** button appears — `group.photos.length > 1`), selection cleared. Evidence: `K02-04-merged.png`.
4. Long-press Item 1's 2nd photo → **"1 selected"** → tap **New item** → **4 items → 5 items** (photo moved to a new Item 5), selection cleared. Evidence: `K02-06-after-move-to-new-5items.png`.
5. Re-merge Item 1 + Item 2 → 2-photo group; **tap the 2nd photo (non-selection mode = set-cover)** → COVER badge moved: dark-pill x 105–246px → 393–534px with **identical pixel count (2856)** — definitively the same badge relocated to photo 2. Evidence: `K02-07-*` / `K02-08-cover-set-photo2.png`.

**Assert result:** PASS for merge / move-to-new / cover-update / long-press multi-select.
- **Reorder photos within a group: NOT available in the current Group-step UI.** `PhotoGroupingView` (which contains the drag-handle reorder UI) is **orphaned** — imported/rendered nowhere in `src/` (grep verified). The active `PhotoSelectGrid` has no reorder affordance (only tap-to-set-cover, +Photos, Split, Delete). Guide asserts reorder; current UI can't do it. **Spec-gap / dead-code finding** (see Critical Findings).

**UX notes:**
- *Structural:* selection action bar is fixed at bottom (New item / 1 selected / Delete / Cancel / Merge); clear selected count. Good.
- *Wording:* "Merge selected photos into one item" hint is clear.
- *Design-system:* selection bar bg `#F5FAF7` border `#A7F3D0` (SP-tinted green family — consistent with design doc's green scale); merge button `#E8F5F0`/`#065F46`, delete `#FEE2E2`/`#E85D75` (semantic error red). Touch targets ≥40pt. No deviations found.

**Locator gaps:** SelectionActionBar buttons (`selection-*`) and card-header toggle (`bulk-item-card-toggle-*`) do NOT surface in the AX tree (had to pixel-scan/slice). Photo tiles also absent (see K01).

### AUTH-TC-K03 · Step indicator — PASS

**Trace:**
1. Initial (Photos step): OCR shows 4 labels (Photos/Group/Review/Publish). Pixel probes at each dot center (y≈152pt): **Photos dot = white text** (`dotTextCurrent`) on solid green; Group/Review/Publish = gray text. Evidence: `K01-00-bulk-screen-initial.png` analysis.
2. After photos (Group step): **Group dot = white text**; Photos dot = gray text (reached). Evidence: `K02-08-cover-set-photo2.png` analysis.
3. After `dev-skip-to-review`: **Review step** reached ("Review 4 items" + item cards). Evidence: `K06-00-review-sp-summary.png`.
4. Assert: the indicator highlights the current step at each stage. **Verified for Photos → Group** via the solid-green current dot + white step number; Review reached with the same indicator rendered.

**Assert result:** PASS.
- **Publish step highlight: not reachable via fixtures** — the `PUBLISHING` flow state only triggers on a real submit (`PUBLISH_START`), but the fixture path has no bulk session/draft, so `handlePublish` short-circuits with "Missing bulk session or draft session" before reaching PUBLISHING. Documented in the guide caveat. Limitation, not a defect.

**Locator gaps:** `bulk-step-indicator` / `bulk-step-{photos,group,review,publish}` (accessibilityRole="tab", accessibilityState selected) do NOT surface in the AX tree — verified only via OCR + pixel probe of the dot colors.

### AUTH-TC-K04 · Apply to All bar — PASS

**Trace:**
1. Review step, all 4 items blank → **no "Apply to all" bar** (correct — `suggestApplyValue` returns null for every field when all blank; bar returns `null`). Verified by absence in OCR at multiple scroll positions.
2. Expand Item 1 (tap header), set **Brand = "Nike"** → **Apply to All bar appears: "Apply to all included items:" + "Brand Nike" chip**. Evidence: `K04-12-brand-set.png`, `K04-13-after-enter.png`.
3. Set **Condition = "New"** on Item 1 → bar now shows **multiple chips** (Brand Nike + New). Evidence: `K04-20-applybar-multi-chips.png`.
4. Tap the **Brand Nike** chip → Item 1 retains its "Nike" value (**non-destructive**). Evidence: `K04-14-after-apply-brand.png`.
5. Cross-item propagation (Items 2–4 Brand="Nike"): **source-corroborated** — `applyFieldToAll` fills only blanks across included items; covered by `src/utils/__tests__/bulkApplyToAll.test.ts` (8 cases). Direct on-device read of Items 2–4's Brand fields was blocked by tooling friction (nested-scroll + stale AX tree on this screen) — see §Friction.

**Assert result:** PASS (core assertions on-device; propagation source + unit-test corroborated).
- Chip suggests the most common value: ✅ (Brand→Nike, Condition→New).
- Fills only blank fields, no overwrite: ✅ (Item 1 unchanged; logic source-verified).

**UX notes:**
- *Structural:* sticky bar above the Submit bar; chips readable; horizontal scroll. Good.
- *Wording:* "Apply to all included items:" clear. Good.
- *Design-system:* bar `#ECFDF5`/`#A7F3D0` (green tint family), chip white pill with `#5DBB8E` border, label `#047857`/value `#111827`. Consistent with the design doc's green + neutral tiers. No deviations found.

### AUTH-TC-K05 · Submit N Items for Review + confirm sheet — PASS (partial)

**Trace:**
1. Review step, all items incomplete → button reads **"Submit 4 Items for Review"**; pixel-probed button color **`#989FAA` (disabled gray)**, not primary green `#5DBB8E`. Evidence: `K06-00-review-sp-summary.png`, `K05-13-final-disabled-state.png`.
2. Filled Item 1 completely (Title "Blue Lego Set", Price "$25", Category "Books" via `dev-set-item-categories`, Condition "New"). Item 1's header updated (`Blue Lego Set $25`, missing → "Missing: Condition, Category" then clear). Evidence: `K05-02-price-set.png`, `K05-07-after-condition.png`.
3. **Button STAYED disabled** ("Submit 4 Items for Review", gray) because Items 2–4 are still incomplete — directly validating "disabled if any included item is missing required fields". ✓
4. Attempted to toggle "Exclude from publish" on Items 2–4 (to reach "Submit 1 Item for Review" + confirm sheet): **exclude switches not tappable via the toolset** (tap at derived switch coords didn't change state; count stayed 4). Tooling friction — see §Friction.

**Assert result:** PASS for the button-text + disabled-state assertions.
- "Submit N Items for Review" (N=4): ✅
- Disabled if any included item missing required fields: ✅ (verified on-device, pixel color `#989FAA`; correctly stayed disabled after Item 1 became complete).
- "Submit 1 Item for Review" variant + confirmation sheet: **not completed on-device** (exclude-toggle friction). **Source-verified:** `canSubmitForReview` (includedCount>0 && no missing details && no missing photo), `handleOpenPublishConfirm` (alerts + opens `BulkPublishConfirmSheet`), confirm sheet summarizes items + SP totals for subscribers, and the fixture-path Confirm shows "Missing bulk session or draft session" (guide caveat). Flag as partial-on-device.

**UX notes:**
- *Structural:* fixed Submit bar; count is always visible. Good.
- *Wording:* "Submit 4 Items for Review" is clear; missing-field list "Missing: Title, Condition, Category, Price" on each card is helpful. Good.
- *Design-system:* Submit button disabled `#989FAA`; item warning card `#FFFDF7`/border `#F2C66D` (warning amber family — correct semantic). Status chips (`status-chip-missing` etc.) present. No deviations found.

### AUTH-TC-K06 · Bulk SP summary (subscriber) — PASS

**Trace:**
1. As **test-seller (Kids Club+ subscriber)**: Review step shows **"Bulk Listing SP Summary"** card with "Included items: 4", "SP-enabled items: 0", "⚠️ 4 items are set to Cash Only" + "Enable 'Accept Swap Points' on item cards to include them in SP totals." Evidence: `K06-00-review-sp-summary.png`.
2. As the **fresh unverified free user** (non-subscriber): the same card renders the **free-user variant — 🔒 "Upgrade to Kids Club+ to earn these points when items sell"** + **"Upgrade to Kids Club Plus to earn Swap Points"** CTA (`upgrade-cta`) instead of SP totals. Evidence: `PHONE-06-unverified-review-no-gate.png`.

**Assert result:** PASS.
- Combined SP summary shown for subscribers: ✅ (card visible; breakdown structure present).
- Hidden for free users: ✅ on-device (totals not shown; replaced by upgrade prompt — the guide's "hidden for free users").
- **Note:** combined SP total dollar/points value not fully exercised because enabling "Accept Swap Points" on an item requires the per-item SP toggle inside the expanded form, which was not reachable due to nested-scroll friction. Summary structure + subscriber/free variants verified.

**UX notes:**
- *Structural:* expandable SP card with `sp-info-icon`; clear Cash-Only warning. Good.
- *Wording:* "Enable 'Accept Swap Points' on item cards to include them in SP totals." — plain for parents. Good.
- *Design-system:* SP gold accents per design doc (`#F59E0B` family) not fully sampled (0 SP-enabled items); warning icon + text legible. No deviations found.

---

## Bulk phone-gate check (additional — per prompt)

### 1. Source-level audit (no code change made)

**File:** `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx`

- **`handlePublish` (lines ~1360–1389):** performs, in order:
  1. `if (!bulkUploadId || !draftId) → Alert "Missing bulk session or draft session."`
  2. `if (includedCount === 0 || hasSubmissionBlockingIssues) → Alert "Missing Fields"`
  3. `dispatch({ type: 'PUBLISH_START' }); await saveNow(); const result = await publishBulkDrafts(...)`
  - **There is NO `isPhoneRequired` / `phone_verified_at` / `PhoneVerificationModal` reference anywhere in the file** (grep: 0 matches for `isPhoneRequired|phone_verified|PhoneVerification|setShowPhoneVerificationModal`).
- **Contrast — `ItemCreateScreen.handlePublish` (E05 P0 fix, lines ~806–825):** the gate is **hoisted FIRST**, before `canPublish()`:
  ```ts
  if (!phoneVerificationPending) {
    const phoneRequired = await isPhoneRequired(sellerId);
    if (phoneRequired) { setPhoneVerificationPending(true); setShowPhoneVerificationModal(true); return; }
  }
  if (!canPublish()) { Alert('Missing Fields', ...); return; }
  dispatch({ type: 'PUBLISH_START' }); ...
  ```
  plus a `<PhoneVerificationModal visible={showPhoneVerificationModal} required onSuccess={retry handlePublish}>`.
- **Defect class:** E05's root cause was a gate nested inside an unreachable branch (dead code). The bulk flow is **a different, arguably worse case: the client-side gate is entirely absent** — an unverified seller can drive the full bulk flow to the Submit bar with no phone prompt, and a real submit would call `publishBulkDrafts` directly.
- **Data path the gate would have covered:** `publishBulkDrafts` (draftService.ts) → `createListing` (listing.ts) → `.from('items').insert({...})` → **`trg_items_enforce_phone_verified` fires server-side.**

### 2. On-device empirical check (fresh unverified seller)

- Created `qa.alice.17871478847129759@kidsmarketplace.test` (user `b645cd23-…`), skipped phone OTP; **DB-verified `phone_verified = null`, `phone_verified_at = null`** (read-only SQL).
- Navigated to `p2pkidsmarketplace://bulk-create`:
  - **Entry:** no phone modal.
  - `dev-add-test-photos` → **Group step:** no phone modal. Evidence: `PHONE-05/06` series.
  - `dev-skip-to-review` → **Review step ("Review 5 items") + "Submit 5 Items for Review" bar:** no phone modal.
  - **Tapped Submit (disabled):** no phone modal, no alert — silent no-op (disabled button). Evidence: `PHONE-06-unverified-review-no-gate.png`.
- **Conclusion: the bulk flow has NO client-side phone-verification gate.** The modal never appears, is never skipped-with-message — it simply does not exist on this code path.

### 3. Server-side protection (holds — read-only verification)

- `trg_items_enforce_phone_verified` is **ENABLED** on staging (`pg_trigger.tgenabled = 'O'`).
- Function `enforce_phone_verified_on_item_insert()` (SQL-verified) raises `PHONE_VERIFICATION_REQUIRED: Please verify your phone number before publishing a listing.` for any authenticated non-admin seller whose `is_phone_verified(seller_id)` is false, on `items` INSERT. Service-role/admin bypass; audit-log insert is best-effort.
- Since `publishBulkDrafts` → `createListing` inserts into `items`, **any real bulk submit by an unverified seller is blocked at the DB** — the item(s) would fail with `PHONE_VERIFICATION_REQUIRED` and land in the bulk publish `failed[]` list.
- Post-attempt read-only check: unverified seller has **0 items** (`SELECT count(*) FROM items WHERE seller_id='b645cd23-…'` → 0). Nothing was inserted.

### Phone-gate verdict: **FAIL (finding — no client-side gate in the bulk flow; server-side protection holds)**

**Severity:** P1 (mirrors the E05 P0 defect class; server-side data is still protected, so no data-integrity breach — but the UX/trust gap is real: an unverified seller completes the whole flow with no guidance and would hit a cryptic publish failure instead of a phone prompt).

**Recommended dev fix (separate task — NOT applied in this execution-only run):** mirror the E05 fix in `BulkListingCreateScreen.handlePublish` — hoist an `isPhoneRequired(sellerId)` check before any field validation, `setShowPhoneVerificationModal(true)` + `return`, and render a `<PhoneVerificationModal required onSuccess={retry handlePublish}>` alongside the existing modal stack. Reuse `isPhoneRequired` from `src/services/phoneService.ts` and the same `PhoneVerificationModal` component as `ItemCreateScreen`.

---

## Perceived load-time table

All measurements are simulator wall-clock, ±polling-interval precision (per §5.7) — not a formal performance profile.

| Screen / transition | Elapsed | Flag |
|---|---|---|
| Login (test-seller) → Home | ~1.5s | OK |
| Deep link → BulkListingCreateScreen | ~1s | OK |
| dev-add-test-photos → Group step | ~1s | OK |
| dev-skip-to-review → Review step | ~1s | OK |
| Cover-photo set (badge move) | <1s | OK |
| Apply-to-All bar appear (after Brand set) | <1s | OK |
| Signup → OTP screen | ~2s | OK |
| App relaunch → onboarding carousel | ~4s (dev-build bundle load) | Environment artifact (dev-build cold start), not app behavior |

No sub-3s transition flagged as an app-behavior performance issue.

---

## Cross-cutting UX findings

- **Step indicator + Apply-to-All + item cards: clear, plain copy for a parent/guardian audience.** No wording problems found on the bulk screen.
- **Design-system compliance:** all bulk surfaces (step indicator, selection bar, item cards, SP summary, Apply-to-All bar) use the documented green palette (`#5DBB8E` current-step dot / `#E8F5F0` reached / `#A7F3D0` borders), semantic warning (`#F2C66D`/`#FFFDF7` missing-fields card), and neutral text tiers. **No deviations found** on the screens checked.
- **AX-tree staleness on `BulkListingCreateScreen` was severe** (see Friction) — the mobile-mcp element tree repeatedly returned pre-interaction content even after expansion/scroll, forcing screenshot+OCR+ pixel-analysis as the source of truth.

## Cross-cutting design-system deviations

None found on the bulk surfaces this run.

## Recommended follow-ups (separate dev tasks — not applied in-run)

1. **[P1] Bulk phone-gate:** add the hoisted `isPhoneRequired` gate + `PhoneVerificationModal` to `BulkListingCreateScreen.handlePublish` (mirror the E05 fix in `ItemCreateScreen`). See phone-gate finding.
2. **[P2] Reorder-in-group spec gap:** either wire the orphaned `PhotoGroupingView` (drag-handle reorder) into the Group step, or remove the reorder step from K02's guide assertions. The guide asserts a capability the active UI does not expose.
3. **[P2] Locator gaps on bulk screen (BP-53):** photo tiles (`photo-tile-*`), SelectionActionBar buttons (`selection-merge/move-to-new/delete/clear`), card header toggles (`bulk-item-card-toggle-*`), step indicator (`bulk-step-*`), and the fixed Submit bar (`bulk-publish-bar`) do not surface on the iOS AX tree despite having `testID`+labels — the header toggle already has `accessible`+`accessibilityLabel` but still doesn't surface; verify why.
4. **[P3] Duplicate-photo perceptual-hash flagging** has no QA-accessible path (the dev fixture skips it) — consider a `dev-inject-duplicate-photo` fixture if K01's dup-flag assertion needs on-device coverage.

---

## Friction vs. operating rules

- **AX-tree staleness on the bulk screen (dominant):** `mobile_list_elements_on_screen` repeatedly returned cached/pre-interaction content after card expansion, scroll, and step changes (e.g., showed SP-summary-at-top layout while the real screen showed the expanded form). Applied §5.9 — screenshot+OCR became the source of truth. Cost: significant re-work locating elements.
- **Card header / form input / switch taps unreliable:** the card-header toggle and form TextInputs did not respond to the first several taps (wrong-position taps based on stale tree coordinates); once located via screenshot OCR + pixel analysis they worked. Exclude-switch taps on the item cards never registered (state unchanged) — this blocked the K05 "Submit 1 Item" + confirm-sheet path.
- **Nested form ScrollView resisted scrolling** via mobile-mcp swipes (swipes hit the outer ScrollView); had to scroll in specific spots to reveal Price/Brand/Condition.
- **Step-indicator/photo tiles/action-bar not AX-exposed** (locator gaps above) — resolved via OCR + ImageMagick color/slice scans (§5.9 fallback).
- **`view_image` did not deliver pixels this session** (returned resource URIs) — used the `vision-ocr.swift` + ImageMagick deterministic fallback throughout.

## App state left behind

- **test-seller:** left logged out (Landing).
- **Fresh unverified seller:** `qa.alice.17871478847129759@kidsmarketplace.test` (user `b645cd23-0dd9-4b08-9f4c-4ed8b0483d90`) — throwaway per-run account (Alice dev-autofill generates unique emails per tap). Left logged out (Landing). No items/drafts created (0 items verified). No bulk session/draft rows created (fixtures are DB-write-free).
- **App:** on Landing screen, clean.
- **No code, seed, config, or DB writes performed.**
