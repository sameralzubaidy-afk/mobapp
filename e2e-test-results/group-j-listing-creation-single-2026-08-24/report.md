# Group J — Listing Creation (Single Item) — QA Run Report

- **Date:** 2026-08-24 (wall-clock 08:48 → 09:20 EDT ≈ 32 min)
- **Device:** iPhone 17 Pro Max sim (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), debug build + Metro
- **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group J, L1047–1258)
- **Cases:** AUTH-TC-J01–J09, J11–J15 (14 cases; J10 excluded per brief — already closed)
- **Personas:** test-seller (Kids Club+; DB `sub_status='trial'` — registry says "Active", doc drift; trial counts as subscriber for SP), test-free (free tier; DB `node_id NULL`, `phone_verified NULL` — registry inferred otherwise, doc drift)
- **Login/logout cycles:** 2 login + 2 logout (test-seller → logout → test-free → logout). Final state: logged out at Landing.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-J01 | Group J | **PASS** | Photo-first gating: fields hidden → render after 1 photo |
| AUTH-TC-J02 | Group J | **BLOCKED** | AI analysis requires real photo upload (toolset-undrivable); dev fixture bypasses uploads |
| AUTH-TC-J03 | Group J | **PASS** | Submit disabled with missing fields; title-length service error path proven via CDP+DB |
| AUTH-TC-J04 | Group J | **PASS** | Condition(5+desc)/Age(5)/Gender(4)/Color(12) all render |
| AUTH-TC-J05 | Group J | **BLOCKED** | CategorySelectModal (native fullScreen) undrivable; no dev fixture for "Other" |
| AUTH-TC-J06 | Group J | **PASS** | Subscriber SP toggle → "✓ SP Eligible" badge + hint |
| AUTH-TC-J07 | Group J | **PASS** | Free user upgrade prompt + Upgrade Now → Kids Club+ screen; no SP toggle |
| AUTH-TC-J08 | Group J | **PASS** | Subscriber SP preview "You'll earn: ~26 SP" (Books 1.30×$20) |
| AUTH-TC-J09 | Group J | **PASS** | Submit → success modal; item created `pending`, not in public feed (DB-proven) |
| AUTH-TC-J11 | Group J | **BLOCKED** | Draft auto-save gated on real photo upload; 0 drafts for test-seller (DB-proven) |
| AUTH-TC-J12 | Group J | **BLOCKED** | Picker-gated; **doc drift: code enforces 10MB, guide says 5MB** |
| AUTH-TC-J13 | Group J | **BLOCKED** | Remove leg PASS (3→2/10); reorder/replace NOT implemented in UI (spec gap); persist gated on draft |
| AUTH-TC-J14 | Group J | **PASS** | Books (bonus 1.30) shows "1.30x multiplier" in preview; picker badge source-corroborated |
| AUTH-TC-J15 | Group J | **FAIL** | Price-recalc PASS (26→13 SP); **buyer max-SP preview NOT displayed** (spec gap); category switch modal-gated |

**Roll-up:** 8 PASS / 1 FAIL / 5 BLOCKED / 0 SKIPPED

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)
| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login | ~1s | — |
| Login → Home (test-seller) | ~1–2s | — |
| Home → ItemCreate (deep link) | ~1s | — |
| Add photo → form render | <1s | — |
| Submit → success modal (J09) | ~2–3s (transient "Submitting…" overlay not captured) | — |
| Login → Home (test-free) | ~1–2s | — |
| Upgrade Now → Kids Club+ (J07) | ~1s | — |

No transition ≥ 3s observed. Perceived Load-Time Verdict: **GOOD**.

---

## Per-case details

### AUTH-TC-J01 · Photo-first gating — PASS
- **Trace:** deep link `create-item` → ItemCreate (0 photos; tree shows only Photos* section + dev fixtures, no title/category/price) → `dev-add-test-photo` → tree shows `(1/10 photos)` + Cover badge; OCR confirms "Title *" and "Submit for Review" now render. `J01-before-photo-empty-form.png`, `J01-after-photo-form-rendered.png`.
- **Assert:** Before photo → title/category/price hidden ✓ (tree). After ≥1 photo → form appears ✓.
- **11th-photo cap note:** the "You can add up to 10 photos." alert lives in `addPhotosFromSource` (picker path), which the dev fixture bypasses — source-corroborated, not on-device drivable.
- **UX:** structural ✓; copy "Add up to 10 photos. First photo will be your cover image." is clear and parent-appropriate. Design tokens: `#5DBB8E` primary on submit ✓.

