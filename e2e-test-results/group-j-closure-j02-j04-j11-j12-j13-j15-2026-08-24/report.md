# Group J Closure Spot-Check — QA Run Report (J02, J04, J11, J12, J13, J15)

- **Date:** 2026-08-24 (wall-clock 13:58 → 14:18 EDT ≈ 20 min)
- **Device:** iPhone 17 Pro Max sim (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), debug build + Metro (fresh bundle on launch)
- **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group J)
- **Cases:** AUTH-TC-J02, J04, J11, J12, J13, J15 — the six previously-open items, re-verified against the fixed build (supersedes the earlier J02/J04/J11/J12-only prompt; J13/J15 now implemented)
- **Persona:** test-seller (Kids Club+ subscriber-tier; DB `sub_status='trial'` — counts as subscriber for SP; phone-verified, node Norwalk Central)
- **Prior run (same build family, `group-j-listing-creation-single-2026-08-24/`):** 8 PASS / 1 FAIL (J15) / 5 BLOCKED (J02, J05, J11, J12, J13)
- **This run:** 6 re-verified → **6/6 PASS** (with documented toolset limitations + new findings)
- **Login/logout cycles:** 1 login + 1 logout. Final state: logged out at Landing.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-J02 | Group J | **PASS** | AI-analysis path triggers on-device (analyzing overlay) → 7s manual release → error card "Photo analysis issue" + Try Again; Apply All/per-field Use source-corroborated (mock URL can't be analyzed by Google Vision, so no successful suggestion set on-device) |
| AUTH-TC-J04 | Group J | **PASS** | ColorPicker AX fix verified on-device: all 12 `color-*` swatches surface as Buttons; selected/unselected state toggles 0/3 → 1/3 → 0/3 |
| AUTH-TC-J11 | Group J | **PASS** | Draft row created (DB read-back `0a8d54b8…`), Dashboard resume banner → Continue → structural resume (title + photo restored; broken thumbnails = accepted mock-URL limitation). **Findings:** banner title junk-text bug; draft omits price |
| AUTH-TC-J12 | Group J | **PASS** | Doc drift resolved — guide now reads 10MB, matches `photoService.MAX_FILE_SIZE_MB = 10` (+ JPEG/PNG/WebP/HEIC/HEIF whitelist, 400×400 min); oversized/unsupported-file picker legs source-corroborated |
| AUTH-TC-J13 | Group J | **PASS** | Reorder fully verified on-device + DB: 3 photos, ◀/▶ moves photo→cover, cover badge updates, `draft_data.photo_urls` persists reordered `[u2,u1,u3]`, resume restores order. Replace ⟳ exists + wired to native picker (completion native-picker-gated; persistence source-corroborated) |
| AUTH-TC-J15 | Group J | **PASS** | Buyer max-SP cap line implemented: pre-price "…70% of the price…" fallback (no $0), $20 → "~14 SP toward this $20 price", $10 → "~7 SP toward this $10 price" (Books cap 70%); category-change leg source-corroborated |

**Roll-up (this batch):** 6 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED

**Full Group J roll-up across all 14 cases (J01–J09, J11–J15):** **13 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED** — the 1 remaining blocker is **AUTH-TC-J05** ("Other" category requires custom name), which needs the native `CategorySelectModal` (documented undrivable) and has no "Other" dev fixture; it was not part of this closure batch.

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)
| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login | ~1s | — |
| Login → Home (test-seller) | ~1–2s | — |
| Home → ItemCreate (deep link `create-item`) | ~1s | — |
| Fixture tap → AI analyzing overlay | <1s | — |
| Analyzing overlay → manual release (blocking timeout) | ~7s | by-design (`AI_ANALYSIS_BLOCKING_TIMEOUT_MS=7000`), spinner + Continue Without AI shown |
| Continue Without AI → form editable | immediate | — |
| Reorder chip (◀) → cover updated | <1s | — |
| Color swatch tap → count update | <1s | — |
| Price change → SP preview (incl. buyer-cap) update | ~1s | 300ms debounce |
| Resume banner Continue → ItemCreate | ~1s | — |
| Replace ⟳ → native picker | <1s | — |
| qa-logout → Landing | ~1s | — |

