# Phase 26 — Bulk Listing Four Fixes — Final Verification Report

**Date:** 2026-08-20 · **Agent:** QA Test Agent · **Run dir:** `e2e-test-results/phase26-bulk-four-fixes-verify-2026-08-20/`
**Device:** iPhone 17 Pro Max sim (iOS 26.1), Debug build + Metro (`http://localhost:8081`), bundle `com.sameralzubaidi.p2pmarketplace`.
**Commit under test:** `315df4d0` (phone gate, AX instrumentation, K02 reorder, Review/Group UX polish) — present at HEAD `5bb2ea62`, working tree clean.
**Reference guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group K, AUTH-TC-K01–K06 context).

---

## Verdict roll-up

| Item | Focus | Verdict |
|---|---|---|
| **Item 1 (critical)** | Bulk phone gate on-device (unverified seller → modal on Submit → verify → resumes) | **PASS** (+ 1 backend finding: `send-phone-otp` Edge Function 500 on `gen_salt`) |
| **Item 2 (critical)** | AX-tree surfacing of `photo-tile-*`, `selection-*`, `bulk-item-card-toggle-*`, `bulk-step-*`, `bulk-publish-button` | **PARTIAL FAIL** — 4/5 element groups surface; **`bulk-step-*` does NOT surface** (goes back to dev per prompt constraint) |
| **Item 3** | K02 reorder arrows (2+ photos → arrows → tap changes order → cover follows) | **PASS** |
| **Item 4** | Apply-to-All collapsed row + expand; one-time "How grouping works" tooltip | **PASS** (Apply-to-All) / **PARTIAL** (tooltip: suppression confirmed on-device; first-show not re-exercisable — flag already consumed on this device) |

**Roll-up:** **3 PASS (Item 1, Item 3, Item 4a) · 1 PARTIAL FAIL (Item 2 — `bulk-step-*`) · 1 PARTIAL (Item 4b tooltip first-show)** — no BLOCKED items.

> Group K is **NOT fully closed** this run: the `bulk-step-*` AX gap (Item 2) recurs on-device despite the code fix and must go back to dev. All other closures are confirmed.

---

## Item 1 (critical) — Bulk Phone Gate — **PASS**

**Actor:** fresh unverified seller `qa.alice.17872299229082971@kidsmarketplace.test` (user `8d0bec43-6a5d-4f1b-a1e5-db14c1b33d2f`) created via UI signup (autofill Alice), OTP skipped, relaunch, onboarding skipped → Home. `phone_verified_at` null at start (empirically proven by the gate firing).

**Execution trace (condensed):**
1. Bulk deep link → `dev-add-test-photos` (5 photos → Group) → deleted items 2–5 on Group step (confirm dialog = `GlobalAlertProvider`, instrumentable) → 1 item remained → `dev-set-item-categories` → `dev-skip-to-review`.
2. Filled Item 1 (Title "Blue Lego Set", Category=Books via fixture, Condition=New via chip, Price=25 via numeric input). "Ready" chip, SP estimate ~33 SP (free-user variant). Publish button turned green (enabled; pixel-verified `srgb(93,187,142)`).
3. Tap **Submit 1 Item for Review** → **Confirm Submission sheet** (Items: 1, "Blue Lego Set", "$25 • Ready").
4. Tap **Submit for Review** (green, right side of sheet) → **`bulk-phone-verification` modal appears immediately**:
   - Title "Verify Your Phone"
   - "Phone verification is required before you can publish listings or make purchases." (required mode)
   - `bulk-phone-verification-phone-input`, `bulk-phone-verification-send-code`
   - **No silent server rejection.**