### AUTH-TC-J02 · AI auto-fill Apply All + per-field Use — BLOCKED (fixture gap)
- **Why:** AI analysis (`useAIAnalysis`) only runs when `uploadedPhotoUrls.length > 0`, which requires a real photo upload through the native picker (toolset-undrivable). `dev-add-test-photo` injects a local photo but deliberately sets no uploaded URLs (no AI, no draft side effects). No dev fixture triggers AI.
- **Source corroboration:** `handleApplyAllAI` fills only empty fields; per-field `handleApplyFieldAI`; "Continue Without AI" (`ai-continue-manual-button`) in the analyzing overlay; "Retry AI" (`ai-retry-button`) on error; 7s blocking timeout (`AI_ANALYSIS_BLOCKING_TIMEOUT_MS=7000`).
- **Needed to unblock:** a dev fixture that sets `uploadedPhotoUrls` (mirrors `dev-add-test-photo` but triggers the analyze path) or a dev-mocked AI result.

### AUTH-TC-J03 · Required field validation — PASS
- **Trace:** empty form (1 photo, no title/category/condition/price) → tapped Submit (pinned footer) → **no-op, no "Missing Fields" alert** (behavioral proof of `disabled={!canPublish()}`); button verified `#5DBB8E`-green only after form valid. Then set category (Books) + dev-fill-item, changed title to 2-char `ab` → tapped Submit → CDP console showed `[createListing] min_listing_price check` (createListing ran) and DB shows **no item created** (title-length throw precedes insert). Error copy source-confirmed: `createListing` throws `Title must be between 3 and 100 characters` (listing.ts:239); screen catch renders via `Alert.alert('Error', …)`.
- **Note:** the on-screen error alert was not captured in a screenshot (alert either displayed-and-was-dismissed by the subsequent tap or rendered outside the capture window); the validation *path* is CDP+DB-proven. `J03-submit-disabled-noop.png`, `J03-title-length-check*.png`.
- **UX:** disabled button renders gray (`#C8C8C8`) per source; copy is plain.

### AUTH-TC-J04 · Condition / Age Group / Gender / Color options — PASS
- **Trace:** scrolled form; OCR captured all 5 conditions with descriptions (New "Brand new with tags" … Worn "Heavy wear, still usable"), all 5 age pills (0-2…13+ years), all 4 gender pills (Boy/Girl/Unisex/Any), full 12-color palette (Red, Blue, Green, Yellow, Pink, Purple, Black, White, Gray, Brown, Orange, Multicolor; "0/3 selected"). Tree confirmed `condition-*` (5), `age-group-*` (5), `gender-*` (4) AX-exposed. `J04-condition-visible.png`, `J04-color-mid-row.png`, `J04-age-gender-payment-visible.png`.
- **Locator gap:** ColorPicker swatches (`color-<id>`, `accessibilityRole="checkbox"`) do **not** surface in the iOS AX tree on RN 0.81 — same class as the documented `tab`/`adjustable` role failures. Recommend switching to `accessibilityRole="button"` + `accessibilityState`.
- **UX:** pills use documented `#E8F5F0` selected / `#F0F0F0` unselected; labels plain and age-appropriate.

### AUTH-TC-J05 · "Other" category requires a custom name — BLOCKED (toolset)
- **Why:** selecting "Other" requires the native fullScreen `CategorySelectModal` (documented undrivable; §5.31 list). `dev-set-category` deliberately picks a non-Other category. No fixture for Other.
- **Source corroboration:** when `category.id === 'other'`, the form renders `custom-category-name-input` with helper text "This custom category will be sent to admin for review."; `canPublish()` additionally requires `requestedCategoryName` non-empty for Other.

### AUTH-TC-J06 · Payment preference — subscriber Accept SP toggle — PASS
- **Trace:** as test-seller, scrolled to Payment Preference → "Accept Swap Points?" + hint "Allow buyers to pay with Swap Points" + `sp-toggle` (Switch, value 0) → toggled → tree shows value **1** + **"✓ SP Eligible"** badge appears. `J06-sp-toggle-on-eligible-badge.png`.
- **UX:** badge uses SP gold `#F59E0B` coin icon per source; toggle track `#5DBB8E` when on ✓.

