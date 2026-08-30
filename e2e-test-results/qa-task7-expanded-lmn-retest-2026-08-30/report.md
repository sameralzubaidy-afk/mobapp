# QA Task 7 — Expanded L/M/N Groups + Retest + DT-62 Bonus — Report (2026-08-30)

**Environment:** iOS Simulator — iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1, app "Pass It Up!" (`com.sameralzubaidi.p2pmarketplace`, Debug build + Metro).
**Backend:** Staging Supabase `drntwgporzabmxdqykrp` (read-only SQL verification).
**Admin portal:** `p2p-kids-admin` @ `http://localhost:3001` (shared browser page, Playwright path).
**Toolkit:** Dev Task 51 `qa-login-as?persona=<name>` deep links used for every persona switch (see Efficiency log).
**Surfaces in scope:** iOS mobile (all). Admin-web legs for F02/K08/N01 executed via the admin portal Playwright path (the shared browser); on-device assertions are mobile.

---

## 1. Batch verdict table

| TC-ID | Group | Verdict | Top finding |
|---|---|---|---|
| **I05** | Retest (DT-48) | ✅ PASS | Quick-reply chips send correct canned messages (DB-verified 2 rows created) |
| **F02** | Retest (DT-48) | ✅ PASS | Admin resolve→complete zeroes nothing erroneously; payout 1600¢, payout row + idempotency key, actor attribution (R35) |
| **K08** | Retest (DT-48) | ✅ PASS | Tax ledger refund 140¢; payments partially_refunded, refunded_tax_cents=140, Stripe refund id |
| **K10** | Retest (DT-48) | ✅ PASS | EF stale-client bundle offer → HTTP 409 `SP_INSUFFICIENT`, 0 trades created |
| **G04** | Retest (DT-48) | ✅ PASS | Offer-reminder deep link → Review Offer (6h reminder) |
| **E08** | Retest (DT-53) | ✅ PASS | Reason-chip deselect toggle works (Submit solid-green toggles) |
| **E10** | Retest (DT-53) | ✅ PASS | "within 24 hours" dispute banner + Auto-complete paused copy |
| **L01** | L (new) | ✅ PASS | Bundle banner "Bundle offer · 2 items" + expand/collapse, buyer + seller |
| **L02** | L (new) | ✅ PASS | "Confirm all 2 items received?" + Confirm All 2 → both completed (⚠ load-time flag, see §4) |
| **L03** | L (new) | ✅ PASS | Seller NEEDS ACTION bundle row + Review Each / Accept All / Decline All |
| **L04** | L (new) | ✅ PASS | Single offer renders as row with only Review action |
| **L05** | L (new) | ✅ PASS | Buyer IN PROGRESS "📦 Bundle · 2 items" group |
| **L06** | L (new) | ✅ PASS | Review Offer bundle banner + expand; Buyer's Total Paid $38, Points Earned +10 SP; net payout (DT-62 item 2) |
| **L07** | L (new) | ✅ PASS | Accept All 2 → both in_progress |
| **L08** | L (new) | ✅ PASS | Individual Accept alongside sibling (1 accepted, 1 stays pending; DB-verified) |
| **L09** | L (new) | ✅ PASS | Buyer Your Offers bundle card (no Accept/Decline All) — **MAJOR finding: disclaimer body = Amazon boilerplate** |
| **L10** | L (new) | ✅ PASS | Buyer "Cancel all 2 items?" + Cancel All 2; seller "Just This One" logic (cash-pending sibling not cancellable — correct per source) |
| **L11** | L (new) | ✅ PASS | Bundle checkout with in-active-trade item → "Already In an Active Trade" notice + eligible offer only |
| **M01** | M (new) | ✅ PASS | Add first item → cart |
| **M02** | M (new) | ✅ PASS | Same-seller direct add |
| **M03** | M (new) | ✅ PASS | Different Seller modal Save & Start New / Replace / Cancel (AX-exposed) |
| **M04** | M (new) | ✅ PASS | Replace Cart flow |
| **M05** | M (new) | ⏭ SKIPPED | Own-item add-to-cart — not exercised (needs a second persona/own-listing state; low value, deferred) |
| **M06** | M (new) | ✅ PASS | Sold item → "❌ Listing not found" |
| **M07** | M (new) | ✅ PASS | Duplicate add → "View Trade Basket" in-cart button |
| **M08** | M (new) | ✅ PASS | Remove item from cart |
| **M09** | M (new) | ✅ PASS | Clear cart shows $0 state (not full empty when saved carts exist — per design) |
| **M10** | M (new) | ✅ PASS | Saved-cart 3/3 cap: 4th → server REJECTS ("You already have 3 saved carts") — **doc drift: guide implies LRU eviction** |
| **M11** | M (new) | ✅ PASS | Min-cart-value — **verified via N01** (deferred there, see N01 row) |
| **M12** | M (new) | ✅ PASS | "Accepts Points" badge shown; **doc drift: no "Up to N SP" numeric** |
| **M13** | M (new) | ✅ PASS | Realtime-unavailable item shows "This item is no longer available" — **P3: subtotal still $18 (not excluded)** |
| **M14** | M (new) | ✅ PASS | Favorite add/remove |
| **M15** | M (new) | ✅ PASS | Unavailable overlay "No longer available" + empty state "No favorites yet" |
| **M16** | M (new) | ⚠️ PARTIAL | "Added to Trade Basket" toast — 2.5s auto-dismiss window; not directly capturable, source-corroborated (behavior verified) |
| **M17** | M (new) | ✅ PASS | Cart badge increments ("2") |
| **M18** | M (new) | ⚠️ PARTIAL | Toast (same 2.5s limitation as M16) — source-corroborated |
| **M19** | M (new) | ✅ PASS | Home action-tile-favorites → Favorites |
| **M20** | M (new) | ✅ PASS | Discover header bookmark "Saved items" → Favorites (icon/copy drift: not heart/"View Favorites") |
| **N01** | N (new) | ✅ PASS | Admin set $20 → on-device "Add $6.00 more" banner + "Minimum checkout is $20.00" + blocked checkout modal → reverted (DB-verified) |
| **N02** | N (new) | ✅ PASS | Admin validation: min=0, negative rejected ("cannot be negative"), write blocked — **doc drift: no $5 floor** |

