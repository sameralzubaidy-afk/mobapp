# Full Decision-and-Outcome Log — TRD Group A (minus post-MVP) + Group B — 2026-08-28

> **What this file is:** a chronological, decision-level transcript of the QA execution run, showing — for every key action — the **decision taken**, the **reasoning behind it**, the **tool calls that mattered**, and the **outcome**. It is written for an AI agent to mine for: **(a) what slows execution**, **(b) what patterns an agent should adopt proactively**, and **(c) what instrumentation/fixture work removes the friction**.
>
> Sections 5, 6, and 7 are the three directly derivable outputs; sections 1–3 are the raw material (run facts + phase-by-phase log) they are derived from. Every bottleneck/pattern/fix below is traceable to a specific entry in the phase log.

---

## 0. How to consume this log

- **Section 1** — run metadata & the environment facts the agent discovered before and during the run (these are preconditions, many of them became bottlenecks).
- **Section 2** — the phase-by-phase decision log. Each phase has: **Goal**, a **Step table** (Decision / Reasoning / Tool calls / Outcome), and a **Phase outcome**.
- **Section 3** — raw tool-call inventory with counts and "what it was used for".
- **Section 4** — notable friction events timeline (the moments that actually cost time).
- **Section 5** — **(a) bottlenecks**, ranked by cost, each with evidence link back to a phase.
- **Section 6** — **(b) proactive patterns**, i.e. what the executing agent did that an agent should internalize before a run.
- **Section 7** — **(c) instrumentation/fixture work**, ranked by friction-removal value.
- **Section 8** — evidence register (screenshots, DB artifacts, source anchors) so a follow-up agent can re-derive any claim.

Conventions in the phase tables:
- **Decision** = the action chosen (what was tapped/typed/queried/read).
- **Reasoning** = the agent's stated rationale at that moment (abridged from the live reasoning trace).
- **Tool calls** = the named tools that mattered (full counts in §3).
- **Outcome** = observable result; `✔` = worked as intended, `⚠` = partial/wasted effort, `✖` = failed / caused rework.

---

## 1. Run metadata & environment facts

