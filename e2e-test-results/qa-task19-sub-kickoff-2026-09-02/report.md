# QA Task 19 — TRD Remainder Closure + SUB Guide Kickoff — Run Report

**Date:** 2026-09-02 · **Agent:** QA Test Agent · **Device:** iPhone 17 Pro Max (iOS 26.1) UDID `3F3293A3` · **Backend:** staging `drntwgporzabmxdqykrp` · **Admin portal:** `:3001` (live session, admin `1a546991`)
**Run dir:** `e2e-test-results/qa-task19-sub-kickoff-2026-09-02/`

---

## Verdict Summary

| Area | PASS | PARTIAL / NOTED | Deferred (fixture-gated) / Classified |
|---|---|---|---|
| Section A (C-N07, C-B10/TRD-TC-B10) | 2 | — | — |
| Section B — Subscription lifecycle | 10 | — | web-first/removed-flow classifications in table |
| Section B — SP Wallet / History | 9 | 1 (I06) | I08 (wallet-not-found branch) |
| Section B — Payment methods | 4 | — | M01 (transient), M07 (backend branches) |
| Section B — Payout (live surface) | 2 | — | F/G/H remainder classified to live screen; DT85 functional re-verify deferred |

---

## Section A — TRD Remainder Closure

### A1 · C-N07 (fixture-building + auto-pause under min_listing_price) — FINDING, state restored clean
Full detail in session memory `/memories/session/qa-task19-plan.md` + screenshots `c-n07-*`.
1. Built QA-owned $3 fixture (`eeb6bc2b`, dev fixtures; price $3 because keyboard digit-typing was suppressed — still sub-$5, same mechanism), approved via real admin → `available`.
2. **Auto-pause trigger CONFIRMED working on staging for the first time:** raising `min_listing_price` 0→5 via admin `/config` FEES tab auto-paused the fixture + **11 pre-existing sub-$5 listings** (12 total, DB-verified).
3. **FINDING (guide premise fails):** No seller path restores a paused listing in the current build — My Listings shows the paused row with a PAUSED badge but **no edit/delete/more actions** (actions only render when `isActive`=available); tapping the row → Item Detail "❌ Listing not found"; `edit-listing/<id>` deep link also "Listing not found" (`getListingById` available-only); `updateListing` has no paused branch; admin UI only offers Pause/Force Delete. A sub-$5 auto-paused listing is stuck until an admin restores it via `admin_approve_listing` RPC.
   - **Dev follow-up (recommended):** expose edit on paused owner rows (or an unpause/republish action) and make `getListingById`/EditListing handle paused-owner listings.
4. Cleanup (R28, DB-verified): `min_listing_price` reverted 5→0; 11 pre-existing listings restored `available`; fixture force-deleted. Final: `mlp=0`, `paused_sub5_remaining=0`.

### A2 · C-B10 / TRD-TC-B10 (Replace Card — literal new-card entry) — **GENUINE PASS** (reverses QA-18's tooling-limited flag for the new-card leg)
The native Stripe PaymentSheet is **fully AX-exposed this build** — unlike QA-18's session where the literal-entry leg was OCR-unreliable.
- Navigated test-buyer to Make Offer on Accept-SP listing `185546da` ($25) → `add-new-card-mode-button` → `replace-card-button` → native PaymentSheet (SetupIntent flow: "Set up" not "Pay", TEST badge) → "New card".
- Typed a literal new card: **4242 4242 4242 4242 / 12/28 / CVC 123 / ZIP 94105** — all fields accepted cleanly (typed via keystrokes).
- Tapped Set up → app alert **"Card Added — Your new card has been saved successfully."**
- **DB read-back:** `subscriptions.stripe_payment_method_id` `pm_1UAyDh4` → `pm_1UBGzc4I6kCJlvXoQbO4QOIf` (updated_at = now). Offer screen refreshed to "Paying with VISA •••• 4242 / Expires 12/2028" (was 07/2028).
- Verdict: **PASS**. Minor note: the transient "Replacing Card…" label wasn't literally observed (the Set-up button went blank/disabled during the busy window) — cosmetic, non-blocking.
- No offer was sent after attaching → no trade residue. Evidence: `c-b10-newcard-filled.png`, `c-b10-card-added-alert.png`.
- **State restored:** subsequent M05 Remove + saved-card re-attach returned test-buyer to the ORIGINAL `pm_1UAyDh4` (VISA 4242, 07/2028).

