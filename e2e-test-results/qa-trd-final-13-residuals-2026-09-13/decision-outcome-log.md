# Decision & Outcome Log — QA Task: TRD's Final 13 Named Residuals

**Run:** `e2e-test-results/qa-trd-final-13-residuals-2026-09-13/`
**Date:** 2026-09-13 · **Platform:** Android emulator `Medium_Phone_API_36.1` · **Admin:** live portal `:3001`
**Outcome:** 10 TRD status flips → **295 PASS / 3 PARTIAL / 0 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓**
**Purpose of this file:** a machine-consumable trace of *what the agent did, why, with which tool calls, and what it cost* — so a future agent can (a) see what slows execution, (b) adopt the right patterns up front, and (c) know which instrumentation/fixture work removes the friction permanently.

> **How to read the cost column:** `calls` = approximate distinct tool invocations for that step (screenshot + OCR + tap each count as 1). Estimates are ±10 %. Where a step was pure waste, it is tagged **WASTE**.

---

## 0. Call-budget summary (the headline numbers)

| Phase | Calls (approx) | % of round | Verdict |
|---|---:|---:|---|
| 0. Recon / Step 0 / preconditions | 45 | 18 % | reasonable |
| **1. AX-dump crash + full recovery** | **52** | **21 %** | **WASTE (avoidable)** |
| 2. S19 | 22 | 9 % | inflated by coordinate misses |
| 3. A3 + FIX-Task-30 verification | 10 | 4 % | efficient |
| 4. O2-C02 | 20 | 8 % | inflated by coordinate misses |
| 5. O3-C01 | 10 | 4 % | efficient |
| 6. O2-C03 (+ admin write/revert) | 14 | 6 % | efficient |
| 7. N03 | 3 | 1 % | efficient |
| 8. O3-C02 | 14 | 6 % | moderate |
| 9. R09 (+O3-C06 layer 2 attempt) | 16 | 6 % | moderate |
| 10. R08 | 4 | 2 % | efficient |
| 11. R07 | 24 | 10 % | inflated by coordinate misses + modal chain |
| 12. B10 | 20 | 8 % | high value, unavoidable |
| 13. Report + tracker + memory | 8 | 3 % | efficient |
| **TOTAL** | **≈252** | 100 % | |

**Avoidable waste (quantified): ≈105 calls (42 % of the round).**

| Waste category | Calls | Root cause |
|---|---:|---|
| Crash + recovery | 52 | mobile-mcp AX-dump path crashes the dev client |
| Coordinate-miss re-derivation | 28 | `view_image` downscales frames by a *variable* factor |
| Schema-guess SQL failures | 18 | column/table names guessed instead of read from the cheat sheet |
| Wrong-API batch aborts + bare-coordinate no-ops | 7 | no pre-validation of batch steps; unfixed tool quirk |
| **Total avoidable** | **105** | |

**Cost per verdict:** 10 TRD verdicts + ~8 verification items ≈ **≈14 calls/verdict** — *worse* than the QA Task 16 baseline (~9.6) and the QA Task 43c baseline (~9.6), **entirely because of the two systematic wastes above**. With the fixes in §5 this round should land at ~7–8 calls/verdict.

---

## 1. Phase-by-phase decision log

### Phase 0 — Recon / Step 0 (45 calls, reasonable)

| # | Action | Reasoning | Tool calls that mattered | Outcome | Calls |
|---|---|---|---|---|---|
| 0.1 | Read `QA-Test-Agent.instructions.md` §4–5.6 + repo memory (`qa-trd-closure-2026-09-13.md`, `fix-task-30-2026-09-13.md`) | Playbook mandates a read before the first run of a session; last round's + FIX-Task-30's durable facts define the starting state | `read_file`, `memory view` ×2 | Knew the 13 residuals, the toast-timing rule, the `view_image` downscale note, and the two FIX-Task-30 unblockers **before** touching the device | 3 |
| 0.2 | **Parse the tracker mechanically** instead of trusting the dispatch list | The dispatch itself said "pull the current rows from the tracker — don't assume this list is complete"; last round proved a reconstructed list can be ~96 % stale | `grep_search` with anchored regex `^\| TRD-TC-… \| 🟡 PARTIAL \|` ×4 (one per status) | Confirmed the real set = **12 PARTIAL + 1 OPEN**; discovered the tracker also carries **mojibake glyphs** (`�` for 🔴/📄) that break string anchors | 6 |
| 0.3 | Read the 12 case bodies from the canonical guide | §4 requires `Setup:`/`Locator hints:`/`Assert:` before executing | `grep_search` for headers → `read_file` ×7 | Had exact assertions (e.g. O2-C03's expected cents, B10's affordance name) | 8 |
| 0.4 | **Read-only DB preconditions** *before* any device time | §4 Phase-23 rule: this single step predicts most execution surprises | `execute_sql` ×7 | Proved FIX-Task-30 items 1 & 2 (admin credential OK; 3 listings now `node_id`-tagged) **without spending device time**. Also found the live rate is **6.99 %**, not the 6.35 % config default | 7 |
| 0.5 | Activate the gated mobile tool categories | `mobile_list_available_devices` was disabled — the tools are lazy-activated in groups | `activate_*` ×4, `mobile_list_available_devices` | Both devices online | 5 |
| 0.6 | §5.41 R29 busy check (Metro 8081+8082, admin `:3001`, foreground app) | Mandatory before driving | `run_in_terminal` | Environment healthy | 2 |
| 0.7 | **Schema guesses on 6 SQL calls** | ⚠️ **PROCESS VIOLATION**: I did *not* consult `/memories/repo/schema-cheat-sheet.md` first, despite rule **R-NEW-3** requiring exactly that | 6 failed `execute_sql` calls (`items.price_cents`, `cart_items.created_at`, `disputes` table, `user_notifications.trade_id`, `tax_categories.code`, `sp_wallets.available_sp`) | **18 calls burned discovering what the cheat sheet already knew** | 18 |
| 0.8 | Session-start `qa:reset-offer-fixtures` (R16-1) | Mandated hygiene *before* building any cart | terminal | Clean baseline (0 carts, 1 stale offer cancelled) | 1 |

