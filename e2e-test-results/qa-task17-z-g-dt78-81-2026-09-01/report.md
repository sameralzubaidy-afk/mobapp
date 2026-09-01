# QA Task 17 (v4) — DT78/79/80/81 Spot-Checks + Full Group Z/G Cancel-Request Verification

**Run dir:** `e2e-test-results/qa-task17-z-g-dt78-81-2026-09-01/`
**Date:** 2026-09-01 (~21:38 UTC completion)
**Device:** iPhone 17 Pro Max sim UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (iOS 26.1)
**Backend:** Supabase staging `drntwgporzabmxdqykrp`
**Admin portal:** `http://localhost:3001` (real admin session, trade-detail + Trade-Timing paths)
**Personas:** test-buyer, test-seller, test-free (staging registry)

---

## Verdict summary

| Group / Case | Verdict | Notes |
|---|---|---|
| **A · DT80 privacy** | ✅ PASS | A1 single Review Offer + A2 bundle Review Offer — no "Buyer pays via" row |
| **B · DT78 copy** | ✅ PASS | B2 bundle SP split "45 from buyer + 16 platform bonus"; H01/H02/H03 via `qa-trade-success` |
| **C · DT79** | ✅ PASS | buyer Your Offers + seller Needs Action redemption tag; disclaimer modal present |
| **D · DT81 payment method** | ⚠️ D1 PASS · **D2 FAIL (real defect)** · D3 PASS | D2 = PaymentMethodSection never calls attach EF |
| **E · Group Z** | Z01 ✅ · Z02 ✅ · Z03 ✅(+finding) · Z04 ✅ · **Z05 ⚠️ PARTIAL/FAIL** · Z06 ✅(+copy) · Z07 ✅ · Z08 ✅ | Z05 seller-response cascade = real defect |
| **G · notifications** | ✅ PASS | G05/G06/G07 + Z08 on-device + DB |

**Totals: 15 PASS · 2 FAIL (D2, Z05 cascade) · 4 findings (D2, Z05, Z03 no-notify-on-timeout, Z06 copy + Action Center Review button)**

---

## Section A — DT80 (seller Review Offer privacy) — PASS

- **A1 (single)** — test-seller Review Offer for Soccer Ball: NO "Buyer pays via" row (AX tree + OCR). `A1-single-review-offer-no-buyer-pay-row.png`.
- **A2 (bundle)** — test-seller Review Offer for b6b42db4 bundle: NO "Buyer pays via" row. `A2-bundle-review-offer-no-buyer-pay-row.png`.

## Section B — DT78 (TradeSuccess copy) — PASS

- **B2 bundle SP split** — bundle Review Offer item list shows "45 from buyer + 16 platform bonus" (`review-bundle-sp-split-465c4b14`). `B2-bundle-sp-split.png`.
- **H01 (free buyer upsell)** — `qa-trade-success?role=buyer&...&feeSavingsCents=200`: **"Trade complete! Kids Club+ would've saved you $2.00 on this trade — try it free for 30 days."** + [Try Kids Club+ Free — 30 Days]. `H01-free-buyer-upsell.png`. ✅
- **H02 (subscriber buyer used SP)** — `...spUsed=8&spAmountDollars=8&remainingSP=490`: **"Got it! You saved $8.00 using SP! You have 490 SP available."** `H02-buyer-saved-sp.png`. ✅ (requires `spUsed>0` to hit Permutation 2)
- **H03 (seller Accept SP)** — `role=seller&listingType=accept_sp&totalSpToSeller=50&spPendingReleaseDays=3`: **"50 SP releasing in 3 days — added to your pending wallet."** + [View Wallet] → opens SP Wallet. `H03-seller-accept-sp-verified.png`. ✅

## Section C — DT79 (redemption tags + disclaimer) — PASS