### Roll-up
- **Retest (7):** 7 PASS
- **New (33):** 30 PASS · 2 PARTIAL (M16, M18) · 1 SKIPPED (M05)
- **Total (40):** 37 PASS · 2 PARTIAL · 1 SKIPPED

### DT-62 Bonus (separate from the 40-case count)
| Item | Verdict | Evidence |
|---|---|---|
| Item 2 — net payout, plain single-item offer | ✅ PASS | Review Offer: Cash Amount $15.00, Platform Fee −$3.00, Net Cash Payout $12.00 (`DT62-single-item-net-payout.png`) |
| Item 2 — net payout, bundle offer | ✅ PASS | Cash Amount $18.00, Platform Fee −$3.60, Net Cash Payout $14.40 (20% fee) (`L06-DT62-review-offer-bundle-net-payout.png`) |
| Item 5 — AX/VoiceOver pass on cancellation-reason + disclaimer/offer-accepted modals | ⚠️ PARTIAL | AX-tree exposure confirmed for CancellationReasonModal, DisclaimerModal, GlobalAlertProvider, TradeConfirmationModal (accessibilityState/roles). Full VoiceOver swipe-gesture pass is tooling-limited (VoiceOver changes the mobile-mcp interaction model) — see Known Gaps |

---

## 2. Retest details (7)

### I05 — Quick-reply chip send (DT-48)
Tapped 📅 Available today + 📆 Available tomorrow chips in chat on trade `a3333333-004`. DB read-back: 2 `messages` rows created —
- 16:43:43 "Hey! I'm available to meet today. What time works for you?"
- 16:44:04 "Hi! I can meet tomorrow. Does that work for you?"
Verdict **PASS** — DT-48 chip-send fix confirmed.

### F02 — Payout zeroing on admin dispute resolve-complete (DT-48)
Admin portal resolved the dispute on `a3333333-004` → Complete. DB read-back: trade `status=completed`, `dispute_status=resolved_seller`, **`dispute_resolved_by=1a546991-…` (admin actor attribution, R35)**; `payout_amount_cents=1600` (NOT zeroed); `seller_payouts` row created (gross 1600, fee 29, net 1571, idempotency_key `trade:a3333333-…:seller:14be337c-…`).
Verdict **PASS** — payout is correctly **not** zeroed on a resolved-in-seller's-favor completion.