### AUTH-TC-J07 · Payment preference — free user upgrade prompt — PASS
- **Trace:** as test-free (fresh ItemCreate + photo), Payment Preference shows "🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!" + `sp-upgrade-button` (Upgrade Now); **no Accept SP toggle** in tree. Tapped Upgrade Now → navigated to **Kids Club+** screen (title "Kids Club+", "Get more out of every trade", "Join on the web" → passitup.com). `J07-payment-pref.png`, `J07-upgrade-navigated-kidsclub.png`.
- **Doc nuance:** guide says "opens Subscription Choice"; app navigates to `JoinKidsClub` (the route `SubscriptionChoice` maps to `JoinKidsClubScreen` per AppNavigator L562) — matches intent.

### AUTH-TC-J08 · SP earnings preview (subscriber) — PASS
- **Trace:** with Books category + price 20, SP preview shows "Swap Points Estimate / **You'll earn: ~26 SP** / 1.30x multiplier for this category / *Estimated based on list price. Actual SP may vary." `J08-sp-preview-26SP-books.png`.
- **Assert:** subscriber sees preview reflecting category + price ✓ (26 = round(20 × 1.30)).

### AUTH-TC-J09 · Submit for Review → pending + success modal — PASS
- **Trace:** valid form (title "QA Dev Fixture Item", Books, new, price 10, SP on) → tapped Submit → success modal "Thanks for submitting!" with review explanation + `submit-review-go-my-items` / `submit-review-go-dashboard` → tapped Go To My Items → My Listings shows the new item with SP Eligible badge. **DB:** item `033baae0-e1e8-4f2d-83d4-4c752da45ed9` created `status='pending'`, price 10.00, Books, `accepts_swap_points=true`, seller sub `trial`. **Public feed:** `new_item_in_feed = 0` (1216 available; pending item excluded). `J09-success-modal.png`, `J09-my-listings-pending-item.png`.
- **Note:** the transient "Submitting Item For Review..." overlay (source-confirmed `Modal visible={isPublishing}`) was not captured on-screen (submit→success ~2-3s); success modal + DB state are the hard evidence.

### AUTH-TC-J11 · Draft auto-save + resume — BLOCKED (fixture gap)
- **Why:** draft auto-save (`useItemDraft`) only creates a draft when `combinedPhotoUrls = [...restoredPhotoUrls, ...uploadedPhotoUrls]` is non-empty — the dev-fixture path never sets uploaded URLs. **Empirical:** after all test-seller form work (J01–J09), `item_drafts` for test-seller = **0** rows (DB-proven). No resume banner can be triggered without a seeded/uploaded draft.
- **Needed to unblock:** a dev fixture that sets `uploadedPhotoUrls` (draft creation) or a dev-seeded `item_drafts` row for test-seller.

### AUTH-TC-J12 · Listing photos — type/size validation — BLOCKED (toolset) + doc drift
- **Why:** real files (valid/oversized/unsupported) require the native image picker (undrivable); `dev-add-test-photo` injects a fixed bundled PNG.
- **Source findings:** `photoService.validatePhoto` rejects unsupported MIME (JPEG/PNG/WebP/HEIC only) with "Only JPEG, PNG, WebP, and HEIC images are supported"; **size cap is `MAX_FILE_SIZE_MB = 10` → "Image must be smaller than 10MB"**; min dimension 400×400. **Doc drift: guide's "5MB" ≠ code's 10MB.**

### AUTH-TC-J13 · Listing photos — remove, reorder, replace, persist — BLOCKED (partial)
- **Remove leg — PASS:** added 2 photos (3 total) → tapped third photo's ✕ → tree shows only 2 `remove-photo-*` buttons + count updated **(3/10) → (2/10)** immediately. `J13-after-3-photos.png`, `J13-after-remove-2of10.png`.
- **Reorder — spec gap:** `PhotoUploadManager` destructures `onReorder` as `_onReorder` and renders **no** reorder/drag affordance (source-confirmed). Guide's reorder expectation is not satisfiable in the current UI.
- **Replace — spec gap:** no replace control exists (only add/remove).
- **Persist after resume — gated:** draft persistence requires real uploads (see J11).

### AUTH-TC-J14 · Bonus category badge in picker + preview — PASS
- **Trace:** `dev-set-category` → Books (bonus category: `sp_earning_multiplier=1.30`, real `bonus_badge_icon_url`). SP preview shows "1.30x multiplier for this category" — the chosen bonus category remains identified in the SP preview area. Picker badge leg source-corroborated: `CategorySelectModal` renders `BonusBadge` (`bonus-badge-<id>`) only when multiplier > 1.1; non-bonus categories (1.10) show none.
- **Note:** the on-form/preview has no dedicated "bonus" badge (only the multiplier line); if a distinct on-form badge is desired, that's an enhancement, not a defect.