- Buyer Your Offers bundle card: `includes-points-redemption-tag` present (b6b42db4, sp=45); absent on sp=0 item. `C1-buyer-your-offers-tag.png`.
- Seller Needs Action bundle card: tag present. `C2-seller-needs-action-tag.png`.
- Disclaimer modal: `disclaimer-modal-accept-button` present; disabled-state not surfaced (documented tool-schema limitation, not a bug); functional gate (tap unchecked = no-op) confirmed.

## Section D — DT81 (stale payment method) — D1 PASS · **D2 FAIL (real defect)** · D3 PASS

- **D1 (checkout error-recovery) PASS** — real `INVALID_PAYMENT_METHOD` (saved card DETACHED on Stripe) → added VISA 4242 via checkout PaymentSheet → checkout immediately showed "Paying with VISA •••• 4242"; DB `subscriptions.pm` + Stripe verified. DT81 forceRefresh on checkout works. `D1-*.png`.
- **D2 (Manage Kids Club+ → "Update Payment Method") FAIL — REAL DEFECT** — `PaymentMethodSection.handleUpdatePaymentMethod` NEVER calls the `attach-payment-method` EF (unlike `PaymentMethodsScreen`); added VISA 4242 via sheet but it was NOT persisted as current — `subscriptions` + `user_subscriptions` still `pm_1UAy9b4` (5556), Stripe customer default still 5556, UI shows 5556 + misleading "Payment method updated successfully" alert. **Fix: add `attachPaymentMethodToCustomer(result.paymentMethodId)` in PaymentMethodSection** (mirror PaymentMethodsScreen step 3). `D2-*.png`.
- **D3 (PaymentMethodsScreen) PASS** — added VISA 5556 → screen showed 5556 + "Payment Method Saved"; checkout focus-refresh shows "Paying with VISA •••• 5556". `D3-payment-methods-after-add.png`.

## Section E — Group Z (Buyer Cancel Request & Escalation) — FIX-CANCEL

### Z01 · Buyer request → seller approves → cancel + refund — ✅ PASS
- Seller `a45caeb5` timeline: "Cancellation requested" card + reason + **Approve Cancellation** → confirm "Cancel this trade? … buyer will be refunded" → Cancel Trade.
- DB: `a45caeb5` → `cancelled`, `cancel_request_status=approved`, `resolution=approved_cancel`, cancelled_at 21:11:41.
- **Real Stripe**: PI `pi_3UAdsN…` → `canceled` ($14.33 uncaptured hold released). `Z01-seller-approve-view.png`.
- Buyer notified `cancel_request_approved` ("Your cancellation for "Soccer Ball & Goal Set" was approved — your refund is on its way.") + `trade_cancelled`.

### Z02 · Seller declines → escalates → admin approves-cancel — ✅ PASS
- Seller `c0d12340` timeline: **Decline** → "Send to our team?" modal → "Sent to Our Team".
- DB: `cancel_request_status=escalated`, trade stays in_progress, resolved_at 21:13:56. Buyer notified `cancel_request_escalated`.
- **Admin leg (real)**: `/trades/c0d12340…` → **Approve Cancel & Refund** → "Cancellation approved and refund issued." → DB `cancelled` + `approved` (resolved_by admin 1a546991) + PI `pi_3UAaC94…` `canceled` ($21.40) + buyer notified `cancel_request_approved` + `trade_cancelled`. `Z02-seller-decline-view.png`.

### Z03 · Timeout auto-escalates — ✅ PASS (with finding)
- Fast-clock (R14): `cancel_request_expires_at=now()-1min` on `4b880a9f` → `fn_escalate_expired_cancel_requests()` → `{"success":true,"updated":1}`; DB `requested→escalated`; audit `cancel_request_escalation_runs` id=25 (processed 1).
- **Admin leg (real)**: `/trades/4b880a9f…` → Approve Cancel & Refund → `cancelled` + PI `pi_3UAyMI…` `canceled` ($17.54) + buyer notified.
- ⚠️ **FINDING (real defect)** — Guide Z03 Expected Result (line 6748) asserts "buyer notified `cancel_request_escalated`" on TIMEOUT, but `fn_escalate_expired_cancel_requests()` (migration `20260901000000_cancel_request_flow.sql` ~L518–552) has **NO `user_notifications` insert** — only the seller-decline branch of `fn_respond_cancel_request` (L489–498) creates it. DB confirms **no** notification for 4b880a9f/Basketball on timeout. A buyer whose request times out (48h no seller response) gets NO notification that it escalated.