5. Completed verification: entered phone `+12025550123` → Send code → `send-phone-otp` Edge Function returned **HTTP 500** (`Failed to hash OTP: function gen_salt(unknown) does not exist` — read-only log evidence) → app **DEV SMS bypass activated** (`[phoneService] DEV SMS bypass activated due to Edge Function failure.` + "DEV mode: use code 123456") → OTP screen → entered `123456` digit-by-digit → **Verify**.
6. Verification succeeded → `profiles.phone_verified_at` set to **`2026-08-20 13:27:13.995+00`** (read-only DB confirmation; `phone_verification_method='sms'`).
7. Modal `onSuccess` re-invoked `handlePublish()` → **gate passed** (`isPhoneRequired` false) → flow **resumed past the gate** to the next guard → **"Cannot submit for review — Missing bulk session or draft session."** alert (the documented fixture limitation: no bulk session exists on the fixture path, so a real DB submit can't complete). Dismissed.
8. DB: **0 items** created for this seller — no silent insert; server held.

**Verdict:** PASS — the phone-verification modal appears immediately on the publish action (not a silent server rejection), required mode blocks publish, verification completes, and the submission resumes past the gate. The final "Missing bulk session" stop is the fixture-path limitation (documented in the guide), not the gate.

**Backend finding (dev-side, not one of the 4 fixes):** `send-phone-otp` Edge Function `hashOTP()` calls Postgres `gen_salt`/`crypt` but they resolve only in the `extensions` schema (pgcrypto lives there on Supabase) — the function's SQL/connection `search_path` doesn't include `extensions`, so every send returns 500. The app's DEV bypass masked it for this test; real SMS verification is broken until the function qualifies `extensions.gen_salt`/`extensions.crypt` (or sets search_path). Evidence: `mcp_supabase_query_logs` `function_edge_logs` shows `[send-phone-otp] Error: Failed to hash OTP: function gen_salt(unknown) does not exist` + `POST | 500`; read-only SQL confirms `gen_salt`/`crypt` exist only in `extensions`.

**Evidence:** `screenshots/ITEM1-phone-verification-modal.png`, `screenshots/ITEM1-after-verify-resume.png`, `cdp-capture.js` (console capture, run-local), DB snapshots above.

---

## Item 2 (critical) — AX-Tree Surfacing — **PARTIAL FAIL (`bulk-step-*`)**

Confirmed via the **accessibility tree** (no screenshot/OCR fallback for this item) on-device, per the prompt's requirement:

| Element group | Surfaces in AX tree? | On-device evidence |
|---|---|---|
| `photo-tile-<g>-<p>` | ✅ **YES** | Photos/Group step: `photo-tile-0-0` … `photo-tile-4-0` with labels "Tap to set as cover…"/"Deselect this photo" (selection state reflected). Phase 25 gap FIXED. |
| `selection-merge` / `selection-move-to-new` / `selection-delete` / `selection-clear` | ✅ **YES** | Group step after long-press: all 4 buttons surface with identifiers + labels ("Merge selected photos into one item", etc.). Phase 25 gap FIXED. |
| `bulk-item-card-toggle-*` | ✅ **YES** | Review step: `bulk-item-card-toggle-0..4` surface ("Open item N details", `accessibilityState.expanded` reflects state). Bonus: `bulk-item-exclude-toggle-*` now surface as Switch elements and **are tappable** (the Phase 25 K05 blocker is FIXED — exclude toggles toggled 5→1 items this run). |
| `bulk-publish-button` | ✅ **YES** | Review step: `bulk-publish-button` "Submit N Items for Review" surfaces. |
| **`bulk-step-*`** | ❌ **NO** | Step indicator visibly renders ("Photos Group Review Publish" — OCR-verified on every step) but `bulk-step-indicator`/`bulk-step-<id>` NEVER appear in the tree across Photos, Group, and Review steps (multiple fresh listings; final targeted check on a 69-element Review tree: 0 step elements). |

**Per the prompt's constraint — report the exact element and do not work around:** `bulk-step-*` (and its container `bulk-step-indicator`) fail to surface despite the code fix (`accessible` + `accessibilityRole="tab"` + `accessibilityState` added to the step `TouchableOpacity`, `accessibilityRole="tablist"` on the container). The step indicator is rendered OUTSIDE the ScrollView (fixed header under `ScreenLayout`), so it is not a viewport/scroll artifact. Other AX-instrumented elements on the same screen surface fine, so this is specific to the step indicator's composition (candidate root causes for dev: iOS `tab`/`tablist` role mapping, the `React.Fragment`-wrapped `TouchableOpacity`+line children, or Fabric flattening of the disabled step nodes). **This needs to go back to dev.**

**Also surfaced (out of the prompt's list, positive):** `photo-tile-*-delete`, `group-title-*`, `group-add-photos-*`, `group-delete-*`, `bulk-item-exclude-toggle-*`, `bulk-item-title-0`/`price-0`/`brand-0`, `age-group-*`, `gender-*` — all AX-visible this run.

**Evidence:** tree listings throughout the run; `screenshots/group-step-after-add-photos.png`, `screenshots/item3-reorder-arrows-after-merge.png`, `screenshots/review-step-initial.png`.

---

## Item 3 — K02 Reorder Arrows — **PASS**

On the Group step as test-seller:
1. After `dev-add-test-photos` → 5 photos auto-grouped to 5 items (1 photo each) → **no reorder arrows** (correct: group has 1 photo; `group.photos.length > 1` gates them).
2. Long-press `photo-tile-0-0` → tap `photo-tile-1-0` → "2 selected" → `selection-merge` → Item 1 now has **2 photos**; **`group-split-0` appeared** (proof of >1) and **reorder arrows surfaced in the AX tree**:
   - `photo-tile-0-0-move-right` ("Move this photo later in the item") at (91,650)
   - `photo-tile-0-1-move-left` ("Move this photo earlier in the item") at (127,650)
   - Directional availability correct (first tile has no move-left; last tile has no move-right).
3. **Tap `photo-tile-0-0-move-right`** (the cover photo) → pixel-verified the COVER badge (dark pill, exact 142×45px / 5125-px signature) moved from the first tile (px x=105) to the **second tile (px x=393)** — same badge, same pixel count → **the cover followed the moved photo**.
4. **Tap `photo-tile-0-1-move-left`** → COVER badge returned to the first tile (px x=105) — two-direction confirmation.

Verdict: PASS — arrows appear only when a group has 2+ photos, tapping them changes photo order, and the cover badge follows the correct photo (verified by exact bounding-box pixel evidence both directions).

**Evidence:** `screenshots/item3-reorder-arrows-after-merge.png`, `item3-after-cover-move-right.png`, `item3-after-cover-move-left.png` (all three share the identical 5125-px badge signature relocated).

---

## Item 4 — UX Polish — **PASS (Apply-to-All) / PARTIAL (tooltip)**

### 4a. Apply-to-All bar: single collapsed row that expands on tap — **PASS**
On the Review step (test-seller, 4 items), set Age Group 3–5 years on Item 1 → a suggestion existed →
- Bar renders **collapsed by default**: single tappable row `apply-to-all-toggle` ("Apply all" + down-chevron; label "Apply the same value to all included items"). No chips until expanded.
- **Tap → expands**: `apply-to-all-toggle` label flips to "Collapse apply to all options"; `apply-to-all-age_group` chip appears ("Apply Age 3-5 to all included items").
- **Tap again → collapses** (chip gone, label back to "Apply the same value…"). Round-trip confirmed via AX state.

Verdict: PASS — the bar is a single collapsed row that expands on tap and collapses back. (Phase 25's always-expanded chip bar is replaced per Fix 4.)

**Evidence:** `screenshots/item4-apply-all-collapsed.png`, `item4-apply-all-expanded.png`.

### 4b. One-time "How grouping works" tooltip — **PARTIAL (suppression confirmed; first-show not re-exercisable on this device)**
- On first Group-step entry this run, **no tooltip appeared** — correct, because the AsyncStorage flag `@kids_marketplace:bulk_grouping_hint_seen_v1` is already `"1"` on this device (read directly from the simulator app container's AsyncStorage manifest — set by the dev's own verification session, which is why it's consumed).
- Source corroboration: `BulkListingCreateScreen` `useEffect` shows `GroupingHelpTooltip` only when the flag is absent and `groupingHelpResolvedRef` is unset; `GroupingHelpTooltip` (`bulk-grouping-tooltip` + `-dismiss`) is a transparent RN Modal with a "Got it" CTA. So the "appears on first entry" half is corroborated by code + the dev's manual verification, and the "does not reappear" half is confirmed on-device (never appeared across every Group-step entry this run, including the unverified-seller path).
- **Known gap:** to re-observe the first-show on-device the flag must be cleared (a single AsyncStorage write in the simulator's app container — outside the QA agent's default write scope per playbook §5.14). Offered as an optional follow-up; not performed without approval.

Verdict: PARTIAL — one-time suppression verified on-device; first-show requires clearing the device flag (or a fresh app-install context) to re-observe.

---

## Cross-cutting notes

- **AX-tree staleness (Phase 25 recurrence):** the Review step's tree repeatedly returned stale/logical scroll-content coordinates (esp. the nested item-card form), forcing screenshot+OCR re-derivation for every tap and several scroll overshoots. Not an app defect; tooling friction (§9).
- **Nested-form scroll:** the item-card form (`nestedScrollEnabled`) vs. the outer scroll made precise positioning of Title/Condition/Price fields expensive (the documented Phase 25 friction). All three fields were eventually reached and filled (verified by AX value + "Ready" chip + `$25 • new` header).
- **OTP digit-box paste character-drop:** bulk-pasting `123456` into the 6-box OTP dropped a digit; digit-by-digit entry (with per-digit AX verification) worked cleanly — matches the Phase 13.25 recovery rule.
- **Backend finding (new, dev-side):** `send-phone-otp` Edge Function is broken (gen_salt 500) — see Item 1.
- **Locator gap (non-blocking):** `bulk-edit-grouping` text button and the confirm-sheet's Cancel/Submit buttons are not AX-exposed (located by OCR/slice-OCR); condition chips (`condition-new` etc.) not AX-exposed (located by slice-OCR band scan).

---

## App State Left Behind

- Test-seller session **logged out**; unverified-seller session **logged out** via `qa-logout` (app on Landing).
- Throwaway account `qa.alice.17872299229082971@kidsmarketplace.test` (user `8d0bec43-…`) now has `profiles.phone_verified_at` set (13:27:13Z) via the dev-bypass verify — it is **no longer an "unverified" persona**; do not reuse as one.
- No items, drafts, or DB writes created by this run (fixture path only). AsyncStorage grouping-hint flag `@kids_marketplace:bulk_grouping_hint_seen_v1` remains `"1"`.
- Run-local artifacts: `screenshots/*.png`, `cdp-capture.js`.

## How to Verify/Reproduce
- Item 1: sign up a fresh user (skip OTP) → bulk → 1 complete item → Submit → Confirm → phone modal fires before any session/field guard. Backend send fails (gen_salt) → dev bypass shows code 123456 → verify → "Missing bulk session" (fixture). Screenshots as listed.
- Item 2: on the bulk screen, re-list the AX tree at Photos/Group/Review: `photo-tile-*`, `selection-*`, `bulk-item-card-toggle-*`, `bulk-publish-button` present; `bulk-step-*` absent (reproduces every time).
- Item 3: merge two photos → arrows appear; tap an arrow → COVER badge follows the moved photo (compare exact badge bbox pre/post).
- Item 4a: set a field on one item in Review → "Apply all" row appears collapsed; tap to expand chips; tap to collapse.
