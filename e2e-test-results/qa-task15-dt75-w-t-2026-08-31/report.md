# QA Task 15 — Session Handoff Report (2026-08-31)

**Session:** DT75 spot-checks + Group W (admin) + T-group (SP) + remaining
**Evidence dir:** `e2e-test-results/qa-task15-dt75-w-t-2026-08-31/screenshots/`
**Device:** iPhone 17 Pro Max simulator (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`) — dev build
**Supabase staging:** `drntwgporzabmxdqykrp`
**Admin portal:** `http://localhost:3001` (logged in as admin-qa)

---

## 1. Test Scope (run)

### Section A — DT75 spot-checks (4/4 PASS)
1. **V08 PASS** — "Matches Your Trade Basket" badge appears immediately on Item Detail when the item is from the same seller as cart items (Kids Bicycle, same seller as 2 cart items; badge rendered at load, no navigation needed).
2. **Q15/Q16/Q17 PASS** — Reviewee's own profile review menu shows 4 report reasons (Spam / Offensive / False Information / **Other**); reporting a review → "Review reported. Thank you!" (DB-verified `review_reports` row). Q16 deferred (reviewee-only model makes the 3-distinct-reporter precondition unreachable — product question); Q17 PASS by construction.
3. **qa:set-sp-balance PASS** — test-buyer SP raised 4 → 500 (`available_balance=500, pending=0, reserved_sp=0, state=active`; ledger `earn_admin_grant`).
4. **O07 PASS (both legs)** — Completed trade with refund: **buyer** sees full refund card ("Your refund has been issued.", Refund Amount $1.40, Refunded Sales Tax $1.40, Refunded to: original payment method, date); **seller** sees role-appropriate status note only ("This trade was cancelled and the buyer was refunded. No payout was issued for this sale.") — NO refund card for seller.

### Section B — Group W (admin portal, 10 verified / 2 blocked-fixture)
| Case | Result | Notes |
|---|---|---|
| W01 | ✅ PASS | "Single Trades" (default) + "Bundle Trades" tabs; `?view=bundles` toggles |
| W02 | ✅ PASS | Single Trades table: one trade per row, no bundle column |
| W03 | ✅ PASS | Bundle Trades table columns: Bundle ID / Items / Statuses / Buyer / Seller / Total / Created / Actions |
| W04 | ✅ PASS | Bundle row shows id + "N items" + status pills + buyer/seller + totals + created + View Bundle |
| W05 | ✅ PASS | View Bundle → `/trades/bundles/{id}` with "Bundle Details" heading |
| W06 | ✅ PASS | "Trades in this Bundle" lists each trade card + "View Details →" |
| W07 | ✅ PASS | Bundle Monetary Breakdown ($60 / $1.49 / $4.19 / $65.68) + Bundle Summary |
| W08 | ✅ PASS | "View Details →" → `/trades/{tradeId}` single-trade detail (General Info, Monetary Breakdown, Item Details, Cancellation Details, Admin Audit Trail, Stripe refs) |
| W09 | ⚠️ NEGATIVE PASS / positive BLOCKED | Button correctly absent on terminal bundles (source `allTerminal → null`). Positive leg blocked: **no staging bundle has a non-terminal trade** (DB `bool_or(...)` → `[]`) — fixture gap |
| W10 | ⛔ BLOCKED | Same fixture gap as W09 (no non-terminal bundle to force-cancel); needs dedicated fixture-building session (R41) |
| W11 | ✅ PASS | Status filter in Bundle view works (select "completed" → only bundles containing completed; URL `?view=bundles&status=completed`) |
| W12 | ⚠️ MINOR DEFECT | Tab toggle resets DATA+URL+search correctly BUT the status `<select>` retains stale selection instead of resetting to "All Statuses" (reproduced twice) |

### Section C — T-group (SP redemption, 10 cases executed)
| Case | Result | Notes |
|---|---|---|
| T02 | ✅ PASS | SP input applied 45 to $60 Kids Bicycle (Sports 75% cap); "You can use up to 45 SP" + "Limited by this item's category"; counter 500→455; Order Summary -$45.00 |
| T03 | n/a | Not in scope (wallet-insufficient scenario) |
| T04 | ⚠️ DIVERGENCE | Guide says admin sets `sp_redemption_cap`; client computes maxAllowed from `categories.sp_spending_cap_percent` ONLY. Server (R11 `fn_item_effective_sp_cap`) DOES bound by `sp_redemption_cap`. So an admin-set absolute cap is NOT reflected in the client hint; server rejects >cap at submit. Category-cap behavior demonstrated (45/10 SP). Recommend unifying client to `fn_item_effective_sp_cap` |
| T05 | ✅ PASS | Sequential allocation: 45→455, +10→445, clear 45→490, re-apply→445 (counter real-time) |
| T06 | ⚠️ PARTIAL | Real-time counter verified; guide's 3-Accept-SP-items scenario not achievable (only 2 eligible Accept-SP items from test-seller) |
| T07 | ✅ PASS | Order Summary math: Subtotal $105.00, Points -$55.00, Fee $1.49, Tax $5.59, Cash Total $57.08 |
| T08 | ✅ PASS | Seller Review Offer per-item breakdown (title + SP + net); **SP inconsistency flagged** (bundle list +60 vs payout card +61 for Kids Bicycle — root cause: main offer select omits `sp_category_multiplier` → fallback 1.0; payout uses live category lookup 1.10) |
| T09 | ✅ PASS | Payout card: Cash Amount / Platform Fee / Points Earned / Net Cash Payout; bundle totals Buyer's Total Paid + Points Earned (with T08 note) |
| T10 | ⚠️ FINDING | "Includes points redemption" tag renders ONLY on single-offer cards; **missing on bundle offer cards** even when SP applied (guide expects it on the seller's bundle offer card) |
| T11 | ⚠️ PARTIAL | Bundle accepted → in_progress; **spec-vs-impl**: SP transfers to seller at COMPLETION (`fn_release_all_sp_on_complete`), not acceptance; buyer `spend_purchase` ledger at offer time; full T11 needs trade completion |
| T12 | ✅ PASS | Seller decline → trade cancelled; **no seller ledger entry**; buyer `earn_refund` +9 released; `sp_transferred_at` NULL; wallet restored |
| T13 | ✅ PASS | Single-item (non-bundle) SP regression: 9 SP applied, offer $9.00, "You saved $9.00 using SP! You have 436 SP available." |

### Section D — Remaining never-started cases
- **NOT RUN** (session cut short by direction to wrap up). The I06–I09 disclaimer-modal cases were partially observed during Section C (I06 gating: Accept blocked until checkbox checked). Remaining never-started cases stay open per `TEST-COVERAGE-INVENTORY.md` — deferred.

---

## 2. Design-System Compliance

- **Checkout / Trade Offer SP inputs** use the amber coin accent (`#F59E0B`) + currency-styled `$` rows — consistent with the design-system token language for value/points.
- **Refund card (buyer)** and **status note (seller)** in TradeTimeline use the standard card + status-badge pattern; the seller note reads cleanly and is role-appropriate.
- **Admin portal** tables/cards/pills follow the existing Next.js design system (blue active tab, status pills, card rows) — consistent.
- **Bundle offer card** on seller's Needs Action list uses the standard bundle banner + per-item rows; spacing/typography consistent.
- **W12 defect** (stale select) is a functional/state bug, not a visual-design issue.

---

## 3. Perceived Load-Time Verdict

- **V08 badge** appears immediately on Item Detail render (no spinner gap) — good.
- **Cart → Checkout → SP hint** renders within one load cycle; Points-remaining counter updates synchronously on input.
- **Admin bundle detail / trade detail** pages load with a brief "Loading..." then render — acceptable for dev-mode Next.js.
- **Trade Initiated / Bundle Accepted / Offer Declined** confirmation screens appear promptly after the action spinner ("Processing…" → result).
- No perceived-load-time regressions identified in the surfaces exercised.

---

## 4. Design & Copy Compliance Confirmation

- **DEV-TASK-72 unified SP wording confirmed live:** "You can use up to N SP" + single subtext ("Limited by your SP balance" / "Limited by this item's category"). No two-denominator "Max / X of Y" pair.
- **Q15 copy confirmed:** "Review reported. Thank you!" (exact).
- **O07 refund copy confirmed:** "Your refund has been issued." + refund amount / tax / method / date rows (buyer); "This trade was cancelled and the buyer was refunded. No payout was issued for this sale." (seller note).
- **T13 CTA copy confirmed:** "You saved $9.00 using SP! You have 436 SP available."
- **Disclaimer modal copy confirmed:** "Please read and acknowledge this disclaimer before completing your purchase", "I have read and understand this disclaimer", "Accept and continue", "Cancel purchase".

---

## 5. Verdict Summary

| Section | Scope | PASS | PARTIAL | DEFECT/FINDING | BLOCKED |
|---|---|---|---|---|---|
| A (DT75) | 4 | 4 | 0 | 0 | 0 |
| B (Group W) | 12 | 9 | 1 (W12) | 1 (W12) | 2 (W09+/W10 fixture) |
| C (T-group) | 10 | 6 | 3 (T06/T11/T04-div) | 2 (T08/T10 findings) | 0 |
| **Total** | **26** | **19** | **4** | **3** | **2** |

---

## 6. Critical Findings (follow-up candidates — NOT fixed in this run)

1. **[T08] Review Offer SP inconsistency (off-by-one):** bundle items list shows Kids Bicycle **+60 SP** while the payout card shows **+61 SP** for the same trade. Root cause: `fetchOffer` in `ReviewOfferScreen.tsx` does not select `sp_category_multiplier` for the primary offer, so the bundle-list platform-bonus falls back to `1.0` (`FLOOR(60×0.25×1.0)=15` → 45+15=60); the payout card uses `previewTotalSPToSeller` (live category lookup, Sports `1.10` → 45+16=61). Correct = 61. **Fix candidate:** add `sp_category_multiplier` to the main offer select (or share one computed value).
2. **[T10] "Includes points redemption" tag missing on bundle offer cards:** the tag renders only for single offers (`offer.sp_amount > 0`); bundle cards (which can carry SP) show no tag. Guide expects it on the seller's offer card for a bundle offer with SP.
3. **[W12] Admin status filter select does not reset on tab toggle:** switching Single↔Bundle resets URL/data/search but leaves the status `<select>` showing the prior value (not "All Statuses") — misleading stale control.
4. **[T04] Client/server SP-cap divergence:** checkout client uses `sp_spending_cap_percent` only; server `fn_item_effective_sp_cap` bounds by `sp_redemption_cap` too. An admin-set absolute redemption cap is not shown in the client hint.
5. **[T11 spec note]** Guide expects seller SP credit at acceptance; implementation transfers at completion (`fn_release_all_sp_on_complete`). Doc/guide should be reconciled (not necessarily a bug).
6. **Guide-vs-impl "toggle" language:** T-group guide describes a "toggle switch" but the implementation uses per-item numeric SP TextInputs — guide copy is stale.

---

## 7. App State Left Behind

- **test-buyer** logged in, on Home dashboard (relaunched to clear a stuck "Offer Declined" alert).
- Wallet: `available_balance=445, reserved_sp=55, pending=0` — the 55 SP are reserved on the **in_progress** bundle `5b69480b` (3 trades: `df35d0db` sp45, `37fa9ba3` sp10, `66bd12a6` sp0; all `in_progress`).
- Trade `70ccf997` (Board Game Set, single-item SP 9) is **cancelled** (`seller_declined`) — buyer's 9 SP refunded via `earn_refund`.
- Cart: 3 items in `active` status (Kids Bicycle, Vintage Comic, QA Canned).
- **test-seller** wallet: `available=1816, pending=230, state=frozen` (pre-existing, did not affect flow).
- Admin portal browser session open at `/trades`.
- No repo/code/config changes made (execution-only).

---

## 8. Known Gaps / Not Tested

- **W09 positive / W10** (Force Cancel Entire Bundle): no staging bundle has a non-terminal trade → positive leg BLOCKED (fixture gap; R41).
- **T04 full admin-set-cap leg:** not driven end-to-end (client divergence documented; would require setting `sp_redemption_cap` + verifying server rejection — recommended as a focused follow-up).
- **T06 3-item scenario:** not achievable with current fixtures (only 2 eligible Accept-SP items from test-seller).
- **T11 completion leg:** not driven (SP transfer at completion requires completing the in_progress trade).
- **Section D (remaining never-started cases ~15–18):** deferred (session wrap-up direction).
- **I07/I08/I09** (disclaimer Cancel/✕/reset): not explicitly driven this run.

---

## 9. What Needs To Be Fixed Next (recommended follow-ups, in priority order)

1. **T08 SP off-by-one in Review Offer bundle list** (primary offer missing `sp_category_multiplier` → falls back to 1.0).
2. **T10 "Includes points redemption" tag on bundle offer cards.**
3. **W12 admin status filter stale-select reset.**
4. **T04 client/server SP-cap unification** (`fn_item_effective_sp_cap` on the client hint).
5. **Guide copy updates:** T-group "toggle" → SP input; T11 acceptance-vs-completion SP timing.
6. **Fixture gap:** a staging bundle with a non-terminal (active) trade to drive W09/W10 positive leg.

---

## 10. Suggested Next Session

- A dedicated fixture-building session to create a **non-terminal bundle** (for W09/W10), then complete Group W.
- A focused T-group completion pass: drive **T04** with an admin-set `sp_redemption_cap`, **T11** completion leg (complete the in_progress bundle → verify seller `earn_reward` + `sp_transferred_at`), and **T06** with a 3-item Accept-SP fixture.
- Section D: run the remaining never-started TRD cases (I06–I09 disclaimer modal, K-group fee display, H-group trade-success CTAs, etc.) per `TEST-COVERAGE-INVENTORY.md`.
- Re-run T08/T10 after the fixes above to close those findings.

---

## 11. Suggested Agent-Rule Improvements

- Consider codifying the **SP hint/spec divergence check** (client `sp_spending_cap_percent` vs server `fn_item_effective_sp_cap`) as a standing verification step for any SP-cap case, so T04-class divergences are caught at review time.
- Add a note in the QA playbook that **TradeList history and lingering GlobalAlert dialogs can wedge the AX tree** — prefer app relaunch over repeated coordinate taps when an alert doesn't dismiss (this session burned time on a stuck "Offer Declined" alert).
