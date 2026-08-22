# Phase 27 — Group K Closure Check — Independent AX Re-Verification

**Date:** 2026-08-20 · **Agent:** QA Test Agent (independent verification)
**Run dir:** `e2e-test-results/phase27-groupk-ax-reverify-2026-08-20/`
**Device:** iPhone 17 Pro Max sim (iOS 26.1), Debug build + Metro (`http://localhost:8081`), bundle `com.sameralzubaidi.p2pmarketplace`.
**Commit under test:** `b5641e80` (P1 phone-OTP `gen_salt` search_path migration · P2 `bulk-step-*` AX role→button fix · P3 dev/real verify sets `phone_verified`) — at HEAD `f9d4c469` (which adds only test artifacts on top), working tree clean.
**Purpose:** independent confirmation required to close Group K — the `bulk-step-*` AX item has failed independent verification **twice** (Phase 25 QA: not surfacing; Phase 26 QA: still not surfacing with `accessibilityRole="tab"`). This run confirms the `b5641e80` role→button fix via the **accessibility tree** (per the prompt: not dev's report, not screenshot/OCR for Item 1), plus a no-regression spot-check of the other three previously-closed fixes.
**Reference guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group K, AUTH-TC-K01–K06 context).

---

## Verdict roll-up

| Item | Focus | Verdict |
|---|---|---|
| **Item 1 (critical)** | `bulk-step-photos/group/review/publish` surface in the **AX tree** at Photos step (all present, current step indicated) and after advancing to Group (current step updates, accessibility state reflects change) | **✅ PASS** |
| **Item 2a** | Phone gate — no regression (`b5641e80` P1/P3) | **✅ PASS** |
| **Item 2b** | K02 reorder arrows — no regression | **✅ PASS** |
| **Item 2c** | Apply-to-All collapse — no regression | **✅ PASS** |

**Roll-up:** **4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.** Per the prompt's constraint, since Item 1 passes independently: **"Group K is now fully closed."**

---

## Item 1 (critical) — `bulk-step-*` AX-tree surfacing — **PASS**

Verified **exclusively via the accessibility tree** (`mobile_list_elements_on_screen`) — no screenshot/OCR used for this item's assertions, per the prompt.

### Photos step (entry, after deep link `p2pkidsmarketplace://bulk-create` as test-seller)

AX tree contained ALL FOUR step elements, each with the correct accessibility label (current step carries the `, current` suffix, per `BulkStepIndicator.tsx` `accessibilityLabel` construction):

| Identifier | AX label | Coordinates |
|---|---|---|
| `bulk-step-photos` | **"Step 1: Photos, current"** | (8,139, 60×45) |
| `bulk-step-group` | "Step 2: Group" | (129,139) |
| `bulk-step-review` | "Step 3: Review" | (250,139) |
| `bulk-step-publish` | "Step 4: Publish" | (372,139) |

- All four present; current step correctly indicated on Photos. **Source of the 2×-failed item is FIXED on-device** (`accessibilityRole="button"` + `accessibilityState` now registers; `role="tab"` was the blocker per locator-conventions §AX role warning).

### Group step (after tapping `dev-add-test-photos` → auto-grouping → 5/30 photos)

AX tree re-listed immediately after the transition:

| Identifier | AX label (after advance) | Δ from Photos step |
|---|---|---|
| `bulk-step-photos` | "Step 1: Photos" | current suffix **removed** |
| `bulk-step-group` | **"Step 2: Group, current"** | current step **moved here** |
| `bulk-step-review` | "Step 3: Review" | unchanged |
| `bulk-step-publish` | "Step 4: Publish" | unchanged |

- Current step correctly updated Photos → Group; accessibility state/label reflects the change. **This is exactly the assertion that failed twice before — now passes independently.**

### Bonus — Review step (third data point, during Item 2c)

After `dev-skip-to-review`, AX tree showed **"Step 3: Review, current"** — the current step advanced correctly Photos → Group → Review in the tree. The step indicator AX behavior is now confirmed across all three reachable steps (Publish is fixture-unreachable per the guide caveat).

### Second-persona confirmation