### AUTH-TC-J15 · Category-specific SP earn and buyer-cap preview recalculates — FAIL (spec gap)
- **Passing legs:** price-change recalculation verified on-device — Books @ $20 → "~26 SP"; changed price to $10 → **"~13 SP"** (1.30 × 10). `J15-price-10-13sp-recalc.png`. Bonus uplift vs standard is math+source-proven (Books 1.30 → 26 SP vs standard 1.10 → 22 SP at $20; `calculateEarnedSP = round(price×multiplier)`).
- **Failing assertion:** "The form shows both the seller earn preview **and the buyer max-SP preview** for the selected category." — the `SPEarningsPreview` component displays **no buyer max-SP / spending-cap line** (source-confirmed; `sp_spending_cap_percent` exists in DB but is not surfaced on this form). Buyer-cap display is unimplemented → spec-vs-app gap (either implement or update the guide).
- **Category-switch legs** (standard→bonus→standard) not drivable on-device (`CategorySelectModal` undrivable; only one category settable via dev fixture).

---

## Cross-cutting UX findings

- **Wording/copy:** Payment Preference hint, SP preview disclaimer, submit modal copy, and the free-user upgrade prompt are all clear, plain, and parent-appropriate. No rewrites proposed.
- **Design-system compliance:** checked submit CTA (`#5DBB8E` primary, disabled `#C8C8C8`), SP surfaces (gold `#F59E0B` coin/badge), selected pills (`#E8F5F0`/`#5DBB8E`), SP preview card (`#F5F5F5` container, neutral text tiers) — all match `design-system-passitup.md`. Dev-only green fixture buttons are `__DEV__`-gated (not production). No production deviations found on visited screens.
- **Structural:** ItemCreate pinned submit footer keeps the CTA always visible; tab bar correctly hidden on ItemCreate.

---

## Friction vs operating rules

1. **ItemCreate ScrollView scroll blocker (toolset):** mobile-mcp swipes produced ~0 changed px across 5+ variants (various start points/distances) — persistent until an app **terminate + relaunch** cleared the stuck state; scrolling then worked normally. Recorded as tooling friction, not an app defect (matching the Phase 22 class).
2. **Header back button no-op (1 attempt):** tapping `back-button` (40,94) on ItemCreate did not navigate back on a single attempt; pivoted to in-place form reset rather than re-probing (not conclusively a defect).
3. **AX-tree coordinate ambiguity on ItemCreate:** below-fold y-coords are logical, not rendered; used screenshot/OCR + color-histogram verification for below-fold interactions.
4. **Pixel-hunt on disabled-button color:** an early badge-scan returned 0 matches in the expected region; resolved via `qa:inspect-screen --region` color histogram (definitive: button was green when enabled). Screenshots between the two differed (stale frame / scroll position), causing the confusion.

---

## QA Session Handoff

