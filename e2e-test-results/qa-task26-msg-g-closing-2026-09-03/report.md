# QA Task 26 — Independent Re-Run: MSG Safety-Review Fix + Spot-Check Dev Task 101

**Run date:** 2026-09-04 (fixtures staged 2026-09-03) · **Folder:** `e2e-test-results/qa-task26-msg-g-closing-2026-09-03/`
**Verdict:** **6/6 MSG G-cases PASS** (G01–G04, G06, G07) + **MSG E04 PASS** + **SUB E03 PASS** + **Item 7 PASS** + **Item 6a PASS (no regression)**.
**This closes Dev Task 101's Item 1 (Safety Review load bug) and the last major unresolved block in MSG's guide.**

---

## 0. Session recon (R29 busy check + state)

- **R29 busy check:** No competing runner procs (`expo run:ios`/`maestro`/`run-suite`/`playwright`), no concurrent agent session markers on the simulator UDID, no fresh `e2e-test-results/` writes from another task. Clear to execute.
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-…`), iOS 26.1. App `com.sameralzubaidi.p2pmarketplace` installed; Metro dev server up on `:8081`.
- **Staging project:** `drntwgporzabmxdqykrp`. Config baselines verified: `moderation_appeal_max_attempts=3`, `moderation_appeal_window_days=14` (both `category=moderation`, active).
- **Fixture state (pre-run, DB-verified on `test-seller@kidsmarketplace.test`):**
  | fixture | id8 | status | role |
  |---|---|---|---|
  | flagged | `ba6345ce` | `flagged` | G01 display (Edit-only) |
  | rejected-fresh | `ccf97ae4` | `rejected` | G02 appeal |
  | rejected-backdated | `e2096de2` | `rejected`, rejected 2026-08-19 (15.6 d old) | G07 window |
  | needs-edits | `afd3384a` | `needs_edits` | G03 resubmit |
  | rejected-appeal3 | `ce322cd9` | `rejected`, appeal_count 3 | G06 max-attempt |
- **Session note:** mid-run the app twice relaunched to the logged-out Landing screen (no crash in `list_crashes`). Deterministic recovery per R-NEW-1: `xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=<name>"` (deep links must go through `simctl openurl` — the mobile-mcp `open_url` tool rejects non-http schemes). After a cold `terminate`, tap the Expo dev-launcher "Pass It Up!" recent entry to reload the bundle. Recorded in `/memories/session/qa-task26-friction.md`.

---

## 1. Batch 1 — MSG G-series closing run (all as test-seller)

> All G-cases deep-link to `p2pkidsmarketplace://listing-safety/<listing_id>`. Screenshots in `screenshots/`; full sequence also captured on `G-series-run.mp4` (prior session leg).

### MSG-TC-G01 — Listing flagged → Safety Review screen — ✅ PASS
- **Fixture:** `ba6345ce` (flagged). Deep link loads Safety Review (NOT "Listing not found") — the DEV-TASK-101 owner-scoped fetch fix is live.
- **On-device:** banner "This listing is currently under safety review.", **FLAGGED** badge, listing preview ($20.00), "Last flagged at 9/3/2026", correct actions (Edit Listing + Back to Listings; no appeal/remove on a pure-flagged listing — source-confirmed `isFlagged` branch).
- **Evidence:** `G01-flagged-safety-review.png`.

### MSG-TC-G02 — Appeal a flagged/rejected listing — ✅ PASS
- **Fixture:** `ccf97ae4` (rejected-fresh). Full appeal validation path driven end-to-end:
  - Empty reason → "Appeal Reason Required".
  - Under-10-char → "Appeal Reason Too Short / Please provide at least 10 characters…" (branded alert).
  - Edit-first requirement honored (server `submitListingAppeal` requires `edited_since_rejection`): edited description → Save → returned → valid 74-char reason → Submit Appeal confirm → **"Appeal Submitted / Your listing is back under review."**
- **DB read-back:** `status: rejected → flagged`, `appeal_reason` stored, `appealed_at` set, `edited_since_rejection: true`. ✅
- **Evidence:** `G02-*.png` set (`G02-short-reason-alert.png`, `G02-submit-appeal-confirm.png`, `G02-appeal-submitted.png`, etc.).

### MSG-TC-G03 — Resubmit a "needs edits" listing — ✅ PASS
- **Fixture:** `afd3384a` (needs-edits). Safety Review shows **NEEDS EDITS** badge + Admin's Edit Request note + **Make Edits Now** button.
- Make Edits Now → **EditListing loads pre-populated** (title/desc/price) → made a genuine edit (dev-fill-item set title "QA Dev Fixture Item") → Save → "Changes Saved" → auto-resubmitted to the moderation queue.
- **DB read-back:** `status: needs_edits → pending`, `appeal_count: 1`, title updated. ✅
- **Evidence:** `G03-*.png` set (`G03-needs-edits-screen.png`, `G03-buttons.png`, `G03-changes-saved.png`, etc.).