### Z04 · Buyer withdraws a pending request — ✅ PASS
- `943097a5` → `cancel_request_status=withdrawn`, reason "QA Z04 withdraw test reason", resolved_at 20:59:18; trade stays in_progress; seller notified `cancel_request_withdrawn`. UI: "Request Withdrawn / Your cancellation request was withdrawn. The trade continues." `Z04-*.png`.

### Z05 · Bundle: whole-bundle default + per-item option — ⚠️ PARTIAL / **FAIL (seller-response cascade)**
- **Whole-bundle request: PASS** — scope prompt "Cancel the whole bundle?" (`cancel-request-bundle-all-button`); both b6b42db4 trades (`e104e139`, `465c4b14`) got `cancel_request_status=requested` with IDENTICAL created_at + expiry (cascade request).
- **Per-item request: PASS** — on fresh bundle 1865943d, "Just This Item" flagged only `6a1f9d94` (`requested`, created 21:08:43); sibling `0fc9a126` untouched (`cancel_request_status=null`). `Z05-peritem-request-sent.png`.
- **Seller whole-bundle approve cascade: FAIL (REAL DEFECT, source-verified)** — seller approved on `e104e139` → `e104e139` cancelled (PI released $26.49), but sibling `465c4b14` (sp=45) left **in_progress** with `cancel_request_status=approved`, `cancelled_at=NULL`, **PI `pi_3UAdjE4…uSdtX5u` STILL `requires_capture` ($19.19 hold ACTIVE)**, 45 SP NOT released.
  - **Root cause**: `respondToCancelRequest('approve')` (`tradeServiceV2.ts` ~L306–335) invokes the `cancel-trade` EF with ONLY the single `tradeId`; the EF cancels just that trade, then `fn_respond_cancel_request` cascade-marks siblings' status `approved` but does NOT cancel them (their Stripe/SP holds stay live). FIX-CANCEL spec §4 "seller approve/decline cascades" is NOT met for the money path.
  - **Cleanup done**: admin Force Cancel on `465c4b14` (reason logged) → `cancelled`, `sp_released_at` set (45 SP back to available), PI `canceled` ($19.19). `Z05-bundle-seller-approve-view.png`.

### Z06 · Escalation disabled → decline ends the request — ✅ PASS (with copy defect)
- Admin Trade Timing set `cancel_request_escalation_enabled=false` → DB `false` (21:25:43).
- Buyer requested on `943097a5`; seller declined → DB `cancel_request_status=resolved`, `resolution=keep_trade`, trade stays in_progress, buyer notified `cancel_request_resolved` ("Trade continues" / "the trade will continue as planned"). No admin queue entry.
- ⚠️ **UI COPY DEFECT** — TradeTimelineScreen hardcodes the decline confirm modal + success alert to "Send to our team?" / "Sent to Our Team — escalated for review" EVEN when escalation is disabled; also the buyer "Request Sent" copy says "If they decline or don't reply, our team will review it." Server behavior correct; UI copy does not adapt to the config.
- **Config restored** to `true` (21:28:51, verified DB).

### Z07 · Gating — ✅ PASS
- **Pending offer** (`ce011027`): `cancel-trade-button` (pending cancel) shown; NO `request-cancel-button`. `Z07-pending-offer-cancel-trade.png`.
- **Duplicate pending** (`6a1f9d94` requested): `withdraw-cancel-request-button` (pending card) shown; NO `request-cancel-button`.
- **Dispute** (R21 state-substitution on `0fc9a126` `dispute_status='reported'`): NO `request-cancel-button` + NO `request-extension-button`; reverted to `none`.