**Decision worth noting (0.4):** reading the DB *before* the device converted "is S19 drivable?" from a 20-call speculative drive into a **2-call certainty**, and it also pre-caught the rate drift that would otherwise have looked like an O2-C03 defect. **This pattern is the highest-leverage in the whole round and should be unconditional.**

---

### Phase 1 — The AX-dump crash and its recovery (**52 calls, 21 % of the round — the single biggest waste**)

**Trigger:** a `mobile_batch_commands` step that clicked an element **by `ref`** while Home was still rendering.

| # | Action | Reasoning | Tool calls that mattered | Outcome | Calls |
|---|---|---|---|---|---|
| 1.1 | Batch `[get_orientation ×2 → click @ref]` on the Home tab | Needed to leave a loading Home; batching felt like a cheap delay generator | `mobile_batch_commands` | Step 3 failed: *"failed to dump UI to resolve ref @e39: no XML content found in uiautomator dump"* | 1 |
| 1.2 | Fell back to a bare-coordinate `mobile_click_on_screen_at_coordinates` | Documented fallback when a ref can't resolve | mobile_click | Tap reported success — **but the app left the foreground** | 1 |
| 1.3 | AX list → found we were on the **launcher** | Diagnostic | `mobile_list_elements_on_screen` | Tapped coordinate had misfired / app gone | 1 |
| 1.4 | `dumpsys window` + `logcat -s ReactNativeJS` | Determine backgrounded vs crashed | terminal ×2 | Launcher focused; **no** JS logs → app was dead | 2 |
| 1.5 | `logcat -b crash` + signature grep | Classify the crash | terminal ×2 | **`SIGSEGV` in `mobilecli.so` → `art::ti::AgentSpec::Attach` → `VMDebug_nativeAttachAgent`** = the documented R87/R107 dev-tooling family, **not app code**. A second fatal (`uiautomator DumpCommand` → `UiAutomationService already registered!`) showed the dump path collided with mobilecli | 2 |
| 1.6 | Force-stop + cold launch (R107 recovery) | Prescribed recovery | terminal | Splash → **Expo Dev Launcher** (cold start always lands there) | 1 |
| 1.7 | Screenshot-poll loop instead of AX-dumping (R107) | R107: never AX-dump in a stalled window | screenshot ×3 + `mobile_batch_commands` orientation-batches ×3 (~N=10–20 each) | Slow but safe; confirmed the dev launcher | 6 |
| 1.8 | AX list of the dev launcher, then **ref-click the Metro row** | Needed a fresh target | AX list + click | **Ref-click failed again** (*"no XML content found"*) | 2 |
| 1.9 | `adb shell input tap` on the OCR-equivalent row centre | Adopted the adb path | terminal | Bundle load started | 1 |
| 1.10 | Orientation-batch polls (~N=40, N=60) + logcat probes ×3 | Waiting for a 28 MB cold bundle | batches ×2, `logcat` ×3 | `Loading from 10.0.2.2:8082…` persisted for minutes | 5 |
| 1.11 | `curl :8082/status` + `curl :8081/status` | Rule out a dead Metro | terminal | Both `packager-status:running` | 1 |
| 1.12 | `curl` the 28 MB Android bundle and time it | Decide: cold-build latency or a real fault | terminal | **HTTP 200, 28,122,267 bytes, 0.84 s** ⇒ server healthy; the delay was device-side download/parse | 1 |
| 1.13 | Orientation-batch polls ×3 more | Patience | batches ×3 | Still loading | 3 |
| 1.14 | Force-stop + **warm** relaunch | Metro now cached | terminal | Back to the dev launcher (cold start always does) | 1 |
| 1.15 | AX list → **ref-click** the *other* Metro row | R107 says pick the other row | AX list + click | **Ref-click failed again** | 2 |
| 1.16 | `adb shell input tap` on the row | adb path | terminal | Load started | 1 |
| 1.17 | Long orientation-batch polls ×5 (~N=60–100) + logcat ×3 | Waiting | batches ×5, logcat ×3 | `loadJSBundleFromMetro` → `startSurface` → **blank white render** | 8 |
| 1.18 | Logcat hunt for a JS error | Diagnose the blank render | `logcat` ×2 | Only a benign `AppearanceModule.colorScheme` `NoSuchFieldException` + `Require cycle` warnings | 2 |
| 1.19 | **Force-stop + relaunch again**, then polls | Second recovery attempt | terminal + batches ×2 | App finally rendered Home with the session intact | 3 |
| 1.20 | **Decision point:** abandon mobile-mcp for input entirely | Two dumps had crashed the client; adb had worked every time | — | **Adopted for the whole rest of the round:** `adb shell input tap` / `input text` / `input swipe` for *all* driving, `qa:ocr --coords` for *all* coordinates | 0 |
| | | | | **Subtotal** | **52** |

