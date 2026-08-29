# QA Task 5 — TRD Groups F–K — Decision & Outcome Log (agent-fed)

**Run:** 2026-08-29 · TRD-TC-F01–K11 (39 cases) · iOS Simulator + staging Supabase + admin portal
**Purpose of this file:** a full decision-and-outcome trace of the executing agent — every key action, the reasoning behind it, the tool calls that mattered, and the outcome — so a downstream AI agent can derive:
- **(a)** what slows execution,
- **(b)** what patterns an agent should adopt proactively,
- **(c)** what instrumentation/fixture work removes the friction.

Each entry: **Action → Reasoning → Tool calls → Outcome.** Verdicts + findings live in `report.md`; this file is the *how/why*, not the what.

---

## Phase 0 — Recon (no app interaction)

### 0.1 Guide + source + DB contract recon
- **Action:** Read the canonical guide sections F–K (exact assertions per TC), repo memories (`locator-conventions`, `test-authoring-conventions`, `simulator-keyboard-suppression`, `manual-testing-guide-canons`, `qa-test-accounts`), key source files (`TradeSuccessScreen`, `TradeOfferScreen`, `TradeTimelineScreen`, `CancellationReasonModal`, `DisclaimerModal`, `ChatScreen`, `QuickReplyChips`, `SafeMeetupCard`, `deepLink.ts`, `send-push-notification`, `send-offer-reminders`, `send-auto-complete-reminders`, `create-trade-offer`, `cancel-trade`), and the fee/tax/`fn_get_buyer_fee_for_checkout` migration.
- **Reasoning:** To avoid mid-run surprises: exact copy strings, testIDs, fee formulas, RLS reachability, deep-link routes, and which personas own which fixtures. The `fn_get_buyer_fee_for_checkout` read (SP RPC) was essential — it told me the *authoritative* fee would be $1.49, not the guide's $0.99/$2.99, before I ever hit the UI.
- **Tool calls that mattered:** `read_file` (guide + sources), `grep_search` (testIDs/copy), Supabase `execute_sql` (config: `buyer_fee_*`, `charge_one_fee_per_bundle`, `platform_fee_seller_*`, `tax_rules`, persona rows), memory views.
- **Outcome:** Full mental model; saved many UI round-trips (e.g., I could pre-verify fee display = `fn_get_buyer_fee_for_checkout` output). ⚠️ **Lesson:** the guide's fee numbers were stale; config readback was the source of truth.

### 0.2 Persona batching decision
- **Action:** Grouped all 39 cases into persona batches (test-buyer: I/K/G/H02; test-free: H01/K02; test-seller: F/G/H03/J; admin: F02/K07–K09) to minimize logins.
- **Reasoning:** Each login cycle = email+password+possibly-TOS-gate = ~6–10 tool calls; batching by persona is the single biggest tap-count saver.
- **Outcome:** Worked well, but the **login flow itself was a recurring cost** (see 1.2).

---

## Phase 1 — Environment & login friction

### 1.1 F03 setup (first executed case)
- **Action:** Seeded `trades` row (`2bd7193b`, in_progress, test-seller-2 Science Kit $20, no payout method) via SQL, then `UPDATE … status='completed'` to fire the completion trigger, then invoked `initiate-payout` EF via curl.
- **Reasoning:** The completion trigger's `net.http_post` EF call is **not wired in staging** (known env artifact) — so I drive the payout EF directly to reach `requires_action` for a no-method seller.
- **Tool calls:** `execute_sql` (seed + update), terminal curl with service-role key (read inline via grep/cut, never echoed).
- **Outcome:** Payout `requires_action` + "Add a payout method to receive your $18.00" notification + deep-link `/payout-settings`. **F03 PASS.** ⚠️ **Lesson:** in this env, "trigger → EF" chains must be invoked manually; this pattern repeated for F02/H02.