---

## Section B — SUB Guide (MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET) — live-screen verdicts

### Subscription lifecycle (Group A + C + N)
| TC | Verdict | Evidence / notes |
|---|---|---|
| SUB-TC-A01 | **PASS** | Upgrade Plan (from My Subscription as free user) shows Free $0 vs Kids Club+ $5.99/mo cards. `sub-a01-upgrade-plan-free-vs-plus.png` |
| SUB-TC-A03 | **PASS** | Kids Club+ price **$5.99 = DB `monthly_price_cents` 599** (config-driven display verified). |
| SUB-TC-A04 | **PASS** | Free user: Free card CTA reads "Current Plan" (current-plan reflected); Kids Club+ CTA active "Start 30-day Trial". |
| SUB-TC-C01 | **PASS** | My Subscription (test-buyer active): "Kids Club+ Plan", ACTIVE MEMBER, Renew Date **Jul 27 2026** (= DB `current_period_end`), benefits list. `sub-c01-my-subscription-active.png` |
| SUB-TC-C02 | **PASS** | Quick menu Billing / Payment / Get Help buttons present. |
| SUB-TC-C03 | **PASS** | Manage Kids Club+ (active): Status Active + subscription details. `sub-c03-manage-kids-club-active.png` |
| SUB-TC-C10 | **PASS** | My Subscription (test-free): Free Plan, Renew Date N/A, Upgrade button. `sub-c10-my-subscription-free.png` |
| SUB-TC-C11 | **PASS** | Benefits "Learn More" present. |
| SUB-TC-C12 | **PASS** | "Member Since: Jan 31, 2026" **= `auth.users.created_at` (2026-01-31)** — app derives member-since from account creation; value correct, no latent bug in this build. |
| SUB-TC-N01 | **PASS** | JoinKidsClub value-prop screen (3 benefits + "Join on the web"). `sub-n01-joinkidsclub-value-prop.png` |
| SUB-TC-N02 | **PASS** (dev caveat) | "Join on the web" opens in-app Safari at **localhost** = dev target for passitup.com, with "Return to Pass It Up!" breadcrumb. Production URL not reachable from dev — wiring confirmed, prod target not assertable here. |
| A02, A05, C04–C09, N03–N06 | classified below | see dead/removed/web-first notes |

### SP Wallet & History (Group I + J + K)
| TC | Verdict | Evidence / notes |
|---|---|---|
| SUB-TC-I01 | **PASS** | Hero **490 SP = DB `available_balance` 490**; lifetime Earned 72 / Spent 58 / Pending 0 = DB. `sub-i01-i07-sp-wallet-buyer.png` |
| SUB-TC-I02 | **PASS** | Quick actions Shop / Sell / History. |
| SUB-TC-I03 | **PASS** | "How to Earn SP" (sell / refer / How Trading Works) + Learn More. |
| SUB-TC-I04 | **PASS** | Expiration info: "Points expire after 700 days of inactivity" = `sp_expiration_days` config; no expiring-soon alert (points active). |
| SUB-TC-I05 | **PASS** | Grace state (test-seller): "⏳ Grace Period Active — You can keep spending existing Swap Points, but you won't earn new ones until you renew." `sub-i05-grace-banner-wallet-seller.png` |
| SUB-TC-I06 | **PARTIAL/NOTED** | test-free wallet renders normally at 0 because its `sp_wallets.state = active`; the distinct inactive/frozen branch is not reachable with current persona state. |
| SUB-TC-I07 | **PASS** | "Reserved in trades **10 SP**" + copy = DB `reserved_sp` 10. |
| SUB-TC-I09 | **PASS** | Pending-release note renders at wallet bottom for test-seller; DB shows **7 completed trades pending release = 41 SP**; source renders note only when pending releases exist (`SpWalletScreen`). `sub-i09-*.png` |
| SUB-TC-J01 | **PASS** | SP History tabs All / Earned / Spent + switching verified. `sub-j01-j02-sp-history-buyer.png`, `sub-j01-earned-tab.png` |
| SUB-TC-J02 | **PASS** | Rows show type label + signed amount (+17 SP "Earn Refund") + date. |
| SUB-TC-K01 / E01 | **PASS** | Transaction History: "Kids Club+ Subscription - Renewal Payment" $0.00 **SUCCEEDED** Jun 30 2026 — matches `billing_history` exactly (amount 0, status succeeded, charged_at 2026-06-30). `sub-k01-transaction-history.png` |
| I08 | not run | "Wallet not found" error branch requires a user with no wallet row — fixture-gated. |