**Key insight:** the crash is triggered by the **ref-resolution path** (mobile-mcp must `uiautomator dump` to resolve a `ref`), and it is fatal when issued while the app is mid-load. It was hit **twice** (1.1 and 1.8/1.15) before the agent stopped using refs entirely. **A rule that says "never ref-click a loading screen; no more than ONE ref-click failure before switching to adb" would have capped this at ~12 calls instead of 52.**

---

### Phase 2 — S19 (22 calls)

| # | Action | Reasoning | Calls that mattered | Outcome | Calls |
|---|---|---|---|---|---|
| 2.1 | `qa-login-as?persona=test-buyer` + poll | One-call login | terminal, AX list, screenshot | Home rendered, basket badge absent (matches DB) | 4 |
| 2.2 | Tab tap | Navigate | batch (failed) → `adb shell input tap 352 2242` | Discover | 2 |
| 2.3 | Screenshot + `qa:ocr --coords` before every tap | **Learned from phase 1/4** | screenshot + OCR | Machine-readable coordinates | 2 |
| 2.4 | Search "Board Game Set" (tap field → CTRL+A → `input text` → suggestion → card → Add) | Add item 1 | terminal ×3, screenshot + OCR ×2, DB verify | **"1 result · near CT" with Show All Nodes Off** — FIX-Task-30 item 2 proven in the UI; DB confirmed 1 `cart_item` | 8 |
| 2.5 | Repeat for "Dictionary" | Item 2 | terminal ×2, screenshot, OCR, view | 2 items | 6 |
| 2.6 | Add "Science Kit"; DB read-back | Item 3 | terminal ×1, DB, screenshot | **3 items** — the precondition unreachable since 2026-08-30 | 4 |
| 2.7 | Open Basket → screenshot + **OCR text-diff** vs the 2-item frame | The assertion is an **absence**; an OCR dump is machine-checkable and needs no AX dump | screenshot + OCR | **Banner text absent at 3-of-3, present at 2-of-3** | 2 |

**Note (2.6–2.7):** the mid-flow accidental landing on the Trade Basket at **2 items** turned out to be *valuable* — it produced the positive control. **Lesson: when a case asserts an absence, opportunistically capture the "N−1" state too.**

---

### Phase 3 — A3 + FIX-Task-30 verification (10 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 3.1 | `qa-login-as?persona=test-admin` | FIX-Task-30 item 1 is the gate for A3 | terminal + batch + view | **Login SUCCEEDED** (previously 3/3 INVALID_CREDENTIALS) — avatar "TA" | 3 |
| 3.2 | Deep link `p2pkidsmarketplace://admin` | Cheaper than Profile → admin button (R-NEW-2). Found by grepping the navigator for the route | `grep_search` + terminal | Admin Dashboard rendered | 2 |
| 3.3 | Full-frame **and** region `qa:badge-scan` of the button | A3's assertion is a *colour* fix; a scan is objective | terminal ×2 | **89.60 % brand green / 0.00 % iOS-system-blue** — the carryover closes on-device | 2 |
| 3.4 | FIX-30 items 4, 7 observed incidentally in later screenshots | Zero marginal cost | — | "Removes all 1 item" (singular) ✓; "You still have 458 SP available…" ✓ | 0 |

---

### Phase 4 — O2-C02 (20 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 4.1 | Check the 3 cart listings' `tax_category_id` | Decide whether the *existing* basket already satisfies the mixed-bundle precondition | `execute_sql` ×2 | YES — 2 taxable + 1 exempt. **Avoided a whole fixture build.** | 2 |
| 4.2 | **Tapped the basket CTA at y=1565** — an eyeballed coordinate | Reused the on-screen position | terminal, screenshot, view | **Missed** — landed on a list row, opened Item Detail | 3 |
| 4.3 | Ran `qa:ocr --coords` on the *already-captured* basket frame | Realised the displayed image is downscaled | OCR | **True CTA y = 1887**, not 1565 → **measured 1.19× downscale** | 1 |
| 4.4 | Back to basket, tap CTA at the true coordinate | Fix | terminal ×2 | Checkout | 2 |
| 4.5 | Screenshot + OCR → **assert the Tax Free badge on the exempt line only** | The residual | screenshot + view + OCR | Badge present on Children's Dictionary, absent on both taxable lines | 3 |
| 4.6 | Region `qa:badge-scan` of the badge | Design-system claim needs colour, and R62c warns thin text bands give false zeros — so scan a *region* around the pill, not the text | terminal | 69.88 % pill bg / 8.62 % brand green / **0.00 % blue** | 1 |
| 4.7 | Scroll → Send Offer → **disclaimer modal** → checkbox → Accept | Complete the case (also creates the Pending trade O3-C01 needs) | terminal ×4, OCR ×2, screenshot ×2 | Trade Initiated | 8 |

**Note (4.3):** the OCR call on a frame **already on disk** was the cheapest possible correction — it should have been the *first* call, not the recovery. **The rule "screenshot → OCR → tap, never screenshot → eyeball → tap" would have saved 3 calls here and ~28 across the round.**

---