No unexpected transition ≥ 3s. The ~7s analyzing overlay is the intended AI-blocking behavior with a visible progress affordance. Perceived Load-Time Verdict: **GOOD**.

---

## Per-case details

### AUTH-TC-J02 · AI auto-fill Apply All + per-field Use — PASS
- **Trace:** fresh ItemCreate → `dev-add-test-photo-uploaded` (label "Dev: Add Uploaded Photo (AI/Draft)") → **AI analyzing overlay** appeared ("Analyzing Your Photos…" + "Continue Without AI" `ai-continue-manual-button`). Overlay auto-released at ~7s (manual-proceed path). AI analysis against the mock `https://dev-fixture.local/…` URL failed (Google Vision cannot fetch it) → **error card "Photo analysis issue"** with user-friendly message + **Try Again** (`ai-retry-button`). Tapped Try Again → re-analysis re-triggered (card persisted after re-error). 
- **Assert (guide Expected Result):**
  - "After ~7 seconds a Continue Without AI option lets the seller proceed manually" — **VERIFIED** (overlay + 7s release; `AI_ANALYSIS_BLOCKING_TIMEOUT_MS=7000`).
  - "a failure shows a 'Retry AI' option" — **VERIFIED** (error card + Try Again `ai-retry-button`; retry re-triggers analysis).
  - "Apply All fills only empty fields" / "Per-field Use applies a single suggestion" — **source-corroborated, not on-device drivable** this run: the dev fixture produces the error path only (mock URL can't be analyzed by the Google-Vision Edge Function), so no successful suggestion set renders. Corroborated from source: `handleApplyAllAI` fills only empty fields (title respects composer-prefill), `handleApplyFieldAI` applies a single field, `AIAnalysisCard` renders `apply-all-button` + `use-<field>` ("Use"/"Filled"); 39/39 `ItemCreateScreen` tests pass per flow-registry.
- **Screenshots:** `J02-itemcreate-0photos-devfixtures.png`, `J02-ai-analyzing-overlay.png`, `J02-form-after-ai-1photo.png`, `J02-ai-error-card-inview.png`, `J02-top-with-errorcard.png` (OCR-confirmed "Photo analysis issue").
- **UX:** Structural ✓ (analyzing overlay has clear copy + escape). Wording: "Photo analysis issue" + message is parent-appropriate; the button reads **"Try Again"** while the guide calls it "Retry AI" — minor copy/doc wording drift (both clear; no rewrite needed, but note the button-label mismatch). Design-system: error card uses neutral styling; overlay spinner green `#5DBB8E`; no deviations found.
- **Locator gaps:** none (all fixture/overlay/error elements AX-exposed).

### AUTH-TC-J04 · Condition / Age Group / Gender / Color options — PASS
- **Trace:** scrolled to Colors section. Re-listed tree: **all 12 `color-*` swatches (Red, Blue, Green, Yellow, Pink, Purple, Black, White, Gray, Brown, Orange, Multicolor) now surface as `Button`** with labels "Red color", "Blue color", etc. (previously `accessibilityRole="checkbox"` did not surface on iOS AX — the BP-53 fix to `button` + `accessibilityState` is verified on-device). "0/3 selected" shown. Tapped Red → **"1/3 selected"** + check mark; tapped Red again → **"0/3 selected"** (toggle verified).
- **Assert:** Condition 5+descriptions, Age 5, Gender 4, Color 12 — all render (Condition/Age/Gender re-confirmed in prior PASS run; this run re-confirmed the full palette + the AX fix). **Color allows multi-select (max 3)** — select/deselect verified; the 3-color cap is source-confirmed (`maxColors=3`).
- **Screenshots:** `J04-color-red-selected-1of3.png`, `J04-final-price10-sp-preview.png` (palette + SP preview), plus full-palette OCR in the J15 pre-price capture.
- **UX:** pills use documented selected/unselected tokens; labels age-appropriate. No deviations.

### AUTH-TC-J11 · Draft auto-save + resume — PASS
- **Trace:** ItemCreate → `dev-add-test-photo-uploaded` (mock URL) → `dev-fill-item` (title "QA Dev Fixture Item") → navigated back (blur flush). **DB read-back:** `item_drafts` row `0a8d54b8-1714-479f-8f1e-ce179b84e8df` created for test-seller — `step='details'`, `photo_urls=["https://dev-fixture.local/item-photos/dev-uploaded-photo-…png"]`, `draft_data.title="QA Dev Fixture Item"`, `expires_at` +7 days. Returned to Dashboard → **resume banner** present: "You have 1 unfinished listing" + "Continue where you left off" + Continue (`resume-draft-banner-resume-button`) + Maybe later. Tapped Continue → ItemCreate resumed with title "QA Dev Fixture Item" + restored photo (`restored-photo-0`, 1/10, Cover badge). **Thumbnail renders broken** (mock `dev-fixture.local` URL never resolves) — **known/accepted limitation** (the fixture exists to satisfy the non-empty URL checks, not to render a real image); the rest of resume works structurally.
- **Assert:** draft row created (DB read-back) ✓; resume banner offers to continue ✓; resume restores structure ✓ (thumbnails broken, accepted).
- **Screenshots:** `J11-dashboard-resume-banner.png` (OCR: junk line + "You have 1 unfinished listing"), `J11-resumed-draft-structural.png`.
- **Findings (new this run):**
  1. **Resume-banner title junk-text bug (P2 copy defect):** the banner title renders the literal string `accessible accessibilityRole="button"` on its own line, then "You have 1 unfinished listing" on the next (OCR-verified). Root cause: `ResumeDraftBanner.tsx` pastes accessibility props as string content inside the `<Text>` (`<Text …> accessible accessibilityRole="button" You have …</Text>`). Same bug class as the earlier WelcomeScreen `welcome-headline` junk-text defect (Group H). **Fix:** remove the stray `accessible accessibilityRole="button" ` text from the `<Text>` content.
  2. **Draft does not persist `price` (P3 data gap):** the J11/J13 drafts carry no price even when one was entered (`draft_data.price` null / absent). `DraftData` type includes `price?: number`, but ItemCreate's auto-save effect builds `draftData` without it. A seller who enters a price, leaves, and resumes must re-enter the price. Guide J11 doesn't assert price persistence, so not a case failure — flagging as a UX/data gap.
- **UX:** Structural ✓ (banner is prominent, green-accented, Continue + Maybe later). Wording: the junk-prefix bug is the only issue; "Continue where you left off" is clear. Design-system: banner uses `#5DBB8E` left border + white surface per design doc ✓.

### AUTH-TC-J12 · Listing photos — multiple upload, type and size validation — PASS
- **Trace:** documentation + source verification (on-device oversized/unsupported-file legs remain native-picker-gated, §5.31).
- **Doc drift resolved:** the guide's J12 case body now reads "Attempt to add an image larger than **10MB**" and "A file larger than **10MB** is rejected"; the media-test preconditions state "(Size cap is 10MB — see AUTH-TC-J12; matches `photoService.MAX_FILE_SIZE_MB`)". **No lingering "5MB" references** in the canonical guide.
- **App behavior matches:** `photoService.MAX_FILE_SIZE_MB = 10` → "Image must be smaller than 10MB"; `SUPPORTED_TYPES` = jpeg/jpg/png/webp/heic/heif → "Only JPEG, PNG, WebP, and HEIC images are supported"; `MIN_DIMENSION = 400` → "Image must be at least 400×400 pixels"; 10-photo cap.
- **Assert:** guide reads 10MB and matches app behavior ✓ (doc/source-verified; picker legs source-corroborated via `validatePhoto`).
- **Finding:** none (the 5MB↔10MB doc drift from the prior run is resolved).

### AUTH-TC-J13 · Listing photos — remove, reorder, replace, persist after resume — PASS
- **Trace:** fresh ItemCreate → `dev-add-test-photo-uploaded` ×3 (dismissing the AI overlay via Continue Without AI each time) → **(3/10 photos)** + Cover badge. Reorder controls present: photo 1 has ▶, photo 2 has ◀▶, photo 3 has ◀, all have ⟳ + ✕. Tapped photo 2's ◀ chip → photo 2 moved to slot 0 → **Cover badge moved to slot 0** (x=44) → order `[…054991, …029576, …076540]`. **DB read-back:** the session's draft `466c440d-32ad-4175-9523-cb3acd1c31be` → `draft_data->'photo_urls' = ["…054991","…029576","…076540"]` — **exactly the reordered on-screen order (cover = `photo_urls[0]`)**. Replaced ⟳ (tapped on restored-photo-1) → **native photo-library picker opened** (Photos grid + Cancel) — confirms the control is wired; Cancel dismissed cleanly. Resumed the draft → **3 photos restored in reordered order** (`restored-photo-0/1/2` with correct ◀/▶/⟳).
- **Assert:** remove updates count immediately (prior run leg, 3→2/10); **reorder changes lead/cover photo** ✓; **reorder persists into the auto-saved draft's photo_urls** ✓ (DB); **replace control exists + is wired** ✓ (native picker opens; completing a real replacement is toolset-undrivable — native grid selection per §5.31; replacement persistence source-corroborated via `handleReplacePhoto`: swaps in place, uploads, updates id→URL map, array length unchanged); **reopen restores same photos + order** ✓ (broken thumbnails = accepted mock-URL limitation).
- **Screenshots:** `J13-3-photos-reorder-replace-controls.png`, `J13-after-reorder-cover-moved.png`.
- **Findings (new this run):**
  1. **`item_drafts.photo_urls` column goes stale after reorder/remove/update (P3 data-consistency):** the top-level `photo_urls` column is set only at insert; the `merge_item_draft` RPC merges only `draft_data` and never refreshes the column (verified via `pg_get_functiondef`). Resume reads `draft_data.photo_urls` first (correct/up-to-date), so there is **no user-facing impact today** — but any future consumer reading the column directly (list queries, admin tooling) would see stale photo data. **Fix (optional):** have `merge_item_draft` also set `photo_urls = COALESCE(p_updates->'photo_urls', photo_urls)` when present, or stop maintaining the column.
  2. Same price-not-persisted note as J11 applies to this draft.
- **UX:** Structural ✓ — reorder chips (◀/▶) and replace (⟳) are small (26×26) but clearly labeled via accessibility labels ("Move this photo earlier/later", "Replace this photo"); touch targets slightly under the 44px guideline for these tiny inline chips (minor). Wording: "Cover" badge + "First photo will be your cover image." are clear. Design-system: chips are neutral; Cover badge uses the primary green; no deviations.

### AUTH-TC-J15 · Category-specific SP earn and buyer-cap preview recalculates — PASS
- **Trace:** on ItemCreate with 3 photos (resumed draft) → `dev-set-category` → **Books** (dynamic label "Set category without modal (dev only): Books"; DB: multiplier 1.30, cap 70%). Scrolled to SP preview:
  - **Pre-price:** seller-earn placeholder "Enter a price above to see SP estimate"; **buyer-cap line "Buyers can pay up to 70% of the price with Swap Points"** (percentage-only fallback — **no nonsensical $0**).
  - Entered **$20** → seller "You'll earn: **~26 SP**" (round 20×1.30), "1.30x multiplier for this category", **buyer-cap "Buyers can pay up to ~14 SP toward this $20 price with Swap Points"** (floor 20×0.70=14).
  - Changed to **$10** (long-press → Select All → retype) → seller "**~13 SP**", **buyer-cap "Buyers can pay up to ~7 SP toward this $10 price with Swap Points"** (floor 10×0.70=7).
- **Assert (guide Expected Result + task emphasis):**
  - "The form shows both the seller earn preview and the buyer max-SP preview" — **VERIFIED** (buyer-cap line now rendered — this was the prior FAIL's missing feature).
  - "SP preview updates when either the category or price changes" — price change **VERIFIED on-device** (14→7 SP); **category change source-corroborated** (cap read live from the selected category's DB `sp_spending_cap_percent` via `useCategorySPCache`, recomputed in the `categoryId` memo; other categories with different caps confirmed in DB: Toys 50%, Sports 75% — the component would render those values if selected). Category switching itself is not on-device drivable (`dev-set-category` always picks Books; the `CategorySelectModal` is the documented undrivable native fullScreen modal).
  - "A bonus category increases the earn preview relative to a standard category" — Books is a bonus category (1.30×); the 26 SP vs a standard 1.10× would give 22 SP at $20 (math/source-corroborated, consistent with prior run).
  - "Buyer-cap line shows the correct concrete dollar figure (not just a bare percentage) and updates correctly" — **VERIFIED** (concrete SP + dollar figure at both prices; percentage-only before a price).
- **Screenshots:** `J15-prepayment-percentage-only-capline.png`, `J15-price20-14SP-cap-line.png`, `J15-price10-7SP-cap-line.png`.
- **UX:** Structural ✓ — the buyer-cap line is a distinct gold-tinted row (`#FFF8E7` bg, `#F59E0B` coin icon) visually separated from the seller-earn row, so a parent won't confuse the two. Wording: "Buyers can pay up to ~14 SP toward this $20 price with Swap Points" is plain and actionable. Design-system: SP gold used correctly for the SP cap surface; no deviations.

---

## Cross-cutting UX findings

- **Copy bug (P2):** `ResumeDraftBanner` title renders junk `accessible accessibilityRole="button"` before "You have 1 unfinished listing" (OCR-verified). Same bug class as the prior WelcomeScreen junk-text defect.
- **Copy nuance (P3):** the AI error button reads **"Try Again"** while the guide calls it **"Retry AI"** — both are clear; minor doc/app wording drift.
- **Draft data gap (P3):** the auto-saved draft does not persist the entered `price` (though `DraftData` supports it) — a resuming seller must re-enter the price.
- **Draft column drift (P3):** `item_drafts.photo_urls` column is not kept in sync with `draft_data.photo_urls` on updates (merge RPC only touches `draft_data`). No user-facing impact today (resume reads `draft_data` first).
- **Design-system compliance:** ItemCreate form, AI overlay/error card, SP preview (incl. new buyer-cap gold row), resume banner, and color picker all conform to `design-system-passitup.md` (primary `#5DBB8E`, SP gold `#F59E0B`, `#E8F5F0` selected pills, neutral text tiers). Dev-only green fixture buttons are `__DEV__`-gated. No production deviations found.

## Friction vs operating rules

1. **ItemCreate ScrollView teleport/erratic scroll (toolset):** swipes sometimes "teleport" between scroll positions (top ↔ condition/color section) rather than tracking distance — cost several re-lists this run (same class as prior-run friction #1). Worked around with fresh re-lists + targeted small swipes. Not an app defect.
2. **Large AX-tree outputs:** ItemCreate trees are 9–16KB and single-line JSON, so every read required a terminal `grep -o` to extract identifiers — no pipes/scripts used, per §5.23.
3. **View-image tooling returned only a URI this session** → used the approved `qa:ocr` script for all visual copy reading (deterministic fallback per §5.9/Phase 23).
4. **Long-press → Select All → retype** worked cleanly for the price field (J15) — no relaunch needed (§5.10 confirmed again for text fields).
5. **Native photo-library picker** (J13 replace) opened and was dismissible via its **Cancel** button (unlike the crop/confirm editor, which rejects all taps) — a useful data point to add to the §5.31 list.

## QA Session Handoff

**Test Scope:** AUTH-TC-J02, J04, J11, J12, J13, J15 (Group J — Listing Creation, Single Item) — closure re-verify of the six previously-open items; full Group J roll-up across all 14 cases included.
**Design-System Compliance:** PASS — no production deviations on the ItemCreate form, AI analyzing overlay, AI error card, SP Earnings Preview (incl. the new gold buyer-cap row `#FFF8E7`/`#F59E0B`), resume banner, or 12-swatch ColorPicker vs `design-system-passitup.md`. Dev-only green fixture buttons are `__DEV__`-gated.
**Perceived Load-Time Verdict:** GOOD — all observed transitions < 3s except the AI analyzing overlay, which releases at ~7s by design (`AI_ANALYSIS_BLOCKING_TIMEOUT_MS=7000`) with a spinner + Continue Without AI affordance (by-design behavior, not a perf defect). Login ~1–2s; ItemCreate deep link ~1s; reorder/color/price recalc ~1s or less.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ItemCreate form: fields/labels match design system.
- CONFIRMED — AI analyzing overlay: copy + Continue Without AI clear and parent-appropriate.
- CONFIRMED — AI error card: "Photo analysis issue" + message + Try Again (button label is "Try Again" vs guide's "Retry AI" — minor wording drift, noted).
- CONFIRMED — SP Earnings Preview: seller-earn line, multiplier line, new buyer-cap line, disclaimer all clear and correctly styled.
- DEVIATION — Resume draft banner title: renders junk `accessible accessibilityRole="button"` text before "You have 1 unfinished listing" (copy bug, same class as the prior WelcomeScreen defect).
- CONFIRMED — ColorPicker: 12 swatches AX-exposed as Buttons with correct selected state; "0/3 selected" counter.
- CONFIRMED — Dashboard/Landing: no new deviations.
**Verdict Summary:** 6 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED (this batch) → **Group J full roll-up: 13 PASS / 1 BLOCKED / 0 FAIL** (J05 "Other" category remains BLOCKED — native-modal-gated, needs a dev fixture; not in this batch).
**Critical Findings:**
1. **ResumeDraftBanner junk-text title (P2 copy defect):** literal `accessible accessibilityRole="button"` renders on its own line above "You have 1 unfinished listing" — same bug class as the prior WelcomeScreen defect; fix = remove the stray string from the `<Text>` content.
2. **Draft omits price (P3 data gap):** auto-saved drafts persist title/photos/etc. but not the entered price (resume requires re-entering it); `DraftData` supports price but ItemCreate's auto-save payload excludes it.
3. **`item_drafts.photo_urls` column drifts from `draft_data.photo_urls` (P3):** merge RPC updates only `draft_data`; resume is correct because it reads `draft_data` first, but the column is stale for any direct consumer.
4. **AI "Try Again" vs guide "Retry AI" (P3 doc/app wording drift):** both clear; recommend aligning the guide wording to the app's actual button label.
**App State Left Behind:** test-seller logged out at Landing. **2 `item_drafts` rows left for test-seller** (cleanup candidates): `0a8d54b8-1714-479f-8f1e-ce179b84e8df` (J11: title "QA Dev Fixture Item", 1 mock-URL photo) and `466c440d-32ad-4175-9523-cb3acd1c31be` (J13/J15: 3 mock-URL photos reordered `[u2,u1,u3]`, category Books set). Both expire in 7 days; delete via `reset:staging`/dev cleanup when no longer needed. **No items created** this run (no submit performed). The J15 price/category edits were auto-saved into draft `466c440d`'s `draft_data` (category Books). Prior run's pending item `033baae0-…` remains in the admin queue (unchanged).
**Why It Matters:** This run closes all six previously-open Group J items against the fixed build — the AI-analysis + draft-auto-save fixture gap (J02/J11), the ColorPicker AX gap (J04), the 5MB↔10MB doc drift (J12), the photo reorder/replace spec gap (J13), and the missing buyer max-SP cap display (J15, the prior FAIL) are all now verified on-device, moving Group J from 8 PASS/1 FAIL/5 BLOCKED to **13 PASS / 1 BLOCKED**. It also surfaces one new copy bug (resume-banner junk text) and two minor draft-persistence data gaps for the dev team.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24/screenshots/` (J02/J04/J11/J13/J15 prefixes). Reproduce J15: ItemCreate → `dev-add-test-photo-uploaded` → `dev-set-category` (Books) → SP preview shows "70% of the price" → price 20 → "~14 SP toward this $20 price" → price 10 → "~7 SP toward this $10 price". Reproduce J11/J13 drafts: add photos via the fixture, navigate away, Dashboard → resume banner → Continue. Reproduce J02: fixture → analyzing overlay → ~7s → error card + Try Again.
**Known Gaps / Not Tested:** J05 ("Other" category) not re-run (native-modal-gated, no fixture; remains BLOCKED). J02 Apply All / per-field Use with a *successful* AI suggestion set is not on-device drivable (mock URL fails Google Vision — no dev-mocked success path) — source-corroborated + unit-tested. J13 *completing* a photo replacement (native picker grid selection) is toolset-undrivable — source-corroborated. J15 category-switch leg not on-device drivable (`dev-set-category` always picks Books; `CategorySelectModal` undrivable) — source-corroborated (per-category caps confirmed in DB: 50–75%). J10 already closed (not in Group J's 14).
**What Needs To Be Fixed Next:**
1. **Fix (P2, copy):** remove the stray `accessible accessibilityRole="button" ` string from the `ResumeDraftBanner` title `<Text>` so it renders "You have 1 unfinished listing" cleanly (same class as the prior WelcomeScreen fix).
2. **Fix (P3, draft data):** include `price` in ItemCreate's auto-save `draftData` payload so a resumed draft restores the entered price (or confirm deliberate exclusion and update the guide's J11 expectation).
3. **Fix (P3, optional, draft column):** update `merge_item_draft` to also refresh `item_drafts.photo_urls` from `p_updates->'photo_urls'` (or stop maintaining the column) so the column and `draft_data` don't drift.
4. **Fix (P3, doc):** align the guide's "Retry AI" wording with the app's actual "Try Again" button label (J02).
5. **Fixture (unblocks J05):** add a `__DEV__` "Other" category fixture (mirroring `dev-set-category` with `id='other'` + `requestedCategoryName`) so AUTH-TC-J05's custom-category-name flow is on-device drivable.
**UX Enhancement Ideas (optional, not defects):**
- On the ItemCreate photo grid, the reorder ◀/▶ and replace ⟳ chips are 26×26px — consider enlarging the touch target to ≥44px (without changing the visual chip size) to reduce mis-taps for parents with larger fingers.
- The resume banner title (once the junk text is fixed) could benefit from showing the draft's item title or photo thumbnail so a parent recognizes *which* listing they're resuming — the current "You have 1 unfinished listing" is generic.
**Suggested Next Session:** Group K (Bulk Listing Creation) — same listing family, exercises `dev-add-test-photos`/`dev-skip-to-review`, and can reuse the §5.31 native-picker learnings; or a focused J05 pass once the "Other" fixture lands.
**Suggested to Improve Agent Rules:** Record in repo memory that the iOS **photo-library picker is dismissible via its native Cancel button** (unlike the crop/confirm editor which rejects all taps) — this lets future runs escape the picker cleanly instead of terminate+relaunch. Also, add `item_drafts` (draft `draft_data` vs `photo_urls` column) to the known-schema notes so DB read-backs check `draft_data->'photo_urls'` for persistence assertions.