### 1.2 Login flow — repeated cost + TOS soft-gate
- **Action:** Logout via deep link `p2pkidsmarketplace://qa-logout`, then email/password login for test-free, test-seller, test-buyer (several times).
- **Reasoning:** Login is the only way to switch personas on a single simulator.
- **Tool calls:** `xcrun simctl openurl` (logout), `mobile_click_on_screen_at_coordinates`, `mobile_type_keys`, `mobile_list_elements_on_screen` (re-list before every tap per §5.1).
- **Outcome & friction (3 real bottlenecks):**
  1. **TOS soft-gate** re-appeared for test-free on every launch (policy re-accept gate) — each login needed a back-dismiss. ⚠️ **Fixture/instrumentation:** auto-accept current TOS for test personas, or persist the gate's "accepted" flag across launches.
  2. **Password field focus misdirection** — typing after tapping the password field sometimes landed in the email field (corruption). Recovery = Cmd+A clear + retype.
  3. **Login is ~8–10 tool calls each**; with 5+ persona switches across the run this was the largest fixed cost. ⚠️ **Instrumentation:** a `qa-login-as=<persona>` deep link would collapse this to 1 call.

---

## Phase 2 — Batch 2 (test-free): value stack + completion CTA

### 2.1 test-free had no Stripe payment method → provisioned one
- **Action:** Found `subscriptions.stripe_customer_id` NULL for test-free; created a Stripe customer + Mastercard 4444 from `tok_mastercard` and persisted to `subscriptions` (mirroring the existing `ensure-buyer3-valid-card.mjs` approach, adapted for test-free via a `node -e` one-off).
- **Reasoning:** H01 (complete a trade) requires a valid saved card; test-free had none. The `payment_card` QA toggle only selects among *existing* saved cards.
- **Tool calls:** `execute_sql` (check subscriptions), terminal `node -e` (Stripe API + Supabase REST patch), `mobile_click/type` to re-open Make Offer so it re-queries the card.
- **Outcome:** test-free checkout showed "MASTERCARD •••• 4444"; K02 + H01 proceeded. ⚠️ **Lesson:** test personas should ship with a saved card; provisioning one mid-run costs ~5 tool calls + a `node -e` script.

### 2.2 K02 value stack + H01
- **Action:** Deep-link `/listing/<skateboard>` → Item Detail Price Breakdown → Make Offer → value stack → send offer (disclaimer) → test-seller accept (confirm dialog) → test-free complete → TradeSuccess.
- **Reasoning:** K02 asserts the non-subscriber stack (fee + tax + no SP input) — captured both Item Detail and Make Offer stacks on-device + OCR.
- **Tool calls:** deep-link, `list_elements` (locate Request-to-Buy/Add/send buttons), `save_screenshot` → `qa:ocr`, `execute_sql` (verify trade row `e54f608a`, fee 149/tax 154).
- **Outcome:** K02 PASS (fee $1.49 first-trade, tax $1.54, Total $25.03, no SP input). H01 offer → accept → complete → free-buyer upsell CTA verified. ⚠️ **Lesson:** every money/SP assertion was closed with a DB read-back (R11) — the on-device value and DB row always matched, which is what made verdicts trustworthy.

### 2.3 Tiered-fee engine observed live
- **Action:** After test-free completed a trade, re-opened an item → fee showed **$2.89** ($1.99 + 5%) instead of $1.49.
- **Reasoning:** test-free's `fee_state` moved first_trade → subsequent after the completed trade; this was expected per `fn_get_buyer_fee_for_checkout`.
- **Outcome:** Confirmed the tiered engine live (good K02 collateral), but ⚠️ **Lesson:** persona fee-state drifts after completing trades — an agent must re-read fee_state or expected values will be wrong (this affected the bundle-fee expectations later).

---

## Phase 3 — Batch 3 (test-seller): seller-side verifications

### 3.1 H03 seller SP-pending + H02 completion
- **Action:** As test-seller, opened completed Trade B (`b829ac8b`) timeline → "18 SP releasing in 2 days — added to your pending wallet." + View Wallet → SP Wallet.
- **Reasoning:** Seller-side completion CTA is shown on the timeline; verified + tapped View Wallet to complete the assertion.
- **Outcome:** H03 PASS. ⚠️ **Lesson:** H04 (seller "Sold for cash!") is **NOT reachable on a single simulator** — the seller TradeSuccess only fires on a realtime status *transition* while the seller has the timeline open; with one device you can't be logged in as both. Marked H04 as source+unit corroborated. This is a **fixture/instrumentation gap**: needs either a second device or a deep link that forces the seller TradeSuccess render.