### Phase 5 — O3-C01 (10 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 5.1 | Trade Initiated → OCR → `View Trade Details` | Reuse the just-created Pending trade rather than build a new one | OCR + terminal | Timeline | 2 |
| 5.2 | Poll (batch) while "Loading trade…" | §5.3 | batch | Timeline rendered | 1 |
| 5.3 | Screenshot → **saw a "Failed to load trade" modal over a fully-rendered timeline** | ⚠️ Investigate before filing | screenshot + view | Source-grepped the string → `TradeTimelineScreen.tsx:614` catch-all; **no console error** in the log | 3 |
| 5.4 | Tap OK → logcat ×1 → re-enter the timeline | R101 discipline: is it reproducible? | terminal + screenshot + view | **Not reproducible** ⇒ recorded as a flake, not a defect | 4 |

**Note (5.3–5.4):** disciplined. A weaker run would have filed a MED defect from a single frame.

---

### Phase 6 — O2-C03 (14 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 6.1 | Find two **same-price** ($28) taxable items from a *different* seller | The case compares two offers; same price isolates the fee effect. A different seller was required because `max_pending_offers_per_seller` was already consumed by the 3-item bundle | `execute_sql` | `18a41ad8` + `c822d42f` identified | 1 |
| 6.2 | **Decision: use `qa:ef-repro` for the offer legs, not the UI** | The assertion is entirely **backend** (tax arithmetic). UI-driving 2 offers ≈ 30 calls (search→detail→offer→disclaimer→send ×2); the harness does it in 2 with the app's exact headers | terminal ×1 | Offer #1 `096fc228` | 1 |
| 6.3 | Read the tax record + snapshot | Ground truth | `execute_sql` ×2 | taxable 2800, tax 196, `include_fee_in_tax_base: false` | 2 |
| 6.4 | Admin portal → **Tax → Settings** → tick the checkbox → Save | Standing rule: admin-dependent actions run **for real** | `open_browser_page` + `read_page` + `click_element` ×2 | New page needed (`forceNew` — the shared page was a background tab, R81) | 5 |
| 6.5 | **Save failed** — Playwright: *"`<aside class="fixed … z-30">` subtree intercepts pointer events"* | Diagnose layout vs tooling | `click_element` (10 s timeout, full retry log) | **Real finding F1**: the fixed sidebar blocks the main content's Save at the default viewport | 2 |
| 6.6 | `run_playwright_code`: widen viewport to 1600 px → click → read the banner | Workaround | 1 call returning a JSON verdict | **"Saved 1 setting: include_fee_in_tax_base."** | 1 |
| 6.7 | Offer #2 via ef-repro + DB diff of both records | The comparison | terminal + `execute_sql` ×2 | **tax 196 → 206 = exactly 149 × 0.0699**; #2's snapshot `true` ⇒ base 2949. #1 unchanged (not retroactive) | 4 |
| 6.8 | **Revert via the same UI** + DB re-verify | §5.37a scope-write-then-revert discipline | `run_playwright_code` + `execute_sql` | `false`, category/data_type **not clobbered** | 2 |

---

### Phase 7 — N03 (3 calls) — the cheapest closure of the round

| # | Action | Reasoning | Calls | Outcome |
|---|---|---|---|---|
| 7.1 | `run_playwright_code`: `goto('/config?tab=fees')` → return the label + description + last-updated in one JSON | The residual was *only* the label; a single structured browser call answers it | 1 | Field reads **"Min Listing Price"** + the guide's exact description ⇒ **the mismatch is gone** |
| 7.2 | Decided **not** to re-drive the 0→5→0 write | It is already on record from 2026-08-30 and was never the residual | — | 3 calls total for a full closure |

**Note:** this is the template for a **cheap closure** — read the residual precisely, then buy exactly the evidence it needs (and nothing more).

---

### Phase 8 — O3-C02 (14 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 8.1 | `qa-login-as?persona=test-seller-2` → Trades tab | The trade needs In Progress; only the seller can accept | terminal + batch + screenshot + terminal | Bundle Offer · 3 items · "All 3 awaiting your review" | 6 |
| 8.2 | OCR → tap **Accept All** → OCR → tap the modal **Accept** | Two-step because R106 forbids batching a modal-opening tap with the modal target | OCR ×2 + terminal ×2 | All 3 trades `in_progress` (DB) | 6 |
| 8.3 | Switch back to test-buyer → **deep link `p2pkidsmarketplace://trade/<id>`** | Deep link beats navigating My Trades (R-NEW-2) | terminal + batch | Timeline opened directly | 2 |
| 8.4 | Scroll ×3 (two swipes were no-ops before a slow 800 ms one worked) | §5.68 R77 #14: long ScrollViews resist fast swipes | terminal ×3 + screenshot ×3 | Payment Details revealed: **"Payment authorized:" $20.00** and **"Estimated Sales Tax (6.99%)" $1.40** — unchanged from Pending ⇒ **PASS** | 6 |

---