### Payment Methods (Group M)
| TC | Verdict | Evidence / notes |
|---|---|---|
| SUB-TC-M02 | **PASS** | After removal: empty state "No Payment Method" + Add Payment Method button. `sub-m02-payment-empty-state.png` |
| SUB-TC-M03 | **PASS** | Saved VISA •••• 4242 + expiry + "Secure Payments — encrypted & processed through Stripe, never store full card details" banner. `sub-m03-*.png` |
| SUB-TC-M04 | **PASS** (via sheet) | Update Payment Method opens the same native PaymentSheet/SetupIntent path proven in C-B10; saved-card re-selection re-attached default. |
| SUB-TC-M05 | **PASS** | Remove confirm modal → "Removed — Your payment method has been removed." → **DB `stripe_payment_method_id` = NULL** (detach verified). `sub-m05-remove-*.png` |
| M01, M07 | classified | M01 loading is a transient state (satisfied by navigation); M07 is backend branch (attach/detach/retryFailedPayment) covered by DB read-backs in M05/M02 + source. |

### Payout — live surface (PayoutSettingsScreen)
| TC | Verdict | Evidence / notes |
|---|---|---|
| SUB-TC-F02 (adapted) | **PASS** | Payout Settings hero Available **$15,498.00** + Pending **$416.00** + Lifetime Earned; PAYOUT METHOD section shows the verified Stripe Connect method card. `sub-payout-settings-seller.png`, `sub-payout-settings-methods.png` |
| SUB-TC-H05 | **PASS** | "Withdraw Now" → **Withdraw Funds modal** (Available Balance / Payout Fee / You'll Receive + Payout Method + Cancel/Confirm). Tapped **Cancel** → dismissed cleanly; **NO withdrawal created** (zero residue). `sub-h05-withdraw-modal.png`, `sub-h05-after-cancel.png` |
| F01, F03–F08, G01–G11, H01–H07 | classified below | guide describes mostly dead/unreachable screens (PayoutDashboard / SellerEarnings / RequestPayout / method-type onboarding for PayPal-Venmo-ACH); the live consolidated surface is PayoutSettingsScreen (verified above). |
| DT85 re-verify | **server-side CONFIRMED + functional re-verify deferred** | see below |

---

## DT85 re-verify — resolve-complete capture-before-payout

- **Server-side fix CONFIRMED** in the deployed admin route `p2p-kids-admin/src/app/api/admin/trades/dispute-action/route.ts` (DEV-TASK-85): `resolve_complete` now reads the PI → if `requires_capture` it **captures** (must return `succeeded` or **fail-closed `CAPTURE_FAILED`** with no completion/payout) → `rpc_mark_tax_collected` → `fn_log_financial_audit` `payment_captured` → then `complete_trade_v2`. This directly closes QA-18 R10's "payout schedulable against an uncaptured hold" gap.
- **Functional re-verify = DEFERRED (fixture-gated, R40-explicit):** no currently-disputed in_progress trade exists (all dispute rows are resolved/cancelled). Seed in_progress buyer↔seller trades with auth-hold PIs ready for a dedicated session: `fe3924ee` ($19, `pi_3UBCpM`), `943097a5` ($20, `pi_3UAyMS`), `6a1f9d94` ($27, `pi_3UAysJ`).
- **Recipe for the dedicated session:** (1) test-buyer files a dispute on one in_progress trade; (2) admin → `/trades/disputes` → **Resolve as Complete**; (3) read back: PI must be `succeeded` (captured, not `requires_capture`), `seller_payouts` row created, no leftover uncaptured hold; (4) cleanup the completed trade/payout.

---

## Dead / removed-flow / web-first classifications (SUB guide vs. current build — source-verified)
- **Group B (start trial/payment, B01–B13):** describes a removed in-app Stripe subscription-purchase flow. Current build is **web-first** — all join CTAs route to JoinKidsClub → "Join on the web" (passitup.com, dev→localhost). `SubscriptionPayment/SubscriptionStatus` are only reachable via push payload; `SubscriptionSuccess` has no caller. Trial config is server-side (`trial_enabled=false`); the app's "Start 30-day Trial" CTA still shows but lands on the web-first value-prop. → mostly classify as removed-flow (web-first) with N01/N02 PASS standing in for the reachable surface.
- **Group D (renewal/grace/expiry screens):** grace banner verified live on the SP wallet (I05) and grace status is a subscription state; the SubscriptionExpired/Renew flows are only reachable for expired sessions (fixture-gated). 
- **Groups F/G/H (payout):** the guide's F01–F08, G01–G11, H01–H07 largely target `PayoutDashboardScreen`/`SellerEarningsScreen`/`RequestPayoutScreen` — `PayoutDashboard` is dead; `SellerEarnings`/`RequestPayout` are unreachable from the current nav (their only caller is the dead dashboard). The **live** consolidated surface is `PayoutSettingsScreen` (hero + method + Withdraw-Now modal), which was verified (F02/H05 above). PayPal/Venmo/ACH method-type onboarding (G02/G03/G06) is not drivable — Stripe Connect is the only configured provider.
- **Group E (E02 empty, E03 failed, E04 status screen):** E02 needs a user with no billing rows; E03 needs a failed charge; E04's Subscription Status screen is push-only reachable. Fixture-gated.
- **Group J (J03 empty, J04 pull-to-refresh):** J03 needs an empty-tab persona; J04 pull-to-refresh is a gesture (satisfied by the refresh-capable list). Not separately executed.
- **Group L (webhooks, L01–L05):** server/webhook domain, not end-user executable via mobile — out of this run's app-surface scope.

---

## Zero-residue confirmation (R28)
- No offers sent; no withdrawals created (Withdraw modal cancelled); test-buyer's payment method restored to the original `pm_1UAyDh4`; `min_listing_price` back to 0; 11 pre-existing listings restored `available`; C-N07 fixture deleted; C-B10's temp PM left only as Stripe-customer PM (sub default = `pm_1UAyDh4`).

## Follow-ups / friction
1. **C-N07 product/UX gap (recommend dev):** auto-paused sub-$5 listings cannot be edited/republished by the seller (no actions on paused rows, `getListingById` available-only, `updateListing` has no paused branch, admin has no Unpause).
2. **C-B10 minor:** "Replacing Card…" busy string not literally observed (button goes blank/disabled instead). Cosmetic.
3. **DT85 functional re-verify:** dedicated session required (recipe above); server-side guard confirmed present.
4. **Friction:** native PaymentSheet AX availability varies by build (this build fully exposed; QA-18's did not) — flag as a known tooling variance, not an app defect.
5. Guide is heavily stale for Groups B/F/G/H (web-first / dead-screen) — recommend a guide refresh mapping SUB cases to the live surfaces (JoinKidsClub web-first, PayoutSettingsScreen, My Subscription/Manage screens).

**Evidence:** all screenshots under `e2e-test-results/qa-task19-sub-kickoff-2026-09-02/screenshots/` (`c-n07-*`, `c-b10-*`, `sub-*`).