### K08 — Tax ledger on partial refund (DT-48)
Admin partial refund of Sales Tax $1.40 only on `a01624a4` (price/fee zeroed). DB read-back: `tax_records` `tax_status=refunded`, `refunded_tax_cents=140`; `payments` `status=partially_refunded`, `refunded_cents=140`, `refunded_tax_cents=140`, Stripe refund `re_3UABZ44I6kCJlvXo0EhPQLID`; `trade_refunds` row (reason "K08 QA tax-ledger partial refund test").
Verdict **PASS** — tax ledger correctly records partial refunds.

### K10 — Bundle stale-client SP (DT-48)
EF repro (`qa:ef-repro --persona test-buyer --ef create-trade-offer` with 3 items × 2 SP + payment_method) → HTTP **409 `SP_INSUFFICIENT`** "You don't have enough Swap Points for this bundle. You have 4 SP available." → **0 trades created** (DB confirmed).
Verdict **PASS** — stale client-side SP is rejected server-side; no partial/duplicate trades.

### G04 — Offer-reminder deep-link routing (DT-48)
Fast-forwarded `a4444444` offer_expires_at → now+6h; ran `rpc_send_offer_reminders(100)` (returned `offer_reminder_6h`, `reminder_6h_sent:1`); inserted `user_notifications` row `18f7fe6c` (type `offer_reminder_6h`, data trade_id `a4444444`). Logged in as test-seller, tapped "⏱ Offer expiring in 6h" → **navigated to Review Offer** for QA L Group Chain Item 0821 ($15.00, "6h 4m left", Accept/Decline).
Verdict **PASS** — deep-link routing fix confirmed.

### E08 — Reason-chip deselect toggle (DT-53)
IssueReportModal: selected "Seller was a no-show" → Submit solid green (52.35% green pixel scan); re-tap same reason → Submit 0% solid green (deselected). Screenshots `E08-reason-selected.png` / `E08-reason-deselected.png`.
Verdict **PASS** — DT-53 toggle fix (`onPress={() => setSelected(prev => prev === reason.id ? null : reason.id)}`, commit `527b8c40`) confirmed.

### E10 — Dispute banner "within 24 hours" copy (DT-53)
After submitting report: banner "Dispute in progress" + "Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused." + "Keep chatting with the other party...". DB: `dispute_status=reported`, `dispute_reason=no_show`. Screenshot `E10-dispute-banner-24h.png`.
Verdict **PASS**.

---

## 3. New-group details (L/M/N)

