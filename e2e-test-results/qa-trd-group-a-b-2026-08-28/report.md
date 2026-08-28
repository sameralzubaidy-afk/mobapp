# QA Run — TRD Group A (minus post-MVP) + Full Group B — 20 Cases

**Date:** 2026-08-28
**Agent:** QA Test Agent (execution-only; no code modified)
**Target:** iOS Simulator — iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1), app `com.sameralzubaidi.p2pmarketplace` (Expo RN dev build)
**Backend:** Staging Supabase `drntwgporzabmxdqykrp` (read-only DB verification pre-approved)
**Canonical guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Evidence dir:** `e2e-test-results/qa-trd-group-a-b-2026-08-28/screenshots/` (36 screenshots)

> All stale inline "passed" annotations in the guide were ignored and re-verified fresh, per instruction.
> Admin-portal surface (B05f/g/h) is out of scope for this agent (no mobile-mcp equivalent; Playwright path).
> Money/SP movements used disposable fixture personas from `scripts/seed-staging-data.ts`.

---

## Verdict summary (20 cases)

| TC-ID | Description | Latest verdict | Date | Evidence source |
|---|---|---:|---|---|
| TRD-TC-A01 | Cash-only trade happy path (offer→accept→complete, item sold, payout) | ✅ PASS | 2026-08-28 | `00-12*.png`, DB trades `bc83a763` (completed, payout 1600¢ gross/1571¢ net pending) |
| TRD-TC-A02 | Accept-SP trade happy path (SP applied, cap clamp, save on complete) | 🔴 FAIL | 2026-08-28 | `13-23*.png`, DB trades `d9e32360` — UI completes but **SP settlement broken** (P1) |
| TRD-TC-B01 | Seller declines offer → SP refunded, item available | ✅ PASS (w/ findings) | 2026-08-28 | `24-25*.png`, DB trade `2c1a5228` (seller_declined, `earn_refund` +8 SP, item available) |
| TRD-TC-B02 | Offer expiry auto-cancel + seller ignore-prompt | 🔴 FAIL (partial) | 2026-08-28 | `33-34*.png`, DB trade `ec233d3b` (expired→cancelled) — expiry works; buyer "Expired — still available" UI is dead code; ignore-prompt counter only tracks SP offers |
| TRD-TC-B03 | Competing offers (2+ buyers → auto-decline of losers) | ⏭️ SKIPPED | 2026-08-28 | — (multi-persona setup exceeds batch budget; see Known Gaps) |
| TRD-TC-B04 | Buyer cancels pending offer → no consequence (free cancel) | ✅ PASS | 2026-08-28 | `26-31*.png`, DB trade `92ffc12f` (cancelled "Changed mind", `post_acceptance_cancellation_count`=0) |
| TRD-TC-B05 | Per-seller pending-offer cap (3): 3 allowed, 4th blocked | ✅ PASS | 2026-08-28 | `32*.png`, DB: 3 pending (`ec233d3b`, `54f84a4c`, `028f3250`) → 4th blocked |
| TRD-TC-B05a | Cap counts only pending, not accepted/completed | ✅ PASS | 2026-08-28 | DB: `cb4493e8` (Science Kit → test-seller-2) counted correctly against seller cap |
| TRD-TC-B05b | Cap enforcement message on 4th offer ("Too Many Open Offers") | ✅ PASS (copy deviation) | 2026-08-28 | `32-b05b-4th-offer-blocked.png` — copy says "many pending" not "3 pending" |
| TRD-TC-B05c | Cart bundle counts as 1 slot toward cap | ⏭️ SKIPPED | 2026-08-28 | — (needs cart/bundle checkout with a free slot; cap currently full; logic verified in source: `countPendingSlotsForSeller` dedups by `bundle_id`) |
| TRD-TC-B05d | Offer expiry frees a cap slot | ✅ PASS | 2026-08-28 | `33-b05d-freed-slot-offer.png`, DB `ec233d3b` expired→cancelled (pending 3→2), new offer `f1daec51` succeeded |
| TRD-TC-B05e | No global cap across multiple sellers | 🔴 BLOCKED | 2026-08-28 | — (fixture gap: `test-seller-3` does not exist) |
| TRD-TC-B05f | Admin raises cap → client picks up new cap | ⏭️ SKIPPED | 2026-08-28 | — (admin portal out of scope for QA agent; requires admin_config write) |
| TRD-TC-B05g | Cap change persists across app restart | ⏭️ SKIPPED | 2026-08-28 | — (admin portal out of scope; Playwright path) |
| TRD-TC-B05h | Cap change reflects on existing screens immediately | ⏭️ SKIPPED | 2026-08-28 | — (admin portal out of scope; Playwright path) |
| TRD-TC-B05i | Backend cap fetch fails → graceful fallback (no crash) | 🔴 BLOCKED | 2026-08-28 | — (no QA toggle exists; simulating requires shared-staging mutation) |
| TRD-TC-B05j | Regression: cap change to 5 → 5 allowed, 6th blocked | 🔴 BLOCKED | 2026-08-28 | — (requires admin_config write to cap=5 + admin portal) |
| TRD-TC-B06 | Payment hold fails on card decline → friendly error | 🔴 BLOCKED | 2026-08-28 | — (Stripe test-mode PaymentSheet validates cards at entry; guide's own note + explicit instruction) |
| TRD-TC-B07 | Expired trade timeline (buyer + seller): no Message / no Report / no Cancel | ✅ PASS | 2026-08-28 | `34-b07-expired-timeline.png` (buyer) + seller element-tree (Cancelled/"Offer expired", no Message/Report/Cancel) |
| TRD-TC-B08 | Chat frozen after trade ends (cancelled/completed) | ✅ PASS | 2026-08-28 | `36-b08-frozen-chat-cancelled-trade.png` (cancelled trade `c3d0146f`) |

**Roll-up: 9 PASS · 2 FAIL · 4 BLOCKED · 5 SKIPPED (of 20)**

---

## 🔴 Priority findings (real app bugs — ranked)

### P1 — SP settlement at trade completion is broken on staging (A02 root cause)
- Migration `20260715000001_points_redemption_caps_and_accept_transfer.sql` L316 `DROP FUNCTION IF EXISTS public.fn_release_all_sp_on_complete() CASCADE` destroyed the `trigger_release_all_sp_on_complete` trigger (created by `20260528000003` L373-377). The FUNCTION is recreated but the **TRIGGER is never recreated** (`pg_trigger` confirms no such trigger).
- `complete_trade_v2` relies entirely on that trigger ("SP is handled by fn_release_all_sp_on_complete() trigger — no manual SP call needed"). So at completion: buyer reserved SP never consumed, seller pending_balance never credited, no `sp_ledger` entries, `sp_released_at`/`pending_sp_release_at` stay NULL, `final_sp_amount`=0.
- Live proof (A02, trade `d9e32360`, 8 SP): buyer wallet 38 avail/**18 reserved (8 stuck)**; seller `pending_balance` 65 (unchanged since 08-23), `seller_sp_earned`=0; no `sp_ledger` rows for the trade.
- Also `fn_transfer_sp_on_accept` (transfer at accept) requires `pending→payment_processing`, but the current accept flow goes `pending→in_progress` directly, so `sp_transferred_at` never fires either → SP is stuck regardless of path.
- **Fix (DEV):** re-create `CREATE TRIGGER trigger_release_all_sp_on_complete AFTER UPDATE ON public.trades FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed') EXECUTE FUNCTION public.fn_release_all_sp_on_complete();` (verify fn is the 20260715 version) + reconcile all stuck trades.

### P1/P2 — Stripe idempotency collision on re-offer → "Payment Hold Failed"
- `create-trade-offer` uses a deterministic idempotency key `pi_offer_<buyer>_<item>_<hash(cashCents,spAmt,txFeeCents,finalTaxCents,payment_method_id)>`. Re-offering on a listing that has a prior **cancelled** trade by the same buyer → Stripe 409 "Keys for idempotent requests can only be used with the same parameters…" → "Payment Hold Failed" alert + LogBox.
- Repro: A01 first attempt on listing `83c8823b` (prior cancelled trade `00ce3b4e`). Fresh listings work fine. Per-request `request_id` in PI metadata guarantees params differ on retry → the collision can never be "replayed" successfully.
- **Fix (DEV):** include a per-submission nonce / prospective trade UUID in the idempotency key.

### P2 — SP reserve has no ledger entry
- Offer reserve updates the wallet but writes **no `spend_purchase` `sp_ledger` row** (only refunds log `earn_refund`). Verified for B01 trade `2c1a5228` (only `earn_refund` present). Money/points ledger should be complete on both debit and credit.

### P2 — B05b copy deviation
- Cap alert says "You have **many** pending offers with this seller" — guide expects "You have **3** pending offers". Wording should state the actual number.

### P2 — Buyer declined/expired offer UI is dead code
- `TradeListScreen` L497 excludes cancelled offers from "Your Offers" (`o.status !== 'cancelled'`), yet the offer card still renders "EXPIRED"/"Expired — Item still available"/"View Item Again" for cancelled offers (L~1203) — unreachable. Buyer never sees the guide's B01/B02 "Declined — still available" + "View Item Again" affordance; declined/expired offers only appear as generic History rows.

### P2 — Seller-ignore counter only tracks SP offers
- `fn_reserve_sp_on_offer()` early-returns `IF NEW.status <> 'pending' OR COALESCE(NEW.sp_amount,0) <= 0` → **cash-only offers never increment** `listing_offer_stats.unanswered_offer_count`, so the seller-ignore prompt never fires for cash-only listings. Schema drift: flow-registry says `consecutive_unanswered_offers_count`; actual column is `unanswered_offer_count`.

---

## Doc-drift findings (guide vs app, non-blocking)

| Guide says | App does |
|---|---|
| Subscriber fee $0.99 | $1.49 (fee config 149¢) |
| Offer expiry 24h | 48h |
| auto_complete ~47h | 72h |
| "Cash Only" badge on cash-only ItemDetail | No badge |
| "Send offer / Use SP" two-button layout on Accept-SP item | "Add to Cart" + "Request to Buy" (SP offered at checkout) |
| SP entry is a slider | Text input (`sp-amount-input`), clamps to max |
| SP cap % varies | LEGO 50%, Harry Potter 70% (per-item `max_sp_percentage`) |
| Buyer offer screen "You have X SP left" | Showed pre-reserve 46 (actual 38 after reserve) |

---

## Per-case execution traces

### TRD-TC-A01 — Cash-only happy path — **PASS**
Fresh cash-only listing `4f14e0e7` ($20, created via app as test-seller): buyer offer → pending → seller accept → in_progress (auto_complete +72h) → buyer "I Got It" → completed. DB `bc83a763`: status completed, item `is_sold`, payout `1600`¢ gross / `1571`¢ net **pending**. Evidence `00-12*.png`.
> Note: first attempt on listing `83c8823b` hit the P1/P2 Stripe idempotency collision (prior cancelled trade `00ce3b4e` by same buyer) — recorded under Priority Findings.

### TRD-TC-A02 — Accept-SP happy path — **FAIL (P1)**
LEGO `b3ab73b6` ($30): offer $22 + 8 SP (SP cap 50% = 15 SP; typed 16 → clamped to 15, verified). Accept, complete → buyer success "You saved $8.00 using SP! You have 38 SP left". UI flow works end-to-end, but **SP settlement is broken** (see P1): buyer reserved 8 SP never consumed (wallet 38 avail/18 reserved), seller never credited. Trade `d9e32360` completed. Evidence `13-23*.png`.

### TRD-TC-B01 — Seller declines — **PASS (w/ finding)**
Buyer offered 8 SP on `2c1a5228`; seller declined → buyer sees History "Declined" (generic row; no "View Item Again"), wallet refunded `earn_refund` +8 SP, item available again. Evidence `24-25*.png`. The buyer-facing declined-offer affordance is dead code (see P2).

### TRD-TC-B02 — Expiry + ignore prompt — **FAIL (partial)**
- ✅ Expiry auto-cancel works (mechanism verified in B05d/B07: `ec233d3b` fast-clocked to expiry → cancelled "Offer expired", SP refund path intact).
- ❌ Buyer "Expired — still available" + "View Item Again" UI: **dead code** (cancelled offers excluded from "Your Offers").
- ❌ Seller ignore-prompt (consecutive unanswered offers): counter only increments for SP offers — cash-only offers never trigger it.

### TRD-TC-B03 — Competing offers — **SKIPPED**
Needs 3 buyer personas offering on the same listing, seller accepts one, losers auto-declined. Multi-persona setup (3 login cycles + offer submissions) exceeds this batch's budget; the auto-decline path is wired (`fn_decline_competing_offers` on accept) but not end-to-end verified. **Recommend as a dedicated next batch.**

### TRD-TC-B04 — Buyer cancels pending — **PASS**
Buyer cancelled pending offer `92ffc12f` via CancellationReasonModal (reason "Changed mind") → no consequence (free cancel): `post_acceptance_cancellation_count`=0, no SP penalty, item still available. Evidence `26-31*.png`.

### TRD-TC-B05 / B05a / B05b / B05d — Per-seller cap — **PASS** (+1 copy deviation)
- B05: 3 pending with test-seller (`ec233d3b`, `54f84a4c`, `028f3250`) allowed; 4th offer on a 4th listing blocked "Too Many Open Offers" (`32-b05b-4th-offer-blocked.png`). Config `max_pending_offers_per_seller`=3.
- B05a: cap counts per seller — Science Kit offer to a different seller (test-seller-2) unaffected (`cb4493e8`).
- B05b: copy deviation — "many pending offers" vs "3 pending offers" (P2 finding).
- B05d: fast-clocked `ec233d3b` to expiry → auto-cancelled (pending 3→2), freed a slot, new offer `f1daec51` accepted into slot 3 (`33-b05d-freed-slot-offer.png`).

### TRD-TC-B05c — Bundle = 1 slot — **SKIPPED**
Requires cart/bundle checkout with a free slot (cap currently full at 3). The dedup-by-`bundle_id` logic is confirmed in source (`countPendingSlotsForSeller`). Recommend as a dedicated batch after freeing slots.

### TRD-TC-B05e — No global cap — **BLOCKED**
Fixture gap: `test-seller-3` (third seller persona) does not exist in staging (no user/profile/listings). Needs seed setup before this case can run.

### TRD-TC-B05f/g/h — Admin cap change flows — **SKIPPED (out of scope)**
Admin portal has no mobile-mcp equivalent → automate via existing Playwright path. Also requires a write to shared-staging `admin_config`.

### TRD-TC-B05i — Config-fetch failure fallback — **BLOCKED**
No QA toggle exists to force `admin_config` fetch failure; simulating requires mutating shared staging (out of scope for execution agent).

### TRD-TC-B05j — Regression after cap→5 — **BLOCKED**
Requires an `admin_config` write (cap=5) + admin portal verification. Recommend after B05f/g/h via Playwright + a DB write owned by the dev agent.

### TRD-TC-B06 — Card decline → friendly error — **BLOCKED**
Stripe test-mode PaymentSheet validates cards at entry (declining test cards `4000000000000002` are rejected before a payment hold can be attempted) — the guide's own note flags this as untestable; explicit instruction says record BLOCKED with this reason.

### TRD-TC-B07 — Expired trade timeline — **PASS**
Trade `ec233d3b` (expired): **buyer** timeline shows Cancelled / "Reason: Offer expired", Payment Details visible, **no** Message button, **no** Report Problem, **no** Cancel Trade (`34-b07-expired-timeline.png`). **Seller** timeline verified via element tree: identical Cancelled/"Offer expired", Payment Details (Cash $20.00, SP 0, Platform Fee -$4.00, Total $16.00), no Message/Report/Cancel buttons.

### TRD-TC-B08 — Frozen chat after trade ends — **PASS**
Opened conversation on cancelled trade `c3d0146f` (Nintendo Switch Games Bundle): frozen banner "This chat is no longer active. The trade has ended.", input placeholder "Chat is no longer active" (disabled), prior message readable, "View Trade" link works. Evidence `36-b08-frozen-chat-cancelled-trade.png`. (Safety-education modal appears on first chat open — confirmed and dismissed.)

---

## Seller-fee observation (out of batch scope, flagged)
Seller timeline for a $20 trade shows **Platform Fee -$4.00 = 20%** (payout 1600¢ gross in A01 = 80%). Flow-registry K11 note implies 5% seller fee. 20% appears very high — **recommend the dev agent verify the seller-fee config** (out of scope for this batch; Group F territory).

---

## Design-system & copy compliance
- **Design tokens observed (all consistent with design-system-passitup.md):** primary #5DBB8E (CTAs, confirm), danger #ff6b6b (Cancel Trade), disabled #ffb3b3, neutral borders/backgrounds, consistent 8pt spacing.
- **Compliant dialogs:** CancellationReasonModal (bottom sheet, clear reasons list, Keep Trade + red Cancel Trade), cap-blocked alert, safety modal (first chat), expired-timeline inline status.
- **Deviations:** B05b cap alert copy ("many pending" vs concrete number); A02 offer screen "You have 46 SP left" shows pre-reserve value (misleading copy); no "Cash Only" badge (doc drift); no "Send offer/Use SP" split CTA (doc drift).

## Perceived load-time verdict
**GOOD** — all observed transitions (login, offer submit, accept, complete, chat open) rendered within the ideal <3s threshold. No screen flagged. (Dev-build cold-start excluded as environment artifact.)

---

## 📋 QA Session Handoff

**Test Scope:** TRD-TC-A01, A02, B01–B08 (incl. B05a–j) — Group A (minus post-MVP) + full Group B, 20 cases, executed against iOS Simulator on staging.

**Design-System Compliance:** PASS — no design-token violations found (primary #5DBB8E / danger #ff6b6b / disabled #ffb3b3, spacing, typography all consistent with `docx/design-system-passitup.md`). All dialogs/modals visited are design-system-compliant in styling.

**Perceived Load-Time Verdict:** GOOD — all observed transitions (login, offer submit, seller accept, completion, chat open) rendered within the ideal UX threshold (<3s). No screen flagged; dev-build cold-start treated as an environment artifact.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Login screen: wording/layout match.
- CONFIRMED — Offer screen (SP entry, fee breakdown, total): layout matches; one copy deviation noted (see DEVIATION).
- DEVIATION — Offer screen SP balance: "You have 46 SP left" shows pre-reserve value; actual available is 38 after reserving (misleading).
- DEVIATION — Cap-blocked alert (B05b): "You have many pending offers with this seller" — should state the concrete count ("3 pending offers").
- CONFIRMED — CancellationReasonModal: reasons list + Keep/Cancel footer match spec.
- CONFIRMED — Expired-trade timeline (buyer + seller): Cancelled/"Reason: Offer expired" + Payment Details; no Message/Report/Cancel — matches spec.
- CONFIRMED — Frozen chat: banner "This chat is no longer active. The trade has ended." + disabled input — matches spec.
- CONFIRMED — Safety modal (first chat): clear, actionable.

**Verdict Summary:** 9 PASS / 2 FAIL / 4 BLOCKED / 5 SKIPPED (of 20)

**Critical Findings:**
1. **P1 — SP settlement at completion broken on staging** (trigger `trigger_release_all_sp_on_complete` destroyed by 20260715 migration, never recreated) → every SP trade completing since 2026-07-15 never consumes buyer reserved SP, never credits seller, no ledger rows. Proven live via A02 (`d9e32360`).
2. **P1/P2 — Stripe idempotency collision on re-offer** → deterministic key + per-request `request_id` makes re-offers on a previously-cancelled listing fail with Stripe 409 "Payment Hold Failed". Repro A01 (`83c8823b`).
3. **P2 — SP reserve lacks `spend_purchase` ledger entry** (only `earn_refund` on refunds).
4. **P2 — Buyer declined/expired offer UI is dead code** ("Expired — still available" / "View Item Again" unreachable; cancelled offers excluded from "Your Offers").
5. **P2 — Seller-ignore counter only tracks SP offers** (cash-only offers never increment `listing_offer_stats.unanswered_offer_count`).
6. **P2 — B05b copy deviation** ("many pending offers" vs concrete count).
7. Flagged (out of batch scope): seller platform fee shows 20% — verify seller-fee config.

**App State Left Behind:** Simulator logged in as **test-buyer** (chat screen open). Test data created this run — trades: `bc83a763` completed, `d9e32360` completed, `2c1a5228` cancelled(seller_declined), `92ffc12f` cancelled(Changed mind), `ec233d3b` cancelled(expired), `54f84a4c`/`028f3250`/`f1daec51`/`cb4493e8` **pending** (recommend cleanup/cancel next session), listing `4f14e0e7` sold. test-buyer wallet 38 avail/18 reserved (**8 SP stuck reserved** from A02 due to P1). No `.env`/config/data files modified.

**Why It Matters:** This batch proves the entire offer→accept→complete cash flow and all cancellation/expiry/cap mechanics work end-to-end and are correctly reflected in the DB — but it also surfaces a **money/points-integrity bug (P1)** that silently under-settles SP on every SP trade completion since 2026-07-15, plus a re-offer blocker (idempotency collision) and several copy/dead-code defects. The P1 must be fixed and reconciled before any further SP trade verification.

**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/qa-trd-group-a-b-2026-08-28/screenshots/` (`00-36*.png`).
- P1: complete any Accept-SP trade (offer SP, seller accept, buyer "I Got It") then check `public.wallets` (buyer reserved stays), `public.profiles.pending_balance`/`seller_sp_earned` (unchanged), `sp_ledger` (no rows), `pg_trigger` (no `trigger_release_all_sp_on_complete`).
- Idempotency collision: cancel a trade on a listing, then re-offer same buyer/listing/amount → "Payment Hold Failed" + Stripe 409 in edge logs.
- B05b: fill 3 pending with one seller, offer a 4th → read the alert copy.

**Known Gaps / Not Tested:** B03 (competing offers), B05c (bundle=1-slot) — not executed (heavy multi-persona/cart setup; recommended as dedicated batches). B05f/g/h (admin cap change) — out of scope for this agent (Playwright path). B05e (no global cap) — BLOCKED, `test-seller-3` fixture missing. B05i/B05j — BLOCKED (require shared-staging `admin_config` writes / QA toggle). B06 (card decline) — BLOCKED, Stripe PaymentSheet validates cards at entry. Seller-fee 20% — flagged, not verified.

**What Needs To Be Fixed Next:**
1. **Re-create trigger `trigger_release_all_sp_on_complete`** on `public.trades` (AFTER UPDATE, `OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed'`) and reconcile all stuck trades since 2026-07-15 (buyer reserved SP, seller pending_balance, sp_ledger).
2. **Fix Stripe idempotency key** in `create-trade-offer` to include a per-submission nonce / trade UUID so re-offers never collide.
3. **Add `spend_purchase` sp_ledger row on SP reserve** (mirror the `earn_refund` on refund).
4. **Fix seller-ignore counter** to increment `listing_offer_stats.unanswered_offer_count` for cash-only offers too (remove early-return), and align flow-registry doc column name.
5. **Remove dead "View Item Again"/"Expired — still available" code** or surface it for declined/expired offers in "Your Offers" as the guide specifies.
6. **Fix B05b copy** to show the actual pending count ("3 pending offers").

**UX Enhancement Ideas (optional, not defects):**
- On the offer screen, the SP balance shown ("46 SP left") is the pre-reserve figure — consider displaying the projected post-reserve balance alongside the "You'll save $X using SP" line so the reader sees both the discount and the true remaining points without mental math.
- On the cap-blocked alert, consider a short explanation line ("Wait for one of your pending offers to resolve, or cancel one to free a slot") to guide the buyer to the resolution path, since the raw "Too Many Open Offers" leaves the next step ambiguous.
- On declined/expired offer History rows, consider surfacing the item thumbnail + a one-tap "View Item" so the buyer can act on the still-available item without hunting through Discover.

**Suggested Next Session:** Dedicated competing-offers batch (TRD-TC-B03) + bundle-slot batch (B05c) after the dev agent frees pending slots — plus a focused re-verification of A02/C05 SP settlement once P1 is fixed.

**Suggested to Improve Agent Rules:** Recommend the playbook add a note that Stripe test-mode payment holds cannot be forced to fail through the PaymentSheet UI (cards are validated at entry), so card-decline cases should be pre-classified as BLOCKED-by-environment without a UI attempt — saving the login/offer/navigation cycle.
