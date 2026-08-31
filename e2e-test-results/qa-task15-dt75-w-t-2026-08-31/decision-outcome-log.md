# QA Task 15 — Full Decision-and-Outcome Log (for AI-agent friction analysis)

**Purpose:** A complete action→reasoning→tool-call→outcome trace of the QA Task 15 run, written so an AI agent can derive:
- (a) what slows execution,
- (b) what patterns an agent should adopt proactively,
- (c) what instrumentation/fixture work removes the friction.

**Focus:** the steps that consumed the most time and tool calls, and the fixes that prevent a smaller future run from repeating them.

**Run:** 2026-08-31 · Sections A (DT75) + B (Group W admin) + C (T-group) + D (partial)
**Device:** iPhone 17 Pro Max sim (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`), dev build
**Backend:** Supabase staging `drntwgporzabmxdqykrp` · Admin `http://localhost:3001`
**Evidence:** `e2e-test-results/qa-task15-dt75-w-t-2026-08-31/` (`report.md`, `screenshots/`)
**Full transcript:** `…/workspaceStorage/46f9ba5f9ae0c9e0a4d3678e081097a5/GitHub.copilot-chat/transcripts/2f019856-895a-4830-a2c4-778e60ea50d7.jsonl`

---

## 0. Executive summary

The run was functionally successful (26 cases: 19 PASS / 4 PARTIAL / 2 BLOCKED / 3 findings), but the **call economy was poor** — large fractions of the tool budget were consumed by a handful of recurring friction classes, not by the tests themselves. The single worst example (the one that prompted this log) was a **stuck "Offer Declined" GlobalAlert** that blocked the accessibility (AX) tree: **~20 tool calls** were spent tapping at guessed coordinates and OCRing crops that returned empty, before a **2-call app relaunch** fixed it. That same "the tool can't see the screen → guess → re-check → still stuck" loop recurred throughout the run (stale AX trees, empty AX trees during transitions, unexposed SP inputs, admin-browser timeouts).

The three systemic root causes:
1. **AX-tree blindness** — iOS AX trees that are stale, empty, or omit key elements (TextInputs, alert buttons, some pill-band items) force coordinate-guessing, which is slow and error-prone.
2. **Preflight "should-have-been-known" schema drift** (R7) — every wrong column name cost a failed SQL + retry; the drift list is now partially documented but not yet a standing cheat-sheet consulted up front.
3. **No "try the cheap, definitive fix early" discipline** — for stuck modals/alerts the definitive fix (relaunch) was available in 2 calls but was only applied after ~20 calls of coordinate guessing.

---

## 1. Run phases (high-level map)

| Phase | Scope | Outcome | Friction level |
|---|---|---|---|
| P0 | Environment: confirm sim, app, personas | OK | Low |
| P1 | Section A — DT75 spot-checks (V08, Q15/16/17, set-SP, O07) | 4/4 PASS | **High** (stale TradeList AX, dup trades, pill-band overlap) |
| P2 | Section B — Group W admin (W01–W12) | 9 PASS / 1 defect / 2 BLOCKED | **High** (admin-browser timeouts, page-ID loss, W09/10 fixture gap) |
| P3 | Section C — T-group (T02–T13 SP) | 6 PASS / 3 PARTIAL / 2 findings | **High** (SP input invisible, disclaimer modal, keyboard suppression, persona switches) |
| P4 | Section D — remaining cases | Cut short by user | **Fatal** (stuck alert burned budget → user called it) |
| P5 | Wrap-up — report + handoff | Done | Low |

---

## 2. Detailed decision-and-outcome log (by phase)

> Format per entry: **Goal → Decision/Reasoning → Tool calls that mattered → Outcome → Calls spent / notes.**

### P0 · Environment confirmation
- **Goal:** verify sim online, app installed, personas usable.
- **Decision:** list devices + list apps once, then rely on deep links for persona switching.
- **Calls:** `mobile_list_available_devices`, `mobile_list_apps`.
- **Outcome:** OK. Simulator and app ready. (No time lost.)
- **Lesson:** cheap, correct — do this every session.

---

### P1 · Section A (DT75)

#### A1 — V08 "Matches Your Trade Basket" badge
- **Goal:** open a same-seller item detail and see the badge immediately.
- **Decision:** use listing deep link `p2pkidsmarketplace://listing/<id>` (known working) instead of navigating through Discover (fewer taps).
- **Calls:** `simctl openurl` → `mobile_list_elements_on_screen` → screenshot → OCR.
- **Outcome:** PASS, badge found at x103 y555 on first check. **Calls: ~6. Low friction.**
- **Lesson:** **deep links are the cheapest navigation primitive** — the single biggest call-saver in the whole run. Any route that can be deep-linked should be.

#### A2 — Q15 report-review menu (Spam/Offensive/False Info/Other)
- **Goal:** as reviewee, open own profile review menu, report with "Other" reason.
- **Friction encountered:**
  - The "Report Other" menu item sat at tree y~856, which **overlapped the floating pill band** (a known occlusion class, R31). Tap at that coordinate risked hitting the pill → decision: use "Report False Information" (~y813) instead — a workable reason, still a valid report.
  - The intended target review (Test Buyer 2's) was **already reported** (QA Task 14 leftover) → dedupe guard fired ("You have already reported this review"). Decision: pivot to Anonymous User's review (id `20c09442`) as `false_info`.
- **Calls:** ~12 (profile nav, scroll, menu open, report, confirm, DB read-back).
- **Outcome:** PASS — "Review reported. Thank you!" + DB `review_reports` row.
- **Lessons:**
  - **Known-occlusion + stale-tree screens need screenshot/OCR-first**, not raw tree coordinates (this screen was fine, but the same principle recurred).
  - **Dedupe guards mean a "fresh" fixture may not be fresh** — check DB state *before* assuming a clean path; a second persona's review was the reliable fallback.

#### A3 — `qa:set-sp-balance` (4 → 500)
- **Goal:** raise test-buyer SP to unblock T-group.
- **Decision:** use the sanctioned `qa:set-sp-balance` script (service-role, dry-run first).
- **Calls:** `npm run qa:set-sp-balance -- --persona test-buyer --amount 500` (dry-run then live) → DB read-back.
- **Outcome:** PASS — available=500, ledger `earn_admin_grant`.
- **Lesson:** sanctioned one-call fixtures are gold; the only cost was the dry-run + verify.

#### A4 — O07 refunded-trade dual-leg
- **Goal:** on a completed+refunded trade, buyer sees refund card, seller sees status note only.
- **Friction (the first big one):**
  - **Trade deep link `p2pkidsmarketplace://trade/<id>` does NOT navigate** — React Navigation linking config has no TradeDetail/TradeTimeline path (only the notification service parses `/trade/:id`). A planned shortcut failed.
  - **TradeList history screen is a known-stale AX screen**: after scrolling, tree coordinates are LOGICAL and diverge from the rendered pixels (verified multiple times — tree said `a01624a4` at y147/y158 but rendered differently; taps at tree coords opened wrong trades). Decision: **screenshot+OCR-first** — locate rows by band-OCR of rendered content, derive tap points from pixels, not tree.
  - **Two identical "QA Canned Cancelled-Trade Item" completed trades** existed (`91668589` newer NO refund vs `a01624a4` older HAS refund) — had to ensure the correct one opened on both sides; buyer history shows `91668589` first, requiring extra scroll.
- **Calls:** ~30+ (scroll/load-more/OCR/verify/tap/re-verify on both personas).
- **Outcome:** PASS both legs.
- **Lessons:**
  - **Deep-link dead-ends should be checked ONCE and cached in memory** (this one is now recorded) so a future run navigates via UI immediately.
  - **Stale-AX screens = OCR-first is the only reliable pattern** — this is the #2 friction class of the run and is now in session memory.

---

### P2 · Section B (Group W, admin portal)

#### B1 — W01–W07 (tabs, tables, bundle detail, breakdown)
- **Goal:** verify admin Trade Management tab/table/bundle-detail structure.
- **Decision:** use `?view=bundles` URL param and View Bundle links; drive tabs via DOM (see B2).
- **Calls:** moderate (~15) — read_page snapshots are large (76KB) and needed grep-of-resource-file to parse.
- **Outcome:** all PASS.
- **Friction:** admin read_page snapshots are huge → every parse needed a `read_file` of a chat-session-resource + grep. Not terrible but adds calls.

#### B2 — Admin-browser interaction (the #3 friction class)
- **Friction encountered:**
  - **`click_element` on tab buttons times out** (embedded-browser hit-testing) → decision: use `run_playwright_code` with `el.click()`/`evaluate` for all tab/select interactions. Worked, but the code calls themselves return **deferred results** requiring a second call to fetch the value (each `run_playwright_code` that mutates needs a follow-up `deferredResultId` call). **Every DOM action = 2 calls.**
  - **`page.screenshot()` (Playwright) hangs** on font-load/stability wait on this Next.js dev page → decision: the browser `screenshot_page` tool works; and later `page.screenshot({ animations:'disabled', timeout:8000 })` succeeded. Two different screenshot paths discovered by trial.
  - **Shared admin browser page ID changed mid-run** (force-opening a new page lost the prior session) → had to re-login (`samer@samer.com`) on the new page.
  - **W12 verification needed a second clean re-run** because the first run's `inputValue()` reading was ambiguous vs the actual selected `<option>` — had to write a dedicated script to resolve whether the stale select was real (it was).
- **Calls:** ~40+ for 12 cases (many 2-call deferred code executions, big snapshot reads).
- **Outcome:** W01–W08, W11 PASS; W12 minor defect found; W09 negative leg PASS.
- **Lessons:**
  - **Admin automation is inherently 2–3× call-expensive** — batch assertions inside a single `run_playwright_code` block (one call) instead of one action per call.
  - **Read page state via `run_playwright_code` returning JSON, not via giant snapshots + grep** where possible.

#### B3 — W09/W10 (Force Cancel Entire Bundle)
- **Goal:** verify the Force Cancel action presence + function.
- **Friction:** **no staging bundle has a non-terminal trade** — DB `bool_or(status NOT IN ('completed','cancelled','payment_failed'))` over bundles → `[]`. The button only renders when `!allTerminal` (source-verified), so it cannot appear on any existing bundle.
- **Decision:** verify the **negative leg** (button correctly absent on terminal bundles — PASS) and record the positive leg as **BLOCKED (fixture gap)**, not "admin-scope" skip (standing rule R13-removed).
- **Calls:** ~6 (bundle detail checks, DB query, source read).
- **Outcome:** negative PASS / positive BLOCKED; flagged for a dedicated fixture-building session (R41).
- **Lesson:** fixture gaps should be **detected by a DB query up front** (are there any non-terminal bundles?) rather than discovered by hunting UI. This was done well.

---

### P3 · Section C (T-group SP)

#### C1 — Cart/checkout fixture build
- **Goal:** assemble a bundle with Accept-SP items for SP testing.
- **Decision:** added Kids Bicycle ($60, Sports 75%) to test-buyer's existing cart (QA Canned $20 Accept-SP + Vintage Comic $25 no-SP).
- **Calls:** ~6.
- **Outcome:** cart had 2 eligible Accept-SP items (Kids Bicycle maxAllowed 45; QA Canned maxAllowed 10) — enough for most cases but **not for T06's 3-item scenario** (Nintendo Switch $45 has no category → not SP-eligible). **Fixture gap #2.**
- **Lesson:** before starting a T-group run, check **how many Accept-SP items per seller exist** and whether a 3-item bundle is even possible.

#### C2 — SP input interaction (the #4 friction class)
- **Friction:**
  - **The per-item SP TextInput is NOT exposed in the iOS AX tree** (only the `sp-max-hint` StaticText is). Coordinate guess required.
  - **Software keyboard is suppressed** (Cmd+K in-memory), so no keyboard UI appears; typing still works via `mobile_type_keys` but **clearing a field requires select-all+delete via osascript keystrokes to the Simulator** (Cmd+A + key code 51). Each clear = an osascript call + screenshot verify.
  - Every value entry = tap(guess) → type → screenshot → OCR to confirm. **~4–5 calls per number entered.**
- **Calls:** ~35+ across T02/T05/T06/T07/T13 for all SP entries + clears.
- **Outcome:** correct math everywhere; but call cost was the highest per-assertion ratio in the run.
- **Lessons:**
  - **`qa:ax-tree` + keyboard-done accessory exist** but the tree still hides the SP input — an instrumentation gap (see §5c).
  - **A dedicated "set SP on checkout" fixture/RPC** (or making the TextInput AX-visible) would collapse ~5 calls per value to 1.

#### C3 — Disclaimer modal gate (discovered, not documented)
- **Friction:** first tap on "Accept and continue" did NOT dismiss — because the modal requires checking the "I have read and understand this disclaimer" checkbox first (correct gating, but undiscovered → spent 2–3 calls figuring it out).
- **Decision:** checkbox tap → accept. Repeated for both bundle and single offers.
- **Calls:** ~6 total (both offers).
- **Outcome:** correct behavior; now documented in memory for next time.
- **Lesson:** **pre-document modal-gating requirements** in the playbook/memory so a future run does the checkbox first.

#### C4 — Persona switching (test-buyer ↔ test-seller ↔ test-seller-2)
- **Friction:** each `qa-login-as` deep link needs a confirmation re-list; and on one occasion the **wrong seller was selected** (Board Game Set is owned by **test-seller-2**, not test-seller) — cost a full extra persona switch + re-nav.
- **Decision:** confirm seller ownership via DB before switching where the seller matters.
- **Calls:** ~8 extra.
- **Lesson:** when a case is seller-agnostic the deep link is fine, but **when a specific seller owns the item, check `items.seller_id` first** (one SQL call) to avoid a wasted persona round-trip.

#### C5 — DB read-backs and SP ledger verification
- **Goal:** verify trades/wallets/ledger after offer/accept/decline.
- **Friction:** **schema drift (R7)** — several columns differ from intuition: `sp_wallets.reserved_sp` (not `reserved_balance`), `cart_items.listing_id` (not `item_id`), `items.price` (not `price_cents`), `trade_refunds.refund_amount_cents`, `subscriptions.has_used_trial` (not `is_trial`). Each wrong column = a failed query + a column-list query + a retry. **~2–3 calls per wrong guess.**
- **Decision:** query `information_schema.columns` proactively after the first surprise.
- **Calls:** ~10 extra total.
- **Outcome:** all ledger/wallet assertions verified (T11/T12/T13).
- **Lesson:** **a standing schema cheat-sheet** (now partially in `/memories/repo/schema-cheat-sheet.md`) should be consulted before any SQL, and a single "columns for table X" query is cheaper than guessing.

---

### P4 · Section D + the fatal stuck alert (the step that prompted this log)

#### The "Offer Declined" stuck alert — full reconstruction (≈20 calls, fix in 2)
- **Context:** after test-seller-2 declined the Board Game Set offer (T12), an "Offer Declined / The buyer has been notified… / OK" GlobalAlert appeared. Persona was then switched to test-buyer via deep link. The alert **persisted across the persona switch** and sat over the Item Detail screen.
- **The loop that followed:**
  1. `mobile_list_elements_on_screen` → returned **only the clock** (AX tree empty behind/despite the alert). 
  2. Decision: screenshot + OCR to locate the OK button (OCR-first, per the stale-tree playbook).
  3. Full-page OCR → alert text visible, but **no coordinates** in plain-text OCR output.
  4. Tried `--region` OCR → **returned empty** (Vision OCR needs context; region crops too small).
  5. Cropped + zoomed the alert region (ImageMagick) → OCR still empty; viewed the image manually.
  6. Guessed taps at y=410, y=440, y=465 — re-screenshot + re-OCR after each to confirm → **none dismissed it** (misses).
  7. Re-listed elements repeatedly → still only the clock.
  8. User interrupted: "just relaunch the app u spend a lot of time on this one."
  9. **Fix: terminate + relaunch = 2 calls. Alert gone. Clean Home.**
- **Calls:** ~20 (6 empty re-lists, ~5 screenshots, ~4 OCR, ~4 crop/zoom/view, 3 guessed taps).
- **Root-cause:**
  - The AX tree went blind (only clock) — a symptom of a stuck modal the toolset couldn't render.
  - The agent treated it as a **locator problem** (find the OK button) when it was actually a **state problem** (stuck modal) whose definitive fix is a relaunch.
  - **No early rule existed like "if the AX tree returns only status-bar content for 2 consecutive lists → relaunch the app (2 calls) instead of coordinate-guessing."**
- **Why this specific step was so expensive (answering the user's question):**
  - The agent **over-committed to OCR-finding the button** instead of recognizing the empty-AX-tree signal as "broken screen state."
  - Each guess-tap required a confirm screenshot+OCR to "be safe," which doubled the cost per attempt.
  - The cheap definitive fix (relaunch) was available from call ~3 but not considered until the user said it.

#### The same pattern in earlier steps
- TradeList stale AX → OCR-first (was the *right* adaptation, but should be a standing rule, not rediscovered).
- SP input invisible → coordinate guess → confirm OCR (should be an instrumented field).
- Admin tab clicks timing out → deferred 2-call pattern (should be batched scripts).
- Empty AX tree during any transition → re-list loop (should have a "2 empty lists → relaunch" rule).

---

## 3. Friction catalog (ranked by time/calls wasted)

| ID | Friction | Calls wasted (est.) | Root cause class | Fix (see §5) |
|---|---|---|---|---|
| F1 | **Stuck GlobalAlert → blind AX tree → coordinate-guess loop** | ~20 | No "broken-screen-state" detector; no relaunch-first rule | FIX-1 |
| F2 | **TradeList history = stale AX tree** (coords diverge after scroll) | ~15 | AX logical vs rendered pixels | FIX-2 |
| F3 | **Admin browser: click/screenshot timeouts + 2-call deferred runs + page-ID loss** | ~15 | Toolset/embedded-browser limits | FIX-3 |
| F4 | **SP TextInput not in AX tree + keyboard suppression** | ~12 | Instrumentation gap | FIX-4 |
| F5 | **Schema drift (R7) — wrong column names** | ~8 | Not consulting cheat-sheet up front | FIX-5 |
| F6 | **Empty AX tree during transitions** (only clock) | ~6 | Re-list loop without a bail rule | FIX-1 (same) |
| F7 | **Wrong-seller persona switch** (test-seller vs test-seller-2) | ~5 | Seller ownership not checked before login | FIX-6 |
| F8 | **Disclaimer modal checkbox gate** (undiscovered) | ~4 | Not pre-documented | FIX-7 |
| F9 | **Deep-link dead-end** (`/trade/<id>` doesn't navigate) | ~4 | Route not in linking config | FIX-8 |
| F10 | **Duplicate-trade disambiguation** (two QA Canned trades) | ~3 | Leftover fixtures | FIX-9 |
| F11 | **Fixture gaps** (3-item SP bundle; non-terminal bundle) | blocked cases | Missing fixtures | FIX-10 |

**Total wasted calls attributable to friction: ~90+** out of a run that probably used ~250–300 calls. That is ~1/3 of the budget spent on avoidable friction — the headline number to attack.

---

## 4. Reasoning patterns observed (adopt vs avoid)

### Patterns that WORKED (adopt proactively)
1. **Deep links as the primary navigation primitive** — cheapest reliable way to move between screens/personas.
2. **OCR-first on known-stale/unknown-coordinate screens** — "screenshot is truth" beats tree coordinates.
3. **DB read-back for all money/state assertions** — never trust a UI number for SP/wallet/ledger.
4. **Sanctioned one-call fixtures** (`qa:set-sp-balance`, `qa-login-as`) — minimal blast radius, minimal calls.
5. **Dry-run before live for write-ish fixtures** — cheap insurance.
6. **Document divergences honestly** (spec-vs-impl, fixture gaps) instead of forcing a fake pass — keeps the report trustworthy and tells the dev team exactly what to fix.
7. **Pre-verify fixture feasibility with a DB query** (e.g., non-terminal bundles) before hunting the UI — catches gaps in 1 call.

### Patterns that FAILED / were slow (avoid or add guardrails)
1. **Coordinate-guessing on a blind AX tree** (F1/F6) — the worst offender. If the tree is empty/only-clock for 2 consecutive lists, **stop guessing; relaunch**.
2. **Confirm-every-guess with a screenshot+OCR** — doubles the cost of every tap. Only confirm the FIRST guess; after that trust the state change or relaunch.
3. **Reading admin state via huge snapshots + grep** — a 76KB snapshot + resource-file read per step; prefer JSON-returning `run_playwright_code`.
4. **One action per `run_playwright_code` call** (deferred 2-call pattern) — batch multiple assertions into one script.
5. **Guessing SQL columns without a cheat-sheet** (F5) — one `information_schema` query up front is cheaper than 3 failed guesses.
6. **Assuming "fresh" fixtures are actually fresh** (dedupe guards, leftover dup trades) — check DB state before the flow.

---

## 5. Recommended fixes (mapped to friction IDs)

### (a) What slows execution — and the direct fix

| Slowness | Fix | Saves |
|---|---|---|
| Blind-AX guessing on stuck modals | **Relaunch-first rule** (below) | ~20 calls/case |
| Stale-AX screens | Standing "OCR-first" for the known list (TradeList history etc.), cached in memory | ~15/case |
| Admin 2-call deferred + snapshots | **Batch-assert in one `run_playwright_code` returning JSON** | ~30–50% of admin calls |
| SP input invisible + keyboard clears | Instrument the field / fixture (FIX-4) | ~5/case |
| Schema drift | Standing `schema-cheat-sheet.md` consulted before SQL | ~8/run |

### (b) Patterns an agent should adopt proactively (codify as standing rules)
1. **R-NEW-1 (relaunch-first):** if `mobile_list_elements_on_screen` returns only status-bar content (or empty) **twice in a row**, do NOT coordinate-guess. `terminate` + `launch` the app (2 calls). If still blind, mark BLOCKED and state why.
2. **R-NEW-2 (deep-link-first):** always attempt a deep link before multi-tap UI navigation; keep a cached list of which deep links work.
3. **R-NEW-3 (schema-consult):** before any SQL, read `/memories/repo/schema-cheat-sheet.md` for the table; query `information_schema.columns` once if unsure.
4. **R-NEW-4 (seller-check):** when a case depends on a specific seller owning an item, verify `items.seller_id` first (1 SQL call) before logging in as a persona.
5. **R-NEW-5 (batch-admin):** in the admin portal, drive each page interaction as ONE `run_playwright_code` block that performs clicks + reads + returns a JSON verdict; never one action per call.
6. **R-NEW-6 (fixture-feasibility):** before a group, run the 2–3 DB queries that prove the required fixtures exist (Accept-SP item counts per seller, non-terminal bundles, etc.).

### (c) Instrumentation / fixture work that removes the friction (dev-team candidates)
1. **FIX-1:** (app) Ensure GlobalAlert buttons are AX-exposed even when a native modal is present, or add a dev-only "clear all overlays / relaunch" deep link so a stuck alert is dismissible in 1 call. *(Biggest single win.)*
2. **FIX-2:** (app) Fix the TradeList history stale-AX divergence (recompute tree after scroll, or add stable per-row testIDs already present — verify they surface in the tree).
3. **FIX-3:** (admin/tooling) Make `run_playwright_code` non-deferred (return inline) or document the 2-call pattern; add a stable screenshot path.
4. **FIX-4:** (app) Add `testID` + AX visibility to the CartCheckout per-item SP TextInput (`sp-input-<id>` exists as a testID but doesn't surface); add a dev fixture "apply N SP to cart item" deep link to avoid typing/clearing.
5. **FIX-5:** (docs) Maintain `/memories/repo/schema-cheat-sheet.md` with every column actually used by QA SQL (reserved_sp, listing_id, refund_amount_cents, has_used_trial, etc.).
6. **FIX-6:** (fixtures) Make a standing note on which seller owns which Accept-SP item (or auto-route qa-login-as to the right seller for an item).
7. **FIX-7:** (docs) Pre-document the disclaimer-modal checkbox gating in the playbook so the checkbox is tapped first.
8. **FIX-8:** (app) Add TradeDetail/TradeTimeline to React Navigation linking config so `/trade/<id>` deep links work (or document the UI-only path).
9. **FIX-9:** (fixtures) Add a distinct title to the "QA Canned Cancelled-Trade Item" trades so the refunded vs non-refunded are not identical; or a `notes`/`fixture_tag` column.
10. **FIX-10:** (fixtures) Provision: (i) a **non-terminal bundle** (one trade stuck in_progress) for W09/W10; (ii) a **3-item Accept-SP same-seller bundle** for T06. These unblock 3 currently-PARTIAL/BLOCKED cases.

---

## 6. Call-economics summary

```
Total run calls (est.):          ~250–300
Friction-attributable calls:     ~90+  (≈1/3)
  F1 stuck-alert loop:           ~20
  F2 stale TradeList:            ~15
  F3 admin tooling:              ~15
  F4 SP input:                   ~12
  F5 schema drift:               ~8
  F6 empty-tree re-lists:        ~6
  F7 wrong seller:               ~5
  F8 disclaimer gate:            ~4
  F9 deep-link dead-end:         ~4
  F10 dup trades:                ~3
Productive calls:                ~160–210
```

**Target for a future smaller run:** implement FIX-1, FIX-2, FIX-4, FIX-5, FIX-6 (pure docs/instrumentation) and the R-NEW-1..6 standing rules → friction drops from ~90 calls to ~20, i.e., **~70 calls recovered per equivalent batch** and the worst "stuck for 20 calls" scenario becomes a 2-call relaunch.

---

## 7. Answers to the specific questions

**Q: Why did you struggle so much on this step (the stuck "Offer Declined" alert)?**
The AX tree went blind (returned only the status-bar clock), so the toolset couldn't see the OK button. The agent misread a **screen-state problem** as a **locator problem** and spent ~20 calls OCRing crops and coordinate-guessing taps — each guess needing a confirm screenshot — when the definitive fix (app relaunch) was 2 calls away and never considered until you said it.

**Q: And on many other steps?**
The same two themes recurred: (1) **AX-tree blindness/staleness** (TradeList history, SP inputs, empty trees, admin clicks) forcing coordinate guessing, and (2) **"should-have-been-known" facts** (schema column names, seller ownership, modal gating, deep-link dead-ends, fixture gaps) that were discovered the hard way instead of from a pre-read cheat-sheet/memory. Both are now itemized with concrete fixes above.