### MSG-TC-G04 — Remove a flagged listing — ✅ PASS
- **App-design nuance (recorded):** the **Remove Listing** control only renders on `status='rejected'` listings (source `ListingSafetyReviewScreen.tsx` L225–227, L391 — `{isRejected && …}`). A pure-`flagged` listing (`ba6345ce`) shows only Edit Listing + Back to Listings (verified on-device in G01). So G04's "flagged" guide wording maps to the reject-removable surface.
- **Execution (faithful to the guide's steps):** on rejected `ce322cd9` Safety Review (scrolled state) → **Remove Listing** → confirmation modal ("Are you sure you want to remove this listing?" / Cancel / **Remove**) → confirm → **"Removed / Listing removed successfully."** success modal → Done.
- **DB read-back:** `ce322cd9` → `status: deleted`. ✅
- **Fixture note:** this consumed the G06 fixture `ce322cd9` (removal is terminal). G06's evidence (limit-block) was captured + DB-read before consumption — see G06. Tracked.
- **Evidence:** `G04-remove-target-buttons.png`, `G04-remove-confirm-modal.png`, `G04-remove-success.png`.

### MSG-TC-G06 — Appeal max-attempt limit follows admin config — ✅ PASS
- **Fixture:** `ce322cd9` (rejected, appeal_count 3). Safety Review shows "Appeals submitted: 3".
- Typed a valid reason → Appeal This Decision → Submit Appeal confirm → **error alert "Appeal limit reached. Maximum allowed appeals: 3."** — enforces `moderation_appeal_max_attempts=3`.
- **DB read-back (pre-G04):** unchanged — still `rejected`, appeal_count 3, no appealed_at. ✅
- **Evidence:** `G06-appeal3-state.png`, `G06-scrolled.png`, `G06-appeal-limit-reached.png`.

### MSG-TC-G07 — Appeal window follows admin config — ✅ PASS
- **Fixture:** `e2096de2` (rejected **8/19/2026**, 15.6 days before run; `moderation_appeal_window_days=14` → window expired).
- Typed 44-char reason → Appeal This Decision → Submit Appeal confirm → **error dialog "Appeal window has expired. Appeals must be submitted within 14 days of rejection."** (matches `listing.ts` `submitListingAppeal` deadline check).
- **DB read-back:** unchanged — still `rejected`, appeal_count 0, no appeal applied. ✅
- **Evidence:** `G07-kb-check.png`, `G07-window-expired-alert.png`.

### Item 2 — Safety Review error-state layout fix — ✅ PASS (verified)
- Bogus listing deep link → genuine "Unable to open safety review / Listing not found" error state now renders **vertically centered** (title y≈478, subtitle + Back centered at x≈219), green max-width Back pill, canonical grays (`#1A1A1A`/`#6B6B6B`).
- Source-verified + on-device-confirmed. **Evidence:** `G01-error-state-layout-item2.png`.

---

## 2. Batch 2 — Spot-checks of other live-verified items

### MSG E04 — Admin ID-badge details page status — ✅ PASS
- Opened `/id-badges/d148ee0f-6471-460c-bd74-14cc9570cb70/details` in the live admin portal (logged in `samer@samer.com`): **Current Status: Approved** (green pill), Reviewed At 9/3/2026 5:25:51 PM, approval note "QA Task 25 E02 - automated review approval".
- **Reloaded once** → still **Approved** (no stale-Pending regression). DEV-TASK-101 admin stale-status fix holds.
- Evidence: browser screenshots (details page pre + post reload).

### SUB E03 — Failed-charge error message under FAILED row — ✅ PASS
- test-buyer → Billing History (via `p2pkidsmarketplace://billing-history` deep link). The FAILED row ($5.99, Sep 3) now renders the caption under the red badge: **"Your payment was declined. Please update your payment method to keep your subscription active."** — matches `billing_history.error_message` (DB: `95d98ab0`, status `failed`). DEV-TASK-101 render fix live.
- **Evidence:** `SUB-E03-failed-reason.png`.

### Item 7 — ID-upload rejected amber inline note — ✅ PASS
- test-seller (ID-badge status `rejected`, reason `unclear_photo`) → `p2pkidsmarketplace://id-verification-upload` → the amber note renders under the upload state: **"Your previous submission wasn't approved — see the reason in your notifications."** (`id-verification-rejected-note`).
- **Token observation (design-system):** the note uses Tailwind amber `#FEF3C7` bg / `#B45309` text — per the DEV-TASK-101 source comment this intentionally "matches the statusPill palette", NOT the canonical warning treatment (`#FFF3E0`/`#FFA726`). Not a PASS-blocking deviation; flagging for design-system consistency awareness.
- **Evidence:** `Item7-rejected-amber-note.png`.

### Item 6a — `screenshot_path` dangling-path DB read-back — ✅ PASS (no regression)
- `SELECT … FROM id_badge_verification_requests`: **0** decided-with-screenshot, **0** pending-with-screenshot, **0** any non-null `screenshot_path` across all 76 rows. Post-decision nulling still intact (unchanged from QA Task 25).

---

## 3. Config / fixture state left behind

- `moderation_appeal_max_attempts=3` and `moderation_appeal_window_days=14` — **untouched** (read-only verification only).
- **Fixtures consumed this run (expected):** `ccf97ae4` (G02 — appealed → now `flagged`, back under review), `afd3384a` (G03 — edited → `pending`, re-queued for moderation), `ce322cd9` (G04 — **removed/deleted**). These are the intended terminal states of their cases.
- **Fixtures intact for re-runs:** `ba6345ce` (flagged), `e2096de2` (rejected-backdated). Both on test-seller.
- **App state left behind:** test-seller logged in on Home (Session unstable during run — see §0; deterministic `qa-login-as` recovery available).
- **Admin portal:** left logged in as the documented staging admin (`samer@samer.com`), on the E04 details page.

---

## 4. QA Session Handoff

**Test Scope:** QA Task 26 — independent re-run of MSG G01–G04/G06/G07 (Batch 1) + spot-checks MSG E04, SUB E03, Item 7, Item 6a (Batch 2), against the DEV-TASK-101 build (`ab704126`, HEAD).
**Design-System Compliance:** PASS on exercised screens. The Item 2 error state now matches the app's centered empty-state treatment (canonical tokens). One token observation flagged: the Item 7 rejected-note amber uses Tailwind `#FEF3C7`/`#B45309` (statusPill palette) vs canonical `#FFF3E0`/`#FFA726` — informational, not a defect.
**Perceived Load-Time Verdict:** GOOD — Safety Review deep-link landings, appeal/remove confirmations, admin details page, and Billing History all rendered within the <3s ideal threshold. (Not a formal profile.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Safety Review status banners + badges per state (FLAGGED/REJECTED/NEEDS EDITS), rejection reason box, appeal input + char counter, appeals-submitted meta.
- CONFIRMED — Remove flow copy ("Are you sure you want to remove this listing?" → "Listing removed successfully.").
- CONFIRMED — Appeal limit/window error copy matches source strings.
- CONFIRMED — Transaction History FAILED caption now rendered (SUB E03).
- CONFIRMED — Admin ID-badge details page shows Approved, holds across reload.
- CONFIRMED — ID-upload rejected amber note (Item 7) renders.
**Verdict Summary:** **8 PASS / 0 FAIL / 0 BLOCKED** (MSG G01, G02, G03, G04, G06, G07, MSG E04, SUB E03) + Item 2 layout fix confirmed + Item 7 confirmed + Item 6a no-regression.
**Critical Findings:** none blocking. Two informational flags (G04 guide wording "flagged" vs remove-available-on-rejected; Item 7 amber token palette).
**App State Left Behind:** §3.
**Why It Matters:** This run **finally closes Dev Task 101's Item 1** (seller Safety Review was unreachable for any non-`available` listing — QA Task 25 HIGH bug) and the **last major unresolved block in MSG's guide** (G01–G04, G06, G07 were all BLOCKED with the owner-scoped fetch fix). All six G-cases now **PASS for real** against the live app + DB, and the sibling DEV-TASK-101 fixes (E04 stale-status, SUB E03 error message, Item 2 layout, Item 7 note, Item 6a screenshot_path nulling) are independently confirmed live.
**How to Verify/Reproduce:** screenshots in this run folder (`screenshots/G*.png`, `SUB-E03-failed-reason.png`, `Item7-rejected-amber-note.png`); DB read-backs quoted in §1/§2. Reproduce any G-case: log in as test-seller → `p2pkidsmarketplace://listing-safety/<fixture-id>` → drive the action. E04: admin portal `/id-badges/d148ee0f-6471-460c-bd74-14cc9570cb70/details`.
**What Needs To Be Fixed Next (out of this run's scope, per the task):**
- **Item 5** (SellerProfile Verified self-view staleness) — **explicitly NOT ready for QA**; Dev Task 102 must run its diagnostic first. Standing as the remaining DEV-TASK-101 item.
- (No new app defects surfaced this run.)
**Suggested to Improve Agent Rules:** nothing new — the existing §5.47/R-NEW-1 (relaunch-first on blind/session-drop state) + §5.53/R51 (deep-link-first) rules covered the session-instability friction. One recurring fact worth retaining: the mobile-mcp `open_url` tool rejects non-http schemes, so QA deep links always route through `xcrun simctl openurl booted` — already reflected in the session memory.
