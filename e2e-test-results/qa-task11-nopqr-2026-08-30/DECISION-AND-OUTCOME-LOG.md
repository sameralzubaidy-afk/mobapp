# QA Task 11 — Decision & Outcome Log (execution-agent post-mortem)

**Purpose:** Feed this log to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — every key action, the reasoning behind it, the tool calls that mattered, and the outcome — and derive: (a) what slows execution, (b) which patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction so future (smaller) runs don't spend the same time and calls.

**Run:** QA Task 11 — Groups N, O, P, Q, R (Rev 3) · 2026-08-30 · iPhone 17 Pro Max sim (`3F3293A3-…-4A0E`) · staging `drntwgporzabmxdqykrp` · 52 evidence screenshots
**Result:** 27 PASS / 2 FAIL / 2 BLOCKED / 6 PARTIAL / 11 OUT-OF-SCOPE / 9 DEFERRED / 1 RESOLVED — 37 executed with evidence-backed verdicts.

---

## 0. Tool-call profile (raw numbers from the session transcript)

| Operation | Count | Why it dominates |
|---|---|---|
| `run_in_terminal` | **471** | Deep links (`xcrun simctl openurl`), OCR (`qa:ocr`), config (`qa:admin-config-set`), greps, source reads |
| `mobile_list_elements_on_screen` | **319** | The mandatory pre-tap resolution primitive (playbook §5.1) — called before EVERY interaction |
| `mobile_click_on_screen_at_coordinates` | 219 | The tap primitive |
| `mobile_save_screenshot` | 105 | Evidence capture |
| `mcp_supabase_execute_sql` | 125 | Money/state DB read-backs (mandatory closure) + schema discovery |
| `grep_search/read_file/file_search` | 131 | Source-confirmation, guide lookup |
| `mobile_swipe_on_screen` | 77 | Scroll-to-clear CTA bands, reach content |
| `mobile_type_keys` | 19 | Manual text entry (price, comment) |
| `mobile_take_screenshot` | 8 | |
| `mobile_launch_app` / `mobile_terminate_app` | 3 / 3 | |

**Read:** element-list + click + swipe are the core loop (~615 calls). `run_in_terminal` is a hidden second leg (deep links + OCR + config + source). SQL is the closure loop. Everything else is context-gathering.

---

## 1. Per-phase decision trace (key actions → reasoning → calls that mattered → outcome)

### Phase 0 — Setup (env, memory, guides)
- **Actions:** Read the operating playbook, repo memories (`qa-test-accounts.md`, `locator-conventions.md`, `simulator-keyboard-suppression.md`), canonical guides for N/O/P/Q/R; ran R29 busy check; confirmed simulator booted + app installed.
- **Reasoning:** Single-source-of-truth discipline — never invent locators or steps; resolve personas before creating accounts; don't touch the simulator if another agent task is driving it.
- **Outcome:** Clean, fast start. The price-field rule was NOT yet in memory — that gap cost the whole N04 discovery loop below.

### Phase 1 — Group N (minimum listing price) — the price-field bottleneck
- **Key discovery (≈20–25 calls burned):** On `ItemCreateScreen`, the dev buttons `dev-fill-item` / `dev-set-price` are rendered at **tree-logical y≈803/866 — behind the sticky "Submit for Review" footer (y≈842–894)**. Taps at their AX-tree centers silently hit Submit. The agent spent: 6× element-list, 4× region-OCR, 5× swipe, 2× source-read trying different offsets before realizing the *footer band overlap* (not a coordinate-scaling issue).
- **The fix that worked:** swipe content up **~77–100pt** so `dev-set-price` clears the footer (verified: `dev-fill-item` at y≈726/747, `dev-set-price` at y≈789/810), then tap. All subsequent N cases used this and were fast (N09/N10/N11 ≈ 6–8 calls each).
- **N11 locator gap:** pencil icon has no AX/testID. **Discovery that saved the edit leg:** deep link `p2pkidsmarketplace://edit-listing?listing_id=<id>` loads the edit screen directly — no need to fight the un-instrumented My Listings action row.
- **N05/N13/N14 bulk (≈25–30 calls burned, BLOCKED):** the bulk per-item form needs title/condition/price per row; the ScrollView "binary-snaps" between states and publish is gated until all rows complete — the agent could not reliably land the per-item inputs. **Decision:** stop fighting the form; **source-confirm the publish gate + StatusChip** (`price_below_minimum` → "Price must be $5.00+") and mark BLOCKED (driving-limited) with a fixture recommendation. This is the single most valuable "know when to stop" decision of the run — it avoided an open-ended fight.
- **Outcome:** N04/N09/N10/N11/N12 ✅, N05/N13 🚫 BLOCKED, N14 ⚠️ PARTIAL, N06 ⛔ out-of-scope.