**Test Scope:** AUTH-TC-J01–J09, J11–J15 (Group J — Listing Creation, Single Item; J10 already closed)
**Design-System Compliance:** PASS — no production deviations found on the ItemCreate form, Payment Preference section, SP preview, submit success modal, or Kids Club+ screen vs `design-system-passitup.md` (primary `#5DBB8E`, SP gold `#F59E0B`, `#E8F5F0` selected pills, neutral text tiers all confirmed). Dev-only green fixture buttons are `__DEV__`-gated.
**Perceived Load-Time Verdict:** GOOD — all observed transitions < 3s (Landing→Login ~1s; Login→Home ~1–2s; Home→ItemCreate ~1s; Submit→success ~2–3s; Upgrade Now→Kids Club+ ~1s).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ItemCreate form: wording/layout match design system.
- CONFIRMED — Payment Preference (subscriber + free): hint copy exact; upgrade prompt exact guide copy.
- CONFIRMED — SP Earnings Preview: "You'll earn: ~X SP", multiplier line, disclaimer all clear.
- CONFIRMED — Submit success modal: "Thanks for submitting!" copy + two-CTA layout (primary/secondary) match.
- CONFIRMED — Kids Club+ (JoinKidsClub) screen: membership copy clear for parents.
**Verdict Summary:** 8 PASS / 1 FAIL / 5 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **J15 FAIL (spec gap):** buyer max-SP preview is expected by the guide but not displayed anywhere on the ItemCreate form (`SPEarningsPreview` has no buyer-cap line despite `categories.sp_spending_cap_percent` existing in DB).
2. **J13 spec gap:** photo reorder/replace are not implemented in `PhotoUploadManager` (`onReorder` unused; no replace control) though the guide asserts them.
3. **J12 doc drift:** photo size validation is 10MB in code vs "5MB" in the guide.
4. **J02/J11 fixture gap:** AI analysis and draft auto-save are both gated on real photo uploads; the dev fixtures bypass uploads, so neither path is on-device drivable.
5. **Locator gap (J04):** ColorPicker swatches (`accessibilityRole="checkbox"`) do not surface in the iOS AX tree on RN 0.81 — same class as the documented `tab`/`adjustable` failures.
**App State Left Behind:** test-seller item `033baae0-e1e8-4f2d-83d4-4c752da45ed9` "QA Dev Fixture Item" (price 10, Books, `pending`, `accepts_swap_points=true`) — sits in the admin pending-review queue (usable as a future L01-style approval fixture; will be auto-referenced if re-run). test-seller & test-free both logged out (Landing). 0 item_drafts for test-seller. No other data created.
**Why It Matters:** This run proves the listing-creation happy path works end-to-end (photo-first gating, field validation, subscriber SP features, bonus-category SP math, pending submission not leaking to the public feed) and surfaces three concrete spec/doc gaps (buyer SP cap display, photo reorder/replace, 5MB-vs-10MB) plus a fixture gap blocking the AI/draft paths.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/group-j-listing-creation-single-2026-08-24/screenshots/` (J01–J15 prefixes). Reproduce J15 recalc: ItemCreate → dev photo → dev-set-category (Books) → dev-fill-item → price 20 → ~26 SP → price 10 → ~13 SP. Reproduce J09 pending: submit the valid form, check `items` for status `pending` + absence from `status='available'` feed. Reproduce J06/J07: subscriber vs free Payment Preference sections.
**Known Gaps / Not Tested:** J02, J05, J11, J12, and J13's reorder/replace/persist legs are not on-device exercisable with current fixtures (native picker/modal + upload-gated features). The J03 error-alert on-screen rendering was not captured (validation path CDP+DB-proven instead). J10 not run (already closed). Android/Admin out of scope.
**What Needs To Be Fixed Next:**
1. **Fix (J15):** decide buyer max-SP preview — either display the buyer spending-cap on `SPEarningsPreview` (data exists: `sp_spending_cap_percent`) or update the guide to drop that expectation.
2. **Fix (J13):** implement photo reorder (and replace) affordances in `PhotoUploadManager` to satisfy the guide, or remove those guide expectations.
3. **Fix (J12):** reconcile the 10MB code cap vs 5MB guide text.
4. **Fix (J04):** change ColorPicker swatch `accessibilityRole="checkbox"` → `"button"` (+ state) so they surface on iOS AX for instrumentation.
5. **Fix (J02/J11):** add a `__DEV__` fixture that sets `uploadedPhotoUrls` (or seeds a draft) to unblock AI-analysis and draft-auto-save testing on-device.
**UX Enhancement Ideas (optional, not defects):**
- On the ItemCreate SP preview, the "1.30x multiplier" line identifies a bonus category but there is no explicit "Bonus" badge on the form — consider surfacing a small "Bonus category" tag next to the multiplier so the bonus status is unmistakable to a selling parent.
- The free-user Payment Preference upgrade prompt is clear but there is no secondary "learn why SP matters" affordance directly on the form (SP preview tooltip exists) — consider linking the upgrade prompt to the SP info tooltip to reduce uncertainty before tapping Upgrade Now.
**Suggested Next Session:** Group K (Bulk Listing) — same listing-creation family and fixtures, and it exercises the `dev-add-test-photos`/`dev-skip-to-review` path; or Group P (composer → New Item) which reuses the ItemCreate flow pre-filled from the composer.
**Suggested to Improve Agent Rules:** When the ItemCreate-style ScrollView shows ~0-changed-px swipes across multiple variants (a known scroll-blocker class), treat a terminate+relaunch as a first-class unblock step (cheap, ~15-20s, clears stuck gesture state) before pivoting to tree-only verification — it restored scrolling on the first try this run.