### 3.2 The stuck "Offer Accepted!" native alert (biggest single-tap blocker)
- **Action:** After accepting an offer, a modal "Offer Accepted! … OK" would not dismiss via coordinate taps at ~6 candidate positions, nor ENTER, nor backdrop taps; only **terminate + relaunch** cleared it.
- **Reasoning:** The AX tree showed only the clock (native overlay not exposed); pixel-scan/OCR located the OK pill but taps didn't register — likely a native `UIAlertController` quirk with the tap tool.
- **Tool calls:** `mobile_click` (multiple y-positions), `mobile_press_button` ENTER/BACK, `view_image`/`qa:ocr`/crop to find OK, `mobile_terminate_app` + `mobile_launch_app`.
- **Outcome:** Recovered without fixture loss (state was DB-persisted). ⚠️ **Lesson:** native-alert dismissal is unreliable — budget for terminate+relaunch as the fallback, and **never lose DB state** (it survives). Instrumentation opportunity: a global "dismiss any alert" QA hook or ensuring these are custom RN modals (AX-exposed).

---

## Phase 4 — Bundle fee modes (K04/K05/K06/K10) — the highest-friction surface

### 4.1 Stale cart / "Already in Active Trade" / MAX_PENDING_OFFERS — the #1 test-data bottleneck
- **Action:** Added 3 items to test-buyer's basket → checkout → send → "Already In an Active Trade" partial failure; a later bundle send failed with `MAX_PENDING_OFFERS: You have 3 pending offers with this seller`.
- **Reasoning:** test-buyer had accumulated pending offers from earlier fixtures (K05 bundle = 3 trades = 1 slot, plus old Puzzle Set + Soccer Ball slots). The per-seller cap (3) blocked new offers; the "already in active trade" dialog blocked re-offering specific items.
- **Tool calls:** `execute_sql` (count pending slots by bundle), `UPDATE trades … cancelled` to free slots, re-invoke EF.
- **Outcome:** Slots freed → K04 succeeded. ⚠️ **Lesson (biggest):** the app's per-seller pending cap + "one active trade per listing" mean **bundle/offer fixtures must be cleaned before reuse**, or you burn many cycles misreading the failure as an app bug. **Instrumentation:** a `reset:offer-fixtures` SQL/script that cancels all pending offers for the QA buyers, plus clear cart_items.
- **Outcome (decision recorded):** The first K04 on-device failure was diagnosed as `MAX_PENDING_OFFERS` (environment artifact), NOT a fee bug — this distinction (read the EF error before concluding) is a pattern to encode.

### 4.2 Toggle management (charge_one_fee_per_bundle)
- **Action:** Confirmed `charge_one_fee_per_bundle=TRUE`; ran K05 (ON) first; toggled OFF via `UPDATE admin_config` for K04; restored TRUE.
- **Reasoning:** Both modes need a live checkout; the toggle is read server-side per request so no restart needed.
- **Tool calls:** `execute_sql` UPDATE + verification SELECTs.
- **Outcome:** K05 PASS ($1.49 single fee, DB 1×149), K04 PASS ($4.47, DB 3×149). ⚠️ **Lesson:** config toggles are cheap and safe (scope + revert) — but remember to revert (documented + verified TRUE at end).

### 4.3 K10 stale-client repro → TRADE_INSERT_ERROR (a real finding, but costly to isolate)
- **Action:** Direct EF calls with fees on all 3 items while toggle ON → `TRADE_INSERT_ERROR` on all. Isolated: single-item on the same item **succeeded**; K05 (app, toggle ON) **succeeded**; only the bundle+stale-fee path fails.
- **Reasoning:** Needed to separate item-vs-path. The direct EF invocation pattern (JWT via `grant_type=password`, real `payment_method_id`, service-role reads) let me reproduce without UI.
- **Tool calls:** terminal `node -e` EF repros (3 variants: `NO_PAYMENT_METHOD` → `MAX_PENDING_OFFERS` → `TRADE_INSERT_ERROR`), `execute_sql` (items/trades/triggers/constraints), source reads of phase1 insert.
- **Outcome:** P2 finding (reproducible), root cause not pinned within budget. ⚠️ **Lesson:** the EF-repro harness is powerful but each attempt costs a `node -e` + token exchange (~2 tool calls each). Also ⚠️ the guide marks K10 as "deferred" — weight these lower when budget is tight.