### Z08 · Seller instant cancel unchanged + TFV2-023 — ✅ PASS
- Seller own **Cancel Trade** on `0fc9a126` → "Cancel all 2 items?" prompt → "Just This One" → DB `cancelled` 21:32:35 (reason "Item no longer available"), Stripe refund ref set.
- TFV2-023: `trade_events` `seller_cancelled` metadata `{level:3, seller_cancellation_count:3}` (consequence applied). `Z08-seller-cancel-view.png`.

## Notifications — G05/G06/G07 + Z08 — ✅ PASS (DB + on-device)
- **Buyer Notification Center**: "Cancellation approved" ×3, "Sent to our team", "Trade continues", "Trade Cancelled", "✨ 45 SP Returned — 45 SP returned to your wallet…". Tap-through on "Trade continues" → opened `943097a5` Trade Timeline (deep link works). `Z08-G05-NotificationCenter-buyer.png`.
- **Seller Notification Center**: "Cancellation requested" ×N, "Cancellation withdrawn" (Z04), "Trade Cancelled", "New Trade Request! 💬". `Z08-G05-NotificationCenter-seller.png`.

---

## Defects / findings (for dev follow-up)

1. **D2 (DT81, real defect, medium/high)** — `PaymentMethodSection.handleUpdatePaymentMethod` never calls the `attach-payment-method` EF → Manage Kids Club+ "Update Payment Method" does not persist the new card; misleading success alert. Fix in `PaymentMethodSection` (mirror `PaymentMethodsScreen` step 3).
2. **Z05 seller-response cascade (real defect, HIGH — money state)** — whole-bundle seller approve only cancels the target trade; siblings get `cancel_request_status='approved'` but stay `in_progress` with Stripe holds + SP NOT released. Fix: `respondToCancelRequest('approve')` (or the cancel-trade EF / `fn_respond_cancel_request`) must cancel + release ALL bundle siblings.
3. **Z03 timeout escalation no buyer notification (real defect)** — `fn_escalate_expired_cancel_requests()` creates no `cancel_request_escalated` notification (guide line 6748 expects one). Add the notification to the cron path.
4. **Z06 escalation-off UI copy (minor)** — decline confirm + success + buyer "Request Sent" copy always say "our team will review" even when `cancel_request_escalation_enabled=false` (actual outcome keep_trade).
5. **Admin Action Center Cancel Requests "Review" button (real defect)** — `ActionCenterClient.tsx` `handleAction` has no `approve` handler for `cancel_requests` → clicking Review shows a false "Approved item." toast with NO server call (request unchanged). The working admin path is `/trades/<id>` → Approve Cancel & Refund.

## App state left behind (cleanup notes)
- **Config restored**: `cancel_request_escalation_enabled=true` (verified DB).
- **Leftover in-progress trades** (test-buyer): `943097a5` (resolved/keep_trade — no pending request) and `6a1f9d94` (bundle 1865943d, `cancel_request_status=requested` — the Z05 per-item request the seller never responded to; will auto-escalate on expiry Sep 3).
- **Cancelled trades from this run**: a45caeb5, c0d12340, 4b880a9f, e104e139, 465c4b14, 0fc9a126 (all Stripe holds released; SP on 465c4b14 released).
- Pending singles `ce011027` + `81fba06b` still pending with test-seller (Z07 fixtures — can be reset via `npm run qa:reset-offer-fixtures`).
- 2-item bundle cart `1865943d` offer consumed (trade created).

## Friction / notes carried forward
- Timeline scroll is flingy (2 snap positions): swipe up 700 @y250 then swipe down 140 @(100,850) reveals the mid-section (approve/decline).
- Queued native alerts ("Trade Cancelled") can overlay the TradeSuccess deep-link render — dismiss, then re-fire.
- H02 needs `spUsed>0` to render the "Got it! You saved…" permutation.
- Action Center click was intercepted by the fixed sidebar — used JS clicks via the trade-detail page for admin actions.