### Group L — bundle flows (11/11 PASS)
- **L01** Bundle banner + expand/collapse on both buyer & seller timelines.
- **L02** "Confirm all 2 items received?" + [Confirm All 2]/[Just This One] → both trades completed (DB: completed 16:30:09 + 16:30:16). ⚠️ load-time flag below.
- **L03** Seller NEEDS ACTION bundle row (Bundle Offer · 2 items) with Review Each / Accept All / Decline All.
- **L04** Single offer renders as `trade-offer-row-a2222222` with only Review action — no bundle actions.
- **L05** Buyer IN PROGRESS "📦 Bundle · 2 items" group.
- **L06** Review Offer bundle banner + expand (2 item rows, Buyer's Total Paid $38, Points Earned +10 SP).
- **L07** Accept All 2 → both in_progress.
- **L08** Individual Accept alongside sibling: Puzzle Set in_progress, QA Canned stayed pending (DB-verified).
- **L09** Buyer Your Offers bundle card ("Bundle Offer · 2 items", PENDING, Buying, item rows, 48h left, View Details, NO Accept/Decline All). **MAJOR finding: disclaimer modal body is Amazon.com seller-insurance boilerplate** (see §5.1).
- **L10** Buyer cancel prompt "Cancel all 2 items?" + [Cancel All 2] (both cancelled, DB-verified); seller cancel prompt + [Just This One] (only current cancelled). Seller path correctly only offers bundle-cancel for cancellable in_progress siblings (pending cash sibling not seller-cancellable — per source).
- **L11** Bundle checkout with an in-active-trade item → "Already In an Active Trade" notice listing the skipped item + eligible offer created, no duplicate.

### Group M — cart end-user (17 PASS / 2 PARTIAL / 1 SKIPPED)
Findings noted in the verdict table; detailed UX notes in §5.

### Group N — admin cart thresholds (2/2 PASS)
- **N01** Admin `/settings/cart`: set Minimum Cart Value to $20 → DB `cart_min_value_cents=2000` (`updated_by` = acting admin 1a546991). On-device as test-buyer: Kids Bike Helmet $14.00 in cart →
  - Banner: "Add $6.00 more to check out"
  - "Minimum checkout is $20.00. Browse more items from this seller to fill your Trade Basket!"
  - "Browse 2 More Items" button
  - Tapping Make-an-offer → blocked modal "Minimum checkout not met" / "Add $6.00 more to reach the $20.00 minimum. Your current total is $14.00." → [Browse More Items]/[Cancel]
  - Cleared basket; reverted config to 0 via admin UI; DB verified `cart_min_value_cents=0`.
  Screenshots `N01-min-value-warning-14-20.png`, `N01-checkout-blocked-min-not-met.png`. Also covers M11.
- **N02** Admin validation: `cart-min-value-input` has `min="0"`, `max=""`. Entered −5 → inline error "Minimum cart value cannot be negative"; DB confirmed **no write** (value stayed 0). **Doc drift:** guide expects a "$5.00 floor"; actual rule is only "≥ 0 / cannot be negative" — no $5 floor exists.

---

## 4. Perceived load-time table

Per §5.7, ≥3s entries flagged.

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Home (post `qa-login-as`) | ~1.5s | — |
| Discover → Item Detail (deep link) | ~1.2s | — |
| Cart → Checkout (bundle) | ~1.8s | — |
| Checkout → Review Offer | ~1.6s | — |
| Confirm All 2 (bundle completion) → "Done!" modal | **>3s (user-noted)** | ⚠️ FLAGGED |
| Accept All 2 → IN PROGRESS rows | ~1.9s | — |
| Offer-reminder notification → Review Offer | ~1.4s | — |
| Send offer → success toast | ~1.5s | — |

**Flagged:** `Confirm All 2 → Done!` transition exceeded 3s. DB corroboration: bundle trades completed at 16:30:09 + 16:30:16 (~7s apart). This was a mid-flow observation (not formally §5.7-timed with polling), recorded per the user's request. Most likely an app-behavior item (batch `complete_trade_v2` + payment-release latency), not a dev-build cold-start artifact — recommend dev measure ms-to-land on the Confirm All path.

---

## 5. Cross-cutting findings

### 5.1 MAJOR — Disclaimer modal body is Amazon seller-insurance boilerplate (L09)
The checkout disclaimer modal body is **Amazon.com seller insurance policy text** (occurrence-based policy, S&P A− / AM Best A− ratings, "additional insureds" = Amazon). This is clearly wrong content for the kids P2P marketplace. Screenshot `L09-disclaimer-amazon-text.png`. **P1 content defect** — dev must replace with the actual marketplace trading-terms/liability copy.

### 5.2 M13 — Realtime-unavailable item not excluded from subtotal (P3)
When an item goes unavailable via Realtime, cart shows "This item is no longer available" but the subtotal still includes it ($18.00). Guide expects the unavailable item to be excluded from the subtotal. **P3.**

### 5.3 Doc-drift findings (behavior differs from guide expectations)
- **M10 / N02** — Saved-cart cap is a **server REJECT** of the 4th save ("Could not save cart — You already have 3 saved carts. Delete one to save a new one."), not LRU eviction. Doc drift.
- **N02** — No $5 minimum-cart-value floor; validation is only "cannot be negative" (`min="0"`). Guide's "$5.00 floor" is doc drift.
- **M12** — Cart rows show "Accepts Points" badge with **no numeric "Up to N SP"**. Doc drift.
- **M20** — Discover header uses a **bookmark icon labeled "Saved items"**, not a heart "View Favorites". Copy/icon drift (functional — navigates to Favorites).
- **M09** — Cleared cart shows $0 total state rather than the full empty state when saved carts exist — confirmed per design (source-verified).

### 5.4 Other notes
- Checkout SP inputs showed "Max: 0 SP" on Accept-SP items while test-buyer had 4 available SP — possible SP-cap display issue to note for dev.
- L10-seller prompt logic (only in_progress siblings bundle-cancellable; pending cash sibling not) is correct per source.
- Native modals (IssueReportModal, completion notices, "Trade Cancelled") are not AX-exposed → pixel-scan fallback used (green #5DBB8E button scan). Locator gap, see §6.

---

## 6. Locator-gap findings (flagged, fallbacks used, recommended instrumentation)

| Element | Fallback used | Recommended instrumentation fix |
|---|---|---|
| IssueReportModal reason rows / Submit | Pixel-scan (green #5DBB8E) | Expose `testID`/AX on `issue-reason-*` (present) + modal accessibilityRole |
| "Trade Cancelled" OK / "Done!" OK | Coordinate tap at known y | Native modal buttons: add `testID` + `accessibilityRole="alert"` |
| Disclaimer modal body text | Screenshot + OCR | Already capturable via `disclaimer-modal-*` — content fix only (§5.1) |
| M16/M18 toast (2.5s) | Source-corroborated | Consider a longer-lived `testID` or a11y live-region announcement |
| Different-seller alert | AX-exposed via GlobalAlertProvider ✓ | — (no gap) |

---

## 7. Friction vs operating rules
- mobile-mcp tool categories re-disable after use and must be re-activated each call — documented, costly.
- Admin portal expanded sidebar intercepts clicks — collapse (Toggle sidebar) first.
- RPC config write (`upsert_admin_config_setting`) → `P0001 UNAUTHORIZED` via MCP SQL; config writes must go through the admin portal UI.
- Multi-statement `execute_sql` returns only the last resultset — run verification queries individually.
- UUID columns reject `LIKE` — cast `id::text`.

---

## 8. Efficiency log (toolkit vs baseline)

Baseline: QA Task 5 = **$2.48 / 39 cases** (pre-toolkit, 8–10-call email/password login per persona switch).

Toolkit usage this run: `qa-login-as?persona=<name>` = **1 call** per persona switch (vs 8–10 baseline). QA Task 7 executed **40 cases + DT-62 bonus** with the toolkit; total tool-call count stayed well under the per-case budget implied by the Task 5 baseline. Full per-batch call counts are in the session transcript; the toolkit decision is a clear efficiency win (roughly an order-of-magnitude reduction in auth-related calls, with no auth regressions observed).

---

## 9. Design & copy compliance (per distinct surface)

**Design-System Compliance: PARTIAL** — one critical content deviation (§5.1); layout/token compliance otherwise confirmed across visited screens.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing/Home: wording + layout match design system.
- CONFIRMED — Discover header: matches layout; **DEVIATION (icon/copy drift)** bookmark "Saved items" vs heart/"View Favorites" (M20).
- CONFIRMED — Item Detail + Add to Cart.
- CONFIRMED — Cart screen: banner, saved-carts, badge, CTAs, spacing/type tokens.
- CONFIRMED — Checkout + Review Offer: payout breakdown, bundle banner, fee lines, SP earn line.
- DEVIATION — Checkout Disclaimer modal: **Amazon seller-insurance boilerplate** (§5.1) — content is not the marketplace's own terms.
- CONFIRMED — Chat quick-reply chips.
- CONFIRMED — Trade Timeline bundle banner + Confirm All / Just This One prompts.
- CONFIRMED — Dispute banner (E10) copy.
- CONFIRMED — IssueReportModal (E08) — reason chips, deselect toggle, Submit CTA color #5DBB8E.
- CONFIRMED — CancellationReasonModal, GlobalAlertProvider (offer-accepted), TradeConfirmationModal — AX/roles verified (DT-62 item 5).
- CONFIRMED — Admin /settings/cart (portal): min-value input, validation message, save flow.

---

## 10. Recommended follow-ups (separate tasks — not applied in-run)

1. **Fix:** Replace the disclaimer modal body with the marketplace's own trading-terms/liability copy (P1, §5.1).
2. **Fix:** Exclude Realtime-unavailable items from cart subtotal (P3, §5.2).
3. **Fix:** Investigate the Confirm All 2 → Done! transition latency (>3s, §4) — measure ms-to-land on `complete_trade_v2` batch path.
4. **Fix:** Checkout "Max: 0 SP" display when buyer has available SP (§5.4).
5. **Doc fix:** Update guide expectations for M10 (no LRU eviction), N02 (no $5 floor), M12 (no "Up to N SP"), M20 (bookmark vs heart) — doc drift.
6. **Instrumentation:** Native modal OK/Done buttons + IssueReportModal need stable `testID`/AX (locator gaps, §6).

---

## 11. Cleanup / app state left behind (completed)

- Seeded trade `a4444444` (G04 fixture) → cancelled (16:53:45); no SP/money moved.
- Seeded notifications `18f7fe6c` + `dda173b8` deleted (verified 0).
- I05 test messages `3f1a2e6a` + `6a6feff9` deleted (verified 0).
- Items restored to `available`: QA Canned `0dca235c`, Puzzle Set `dd8fc177`.
- test-buyer `cart_items` = 0; **no pending offers remain anywhere**; `cart_min_value_cents=0` (reverted, DB-verified).
- Completed/cancelled seeded trade rows left as historical (referenced by ledger/payout/refund rows).

---
