# QA Task 5 — TRD Groups F–K (39 Cases) — Execution Report

**Date:** 2026-08-29
**Agent:** QA Test Agent (execution-only; no code fixes applied)
**Canonical guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (sections F–K)
**Simulator:** iPhone 17 Pro Max (iOS 26.1), UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, app "Pass It Up!" (com.sameralzubaidi.p2pmarketplace)
**Backend:** Staging Supabase `drntwgporzabmxdqykrp` · Admin portal `http://localhost:3001`
**Evidence:** `e2e-test-results/qa-task5-trd-f-k-2026-08-29/screenshots/` (26 files)
**Scope note:** All inline "passed" annotations in the guide were treated as STALE (never run in the master tracker); every case was executed fresh.

---

## 1. Verdict Summary

| Group | TC | Verdict | Key evidence / notes |
|---|---|---|---|
| F | F01 | **PASS** | Pending payouts shown in Payout Settings (Available $15,111 / Pending), history entries with fees, no duplicates |
| F | F02 | **PASS (with P1 money finding)** | Dispute `28a41289` opened → payout held; admin "Resolve → Complete" → trade completed, dispute resolved. **Finding:** admin resolve leaves `payout_amount_cents` NULL → payout EF processed **$0** |
| F | F03 | **PASS** | No-method seller: `initiate-payout` → `NO_CONNECT_ACCOUNT` → `seller_payouts` row `requires_action` ($18.00) + notification "Add a payout method to receive your $18.00" + deep-link `/payout-settings` |
| G | G01 | **PASS** | `rpc_send_offer_reminders`: 6h + 1h reminder rows generated (exact guide copy), no third via dedup (re-run 0/0) |
| G | G02 | **PASS** | 24h + 2h auto-complete reminders with exact guide copy; no third via dedup |
| G | G03 | **PASS** | Throttle: 4th non-payout push → `{success:false,throttled:true}`; payout events NOT throttled |
| G | G04 | **PARTIAL** | Auto-complete → TradeTimeline verified on-device; **P2:** `offer_reminder_6h/1h` NOT in deepLink `TYPE_TO_ROUTE_MAP` → tapping the notification does nothing (guide expects Review Offer) |
| H | H01 | **PASS** | test-free completion → "Trade Complete!" + upsell CTA **"Kids Club+ gives you a flat fee and bonus Swap Points on every sale — try it free for 30 days."** + [Try Kids Club+ Free — 30 Days] (copy = R1 savings-$0 variant; guide's "$2 saved" branch requires legacy fees) |
| H | H02 | **PASS** | Subscriber SP completion → "You saved $8.00 using SP! You have 4 SP available." DB: trade completed, seller_sp_earned=18, payout $19.20 queued (copy drift: guide "Got it! You saved $8" vs app "You saved $8.00") |
| H | H03 | **PASS** | Seller timeline on Accept-SP trade: "18 SP releasing in 2 days — added to your pending wallet." + [View Wallet] opens SP wallet |
| H | H04 | **PASS (source+unit corroborated)** | Permutation 5 exact copy 'Sold for cash! Try "Accept SP" on your next listing to also earn SP.' + CTA 'Create New Listing' (unit-tested P5). On-device seller TradeSuccess not reachable on single simulator (transition-gated realtime nav) |
| H | H05 | **BLOCKED (trial leg) / PARTIAL** | Trial-start leg not reachable on-device: `trial_enabled=false`, native subscription choice removed (D-001). State machine (trial/active → grace_period/free) source-verified via `getSubscriptionSummary`; test-seller DB shows `trial` + `grace_ends_at` populated. Cancel leg not executed (would mutate primary persona) |
| I | I01 | **PASS** | Safe-meetup card on in_progress trade; copy deviation ("Trade Smart, Trade Safe" vs guide) |
| I | I02 | **PASS** | Dismiss → collapse persists per-trade (`safe_meetup_collapsed_<tradeId>`); different trade shows expanded |
| I | I03 | **PASS** | Safety banner pinned, non-dismissible; copy deviation |
| I | I04 | **PASS** | Once-per-trade modal; no reappear on reopen |
| I | I05 | **FAIL (P2 bug)** | Quick-reply chips broken: `setTimeout(()=>handleSend(),100)` stale-closure sends empty text → no message persisted (verified: 2 chip taps, 0 DB rows; manual Send works) |
| I | I06 | **PASS + P2 finding** | Disclaimer modal gates offer; checkbox gates Accept. **Finding:** `acknowledge_trade_disclaimer` RPC **does not exist** on staging → disclaimer acknowledgment never recorded (client best-effort call fails silently) |
| I | I07 | **PASS** | Cancel → no trade created |
| I | I08 | **PASS** | ✕ close dismisses modal |
| I | I09 | **PASS** | Checkbox resets on reopen |
| I | I10 | **PASS** | Disclaimer loading + retry (source+unit corroborated; loading transient on-device) |
| I | I11 | **PASS** | SP Wallet opens; no modal |
| J | J01 | **FAIL vs guide (backend verified)** | No Level-1 alert UI. Backend: seller cancel count 0→1, no admin flag. Trade shows generic "Trade Cancelled" notif (DEPRECATED TFV2-023) |
| J | J02 | **FAIL vs guide (backend verified)** | No Level-2 alert UI. Backend: count 1→2 |
| J | J03 | **FAIL vs guide (backend verified)** | No Level-3 alert UI. Backend: count 2→3 + `admin_review_flagged_at` set |
| J | J04 | **PASS** | Seller cancel button only on in_progress (buyer has none) |
| J | J05 | **PASS** | Seller-only reasons; copy deviation ("Can't do pickup" vs guide "Can't do pickup/meetup") |
| K | K01 | **PASS** | Subscriber value stack: fee $1.49, Sales Tax $1.54, Total $25.03; BP-37 (4 SP → tax unchanged, cash $18, total $21.03) |
| K | K02 | **PASS** | Non-subscriber value stack: first-trade fee $1.49, Sales Tax, no SP input (Kids Club+ gated banner + upsell). Also confirmed tiered engine: after first completed trade, fee = subsequent tier $2.89 ($1.99 + 5%) |
| K | K03 | **PASS** | SP discount row appears/hides with SP 0→5→0 |
| K | K04 | **PASS** | Toggle OFF → "Safety & Platform Fee (×3 items): $4.47" (3×$1.49), Cash Total $68.67; DB: 3 trades each carry fee 149 |
| K | K05 | **PASS** | Toggle ON → "Safety & Platform Fee: $1.49" (no ×N), Cash Total $66.49; DB: exactly 1 trade carries fee 149, others 0 |
| K | K06 | **PASS** | Both bundle modes verified: K05 bundle timeline (fee on one item, $0 on others) matches charge mode; DB confirms K04 (3×149) vs K05 (1×149). Aggregate bundle-totals view not exercised for completed bundle (pending offers show per-item fees) |
| K | K07 | **PASS** | Admin partial refund (price $22 only, fee kept): Stripe `re_3U9n6L...` succeeded, `payments.status=partially_refunded`, `refunded_cents=2200`, `refunded_fee_cents=0`, `trade_refunds` split row, trade NOT cancelled |
| K | K08 | **PASS + P2 finding** | Second refund (tax $1.54) succeeded → `payments.refunded_cents=2354`, `refunded_tax_cents=154`, 2 `trade_refunds` rows. **Finding:** `tax_records.tax_status` stays `collected` with `refunded_tax_cents=0` — tax ledger NOT updated on refund |
| K | K09 | **PASS** | Payments Reconciliation: e54f608a row Charged $25.03 (matches Stripe PI), Refunded $23.54, status pill `partially refunded`, trade link + PI shown |
| K | K10 | **PARTIAL + P2 finding** | Server-side enforcement proven via K05 (toggle ON → 1 fee in DB) + EF source. Stale-client repro (fees on all 3 items, toggle ON) → **`TRADE_INSERT_ERROR`** on all items (reproducible; single-item + K05-toggle-ON work) — needs root-cause |
| K | K11 | **PASS (with config drift)** | Seller fee = pct% × cash portion verified (Trade B: 20% × $24 = $4.80, not full price). Config drift: guide says 5% but staging = 10% free / 20% subscriber (trial) — task/guide fee numbers stale |

**Totals (39 target):** executed 38 verdicts incl. partials (F:3, G:4, H:5, I:11, J:5, K:11 = 39 rows; H05 BLOCKED-PARTIAL, G04/K10 partial). PASS ~29, FAIL-vs-guide 3 (J01–J03), FAIL-bug 1 (I05), PARTIAL 3, BLOCKED 1.

---

## 2. Priority Findings (real app bugs)

1. **P1 — Admin dispute "Resolve → Complete" zeroes the payout (`payout_amount_cents` left NULL).** `28a41289` resolved → trade completed, dispute resolved, but `payout_amount_cents=NULL`; `initiate-payout` then processed **$0** and marked `payout_status='paid'` with no payout row. Normal buyer-completion sets this (Trade B = 1920). Fix: resolve-complete must compute `payout_amount_cents = cash − seller fee` (or invoke the completion EF path).
2. **P2 — Quick-reply chip auto-send broken (I05).** `ChatScreen.handleSend` early-returns on empty `inputText`; `QuickReplyChips` calls `setTimeout(()=>handleSend(),100)` → stale closure sends empty → no message persists (verified 2 taps = 0 DB rows).
3. **P2 — `acknowledge_trade_disclaimer` RPC missing on staging (I06).** Disclaimer modal works but acknowledgment never recorded (client call fails silently; `pg_proc` shows no such function).
4. **P2 — Tax ledger not updated on admin partial refund (K08).** Stripe + `payments` + `trade_refunds` updated, but `tax_records.tax_status` stays `collected` / `refunded_tax_cents=0`.
5. **P2 — K10 stale-client bundle insert fails (`TRADE_INSERT_ERROR`).** Reproducible in bundle path with toggle ON when the request embeds fees on all items; single-item and app-driven toggle-ON (K05) succeed. Needs root-cause (possible insert/trigger edge in bundle path).
6. **P2 — Offer-reminder deep-link gap (G04).** `offer_reminder_6h/1h` not in `deepLink.TYPE_TO_ROUTE_MAP` → notification tap does nothing (guide expects Review Offer).
7. **P3 — Spec/copy drift (documented, not bugs):** J01–J03 Level 1/2/3 seller-cancel alerts REMOVED per TFV2-023 (backend consequence counters still work); fee config $1.49 flat vs guide $0.99/$2.99 (tiered engine is authoritative); seller fee 10/20% vs guide 5%; H02/H01 completion copy variants (R1).

---

## 3. Decision & Outcome Log (selected)

- **F02 resolve leg** executed for real in admin portal (`samer@samer.com`/`samer`) — dispute detail `/trades/disputes/28a41289…` → Resolve → Complete (confirm dialog accepted). Payout leg flagged as P1 (above).
- **K07/K08** executed for real in admin portal (Issue Partial Refund on `e54f608a`, a completed trade with captured PI `pi_3U9n6L4I6kCJlvXo0nZMmOFN`).
- **K04 initial on-device send** failed with `MAX_PENDING_OFFERS` (test-buyer hit the 3-offer cap from earlier fixtures, NOT a fee bug). Freed slots by cancelling 2 throwaway pending slots → direct EF invocation succeeded (per-item fees verified in DB). Documented as environment artifact.
- **Fee engine evidence:** test-free fee moved $1.49 (first-trade) → $2.89 (subsequent: $1.99 + 5%) after completing a trade — tiered engine confirmed live.
- **H05 trial-start leg BLOCKED** (D-001 removed in-app subscription choice; `trial_enabled=false`). Cancel leg not executed to avoid mutating the primary seller persona.
- **`charge_one_fee_per_bundle`** toggled OFF for K04 then restored to TRUE (verified).
- **Payout triggers** (`trg_queue_payout_on_complete` net.http_post) not wired in staging → payout rows invoked manually via `initiate-payout` EF (same pattern as earlier runs).

---

## 4. Perceived Load-Time & UX Notes

- No material load-time regressions observed; CartCheckout warmup ping (`__warmup`) present; checkout + bundle submissions within expectation.
- **Layout finding (minor):** Trade Basket "Make offer" CTA (`bundle-cta-button`) overlaps the tab bar (y 845–916 vs tab bar 868–905) — taps near the CTA bottom hit a tab instead of the CTA (observed twice).
- Admin portal: expanded sidebar intercepts clicks over main content (workaround: collapse sidebar); not product-facing.

---

## 5. Design & Copy Compliance

- Popup/modals (Disclaimer, Accept-Trade confirm, Complete confirm, Refund modal) follow design-system patterns (labels, buttons, disabled states) — PASS.
- Copy deviations documented (safe-meetup, chat banner, quick-reply chips, J05 reason, H01/H02 completion) — all P3, no design-system violations.

---

## 6. Cleanup Performed

- Corrected F02 trade `28a41289`: `payout_amount_cents=1600`, `payout_status='pending'` (no real transfer occurred).
- Cancelled throwaway bundle offers (`ba0859c3`, `bc4a94b7`), stray single-item trade `5a916e13`, prior G01/G03 fixtures (`65e6cc19`).
- `charge_one_fee_per_bundle` restored to TRUE.
- **Note:** test-seller `post_acceptance_cancellation_count` remains at 3 + `admin_review_flagged_at` set (from J03) — restore to 0/NULL before any J-series re-run.

---

## 7. What Needs To Be Fixed Next (recommended follow-up tasks)

1. (P1) Admin dispute resolve-complete: compute `payout_amount_cents`.
2. (P2) Quick-reply chip send fix (stale closure in ChatScreen/QuickReplyChips).
3. (P2) Deploy `acknowledge_trade_disclaimer` RPC (or wire to existing disclaimer-record table).
4. (P2) Refund API: update `tax_records` (status `refunded`, `refunded_tax_cents`).
5. (P2) K10 stale-client bundle insert root-cause + fix.
6. (P2) Add `offer_reminder_6h/1h` to deepLink TYPE_TO_ROUTE_MAP → ReviewOffer.
7. (P3) Basket CTA/tab-bar overlap; copy alignment pass per guide.