The identical Photos→Group→Review AX progression was re-confirmed while logged in as the **standing unverified seller** (the Item 2a phone-gate actor): all four `bulk-step-*` elements surfaced with the correct current-step labels at every stage.

**Evidence:** `screenshots/ITEM1-photos-step-ax.png`, `ITEM1-group-step-ax.png`; AX-tree dumps captured in trace.

---

## Item 2 — no-regression spot-checks (all previously closed in Phase 26)

### 2a. Bulk phone gate — **PASS**

- **Actor:** standing unverified seller `qa.alice.17871478847129759@kidsmarketplace.test` (user `b645cd23-…`), DB-confirmed `phone_verified=false, phone_verified_at=null` at start (read-only SQL).
- **Flow:** deep link → `dev-add-test-photos` (5 items) → `dev-set-item-categories` → `dev-skip-to-review` → **excluded items 2–5** via the (now-tappable) `bulk-item-exclude-toggle-*` switches → "Submit 1 Item for Review" → filled Item 1 (Title "Blue Lego Set", Category Books via fixture, Condition **New** via chip, Price 25) → missing-list cleared → **Submit button turned green (`#16A34A`) = enabled** (pixel-probed) → tap → **Confirm Submission sheet** ("Items to submit for review: 1", "$25 • Ready", items 2–5 "Excluded from submission") → tap **Submit for Review** (green `#5DBB8E` pill at right of sheet) →
- **`bulk-phone-verification` modal fires immediately:** title "Verify Your Phone", body "Phone verification is required before you can publish listings or make purchases." (required mode, no dismiss), `bulk-phone-verification-phone-input` + `bulk-phone-verification-send-code` present. **No silent server rejection.**
- **Read-only DB after attempt:** `item_count=0` for the seller — the gate blocked the submit (no silent insert). Seller left **unverified** (`phone_verified=false`) so the standing persona is preserved for future re-checks.
- **Related `b5641e80` deltas confirmed:** P1 migration **live on staging** (`hash_otp_code`/`verify_otp_code` `proconfig=["search_path=public, extensions"]` — the Phase 26 `gen_salt` 500 root cause is fixed); P3 change read from `phoneService.ts` (`verifyPhoneCode` now also writes `phone_verified: true`).
- **Verdict:** PASS — gate intact and firing at the correct point; P1/P3 changes are live and do not regress the gate.

### 2b. K02 reorder arrows — **PASS**

- As test-seller on the Group step: long-press `photo-tile-0-0` → tap `photo-tile-1-0` → "2 selected" → `selection-merge` → Item 1 becomes a 2-photo group (`group-split-0` appeared).
- **Reorder arrows surface in the AX tree** only for the 2-photo group:
  - `photo-tile-0-0-move-right` ("Move this photo later in the item") at (103,248)
  - `photo-tile-0-1-move-left` ("Move this photo earlier in the item") at (139,248)
  - Directional availability correct (first tile has no move-left; last has no move-right). Single-photo groups (items 2–5) show **no** arrows — the `group.photos.length > 1` gate holds.
- **Tap `photo-tile-0-0-move-right`** → pixel-verified the **COVER badge relocated**: bottom-left-strip mean brightness of tile-0 went 0.556→0.948 and tile-1 went 0.948→0.556 (values **exactly swapped** — same badge, moved with the photo). The cover follows the moved photo. **No regression.**

### 2c. Apply-to-All collapse — **PASS**

- On the Review step (test-seller), the bar was **correctly absent** while all fields were blank (no suggestion; 4 items).
- Expanded Item 1 and set **Brand "Nike"** → a suggestion existed → **`apply-to-all-toggle` appeared as a single collapsed row** (label "Apply the same value to all included items", **no** chips — collapsed by default).
- **Tap → expands:** toggle label flips to "Collapse apply to all options", `accessibilityState` reflects expanded, and `apply-to-all-brand` chip appears ("Apply Brand Nike to all included items").
- **Tap again → collapses:** label reverts to "Apply the same value…", chip gone. Round-trip confirmed via AX. **No regression.**

---

## Cross-cutting notes