### 4.4 Basket CTA overlaps the tab bar
- **Action:** Multiple attempts to tap "Make offer" (`bundle-cta-button`) kept hitting a tab (Sell/Discover) because the CTA (y 845–916) overlaps the tab bar (y 868–905). Worked around by tapping the CTA's top strip at x=300.
- **Reasoning:** AX coordinates show overlap; taps in the overlap resolve to the tab.
- **Outcome:** Minor layout finding; cost ~6 wasted taps. ⚠️ **Lesson:** occlusion is a §5.23/R22 check — but here the *overlap itself* is a product bug worth flagging, and a `data-testid`-driven tap (via AX name) would bypass coordinates entirely.

---

## Phase 5 — Admin portal (F02 resolve, K07/K08 refunds, K09) — second friction cluster

### 5.1 Sidebar intercepts clicks over main content
- **Action:** Admin dispute "Resolve → Complete" and "Issue Partial Refund" buttons failed via normal `click` (sidebar `aside` intercepted pointer events); used `run_playwright_code` to `scrollIntoView + click({force})` — which **also** sometimes hit the sidebar's "Action Center" link. Reliable fix: **collapse the sidebar first**, then click normally.
- **Reasoning:** Expanded sidebar overlays main content; Playwright's actionability check fails repeatedly.
- **Tool calls:** `open_browser_page`, `type_in_page`, `click_element` (with retry failures), `run_playwright_code` (force click, `waitForSelector`, spinbutton fills), `handle_dialog` (native confirm).
- **Outcome:** F02 resolve executed (trade → completed, dispute resolved, `payout_amount_cents` NULL → **P1 payout-zeroing finding**). ⚠️ **Lesson:** (a) collapse the sidebar as a default first step on admin detail pages; (b) the P1 was only visible because I did a DB read-back after the admin action — the UI said success but the money field was wrong. **Pattern to adopt:** always read back the *state that matters* (money/ledger), not just the success toast.

### 5.2 Partial refund (K07/K08)
- **Action:** On trade `e54f608a` (completed, captured PI), opened Issue Partial Refund → set price=$22 (K07) or tax=$1.54 (K08), fee=0 → Refund → accepted the "Partial refund issued successfully" alert → DB read-back.
- **Reasoning:** Refund is a real Stripe flow; needed a completed trade with a captured PI (chose the H01 trade).
- **Tool calls:** `run_playwright_code` (spinbutton fill — price/fee/tax are `[role=spinbutton]` number inputs), `click_element`, `handle_dialog`, `execute_sql`.
- **Outcome:** K07 PASS (partially_refunded, fee kept, trade_refunds split). K08 PASS-with-P2: **`tax_records.tax_status` never updated** (stays `collected`) — the refund API updates Stripe + payments + trade_refunds but not the tax ledger. ⚠️ **Lesson:** multi-assertion cases should each be DB-verified (2 refunds = 2 ledger reads); the tax-ledger gap is exactly the kind of cross-system inconsistency that only a ledger read-back exposes.

### 5.3 Payments reconciliation (K09)
- **Action:** Navigated `/payments`; captured summary + the e54f608a row.
- **Outcome:** K09 PASS — Charged $25.03 (= PI), Refunded $23.54 (sum of both refunds), pill `partially refunded`. Cheapest case of the batch (1 nav + 1 read).

---

## Phase 6 — Cleanup