### Phase 9 — R09 dispute → admin refund (+ the O3-C06 layer-2 attempt) (16 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 9.1 | OCR the timeline → tap **Report Problem** → OCR → reason + Submit | Drive the dispute for real | OCR ×2 + terminal ×2 + screenshot + DB | **"Dispute in progress · Auto-complete is paused"**; Complete CTA disabled | 7 |
| 9.2 | Admin portal → `/trades/disputes` → discover the status filter is a `<select>` (my first click targeted a hidden `<option>`) | Diagnose | `run_playwright_code` ×2 | `selectOption('reported')` → **"1 dispute"** = my row | 2 |
| 9.3 | Click **Resolve → Refund**; buttons go `[disabled]`; re-read → row left the queue | The write succeeded with no confirm dialog | `click_element` + `run_playwright_code` | Resolved | 2 |
| 9.4 | DB sweep: status, dispute fields, tax, payouts, notifications | Full settlement in one query batch | `execute_sql` ×4 | `cancelled`, `resolved_buyer`, tax **`voided`**, **0 payouts**, `trade_cancelled` to **both** parties | 4 |
| 9.5 | **Attempt O3-C06 layer 2** via `qa:ef-repro --ef resolve-dispute` | Close the EF's `ALREADY_RESOLVED` guard | terminal | **Blocked: "Unknown persona 'test-admin'. Known: test-buyer, test-free, …"** — the harness has **no admin persona** | 1 |
| 9.6 | Fall back: open the resolved dispute's admin detail page and enumerate resolve buttons | Verify the guard's UI surface instead | `run_playwright_code` | **Zero resolve controls** ⇒ layer 2 is UI-verified | 1 |

**Note (9.5):** a **one-line fixture gap** (`test-admin` missing from the harness registry) is the sole reason a named residual could not be driven. Section §5 lists it as a top instrumentation ask.

---

### Phase 10 — R08 (4 calls)

| # | Action | Reasoning | Calls | Outcome |
|---|---|---|---|---|
| 10.1 | `execute_sql`: payouts for the bundle + a `payout_status` distribution for the seller | **R100 discipline: name the writer before filing.** A raw `payout_status='pending'` on a cancelled trade *looks* like an owed payout | 2 | **0 `seller_payouts` rows**; 10 cancelled trades all carry the untouched `pending` default ⇒ **no payout was created** ⇒ **PASS**, plus a documented R100 trap |

---

### Phase 11 — R07 (24 calls)

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 11.1 | Craft an **SP offer via ef-repro** with `--body '{"…","sp_amount":5}'` | R07 needs an SP trade; grep of the EF confirmed `sp_amount` is in the body and is in **SP points**. The EF harness had auto-injected the PM before, so with `--body` the `payment_method_id` had to be included manually | `grep_search` + terminal | `50849c0b`, `sp_amount: 5` | 2 |
| 11.2 | Capture the **pre-state**: wallet + ledger | Needed a baseline to prove reversal | `execute_sql` ×2 (columns guessed wrong twice → see §0) | available 458→453, `reserved_sp` 5, `spend_purchase −5` | 4 |
| 11.3 | Seller login → Trades → find the SP offer among 3 | — | terminal + screenshot | "Kids Kindle Tablet … Includes points redemption" | 2 |
| 11.4 | Review Offer → **tap Accept at an eyeballed y=1507** | — | terminal + screenshot | **Missed** — no change | 2 |
| 11.5 | OCR the frame | **Fix** | OCR | True `Accept Trade` y = **1719**; the frame was ~1.20× downscaled | 1 |
| 11.6 | Tap Accept → **confirm modal appeared** → tapped at an eyeballed coordinate again | R106 forbids batching the modal target | terminal + screenshot | **Missed again** | 2 |
| 11.7 | OCR the modal | **Fix (second time in one phase)** | OCR | True modal `Accept` y = **1365**, x = **743** — the frame was **~0.74× height**, i.e. a *different* downscale from the previous frame | 1 |
| 11.8 | Tap the true coordinate → DB verify | — | terminal + `execute_sql` ×2 | Trade `in_progress`, `sp_reserved_at` set, `sp_transferred_at` NULL | 3 |
| 11.9 | Deep link to the trade → dismiss a leftover "Offer Accepted!" alert | — | terminal ×2 + batch + screenshot + view | Seller view: "Swap Points Used 5 SP", "Your payout is on hold" | 5 |
| 11.10 | Scroll → **Cancel Trade** → OCR → reason + confirm | Two-step modal chain | terminal ×2 + OCR ×2 | `cancelled` | 5 |
| 11.11 | DB verify the reversal | — | `execute_sql` ×2 | **available 453→458, `reserved_sp` 5→0, one `earn_refund +5`**; seller unchanged, **0** seller ledger entries ⇒ **PASS** | 2 |

**Note (11.4–11.7):** **three eyeballed-coordinate misses inside one phase**, each costing ~3 calls, and the downscale factor differed between two frames in the *same* phase (1.20× vs 0.74×). This is the strongest evidence for the OCR-first rule in the whole round.

---

### Phase 12 — B10 (20 calls) — the highest-value closure