| Item | Value |
|---|---|
| Task | Execute 20 manual cases: TRD-TC-A01, A02, B01–B08 (incl. B05a–j) from `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`; ignore stale inline "passed" annotations; PASS/FAIL/BLOCKED/SKIPPED + evidence; flag real app bugs. |
| Target | iOS Simulator **iPhone 17 Pro Max** (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1; app `com.sameralzubaidi.p2pmarketplace` (Expo RN dev build). |
| Backend | Staging Supabase `drntwgporzabmxdqykrp` — read-only verification pre-approved; one documented fast-clock test step approved (expiry). |
| Personas (fixture passwords) | test-buyer `TestBuyer123!` (subscriber, node Norwalk Central), test-seller `TestSeller123!`, test-seller-2 `TestSeller2123!` (1 available item, Science Kit), test-buyer-2, test-buyer-3. **test-seller-3 does not exist.** |
| Evidence | `e2e-test-results/qa-trd-group-a-b-2026-08-28/screenshots/` — 36 PNGs; report at `report.md`. |
| Verdict | 9 PASS · 2 FAIL · 4 BLOCKED · 5 SKIPPED. P1 backend bug (SP settlement trigger missing) + P1/P2 Stripe idempotency collision surfaced. |

### 1.1 Environment facts the agent had to discover (many became friction)

| Fact | How discovered | Consequence |
|---|---|---|
| Software keyboard appears over fields; **AX-tree coordinates are unreliable while keyboard is up** (hard gate §5.19). | First login: tree showed shifted button coords. | Cmd+K (hardware keystroke) before every submit; verify via re-list that keys moved off-screen; use OCR/pixel scan as ground truth. ~dozens of extra tool calls. |
| **Long-press "Select All" does NOT work** in the SP text field. | B04/B05-era SP-field clearing; tried long-press twice, no edit menu. | Adopted `Cmd+A` (hardware select-all) then re-type. The working technique. |
| **Native modals (ui/Modal bottom sheets, accept/OK alerts) are NOT in the AX tree.** | Accept-trade alert after seller accept: tree empty (only clock). | Pixel-scan for button bands (primary #5DBB8E green; cancel/confirm danger #ff6b6b red; disabled #ffb3b3 pink). Costly on the B04 cancel modal (see §4). |
| `view_image` returns a URI, not pixels the agent can read. | Tried to inspect crops. | Routed all visual verification through OCR + pixel-scan helpers. |
| Large element trees (>~18 KB) are truncated in tool results and written to a resource file; `grep_search` on the resource file intermittently failed. | Discover screen 19 KB tree; Discover search result; item-detail tree. | Adopted: grep the resource file, fall back to `read_file`, fall back to OCR/pixel-scan. |
| **Deep link `p2pkidsmarketplace://listing/<id>` opens ItemDetail — but only reliably when the app is warm and clean (no LogBox).** | Used to reach NULL-node fixtures and fresh listings. | Deep link became the standard way to reach items; LogBox forced terminate+relaunch first. |
| **LogBox "Console Error" overlays replay stale errors and block taps with a full-screen scrim.** | Replayed idempotency error mid-A01 twice. | Terminate + relaunch the app (session persists). Two forced relaunches this run. |
| `qa-logout` deep link logs out cleanly. | Used every persona switch. | 12+ persona switches done via deep link instead of UI. |
| Only **2 of test-seller's 122 available items are in test-buyer's node**; ~120 are NULL-node. | SQL count by node. | NULL-node fixtures reachable only via deep link; in-node discovery search returns 70 items. |
| `test-seller-3` has no user/profile/listings. | SQL: no rows. | B05e blocked; documented setup gap. |
| Config: `max_pending_offers_per_seller=3`, `auto_complete_hours=72`, offer expiry **48h** (guide says 24h). | SQL on `admin_config` + offer_expires_at. | Doc-drift finding; expiry fast-clock used `UPDATE trades SET offer_expires_at=now()+interval '5 seconds'` + `rpc_process_expired_offers` (approved test step). |
| Confirm-trade ("I Got It") button lives at logical y≈1823 (below fold). | ItemDetail/timeline tree. | Required 2–3 swipes before the button was reachable at y≈779. |
| The pending-trade Cancel button is a **sticky footer at y≈854 under the floating tab bar**; two taps hit the Home/Sell tabs. | Mis-taps landed on Home and Sell. | Solved by tapping at the far-left edge (x≈40) of the cancel button. |
| The buyer success screen's "You have 46 SP left" is the **pre-reserve** value; wallet is actually 38. | Offer screen vs wallet SQL. | Copy-deviation finding. |

---

## 2. Phase-by-phase decision & outcome log

### Phase P0 — Context loading (start)

**Goal:** Load the operating rules and case specs before touching the device.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 0.1 | Read the QA operating playbook + canonical guide + repo memory (locator-conventions, test-authoring, keyboard-suppression, qa-test-accounts, manual-testing-guide-canons) | "Read the operating playbook and canonical guide, then set up execution plan" — playbook is the source of operating rules. | `read_file` ×6+ (parallel), `memory` | ✔ Context loaded; hard-gate rules (re-list discipline, keyboard rule, native-modal pixel-scan) internalized. |
| 0.2 | Read `TEST-COVERAGE-INVENTORY.md` verdict format; confirm all 20 cases "NEVER RUN" | Verify master tracker state vs guide's inline annotations; the user said inline passes are stale. | `read_file`, `grep_search` | ✔ Confirmed all 20 are NEVER RUN in the master tracker → re-verify everything fresh. |
| 0.3 | Create the todo list (19 items) and activate the mobile tool groups | Large multi-case batch needs visible progress tracking + the tool category gate. | `manage_todo_list`, tool activation calls | ✔ |

**Phase outcome:** Rules loaded; plan set. **Pattern: read canonicals + memory first; verify tracker state before trusting guide annotations.**

---

### Phase P1 — Environment & DB precondition recon

**Goal:** Confirm simulator/app state and DB preconditions (read-only) before executing.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 1.1 | Query admin_config (`max_pending_offers_per_seller`), trades, profiles, wallets, listings | Know the cap value (B05), current pending-offer state (clean start?), persona node membership, wallet balances (SP assertions). | `mcp_supabase_execute_sql` (several) | ✔ Config=3; no stale pending offers for the fixture pair (clean start); buyer SP 46 avail/10 reserved; most fixtures NULL-node. |
| 1.2 | Fix SQL on schema errors (e.g., `display_name` doesn't exist → `name`; `item_id` → `listing_id`) | §5.34: check schema before trusting column names. | `mcp_supabase_execute_sql` | ✔ Quick self-corrections; no rework beyond one retry each. |
| 1.3 | Read the deep-link map / AppNavigator to find a way to reach NULL-node items | Only 2 in-node items; 120 NULL-node. Discover search is node-scoped. | `read_file`, `grep_search` | ✔ Found `p2pkidsmarketplace://listing/:id` → ItemDetail. This became the standard navigation tool. |
| 1.4 | Read `create-trade-offer` for a config-fetch-failure QA toggle (B05i) and for the idempotency key | B05i needs a forced config failure; also early look at offer logic. | `read_file`, `grep_search` | ✔ No QA toggle exists → B05i pre-classified BLOCKED (environment). |
| 1.5 | Check for an existing conversation on a cancelled trade (for B08) | B08 needs a chat on an ended trade; creating one via UI is heavy. | `mcp_supabase_execute_sql` | ⚠ Found messages on `c3d0146f` (cancelled) — but this fact was NOT fully leveraged until P10; agent spent P9 reasoning about B08 cost first. |

**Phase outcome:** Environment mapped; B05i pre-blocked; deep-link navigation discovered; P1 root-cause groundwork laid. **Pattern: schema-first SQL; find deep links early; pre-classify environment-blocked cases during recon.**

---

### Phase P2 — A01 attempt 1 → Stripe idempotency collision (the #1 bottleneck of the run)

**Goal:** Cash-only happy path (A01) on the in-node listing `83c8823b`.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 2.1 | Login as test-buyer (email, password, Cmd+K, submit), verify keyboard hidden before submit | Keyboard rule hard gate; re-list discipline. | `mcp_mobile-*` (click, list, type), `run_in_terminal` (Cmd+K) | ✔ Logged in. Perceived load <2s (noted). |
| 2.2 | Discover → search "QA Dev Fixture Item" → open `83c8823b` | A01 target item (in-node, cash-only, $25). | clicks, search, list | ✔ ItemDetail open. |
| 2.3 | Verify "Cash Only" badge + single "Request to Buy" (no Use SP) | A01 UI assertions. | list/grep tree, OCR region | ⚠ **No "Cash Only" badge exists** → read ItemDetailScreen source → confirmed badge is not implemented → doc-drift finding (not a blocker). |
| 2.4 | Tap Request to Buy → Make Offer screen → scroll to Send Offer → disclaimer checkbox → Accept | Standard offer path. Send Offer is below the fold inside a ScrollView. | click, swipe, list, OCR, pixel-scan | ⚠ Green pixel-scan had to confirm the button (bottom region under tab bar); 3–4 extra calls. |
| 2.5 | Submit offer → **"Payment Hold Failed" alert with Stripe 409: "Keys for idempotent requests can only be used with the same parameters they were first used with"** | — | list (alert in AX tree) | ✖ **Bottleneck hit.** Offer blocked. |
| 2.6 | Read `create-trade-offer` to confirm the idempotency-key construction | "This is the smoking gun" — confirm root cause before recording. | `read_file`/grep | ✔ Confirmed key = `pi_offer_<buyer>_<item>_<hash(cashCents,spAmt,txFeeCents,finalTaxCents,payment_method_id)>`; prior cancelled trade `00ce3b4e` on same listing had identical params → collision; per-request `request_id` in PI metadata guarantees params differ → replay impossible. |
| 2.7 | Verify no partial trade was created for `83c8823b` | Rule: confirm failed submissions are clean. | `mcp_supabase_execute_sql` | ✔ No trade created; failure was clean. |
| 2.8 | **Abandon `83c8823b`**; navigate to a fresh listing `4f14e0e7` (Cash-Only Item, $20, NULL-node) via deep link | Fresh listing with no prior buyer trade → avoids the collision. | `run_in_terminal` (simctl openurl), list | ✔ Deep link worked; ItemDetail open. |
| 2.9 | Offer on `4f14e0e7` → Send Offer → disclaimer accept → **LogBox replay of the same idempotency error scrims the screen** | — | list, screenshot | ✖ LogBox blocked the Accept tap; **no trade created** for `4f14e0e7`. |
| 2.10 | **Terminate + relaunch the app** (session persists) | "The offer wasn't submitted (the LogBox intercepted the Accept tap). Let me terminate + relaunch." | `terminate_app`, `launch_app`, list (poll) | ✔ Clean relaunch, still logged in as test-buyer, no LogBox. |
| 2.11 | Redo offer on `4f14e0e7` (deep link → Request to Buy → Send Offer → disclaimer → accept) | Retry on fresh listing after clean state. | clicks, type, list, swipe | ✔ **Offer submitted.** "Trade Initiated!" success screen. Trade `bc83a763` created (pending, PI attached, `offer_expires_at` +48h). |

**Phase outcome:** A01 offer created, but at high cost — one blocked offer, one LogBox, one app relaunch, plus ~15 extra tool calls. **The Stripe idempotency collision is the single biggest execution cost of the run.**

---

### Phase P3 — A01 completion (seller accept → buyer confirm)

**Goal:** Complete the cash-only trade end-to-end.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 3.1 | Logout (qa-logout) → login test-seller → Trades → Offers → Review offer on `bc83a763` | Seller leg. | login cycle (clicks/type/Cmd+K), list | ✔ Offer visible under "NEEDS ACTION" with countdown "47h 59m". |
| 3.2 | Tap Accept → confirm modal → **Accept** | Standard accept. | click, list | ✔ "Offer Accepted!" alert — but tree nearly empty (native modal). |
| 3.3 | Pixel-scan for the OK button (green band analysis at y 500–587; full-width) | Native alert OK not in AX tree. | pixel-scan region scans, OCR | ⚠ 4–5 scans to locate the band; confirmed full-width green at pt y~500–587 → tapped (220,543). |
| 3.4 | Verify trade `bc83a763` = in_progress, `auto_complete_at` +72h | Backend confirmation of accept. | `mcp_supabase_execute_sql` | ✔ in_progress at 11:12:35. |
| 3.5 | Login test-buyer → Trades → Buying → View Trade → scroll to "I Got It" (confirm-trade-button at y≈1823) → Confirm | Buyer completion leg. | login cycle, click, swipe ×2–3, screenshot | ✔ "Trade Complete!" screen. |
| 3.6 | Verify DB: `bc83a763` completed; item sold; payout 1600¢ gross/1571¢ net **pending**; `payout_status=pending` | Money-side confirmation. | `mcp_supabase_execute_sql` | ✔ **A01 = PASS** (with doc-drift findings on badge/fee). |

**Phase outcome:** A01 PASS. Cost driver was the native-OK-button pixel-scan + the below-fold confirm button scroll.

---

### Phase P4 — A02 Accept-SP → SP settlement bug (P1)

**Goal:** Accept-SP happy path on an SP-eligible item.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 4.1 | Choose LEGO `b3ab73b6` ($30, Accept-SP) — but check `buyer_trade_count=5` first | Prior buyer trades → idempotency-key reuse risk (learned from A01). | `mcp_supabase_execute_sql` | ✔ Flagged risk; proceeded (different SP amount → different hash) — worked. |
| 4.2 | ItemDetail: verify SP UI | A02 expects "Send offer/Use SP" two buttons. | list/grep | ⚠ **Only "Add to Cart" + "Request to Buy"** — SP selection happens inside the offer screen. Doc drift (finding). |
| 4.3 | Make Offer → SP text input (not a slider — doc drift); "Max: 15 SP (50%)" | SP entry is an input field. | list | ⚠ Doc drift: guide says slider. |
| 4.4 | Type 8 SP → verify breakdown ($22 + -8 SP + $1.49 + $2.10 = $25.59) | Confirm SP discount math. | type, OCR | ✔ 8 SP applied. |
| 4.5 | **Clamp check:** type 16 → field clamps to 15 (max). Then Cmd+A → retype 8 | "SP cap clamp verified." Long-press Select All failed (2 tries) → Cmd+A worked. | type, long-press ×2, run_in_terminal (Cmd+A) | ⚠ Field-clearing cost ~5 calls before Cmd+A worked. |
| 4.6 | Submit offer → disclaimer → **success** | — | clicks | ✔ Trade `d9e32360` (pending, 8 SP, cash 2200¢); wallet 46/10 → **38/18** (reserve worked). |
| 4.7 | Seller accepts (same native-alert pixel-scan pattern) | Seller leg. | login cycle, click, pixel-scan, SQL | ✔ in_progress at 11:24:11. |
| 4.8 | Buyer completes (I Got It → Confirm) → "You saved $8.00 using SP! You have 38 SP left." | Completion leg. | login cycle, click, swipe, screenshot | ✔ UI success. |
| 4.9 | **Verify SP settlement in DB** | "SP released to seller? buyer reserved→0?" | `mcp_supabase_execute_sql` (wallets, profiles, trades, sp_ledger) | ✖ **P1 discovered:** trade completed but `final_sp_amount=0`, `seller_sp_earned=0`, `sp_released_at`/`pending_sp_release_at` NULL, buyer still 18 reserved (8 stuck), no `sp_ledger` rows at all. |
| 4.10 | Check `pg_trigger` + read trigger/functions + migration history | Root-cause the missing settlement. | `mcp_supabase_execute_sql`, `read_file` (migrations, complete_trade_v2) | ✔ **Root cause confirmed:** migration `20260715000001` L316 `DROP FUNCTION ... fn_release_all_sp_on_complete() CASCADE` destroyed `trigger_release_all_sp_on_complete` (created by `20260528000003` L373–377); migration recreates the FUNCTION but **never the TRIGGER**. `complete_trade_v2` relies entirely on that trigger. Also `fn_transfer_sp_on_accept` requires `pending→payment_processing` (never fires in current flow). |
| 4.11 | Verify payout records exist (both completed trades) | Close the payout loop. | `mcp_supabase_execute_sql` | ✔ Payouts queued pending (A02 gross 1760¢ — noted as an oddity to check: 80% of cash 2200¢). |

**Phase outcome:** A02 = FAIL (UI flow works; SP settlement broken → P1). The P1 discovery was the single highest-value finding and came from disciplined DB verification after a UI-passing case.

---

### Phase P5 — B01 seller decline (SP refund path)

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 5.1 | Pick Harry Potter `fa44f753` ($35, 1 prior trade) for the decline case | 1 prior (completed, pre-idempotency-fix) → low collision risk. | `mcp_supabase_execute_sql` | ✔ |
| 5.2 | Buyer offers 8 SP → success → trade `2c1a5228` | Offer leg. | clicks | ✔ pending, 8 SP reserved. |
| 5.3 | Seller opens offer → Decline → confirm modal → Decline | Decline leg. | login cycle, clicks | ✔ "Offer Declined — buyer notified" alert. |
| 5.4 | Verify DB: trade cancelled `seller_declined`; `sp_released_at` set; item still available; buyer wallet refunded | Money/persistence side. | `mcp_supabase_execute_sql` | ✔ Refund worked: `earn_refund` +8 SP (30→38). |
| 5.5 | Check sp_ledger for the reserve | Ledger completeness. | `mcp_supabase_execute_sql` | ⚠ **P2 finding:** `earn_refund` logged on refund, but **no `spend_purchase` on reserve** — ledger is one-sided. |
| 5.6 | Buyer History → declined trade → verify "Declined — still available" + "View Item Again" | B01 UI assertion. | login cycle, list, clicks | ⚠ History shows only a generic row ("View trade details"); read `TradeListScreen` → confirmed `Your Offers` **excludes cancelled** (`o.status !== 'cancelled'` L497) while the "Expired — Item still available"/"View Item Again" card (L~1203) is **unreachable dead code** → **P2 finding**. |

**Phase outcome:** B01 = PASS w/ findings (refund correct; buyer-facing affordance dead code; ledger one-sided).

---

### Phase P6 — B04 buyer-cancel pending (the native-modal pixel-scan saga — #2 bottleneck)

**Goal:** Buyer cancels a pending offer → no consequence.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 6.1 | Submit a cash-only offer `92ffc12f` (fresh listing, no prior buyer trade) | Cash-only to avoid SP-refund noise; fresh to avoid idempotency collision. | clicks, SQL | ✔ pending. |
| 6.2 | Buyer Trades → Active → "YOUR OFFERS" card → View offer → timeline | Find the pending trade. | clicks, list | ✔ Timeline: "Awaiting Seller", Cancel trade button at (16,854,408,48). |
| 6.3 | Tap Cancel trade at (220,878) → **landed on Sell screen** | Tap overlapped the floating Sell FAB (192,848). | click, list | ✖ Mis-tap; navigated to Sell. |
| 6.4 | Re-open trade, tap Cancel at (50,878) → **landed on Home tab** | Tap hit Home tab (x 16–102). | click, list | ✖ Second mis-tap. |
| 6.5 | Re-open; tap Cancel at **far-left edge (x=40)** | "To avoid the FAB, tap the left edge of the cancel button." | click, list | ✔ Cancel-reason bottom sheet appeared — **native modal, NOT in AX tree** (tree nearly empty). |
| 6.6 | Pixel-scan the bottom sheet to find the reason rows + confirm button | Native modal → pixel-scan per §5.4. | pixel-scan region scans, OCR | ⚠ Multiple scans: first assumed green button; **discovered confirm is RED #ff6b6b (disabled #ffb3b3 pink)** by reading `CancellationReasonModal` source. |
| 6.7 | Tap "Changed mind" row; verify confirm turned red (enabled); tap Cancel Trade at right half (330,900) | Confirm via red-pixel presence before tapping. | pixel-scan, click | ✔ **"Trade Cancelled"** alert, no consequence text. |
| 6.8 | Verify DB: `92ffc12f` cancelled "Changed mind"; item available; `post_acceptance_cancellation_count=0`; no flag | Consequence check. | `mcp_supabase_execute_sql` | ✔ **B04 = PASS.** |

**Phase outcome:** B04 PASS, but the native-modal pixel-scan consumed ~8–9 tool calls and 2 mis-taps. **The cancel-reason modal not being in the AX tree is the #2 execution cost.**

---

### Phase P7 — B05 / B05a / B05b / B05d per-seller cap

**Goal:** Fill 3 pending with test-seller, verify cap blocks a 4th, per-seller independence, expiry frees a slot.

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 7.1 | Submit 3 offers to 3 different test-seller listings (deep-link each) | Reach cap precondition. | 3× (deep link, clicks, disclaimer) | ✔ 3 pending: `ec233d3b`, `54f84a4c`, `028f3250`. **Batched DB verification instead of OCR-per-offer** ("let me verify all offers at the end via DB" — time-saving pattern). |
| 7.2 | Submit offer to test-seller-2 (Science Kit) | B05a: per-seller independence. | clicks | ✔ `cb4493e8` pending with test-seller-2. B05a PASS. |
| 7.3 | Submit 4th offer to test-seller → **"Too Many Open Offers" alert** | B05b: cap enforcement. | clicks | ✔ Alert: "You have **many** pending offers with this seller. Cancel one to make a new offer." → copy deviation finding (guide: "3 pending"). No trade created; still 3 pending. |
| 7.4 | Fast-clock `ec233d3b` to expiry (`UPDATE trades SET offer_expires_at=now()+5s` + `rpc_process_expired_offers`) | B05d: expiry frees a slot (approved test step). | `mcp_supabase_execute_sql` | ⚠ First RPC returned `expired_offers_processed: 0` (raced the 5s) → reran → processed 1. |
| 7.5 | Verify `ec233d3b` cancelled "Offer expired"; pending with test-seller = 2; submit a new offer `f1daec51` | B05d completion. | SQL, deep link, clicks | ⚠ First submit was **blocked by a stale LogBox replay** of the B05b cap error → terminate+relaunch → resubmit → **`f1daec51` created (pending)**. B05d PASS. |
| 7.6 | Investigate why cap blocked the freed-slot offer (stale LogBox vs real) | Rule: confirm real vs stale before recording. | `mcp_supabase_execute_sql` (count pending) | ✔ DB showed 2 pending → the block was the stale LogBox replay, not a real cap failure. |
| 7.7 | Check `listing_offer_stats` / `fn_reserve_sp_on_offer` for the ignore-counter | B02/B05 ignore-prompt mechanism. | SQL + `read_file` | ⚠ **P2 finding:** `fn_reserve_sp_on_offer` first line `IF NEW.status <> 'pending' OR COALESCE(NEW.sp_amount,0) <= 0 THEN RETURN` → **cash-only offers never increment** `unanswered_offer_count` → seller-ignore prompt never fires for cash-only. Schema drift: registry says `consecutive_unanswered_offers_count`; column is `unanswered_offer_count`. |

**Phase outcome:** B05/B05a/B05b/B05d PASS (+ copy deviation + ignore-counter finding). Second LogBox-triggered relaunch this run.

---

### Phase P8 — B07 expired-trade timeline (buyer + seller)

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 8.1 | Buyer History → open expired `ec233d3b` | B07 buyer leg. | click | ✔ Timeline: **Cancelled / "Reason: Offer expired"**, Payment Details visible, **no Message / Report Problem / Cancel Trade** buttons. Screenshot 34. |
| 8.2 | Logout → login test-seller → History → open `ec233d3b` | B07 seller leg. | login cycle, click, list | ✔ Same Cancelled/"Offer expired"; Payment Details shows Platform Fee **-$4.00 on $20 (20%)** — flagged for dev (flow-registry implies 5%). No Message/Report/Cancel. |
| 8.3 | (Screenshot 35 skipped — seller leg captured via element tree; identical UI to buyer's 34) | Time pragmatism. | — | ⚠ Evidence gap (minor). |

**Phase outcome:** B07 = PASS (both legs). Seller-fee 20% flag.

---

### Phase P9 — B08 frozen chat after trade end

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 9.1 | Reuse existing conversation on cancelled `c3d0146f` (message from test-seller) instead of creating a new chat on an ended trade | "The quickest path... a conversation exists!" — reuse the P03 fixture. | SQL confirm | ✔ B08 precondition met with zero UI setup. |
| 9.2 | Login test-buyer → Messages (header chat) → open `c3d0146f` | Open the conversation. | login cycle, click | ✔ Conversations list shows the trade; open it. |
| 9.3 | Dismiss first-time **safety-education modal** (confirm) | First-chat gate. | click | ✔ |
| 9.4 | Verify frozen state: banner "This chat is no longer active. The trade has ended." + input placeholder "Chat is no longer active" (disabled) + View Trade link | B08 assertions. | list | ✔ **B08 = PASS.** Screenshot 36. |

**Phase outcome:** B08 PASS — done cheaply by reusing an existing conversation. **Pattern: mine existing fixtures before building new state.**

---

### Phase P10 — Blocked/skipped triage (no UI execution)

| Case | Decision | Reasoning | Outcome |
|---|---|---|---|
| B05e | BLOCKED | `test-seller-3` does not exist (verified by SQL) — setup gap. | BLOCKED |
| B05f/g/h | SKIPPED | Admin-portal cap change — no mobile-mcp equivalent; Playwright path; requires `admin_config` write (out of scope for execution agent). | SKIPPED |
| B05i | BLOCKED | No QA toggle for config-fetch failure; would require shared-staging mutation. | BLOCKED |
| B05j | BLOCKED | Requires `admin_config` cap=5 write + admin portal verification. | BLOCKED |
| B06 | BLOCKED | Stripe test-mode PaymentSheet validates cards at entry — declining cards rejected before a hold can be attempted (guide's own note + explicit instruction). | BLOCKED |
| B03 | SKIPPED | Multi-persona (3 buyers on one listing) — high setup cost; recommend dedicated batch. | SKIPPED |
| B05c | SKIPPED | Bundle-as-1-slot requires a cart/bundle checkout with a free slot (cap full at 3); dedup-by-`bundle_id` verified in source. | SKIPPED |

**Phase outcome:** 4 BLOCKED / 5 SKIPPED, each with an explicit, evidence-backed reason.

---

### Phase P11 — Report + handoff

| # | Decision | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 11.1 | Write `report.md` in the TEST-COVERAGE-INVENTORY verdict-table format + priority findings + §8.3 handoff block | Deliverable per task + playbook. | `create_file` | ✔ |
| 11.2 | Update session memory with verdicts + operational notes (safety modal, screenshot gaps, seller-fee flag) | Preserve knowledge for next session. | `memory` | ✔ |
| 11.3 | Emit full §8.3 handoff verbatim in the chat reply | Playbook §8.4: handoff must appear in chat, not file-only. | — | ✔ |

**Phase outcome:** Deliverables complete.

---

## 3. Raw tool-call inventory (667 tool executions)

| Tool | Count | Dominant use | Efficiency signal |
|---|---|---|---|
| `mcp_mobile-*_click_on_screen_at_coordinates` | 149 | Every tap on the device | 2 mis-taps into wrong tabs (P6); a few no-ops on stale coords |
| `mcp_mobile-*_list_elements_on_screen` | 138 | The primary "what's on screen" oracle; re-list discipline after every keyboard change | Very reliable for React screens; **returns empty/stale for native modals** (the big gap) |
| `run_in_terminal` | 126 | Cmd+K keyboard-hide, Cmd+A select-all, `simctl openurl` deep links/logout, JSONL analysis | Keyboard keystrokes dominate this bucket (~60+ Cmd+K) |
| `mcp_supabase_execute_sql` | 80 | Every DB verification (trades, wallets, ledger, triggers, config, payouts) | The reason financial findings are trusted; 1–2 retries on schema guesses |
| `read_file` | 39 | Playbook, guide, source code (edge function, triggers, screens), resource files | Root-cause confirmation almost always required a source read |
| `mcp_mobile-*_save_screenshot` | 36 | Evidence capture | 1 numbering gap (B07 seller) |
| `grep_search` | 30 | Guide sections, source anchors, resource files | Intermittent failure on large single-line resource files → fallback to read_file/OCR |
| `mcp_mobile-*_type_keys` | 23 | Text entry (emails, passwords, SP amounts) | 1–2 misses on the SP field clearing |
| `mcp_mobile-*_swipe_on_screen` | 16 | Scrolling (Send Offer below fold, confirm button at y=1823) | 2 cases needed 2–3 swipes |
| `memory` | 7 | Load repo memory; update session memory | — |
| `manage_todo_list` | 4 | Progress tracking | — |
| `view_image` | 3 | Tried to inspect screenshots | **Useless** (returns URI, not pixels) — all visual checks routed to OCR/pixel-scan |
| `mcp_mobile-*_terminate_app` / `launch_app` | 2/2 | LogBox recovery (2 forced relaunches) | Each costs ~5–10s + re-poll |
| `mcp_mobile-*_long_press` | 2 | Tried Select All on SP field | Failed both times → Cmd+A |
| `create_file` / `create_directory` | 1/1 | Report | — |

---

## 4. Friction events timeline (what actually cost time)

| # | Event | Cost | Where |
|---|---|---|---|
| F1 | **Stripe idempotency collision** on A01 first listing | High — one blocked offer, one LogBox replay, one app relaunch, ~15 extra calls, plus a listing switch | P2 |
| F2 | **Native cancel-reason modal not in AX tree** (B04) | High — ~8–9 pixel-scan/OCR iterations, 2 mis-taps, source-read to learn red/pink button colors | P6 |
| F3 | **Native accept/OK alerts not in AX tree** (A01/A02 seller accept) | Medium — ~4–5 pixel-scans each to find the green OK band | P3/P4 |
| F4 | **Keyboard show/hide cycle** (Cmd+K before every submit, verify via re-list) | Medium, recurring — ~60 Cmd+K calls + a re-list each time | All phases |
| F5 | **LogBox stale replay** (2nd occurrence, freed-slot offer) | Medium — blocked tap, terminate+relaunch, resubmit | P7 |
| F6 | **SP field clearing** (long-press Select All failed) | Medium — ~5 calls before Cmd+A discovered | P4 |
| F7 | **Below-fold confirm button** (y=1823) | Medium — 2–3 swipes per timeline | P3/P4 |
| F8 | **AX-coordinate unreliability with keyboard up** → mandatory OCR/pixel verification | Medium, recurring | P2/P4 |
| F9 | **Large element-tree truncation** → resource-file grep fallback loop | Low-Medium | P2/P7 |
| F10 | **Fixture gaps** (test-seller-3 missing; NULL-node items) | Low for A/B (deep links), High for coverage (B05e BLOCKED) | P1/P10 |

---

## 5. (a) What slows execution — bottleneck analysis (ranked)

**B1 — Native modals are invisible to the accessibility tree (F2, F3).**
Every alert and bottom sheet that renders through `ui/Modal` or a native path produced an empty or near-empty element tree. The agent had to fall back to OCR + color-pixel scanning, and in B04 had to read the component source to learn that the confirm button is red (`#ff6b6b`), not primary green — after assuming green. **This is the largest avoidable cost** after the app bugs themselves. Fixing this (testIDs/AX exposure) removes ~15–20% of total tool calls.

**B2 — Stripe idempotency collision + LogBox replay (F1, F5).**
Two genuinely broken behaviors in the app forced blocked offers, stale-error scrims, app relaunches, and listing switching. This is an app defect (dev fix), but the QA-side lesson is: *fresh listings per offer case* and *relaunch after LogBox* are required preconditions that should be encoded in the playbook so they aren't rediscovered mid-run.

**B3 — Keyboard show/hide + coordinate discipline (F4, F8).**
The hard gate (never tap AX coords while the keyboard is up) is correct but expensive: ~60 Cmd+K keystrokes + a re-list after each. A device-level "dismiss keyboard" affordance/testID would collapse this to one tap.

**B4 — Below-fold CTAs (F7).**
The confirm-trade button at y≈1823 and the Send Offer button hidden under the tab bar forced 2–3 swipes per timeline. Instrumentation: expose stable testIDs and/or make CTA screens scrollable-to-action with one swipe.

**B5 — Element-tree truncation + non-readable screenshot tool (F9, §3).**
Large trees get truncated and written to resource files where grep intermittently fails; `view_image` returns a URI the agent can't read. This forced a three-hop fallback (grep → read_file → OCR/pixel). Instrumentation: paginate/truncate-with-anchor large trees; make screenshot inspection actually return pixels.

**B6 — Fixture scarcity (F10).**
Only 2 of test-seller's items are in the buyer's node (rest NULL-node → deep-link-only); `test-seller-3` missing → B05e BLOCKED; prior trades on listings cause idempotency-key reuse → many listings unusable for repeat offers. Fixture work removes both navigation cost and coverage gaps.

**B7 — Multi-persona login cycles.**
12+ login cycles (buyer/seller/seller-2), each ~8–12 tool calls even when "well-rehearsed". Instrumentation: a fast account-switch helper (or maintain two signed-in simulators / use the `qa-logout` + credential autofill) would cut this substantially.

**B8 — Sub-case batching gap.**
The run hit its budget before B03/B05c (heavy multi-persona/cart setups). This is a *scope* cost, not a technique cost, but it highlights that Group B's medium-heavy cases need their own batch.

---

## 6. (b) Patterns an agent should adopt proactively

**P1 — Load canonicals + repo memory first; distrust inline annotations.** Confirmed the master tracker showed all 20 as NEVER RUN before executing anything — validated the user's "stale inline passes" warning up front.

**P2 — Schema-first SQL.** On a schema error (e.g. `display_name`, `item_id`), stop and inspect the actual schema before retrying; never guess column names. Cost: one retry each, never a cascade.

**P3 — Find navigation escape hatches early.** Deep links (`/listing/:id`, `qa-logout`) discovered during recon became the standard tool for NULL-node items and persona switches. Search for deep-link routes in the first 15 minutes, not the 30th.

**P4 — Terminate+relaunch after any LogBox.** The session persists; a clean relaunch is faster and more reliable than trying to dismiss the scrim. Encode as reflexive behavior.

**P5 — Use OCR/pixel-scan as ground truth when the AX tree is empty or stale.** Never blind-retry a tap on an empty tree; screenshot+OCR first, pixel-scan for the colored button band (know the palette: green primary, red destructive, pink disabled).

**P6 — Confirm root causes in source before recording findings.** Every major finding (idempotency key, missing trigger, dead code, SP-only counter) was proven by reading the Edge Function / trigger / migration / screen source — not inferred from a single symptom. This is what made the P1 discovery credible.

**P7 — Verify money/SP in the DB, not the UI.** The UI said "You saved $8 / You have 38 SP" while the DB proved SP settlement was broken. UI success ≠ persistence success. Always close the loop with SQL for financial cases.

**P8 — Batch DB verification.** Instead of OCR-verifying each of 3–4 offers, submit the batch and verify all at once via one SQL query. Big time-saver in P7.

**P9 — Reuse existing fixtures before building new state.** B08 was done nearly free by reusing the existing conversation on cancelled `c3d0146f`. B03/B05c would have benefited from the same mindset (check what already exists).

**P10 — Track a running friction list.** The session memory captured keyboard technique, Cmd+A trick, modal colors, screenshot gaps, and the seller-fee flag — so the next session starts from the discovered facts, not from scratch.

**P11 — Classify bug vs fixture vs environment immediately.** Every blocked/skipped case got an explicit reason (missing fixture / admin scope / no QA toggle / Stripe validation). This keeps verdicts honest and actionable.

**P12 — Fast-clock expiry via documented test steps.** Using the approved `UPDATE offer_expires_at` + RPC avoided a 48h wait — and the first `0 processed` was correctly diagnosed as a race, not a bug.

---

## 7. (c) Instrumentation / fixture work to remove the friction (ranked)

**Ranking = friction removed × breadth ÷ cost.**

1. **Expose native modals/alerts in the AX tree or add stable `testID`s** (accept-alert OK, cancel-reason bottom sheet + its reason rows, decline/complete confirms). Removes B1 — the largest avoidable cost. *Dev + test-infra.*
2. **Fix the P1 SP-settlement trigger** (re-create `trigger_release_all_sp_on_complete`) + reconcile stuck trades. Not test-infra, but it unblocks every future SP completion case and removes the misleading-UI-vs-DB class of failure. *Dev.*
3. **Fix the Stripe idempotency key** (per-submission nonce / trade UUID) and/or **seed each case's listing as "fresh, no prior buyer trade"**. Removes B2's root cause and the LogBox replay trigger. *Dev + fixture.*
4. **Add `test-seller-3` fixture** (user + profile + 1–2 available listings, in-node). Unblocks B05e/B05j. *Fixture.*
5. **Add a "dismiss keyboard" affordance/testID** (or a device-level API) so Cmd+K is unnecessary. Removes ~60 terminal calls. *Test-infra.*
6. **Assign fixtures to test-buyer's node** (or add an in-node "QA item pool") so most items are reachable without deep links. *Fixture.*
7. **Add a QA toggle to bypass Stripe PaymentSheet card validation** (force a payment-hold failure on a known card). Unblocks B06. *Dev/QA infra.*
8. **Add a QA toggle / mock for `admin_config` fetch failure.** Unblocks B05i. *Dev/QA infra.*
9. **Add a safe `admin_config` write helper / QA command** (set cap, restore) so B05f/g/h/j can be exercised from the suite without a human admin. *Dev/QA infra.*
10. **Seed a canned conversation on a cancelled trade** as a first-class B08 fixture (it exists ad hoc via `c3d0146f`; make it a named seed). *Fixture.*
11. **Improve large-tree handling**: anchor/truncate element dumps so grep works; make screenshot inspection return readable pixels (fix `view_image` equivalent). *Tooling.*
12. **Pending-trade state hygiene**: a cleanup/cancel-all-pending seed so each batch starts with empty pending slots (the cap=3 precondition is stateful and easy to corrupt across runs). *Fixture.*
13. **Scroll-into-view on the confirm-trade CTA** (or move it above the fold / above the tab bar) to remove the 2–3 swipe cycles. *Dev (low priority UX/infra).*

---

## 8. Evidence register

- **Report:** `e2e-test-results/qa-trd-group-a-b-2026-08-28/report.md` (verdicts + priority findings + handoff).
- **Screenshots:** `e2e-test-results/qa-trd-group-a-b-2026-08-28/screenshots/` `00–36*.png` (36 files; #35 intentionally skipped).
- **DB artifacts (staging `drntwgporzabmxdqykrp`):** trades `bc83a763` (completed), `d9e32360` (completed, SP-settlement fail), `2c1a5228` (cancelled/seller_declined), `92ffc12f` (cancelled/Changed mind), `ec233d3b` (cancelled/expired), `54f84a4c`, `028f3250`, `f1daec51`, `cb4493e8` (pending). Buyer wallet 38 avail/18 reserved (**8 SP stuck** from A02).
- **Source anchors:** `create-trade-offer/index.ts` idempotency key (~L884); `complete_trade_v2` "SP is handled by fn_release_all_sp_on_complete() trigger"; migration `20260715000001` L316 (CASCADE drop, trigger never recreated); `20260528000003` L373–377 (trigger creation); `TradeListScreen.tsx` L497 (excludes cancelled) + L~1203 (dead "View Item Again"); `CancellationReasonModal.tsx` (red `#ff6b6b` confirm); `fn_reserve_sp_on_offer` (early-return for cash-only, SP-only counter); `TradeOfferScreen.tsx` (SP text input, clamp).
- **Transcript source for this log:** VS Code chat session transcript `773e5b0a-ade4-40f1-9d70-624b842063f7.jsonl` (667 tool executions, 606 assistant turns).

---

## Appendix — quick triage map for a follow-up agent

| If you need to… | Do this first |
|---|---|
| Verify SP settlement on a completed SP trade | `SELECT * FROM pg_trigger WHERE tgname LIKE '%sp%'` then check `sp_ledger`, `wallets`, `profiles.pending_balance` |
| Test a cap case | Check `admin_config.max_pending_offers_per_seller`; count pending by buyer/seller; keep ≤2 pending before the case |
| Reach a NULL-node item | `xcrun simctl openurl booted "p2pkidsmarketplace://listing/<id>"` while app is warm/clean |
| Recover from LogBox | `terminate_app` + `launch_app` (session persists); then re-list |
| Find a button on a native modal | OCR the frame → pixel-scan for green `#5DBB8E` / red `#ff6b6b` / pink `#ffb3b3` bands → tap band center |
| Clear the SP input | `Cmd+A` (osascript) then retype (long-press Select All does not work) |
| Switch persona | `xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"` then login |
| Prepare B08 | Reuse conversation on cancelled `c3d0146f`; expect the first-chat safety modal |