- **Action:** Corrected F02 trade `28a41289` (`payout_amount_cents=1600`, `payout_status='pending'`) since the $0 payout was test-data corruption from the P1; cancelled throwaway bundles `ba0859c3`/`bc4a94b7` + stray `5a916e13`; restored `charge_one_fee_per_bundle=TRUE`; copied 26 evidence screenshots to the evidence folder; wrote `report.md`; updated `TEST-COVERAGE-INVENTORY.md`; recorded session memory.
- **Reasoning:** Leave personas/DB clean for the next batch; evidence must live in the workspace (mobile tool can't write there — save to /tmp then `cp`).
- **Outcome:** Clean handoff; one residual (test-seller cancel counter = 3 + admin flag) documented for the next J-series run.

---

## (a) What slows execution (ranked by cost)

1. **Stale/accumulated test data** — per-seller pending-offer cap (`MAX_PENDING_OFFERS`), "already in active trade" on prior-fixture items, drifting `fee_state` after completions. Cost: K04 needed 3 diagnosis + cleanup cycles; multiple failures misattributed until the EF error was read.
2. **Persona login cycles** — ~8–10 tool calls each (email/password + occasional TOS-gate + focus-misdirection retries); 5+ switches across the run.
3. **Admin portal click interception** — expanded sidebar blocks main-content clicks; force-click misfires; each recovery costs retries.
4. **Native-alert dismissal** — "OK" dialogs not dismissible by coordinates → terminate+relaunch (state-safe but slow).
5. **Bundle fixture assembly** — adding 3 items = 3×(deep-link + re-list + add) + basket nav; one stale item voids the whole checkout.
6. **Missing payment method on a persona** — provisioning a Stripe card mid-run (one-off `node -e`, multiple reads).
7. **Occlusion/overlap** — Basket CTA over tab bar; repeated coordinate trial-and-error.

## (b) Patterns an agent should adopt proactively

1. **Read the backend before concluding** — every "failed" offer submit: read the EF error first (`NO_PAYMENT_METHOD` vs `MAX_PENDING_OFFERS` vs `TRADE_INSERT_ERROR` are very different). Never assume app bug from a generic "Batch offer failed".
2. **Close every money/SP/state assertion with a DB read-back** — the UI success toast is not the truth; the P1 (payout $0), P2 (tax ledger), and K04/K05 fee rows were all found this way.
3. **Re-read persona/`fee_state`/config before each money case** — values drift after completions; the guide numbers are stale; `fn_get_buyer_fee_for_checkout` is authoritative.
4. **Batch by persona; verify fixtures before reuse** — check "active trade" + pending-slot counts *before* assembling a bundle.
5. **Collapse the admin sidebar before clicking main content; use `[data-testid]`/AX names, not coordinates, when occlusion is possible.**
6. **Have a state-safe recovery path** — terminate+relaunch for stuck native alerts (DB state survives).
7. **Scope + revert config toggles, and verify the revert.**
8. **Use direct EF/repro harnesses for server-side cases** — JWT + real PM + service-role reads reproduce exactly what the app sent, and isolate item-vs-path quickly.
9. **Treat guide fee/copy numbers as stale; treat config + `report.md` as truth.**

## (c) Instrumentation / fixture work that removes the friction

1. **Offer-fixture reset script** — cancel all pending offers for QA buyers + clear `cart_items` (one command) to avoid `MAX_PENDING_OFFERS` and stale-cart collisions.
2. **`qa-login-as=<persona>` deep link** — collapse the 8–10-call login to 1; also **auto-accept current TOS** for test personas (kill the soft-gate on every launch).
3. **Ship every test persona with a valid saved Stripe card** (extend the `ensure-buyer3-valid-card.mjs` pattern to all QA buyers) so no mid-run provisioning.
4. **Global "dismiss alert" QA hook** (or convert the "Offer Accepted!"/trade alerts from native to custom AX-exposed RN modals) to remove the terminate+relaunch fallback.
5. **Deep link to force the seller TradeSuccess screen** (H04) — currently unreachable on a single simulator; a `qa://trade-success?role=seller&listingType=cash_only` hook would make it testable.
6. **`data-testid` on the Basket "Make offer" CTA** and fix the tab-bar overlap so the CTA is fully tappable.
7. **Bundle fixture generator** — a SQL/script that creates N same-seller items + preloads the cart for a given buyer, so bundle cases don't need 3×(open+add) UI cycles.
8. **Admin: auto-collapse sidebar on detail pages** (or fix z-index) so main-content clicks aren't intercepted.
9. **EF repro harness as a checked-in script** (not ad-hoc `node -e`): takes persona + item ids + fee mode, prints the raw EF response — would have halved the K10/K04 diagnosis time.