| # | Action | Reasoning | Calls | Outcome | Calls |
|---|---|---|---|---|---|
| 12.1 | **Decision: preload the basket with the sanctioned fixture tool** instead of driving search+add again | `qa:create-bundle-fixture` does it in 1 call vs ~12 | terminal | 1-item basket | 1 |
| 12.2 | Login → Basket → OCR → tap the single-item CTA | — | terminal + screenshot + OCR + terminal | Checkout | 5 |
| 12.3 | Scroll → OCR → tap **Add New Card** | The guide's "payment-mode selector" | terminal + screenshot + OCR + terminal | Selector turns green; a **`Replace Card`** button appears | 5 |
| 12.4 | Tap **Replace Card** | The guide's exact affordance | terminal + batch + screenshot | **The native Stripe PaymentSheet opened** — SetupIntent flow (TEST · `Set up` + lock · *no charge*) | 3 |
| 12.5 | OCR → tap **New card** | — | OCR + terminal + batch + screenshot | Full **Add new card** form | 3 |
| 12.6 | OCR → tap the **Card number** field → `input text` | **Adb typing into a native sheet** — the technique that finally unlocked this case | OCR + terminal + screenshot | First digit dropped (`2424…`, Stripe detected Mastercard) | 3 |
| 12.7 | `CTRL+A` + retype | R77 #4 field-clear; **verify the rendered value** | terminal | **4242 4242 4242 4242**, VISA detected, focus auto-advanced to MM/YY | 1 |
| 12.8 | Type expiry + CVC → CVC lost a digit | Stripe auto-advances; `adb input text` can drop a leading char on focus change | terminal + screenshot | `12 / 34` ✓, CVC `23` ✗ | 2 |
| 12.9 | `CTRL+A` + retype CVC → dismiss IME → type ZIP → dismiss IME | — | terminal ×2 + screenshot | CVC **123**, ZIP **06850**, IME gone | 3 |
| 12.10 | Tap **Set up** → screenshot | Submit the SetupIntent | terminal + batch + screenshot | **"Card Added — Your new card has been saved successfully."** | 3 |
| 12.11 | DB verify `subscriptions.stripe_payment_method_id` | Prove attach+persist (the case's real assertion) | `execute_sql` | **`pm_…MXsky`** (new, `updated_at` 00:33:29) ⇒ **PASS** | 1 |

**Note:** this is the case that was labelled "tooling-limited" for **11 days across multiple rounds**. It took **20 calls** once the agent (a) preloaded the basket with a fixture tool, (b) OCR-derived every coordinate, and (c) typed into the native sheet with `adb`. **The blocker was never product-side — it was a missing technique.** That should be captured as a reusable capability note, not a per-round rediscovery.

---

### Phase 13 — Report + tracker + memory (8 calls)

| Action | Reasoning | Calls | Outcome |
|---|---|---:|---|
| `create_file` the closing report | Deliverable | 1 | `report.md` |
| `multi_replace_string_in_file` ×2 for 10 case rows + 3 count locations | Batch edits | 2 | 9/10 rows flipped; **S19 failed because its status glyph is the mojibake `�`, not 🔴** |
| Retry S19 with an anchor that *skips* the glyph | Workaround | 1 | Flipped |
| Verify by re-grepping the PARTIAL set + the count lines | R56 reconciliation | 2 | **295 + 3 + 0 + 13 + 6 + 16 = 333 ✓**; zero TRD rows contain `STILL OPEN` |
| Header-totals sentence | 1 failed attempt (phrase mismatch), 1 success | 2 | Reconciled |
| `memory create` the durable-facts file | Cross-session learning | 1 | Recorded |

---

## 2. (a) What slows execution — ranked, quantified

| Rank | Bottleneck | Calls lost | Why it happens | One-line fix |
|---|---|---:|---|---|
| **1** | **`ref`-based mobile-mcp clicks crash the dev client** | **52** | Resolving a `ref` forces a `uiautomator dump`; issued mid-load it collides with mobilecli's JVMTI attach → `SIGSEGV`. Recovery is expensive (cold launch + 28 MB bundle + dev launcher). | Cap it: **≥1 ref-click failure ⇒ switch permanently to `adb shell input tap`** for the session. Never ref-click a screen that is still loading. |
| **2** | **Every tap costs 3 calls** (screenshot → OCR → tap) because coordinates cannot be eyeballed | **28 wasted + ~60 unavoidable** | `view_image` downscales frames — **by a different factor per frame** (measured 0.74×, 1.19×, 1.20× this round). | Ship a **`qa:tap --text "<label>"`** helper: screenshot + OCR-match + adb tap in **one** call. This is the single biggest instrumentation win available. |
| **3** | **Schema-guess SQL failures** | **18** | Column/table names guessed; **R-NEW-3 says consult `schema-cheat-sheet.md` first** and it was skipped. | Make the cheat-sheet consult *the first action of Phase 0*, and keep it updated with this round's 6 corrections. |
| **4** | **Persona switching** (~6 switches × 4–6 calls) | **~30** | Each switch = deep link → poll → re-navigate; persona state is not observable in one call. | A **`qa:persona --current`** read + a status endpoint would let the agent confirm rather than poll. |
| **5** | **Modal chains discovered mid-flow** (disclaimer, Accept-All confirm, cancel-reason) | **~20** | Each modal costs 2–3 calls (screenshot + OCR + tap) and R106 forbids batching the modal target. | **Pre-read the screen source** for the modal chain during Phase 0 (the guide names the surfaces; the components are greppable). |
| **6** | **Search→add flow** (~8 calls per item) | **~22** | No item deep link exists, so every listing must be found by typing + choosing a suggestion + tapping a card. | **Register `p2pkidsmarketplace://item/<id>`** (see §5). Would have cut S19 roughly in half and helps every search-based case. |
| **7** | **Cold bundle rebuild** after any crash | **~10 + 6–8 min wall-clock** | 28 MB unminified dev bundle over `10.0.2.2`. | **Pre-warm**: `curl` the bundle URL before launching the client; keep the dev client alive. |
| **8** | **Tool-API misuse** (batch aborted by a missing `direction`; bare-coordinate clicks no-op) | **7** | `mobile_swipe_on_screen` requires `direction` and aborts the *remaining batch steps*; bare-coordinate clicks silently no-op. | **Validate batch steps before sending**; prefer `ref` outside loading windows, else `adb`. |
| **9** | **Moijbake glyphs in the tracker** | **2** | Status cells contain `�` instead of the emoji, breaking string anchors. | Anchor edits on the status words, or repair the glyphs once. |

**Bottom line:** **42 % of the round was avoidable**, and **~80 % of that lands in just two items** — the ref-click crash and the coordinate re-derivation. Both are *entirely* fixable with (i) one behavioural rule and (ii) one helper script.

---

## 3. (b) Patterns an agent should adopt **proactively**

| # | Pattern | When | Why it pays |
|---|---|---|---|
| **P1** | **Read-only DB preconditions first** — before any device time | Phase 0, always | Predicted 2 of 2 FIX-Task-30 unblockers and the 6.99 %‑vs‑6.35 % rate drift **without a single device call**. Converted "is this drivable?" from a 20-call speculation into a 2-call certainty. |
| **P2** | **Track the tracker, not the dispatch** — parse the status column mechanically | Phase 0 | The dispatch's list was correct but incomplete (6 of 12 PARTIALs were unnamed). Never plan from prose. |
| **P3** | **OCR-first, always** — `screenshot → qa:ocr --coords → adb tap` | Before **every** tap | Eliminates a whole class of misses; the downscale factor is not constant between frames, so no calibration is reusable. |
| **P4** | **Abandon `ref` clicks after ONE failure** | On the first `no XML content` error | The failure mode is a client crash, not a retryable glitch. `adb shell input tap` worked on every single attempt this round. |
| **P5** | **Prove an unblocker in the UI, not just the DB** | As soon as a "fixed" fixture is used | S19's DB said `node_id` was set; only Discover's *"1 result"* with Show All Nodes **Off** proved it was actually reachable. |
| **P6** | **When a case asserts an ABSENCE, capture the "N−1" control too** | Any "X does not appear" assertion | A two-frame before/after pair is far stronger than a single empty region — and here it cost nothing (an accidental navigation produced it). |
| **P7** | **Reuse the object you just made** | After any flow that creates a trade/order | The O2-C02 bundle *became* O3-C01's Pending trade and O3-C02's In Progress trade — three cases from one flow. |
| **P8** | **For a backend-only assertion, use the sanctioned harness** | Tax/fee/idempotency cases | `qa:ef-repro` reproduced two offers with the app's exact headers in **2 calls** vs ~30 UI-driving them, with identical server-side semantics — and it was disclosed in the report. |
| **P9** | **Name the writer before filing a surprising DB read (R100)** | Any "this value looks wrong" moment | `payout_status='pending'` on 10 cancelled trades looked like owed money; it is the untouched column default. Avoided a false MED defect and produced a reusable trap note. |
| **P10** | **One frame is not a defect — try to reproduce** | Any error modal | The "Failed to load trade" modal did not recur; the round recorded a **flake to watch**, not a defect. |
| **P11** | **Scan a REGION for a colour claim, and a FULL FRAME for a presence claim** | Design-system checks | The badge region gave a clean 69.88 %/8.62 %/0.00 %; the full-frame scan is what surfaced the *new* Home blue accent (0.20 %) that a per-region scan would have missed entirely. |
| **P12** | **Scope-write-then-revert through the SAME UI** | Every admin config write | The config was reverted via the very surface that wrote it, then re-verified in the DB — leaving `category`/`data_type` intact and the environment as found. |
| **P13** | **Buy exactly the evidence the residual needs — and nothing more** | Cheap closures | N03's residual was *one label*; one structured browser call closed it in 3 calls instead of re-driving the whole write leg. |
| **P14** | **Drive native sheets with `adb input`, and verify each field's rendered value** | Any 3rd-party sheet (Stripe) | This is what closed B10 after 11 days. `input text` can drop the first character — always screenshot-verify and CTRL+A + retype. |
| **P15** | **Deep-link-first, discovered from source** | Navigating to any registered route | `p2pkidsmarketplace://trade/<id>` and `://admin` each replaced a multi-screen navigation with one call (found by grepping the navigator). |

---

## 4. (c) Instrumentation / fixture work that removes the friction

**Tier 1 — highest leverage, small effort (would have saved ~80 calls this round alone):**

1. **`npm run qa:tap -- --text "<label>" [--index N] [--img <latest>]`** — one call that does: screenshot → OCR → fuzzy-match the label → `adb shell input tap <x> <y>` → echo what it tapped. Collapses the dominant 3-call pattern into 1. *Saves ~28 wasted + ~40 unavoidable calls per round.*
2. **Make the mobilecli AX-dump path non-fatal, or fail closed before it kills the app.** The `agent attach` `SIGSEGV` turns a *read* into a *20-call recovery*. A guard that detects "app is mid-load" (or simply refuses `ref` resolution on a loading/stalled screen) would remove the round's single largest cost. *Saves ~40 calls and 6–8 min per occurrence.*
3. **Register an item deep link: `p2pkidsmarketplace://item/<listingId>`** (mirroring the existing `://trade/<id>`). Every search-based case currently pays ~8 calls to find a listing by typing. *Saves ~10 calls on S19-class cases alone.*
4. **Add `test-admin` to the `qa:ef-repro` persona registry.** One line. It is the **only** reason O3-C06 layer 2 stayed PARTIAL. *Turns a residual into a 1-call closure.*
5. **Make `qa:admin-config-set` refuse to write without explicit `--category` and `--data-type`** (it silently clobbers them today). The dispatch had to warn about this; the tool should enforce it.

**Tier 2 — medium effort, high recurring value:**

6. **`npm run qa:ocr -- --coords --tap-line`** — emit a ready-to-run `adb shell input tap X Y` per matched label, so nothing is hand-transcribed.
7. **A frame-scale helper** — `qa:ocr` already knows the truth; have it print the detected display-scale factor so the *variable* downscale becomes visible instead of being discovered by a miss.
8. **Fix the admin sidebar's pointer-event interception** (F1) — a real operator blocker discovered only because Playwright reported it. Any `<aside>` with `z-30` over `main` should not swallow clicks on main content.
9. **Warm-app launcher:** `npm run qa:app-warm` — pre-fetch the bundle over `curl`, confirm the dev client is alive, and report the Metro row to tap. Removes the cold-start tax.
10. **Update `/memories/repo/schema-cheat-sheet.md`** with this round's corrections: `items.price` (not `price_cents`), `items.node_id`, `cart_items.added_at` (no `created_at`), **no `disputes` table** (dispute state lives on `trades`), `user_notifications` has **no `trade_id`** (use `data->>'trade_id'`), `tax_categories` uses `key` (no `code`), `sp_wallets.available_balance`/`pending_balance`/`reserved_sp`, `sp_ledger.related_transaction_id`, `trades.sp_reserved_at`/`sp_transferred_at`, and **`seller_payouts` is the only earnings authority**.

**Tier 3 — fixture gaps to close (each is a named blocker on a live case):**

11. **No `clothing_footwear` listing exists in node `550e8400-…0001`** ⇒ O2-C02's Item-C price-threshold leg is untestable. Seed one sub-$50 clothing item.
12. **No inducible Stripe capture failure** ⇒ blocks O2-C10, O3-C04, O3-C08, O3-C09 and O3-C06's layer 3. Either build the harness or formally accept the class as permanently out of scope (it is already treated that way for three of them).
13. **Bundle dispute semantics** — a dispute settles only the disputed line (siblings stay `in_progress`). Either document it or make it settle the bundle; today it is ambiguous.
14. **`test-buyer` left with a 1-item basket and a changed saved card** after B10 — a `qa:restore-persona` one-liner would make runs self-cleaning.

---

## 5. Anti-patterns (do NOT repeat)

| Anti-pattern | Observed cost | Do instead |
|---|---|---|
| Retrying a `ref` click after `no XML content found` | **~40 calls** (two crashes) | One failure ⇒ adb-only for the session |
| Estimating a tap coordinate from the displayed screenshot | **28 calls**, 4 recorded misses | `qa:ocr --coords`, every time |
| Guessing column/table names in SQL | **18 calls** | Read the cheat sheet first (R-NEW-3) |
| Batching a `mobile_swipe_on_screen` step without `direction` | **1 aborted batch (3 lost steps)** | Validate batch steps before sending |
| Re-driving a leg the residual does not need | avoided here (N03, O2-C02) | Read *what the residual is* before buying evidence |
| Filing a defect from a single frame | avoided here | Attempt one reproduction; if it does not recur, file it as a flake |
| Trusting a stored/mirror column as an observation | avoided here (R100) | Name the writer first |
| Leaving an admin config write in place | avoided here | Revert through the same UI + DB re-verify |

---

## 6. Suggested rule additions (for `consolidate-agent-rules`)

1. **R-NEW-A — "One ref-failure ⇒ adb-only".** After a single `no XML content found in uiautomator dump` from a `ref` click, abandon `ref`-based interaction for the rest of the session and drive with `adb shell input tap|text|swipe`. The failure mode is a **client crash**, not a transient glitch — retrying costs ~20–40 calls.
2. **R-NEW-B — "The display downscale is VARIABLE".** `view_image` does not render captures 1:1, and the factor **differs between frames of the same run** (0.74×–1.20× measured). Tap coordinates must come from `qa:ocr --coords` or the AX tree, **never** from the displayed image; a frame is never an acceptable coordinate source even when it "looks" 1:1.
3. **R-NEW-C — "Verify every typed value in a native sheet".** `adb shell input text` can drop the first character on field entry/focus change; screenshot-verify the rendered value and re-enter via `CTRL+A` + retype before submitting.
4. **R-NEW-D — "Validate `mobile_batch_commands` steps before sending".** A single invalid step (e.g. a missing `direction`) **aborts every remaining step** with no partial-completion report.
5. **R-NEW-E — "Extend R108's transient-UI trigger to `adb`".** The batched-[tap→delay→screenshot] technique depends on a *ref* click for the trigger; a bare-coordinate click inside a batch no-ops too often. Trigger with an `adb` tap in a separate call, then batch the capture.
6. **R56 sub-note — tracker anchors.** Scripted status edits must not anchor on a status emoji: some rows carry a **mojibake `�`** instead of 🔴/📄, which silently fails the match. Anchor on the surrounding words.