### Phase 2 — Rev 3 (IssueReportModal AX re-verify)
- **Context:** A prior task (DT-67) saw a *partial/empty* AX capture of the IssueReportModal reason rows and suspected an app regression.
- **Actions:** Built a disposable in_progress trade (buyer offer $18 → seller accept), opened the issue modal on 2 different listings, and captured the AX tree **in a fresh session**.
- **Outcome:** **All 5 reason rows + submit + cancel surfaced, stable across 2 listings → RESOLVED as a capture-reliability artifact, NOT an app regression.** The modal *container* not surfacing was accepted as a platform limitation (per instructions, not re-flagged).
- **Pattern to adopt:** *"Before flagging an AX regression from a prior run, re-verify in a fresh session — partial captures are often tooling artifacts."* This prevented a false bug report.

### Phase 3 — Group O (tax engine) — the bug hunt + doc-drift trap
- **O03 bug hunt (≈15 calls):** Set `sales_tax_enabled=false` via `qa:admin-config-set` → rebuilt a $30 offer → **Sales Tax STILL $2.10** → relaunched app → still there → read `src/services/tax.ts` → found `calculate_tax` **selects the flag but never conditions on it** (write path ignores it too). **Confirmed real bug; reverted the flag (read-back).**
- **Doc-drift discovery (≈8 calls):** The guide says node rate 6.35%/$1.91 on $30, but live offers show **$2.10 = 6.99%** — the tax engine uses **category tax RULES** (`general_tangible_goods` v3 `bc94b4e0`), which **override** the node rate. **All O-group assertions were re-based to the live rule rate (R25/R36), and P01/P08 conclusions followed** (node-rate edits don't propagate).
- **Outcome:** O01/O02/O05/O06/O08 + O2/O3 ✅, O03 ❌ FAIL (real bug), O04/O1 ⚠️, O07 ⏭️ deferred. P04 ❌ FAIL (same O03 root cause).
- **Pattern to adopt:** *"When a config toggle seemingly has no effect, verify (1) the value actually persisted (read-back), (2) the app actually re-reads it (relaunch), (3) the source actually conditions on it — in that order. Don't stop at 'it didn't work.'"*

### Phase 4 — Group Q (reviews) — the value of reusable state
- **Actions:** All 9 PASS cases were executed **off the single completed trade `6cbe3c5d`** built back in Phase 2 — one completed trade powered the whole Q group (rate prompt, rating-required alert, char-count, anonymous, mutual status, profile aggregation, breakdown, no-duplicate).
- **Outcome:** ~35–40 calls for 9 cases — very efficient because the state was reused.
- **Pattern to adopt:** *"Batch by persona/state — build ONE reusable fixture (a completed trade) and drive as many cases as possible off it before creating new state."*

### Phase 5 — Group R (refund/cancellation state machine)
- **R01 (buyer-cancel pending):** Built a pending trade, cancelled with reason, DB read-back (status cancelled, listing restored, auth released). Clean.
- **R04 (card declined):** `card_decline` toggle via `qa-dev-toggle` deep link → offer → "Payment Hold Failed" alert → DB: no trade. **Note:** this toggle is client-side → disarm by logout.
- **R05 (seller-cancel in_progress) + R06/R08:** Built a NEW trade → seller accept (in_progress) → seller cancel → DB: **no `seller_payouts` row (R08 ✅), `tax_records.tax_status='voided'` (R06 ⚠️), synthetic `stripe_refund_id='cancelled_pi_...'`** → staging-capture-is-simulated finding. One trade closed R05/R06/R08.
- **R02/R03:** Created **two fresh pending offers in one buyer login session**, then handled both as seller: R02 = decline (confirm modal), R03 = fast-clock `UPDATE offer_expires_at=now()-'1 second'` → `rpc_process_expired_offers()` → auto-cancel + both-party notifications. Efficient reuse of one login session.
- **Outcome:** R01/R02/R03/R04/R05/R08 ✅, R06/R07 ⚠️ (staging-void / SP leg not exercised), R09 ⛔ out-of-scope.

### Phase 6 — Cleanup + report + tracker
- **Actions:** Reverted `min_listing_price` 5→0 **and caught that the config helper defaulted category/type to `feature_flags`/`string` — re-issued with `--category fees --data-type number` to restore the original metadata**. Soft-deleted fixture item `755e1774` (owner-gated, `status='deleted'`, read-back). Final logout to Landing (cleared client-side toggles). Wrote `report.md`, updated 57 tracker rows.
- **Outcome:** Zero-residue state; tracker reflects real verdicts.

---

## 2. Bottleneck deep-dives (what actually took time and calls)

### B1 ⭐ PRICE FIELD — the #1 recurring cost (user-flagged)
**The problem:** Every price-related test case (N04/N09/N10/N11, and any case needing a custom price) burned extra calls because the agent had to *rediscover*:
1. that `dev-price-input` (ItemCreate, default "3") / `price-input` (offer) / `edit-listing-price-input` (edit) are the field testIDs;
2. that `dev-fill-item`/`dev-set-price` sit **behind the sticky Submit footer** at top-scroll, so taps at AX-tree coordinates silently hit Submit;
3. that manual price entry requires **Cmd+A select-all + retype** (the default "3" or existing value must be replaced) and the value must be **re-verified in the AX tree** before proceeding (R2);
4. that `items.price` is **numeric dollars, NOT price_cents** — a schema trap for DB read-backs.

**Calls burned:** ~20–25 on the initial discovery (N04); ~5–7 per subsequent price edit before the pattern locked in; ~3 once the pattern was internalized.
**Fix → standing rule (see §5, RULE-PRICE-1).** With the rule: **~3 calls per price interaction** (deep link → scroll-to-clear → tap dev button/type → AX-verify) and zero rediscovery.

### B2 Bulk per-item form driving (N05/N13/N14)
**The problem:** The bulk listing per-item form (title/condition/price per row) is not reliably drivable: ScrollView binary-snapping between states, publish gated until all rows complete, no bulk-fill fixture. The agent burned ~25–30 calls across three attempts before **deciding to stop and source-confirm instead** (BLOCKED, driving-limited).
**Calls burned:** ~25–30 for zero verdict value (the source-confirm produced the assertion, not the UI drive).
**Fix → fixture `dev-fill-bulk-items` (see §6).** With it: ~5 calls.

### B3 Native alerts are AX-suppressed
**The problem:** "Offer Accepted!", "Offer Declined", "Trade Cancelled" render as **native iOS alerts that blank the app AX tree** (only the status bar shows). The agent had to: list (empty) → save screenshot → `qa:ocr` → estimate the OK button position → tap → verify.
**Calls burned:** ~4–5 per alert.
**Fix → known pattern:** alerts are centered ≈ y530 (iPhone 17 Pro Max); OCR-first; treat an empty tree as a native-alert signal, not a hang. ~2 calls.

### B4 CTA-overlaps-tab-bar (R22/R31)
**The problem:** Send Offer / other CTAs land in the tab-bar band (y≈848–904). Every offer flow needed list → detect overlap → swipe up → re-list → tap (~3 calls each). This repeated ~7 times (every trade build).
**Fix → proactive:** swipe-up before touching any CTA at y>800 in a scrollable screen; only then list+tap. ~1 call.

### B5 FlatList logical-vs-rendered coordinates (My Listings)
**The problem:** FlatList AX coordinates are **logical (scroll offset ~274pt), not rendered** — tapping a "first card" by tree coords hit the wrong row. Discovered once (N11); cost ~6 calls.
**Fix → rule:** never tap a FlatList row by tree coords; OCR/pixel-verify first, or deep-link to the target screen (e.g., `edit-listing`).

### B6 Tax-engine doc drift (rule vs node rate)
**The problem:** The guide's 6.35%/$1.91 figures are stale — the live engine uses category tax RULES (6.99%). This misled early O-group expectations and only surfaced via O03's "why is tax still $2.10?" investigation.
**Calls burned:** ~8 to discover; every future O/P case would re-hit it without a doc fix.
**Fix → doc + memory:** update the guide figures + record "rule overrides node rate" as a standing fact.

### B7 Schema column guessing (SQL friction)
**The problem:** Column names drifted from assumptions (`offer_accepted_at`, `stripe_payment_intent_status`, `amount_cents` on `seller_payouts`/`trade_refunds`). Each wrong guess cost 1–2 failed queries before falling back to `SELECT *`.
**Calls burned:** ~1–3 per table; ~10 total.
**Fix → schema cheat-sheet** in repo memory (items.price numeric dollars, trades uses listing_id, tax_records.tax_rate, tax_status, etc.).

### B8 Deep-link navigation overhead
**The problem:** `xcrun simctl openurl` (in `run_in_terminal`) + a landing/transition is the standard navigation. It's reliable but each hop is a terminal call + a list. Logging in/out between personas added ~3–4 calls per switch.
**Calls burned:** ~8–10 per persona switch (deep link + list + wait + verify).
**Fix → pattern:** batch all buyer work, then all seller work, in as few persona switches as possible (done in Phase 5: 2 offers in 1 buyer login → 2 cases as seller).

---

## 3. (a) What slows execution — ranked

1. **Rediscovering locators/layout per screen** — the price field, the footer overlap, FlatList coordinate drift. Mitigated by standing rules + memory.
2. **Fighting un-drivable UI** — bulk per-item form (25–30 calls, zero verdict). The "know when to stop and source-confirm" decision is the highest-leverage skill.
3. **Native-alert/OCR detours** — every AX-suppressed alert costs a screenshot+OCR+estimate cycle.
4. **Config toggle experiments that "do nothing"** — O03 burned 15 calls because the flag genuinely doesn't work; the investigation order (persist → re-read → source-condition) shortens this.
5. **Doc drift** (tax rule vs node rate) — misleads assertions before a finding is made.
6. **Persona switching** — each switch is ~8–10 calls; not batching is the cost.
7. **Schema guessing** — failed column names cost redundant queries.

## 4. (b) Patterns an agent should adopt proactively

1. **Write friction to session memory as you discover it (R16)** — this run's `friction/facts log` made later groups fast because the lessons were already codified.
2. **Cache locator facts in repo memory** (the standing RULE-PRICE-1 etc.) — the difference between "20 calls to find the price field" and "3 calls."
3. **Scroll-then-tap for any CTA near a bottom band** — never tap tree coords at y>800 in a scrollable screen without scrolling first (R22/R31).
4. **Deep-link to a target screen instead of fighting un-instrumented nav** (`edit-listing`, `listing/<id>`, `my-listings`, `qa-login-as`).
5. **When a config toggle "does nothing": persist → relaunch → read source — in that order**; don't burn 6 offers re-testing.
6. **Before flagging an AX regression from a prior run, re-verify in a fresh session** (Rev 3 → RESOLVED, avoided a false bug).
7. **Batch by persona/state** — one reusable fixture (a completed trade) powered 9+ cases; two offers created in one login powered two R cases.
8. **Source-confirm then stop** — for un-drivable UI, read the component to assert the logic and mark BLOCKED with a fixture recommendation; never grind on the UI.
9. **Assert against live values, not guide numbers** — always re-derive the expected rate/amount from the DB/config before asserting (R25/R36).
10. **Cleanup as you go + read-back every revert** — zero-residue was achieved because reverts were verified and metadata was preserved.

## 5. (c) Instrumentation / fixture work that removes the friction

| # | Work | Removes | Est. call savings per run |
|---|---|---|---|
| 1 | **Standing RULE-PRICE-1** (below) codified in repo memory | price-field rediscovery | ~15–20 calls/run |
| 2 | **`dev-fill-bulk-items`** fixture on `BulkListingCreateScreen` (fills title/condition/price for all rows) | N05/N13/N14 block | ~25–30 calls + unblocks 3 cases |
| 3 | **testID on My Listings action icons** (pencil/trash/dots, currently AX-invisible) | N11/N14 locator gap | ~6 calls + removes workaround |
| 4 | **Native-alert known pattern** (centered ≈y530, OCR-first) documented in playbook | every AX-suppressed alert | ~2–3 calls/alert |
| 5 | **Schema cheat-sheet** in repo memory (items.price dollars, trades.listing_id, tax_records columns, etc.) | failed-column queries | ~10 calls/run |
| 6 | **Tax guide update** (6.99% rule rate + rule-over-node precedence) | doc-drift mis-assertions | ~8 calls + fewer false failures |
| 7 | **`dev-set-price` deep-link** (e.g. `create-item?price=NN`) to jump straight to a target price | per-edit scroll+type | ~3 calls/price edit |
| 8 | **Fixed disclaimer-footer** on offer sheet (or documented always-in-view) | scroll-to-accept each offer | ~2 calls/offer |

## 6. ⭐ The price-field standing rule (RULE-PRICE-1) — codify for every future run

> **RULE-PRICE-1 — Price field standard procedure (never rediscover this):**
> 1. **Field testIDs:** ItemCreate = `dev-price-input` (default `"3"`); Offer = `price-input`; Edit listing = `edit-listing-price-input`. Use the dev fixtures whenever possible — don't type by hand.
> 2. **Dev-button footer overlap:** on `ItemCreateScreen`, `dev-fill-item` and `dev-set-price` sit at tree-logical y≈803/866 — **behind the sticky "Submit for Review" footer (band y≈842–894) at top-scroll. NEVER tap them by tree coords at top-scroll — the tap hits Submit.** Always **swipe content up ~77–100pt first** (verified targets: `dev-fill-item` y≈726/747, `dev-set-price` y≈789/810), then tap.
> 3. **Setting a price value:** prefer `dev-fill-item` (sets price=20 + title + condition). Use `dev-set-price` for threshold cases (sets `"3"`). Only type into `dev-price-input` when a custom price is required: tap it, **Cmd+A (osascript select-all) + retype** (default/existing value must be replaced), then **re-verify the value in the AX tree (R2) before proceeding**.
> 4. **DB read-back:** `items.price` is **numeric dollars, NOT price_cents**. After any price flow, close with a DB read-back (`items.price`) — never trust UI alone (R37).
> 5. **Edit flow:** reach the edit screen via deep link `p2pkidsmarketplace://edit-listing?listing_id=<id>` (the My Listings pencil icon has no AX/testID).

This rule is also persisted to repo memory (`/memories/repo/locator-conventions.md` → "Price field (RULE-PRICE-1)") so it survives across sessions.

## 7. What the next (smaller) run should look like

- **Price-needing cases:** ~3 calls each (deep link → scroll-to-clear → dev button/AX-verify), zero rediscovery.
- **Bulk cases:** unblocked by `dev-fill-bulk-items` (or, until then, source-confirm + BLOCKED in ~5 calls).
- **Offer flows:** swipe-up-then-tap pattern + disclaimer fast-path (R30) + native-alert pattern ⇒ ~6 calls per offer build instead of ~12.
- **Persona switches:** batch by persona; ~2 switches per group instead of per case.
- **Tax assertions:** use live rule rate 6.99% from memory, no discovery.
- **Cleanup:** helper calls only; revert + read-back each; metadata preserved (fees/number).

**Projected call savings vs. this run: roughly 30–40% fewer tool calls on an equivalent workload — and the BLOCKED bulk cases become executable.**