- **Exclude switches (Phase 26 fix) confirmed on-device:** `bulk-item-exclude-toggle-*` are tappable Switches — excluded 4 items → button label updated 5→1 items. (Phase 25 K05 blocker stays resolved.)
- **CategorySelectModal on the bulk screen is AX-visible AND dismissible** by tapping the already-selected category row (contrast to the Phase 23 ItemCreate fullScreen-modal finding where the tree showed only underlying content and taps were unresponsive). Opened accidentally during chip-locating; dismissed via "Books" row tap. Noted as tooling context, not a defect.
- **Free-user SP summary variant re-confirmed** on the unverified seller's Review step: 🔒 "Upgrade to Kids Club+ to earn these points when items sell" + `upgrade-cta` instead of SP totals (K06 free-tier behavior).
- **Tooling frictions (not app defects):**
  - AX-tree staleness on the bulk Review step persisted (Phase 25/26 recurrence) — screenshots/OCR as source of truth per §5.9.
  - Condition chips are **not AX-exposed** (`condition-*` absent) — located via OCR + pixel fill/text probes.
  - Two minor field-value artifacts from mis-taps while dismissing the keyboard ("Blue Lego Sete", "Nikeg") — toolset interaction noise; the values remained non-blank so the assertions held. Per §5.2 no repair attempted.
  - `view_image` unavailable this session (resource-URI only) → deterministic OCR + ImageMagick fallback used throughout (§5.9).

---

## App State Left Behind

- Both sessions **logged out** via `qa-logout`; app on Landing (clean).
- Standing unverified persona `qa.alice.17871478847129759@kidsmarketplace.test` (user `b645cd23-…`) left **unverified** (`phone_verified=false, phone_verified_at=null`) with **0 items** — fully reusable for any future phone-gate re-check. **Not consumed by this run.**
- No items, drafts, or DB writes created (fixture path; gate blocked the only submit attempt).
- Run-local artifacts: `screenshots/*.png` (see below).

## How to Verify/Reproduce

- **Item 1:** log in → deep link `p2pkidsmarketplace://bulk-create` → `mobile_list_elements_on_screen`: all four `bulk-step-*` present, `bulk-step-photos` = "Step 1: Photos, current" → tap `dev-add-test-photos` → re-list: `bulk-step-group` = "Step 2: Group, current", `bulk-step-photos` = "Step 1: Photos" → `dev-skip-to-review` → `bulk-step-review` = "Step 3: Review, current".
- **Item 2a:** sign up/log in as an unverified seller → bulk → `dev-add-test-photos` → `dev-set-item-categories` → `dev-skip-to-review` → exclude items 2–5 → expand Item 1, fill Title/Condition/Price → Submit (green) → Confirm sheet → Submit for Review → `bulk-phone-verification` modal fires; DB shows 0 items for the seller.
- **Item 2b:** Group step → long-press tile-0 → tap tile-1 → `selection-merge` → reorder arrows surface → tap `move-right` → COVER badge follows (bottom-left-strip mean swaps).
- **Item 2c:** Review step → set Brand on an item → `apply-to-all-toggle` appears collapsed → tap expands (chip appears) → tap collapses.

## Screenshots (evidence)

`e2e-test-results/phase27-groupk-ax-reverify-2026-08-20/screenshots/`
- `ITEM1-photos-step-ax.png`, `ITEM1-group-step-ax.png` — Item 1 AX evidence (Photos + Group).
- `ITEM2-selection-mode-1selected.png`, `ITEM2-reorder-arrows-after-merge.png`, `ITEM2-after-move-right.png` — reorder arrows + COVER-badge relocation.
- `ITEM2-review-step-initial.png`, `ITEM2-item1-expanded.png`, `ITEM2-apply-all-collapsed.png`, `ITEM2-apply-all-collapsed-restored.png`, `ITEM2-before-toggle2.png` — Apply-to-All collapsed→expanded→collapsed.
- `ITEM2b-*` — unverified-seller flow (review, form fill, confirm sheet, **`ITEM2b-phone-gate-modal.png`** = the gate firing).

---

*End of Phase 27 report. Group K is now fully closed.*
