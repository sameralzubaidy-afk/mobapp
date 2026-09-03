# QA Task 22 (v4) — Close the SUB Remainder + Verify Dev Tasks 92 & 93 — Run Report

**Date:** 2026-09-02 · **Agent:** QA Test Agent · **Device:** iPhone 17 Pro Max (iOS 26.1) UDID `3F3293A3` · **Backend:** staging `drntwgporzabmxdqykrp` · **Web target:** `p2p-kids-web` :3002 (real/non-mock) · **Admin:** :3001 · **Stripe:** acct_1ShGft4I6kCJlvXo (test mode)
**Run dir:** `e2e-test-results/qa-task22-sub-remainder-2026-09-02/` · HEAD `7735d346` (DT92 + DT93 committed)

---

## Executive summary

**Dev Task 92: BOUNCES BACK — item 2 (initial billing_history row) FAILED live.** A real web purchase ($5.99, card 4242, disposable user) created the `subscriptions` row (active, period to 2026-10-02) + `subscription_events` audit row, but **no `billing_history` row was written for the initial invoice** and `last_payment_date`/`last_payment_amount` stayed NULL. Items 1/3/4 of DT92 were already verified by DT92 itself (item 1 env secret live-probed; item 3 Manage remap is subsumed by the DT93 visual pass here).

**Dev Task 93: CLOSES CLEAN (visual + source).** All four DT93 targets verified:
- Source audit of the 4 fixed files returns **zero** legacy off-palette colors (`#4A7C59|#E53935|#4CAF50|#29B6F6|#0066CC|#111827|#4b5563|#6b7280|#166534`); only the intentionally-left `#808080` neutral badges remain.
- On-device: ManageKidsClubScreen **active / grace / cancelled / cancel-reason-modal / free** states all render the semantic palette (badge Active `#5DBB8E`, Grace `#E85D75`, Cancelled `#FFA726`; cancel button + modal confirm `#E85D75`; re-subscribe/subscribe `#5DBB8E`; auto-renew switch green `#5DBB8E`; disabled Confirm `#CCCCCC`→ enabled `#E85D75`). JoinKidsClubScreen web-card success-tint grammar reads on-brand (`#E8F5F0` tint / `#5DBB8E` accent, neutral text — no green-on-tint). JoinKidsClubButton hint `#999999`.
- SubscriptionStatusScreen (Batch 0 item 5 / E04): **not reachable on-device** (deep link does not navigate; no in-app nav; no AdminDashboard link — the source comment is stale). DT93's remap is verified at the source level only.

**Batch 1 (budget): PASS** — E02 (billing empty), J03 (SP empty per tab), J04 (pull-to-refresh wired).
**Batch 2:** L03 **PASS live** (negative-signature POST → 400 `INVALID_SIGNATURE`, no mutation); L02 **PARTIAL** (failing-renewal fixture not built this session).
**Batch 4 remainder:** C08 PASS, A02 PASS (render), A05 doc-drift (Overview = JoinKidsClub alias), D03 reachable + structure verified (expired-date population still needs an expired persona). The balance of the 44-case remainder is ledgered below with explicit reasons (mostly fixture-gated or already-covered/retired per QA Task 21).

---

## Roll-up (this session)

| Area | Result |
|---|---|
| Batch 0 — DT92 item 2 (initial billing row) | **FAIL** (money-adjacent; DT92 bounces back) |
| Batch 0 — DT93 source audit | **PASS** |
| Batch 0 — DT93 Manage visual (active/grace/cancelled/modal/free) | **PASS** |
| Batch 0 — DT93 JoinKidsClub + button hint | **PASS** |
| Batch 0 — SubscriptionStatusScreen visual | **BLOCKED** (reachability — push-payload fixture only) |
| Batch 1 — E02 / J03 / J04 | **PASS** ×3 |
| Batch 2 — L03 | **PASS** (live) |
| Batch 2 — L02 | **PARTIAL** (fixture) |
| Batch 4 — C08 / A02 / D03 | **PASS** (C08, A02 render) / reachable+structure (D03) |
| Batch 4 — A05 | doc-drift (screen aliases JoinKidsClub) |

---

## Batch 0 — Dev-fix verification (gates DT92/DT93)

### 0.1 — DT92 item 2: initial `billing_history` row — **FAIL**

**Disposable:** `qa.alice.17883913028427616@kidsmarketplace.test` (user `f6822d33-5c38-4f31-a627-ad07bd0809d5`, UI signup → phone verified → profile complete).

**Drive:** web `/join?email=…` → real Stripe Checkout (card 4242, name, ZIP 06850, phone) → success page `…/account/subscription?session_id=cs_test_a1PVnc…`.

**DB after purchase:**
- `subscriptions`: status **active**, period `2026-09-02 23:24:07 → 2026-10-02 23:24:07`, `sub_1UBNVj4I6kCJlvXosE287u79`, `cus_VBl1Wo2CRMN3L2`. ✅
- `subscription_events`: 1 row `web_subscription_upsert` (source `web_first_subscription_r7`). ✅
- **`billing_history`: EMPTY** ❌ (the DT92 item-2 fix target)
- `last_payment_date` / `last_payment_amount`: **NULL** (the `invoice.payment_succeeded` handler's `record_payment_attempt` never completed)

**App propagation:** Manage Kids Club+ showed **Active / Next Billing Date October 2, 2026 / 30 days** (correct fresh-web-sub display — unlike test-buyer's stale July 27 legacy quirk).

**Webhook v49 deployed** (`get_edge_function` version 49) and contains `recordInitialBillingRow` wired into BOTH row-creating handlers (`checkout.session.completed` + `customer.subscription.created`) gated on `old_status == null` (verified in the deployed source). Both Stripe events carried `latest_invoice` (`in_1UBNVj4…`) in their payloads (verified via Stripe events list). The initial invoice is **paid, $5.99** but has **no `charge`/`payment_intent`** (this env's invoices omit them → charge-id falls back to invoice.id). `billing_history.charge_id` has a UNIQUE constraint; currency/status/charged_at all default. The schema permits the upsert. `sendSubscriptionWelcomeNotification` cannot throw (fully try/catch'd) so it cannot skip the billing write.

**Root-cause candidates (dev must confirm via EF console — the log-query tool was down this whole session with a persistent "Backend error", same as QA Task 21):**
1. `recordInitialBillingRow` ran but its `billing_history` upsert failed silently (logged `[stripe-webhook-subscriptions] billing_history insert failed`) — OR
2. `invoice.payment_succeeded` raced the row creation (the exact QA Task 21 F-A1 race the fix was meant to close) AND the compensating `recordInitialBillingRow` did not persist on the row-creating event.

Only **one** `subscription_events` row exists, so only ONE handler executed the upsert RPC; the sibling handler either failed user-resolution or was not delivered. Because only one RPC ran and `last_payment_*` is NULL, the initial-invoice legs did not converge on a billing row.

**Recommendation (dev):** reproduce with the disposable-purchase recipe and read the EF console logs for `recordInitialBillingRow` (`recorded initial charge` vs `billing_history insert failed`) and for `handleInvoicePaymentSucceeded`'s `record_payment_attempt failed`/`no subscription record`. The fix's guard/ordering needs a follow-up (likely: move the billing write ahead of the welcome notification, and/or make `recordInitialBillingRow` resilient when the event object's `latest_invoice`/the invoice's charge ids are absent).

### 0.2 — DT93 source audit — **PASS**
`grep -E "#4A7C59|#E53935|#4CAF50|#29B6F6|#0066CC|#111827|#4b5563|#6b7280|#166534"` over `ManageKidsClubScreen.tsx`, `JoinKidsClubScreen.tsx`, `SubscriptionStatusScreen.tsx`, `JoinKidsClubButton.tsx` → **empty**. Only intentional `#808080` neutral badges remain (ManageKidsClubScreen L690/693 `badge_expired`/`badge_free`; SubscriptionStatusScreen L97/99 expired/default).

### 0.3 — ManageKidsClubScreen visuals — **PASS (all reachable states)**
| State | Persona | Evidence |
|---|---|---|
| Active (badge + cancel btn + auto-renew) | test-buyer | badge Active `#5DBB8E` 43.67% (0 `#4CAF50`); Cancel Kids Club+ `#E85D75` 64.25% (0 `#E53935`); auto-renew switch `#5DBB8E` 21.49% (0 iOS blue/green). `b0-manage-active-*.png` |
| Grace (badge + Re-subscribe) | test-grace | badge Grace Period `#E85D75` 52.95%; Re-subscribe `#5DBB8E` 50.76% (0 `#4A7C59`). `b0-manage-grace-*.png` |
| Cancelled (badge + info box) | disposable (full cancel) | badge Cancelled `#FFA726` 42.64%; DB status=canceled, reason too_expensive, access to Oct 2. `b0-manage-cancelled-*.png` |
| Cancel-reason modal (Confirm) | test-buyer | disabled Confirm gray `#CCCCCC` (source `modalConfirmBtnDisabled`), enabled → `#E85D75` 38.99%; Keep Subscription dismisses (no mutation). `b0-cancel-modal-*.png` |
| Free state (C08) | test-free | "You don't have an active Kids Club+ subscription." + green Subscribe CTA. `b4-C08-*.png` |

Design-system note: the cancelled-state info box reads "…Swap Points will be frozen for a **500-day** grace period." — faithful render of `admin_config.grace_period_days = 500` (config anomaly; likely should be 90). Flag for dev/ops.

### 0.4 — JoinKidsClubScreen visual (incl. "managed on the web" card) — **PASS**
As test-free: value-prop + web card ("Membership is managed on the web") + "Join on the web" CTA + hint. Colors: web-card tint `#E8F5F0` (90.04% of card band), Join-on-the-web button `#5DBB8E` (85.07%, 0 legacy `#4A7C59`), hint text `#999999`. **Judgment: the success-tint web-card grammar reads as on-brand** — `#E8F5F0` tint + `#5DBB8E` icon/accent with neutral (`#1A1A1A`/`#6B6B6B`) text; no legacy `#166534` green-on-tint text. `b0-joinkidsclub-testfree.png`

### 0.5 — SubscriptionStatusScreen (item 5 / E04) — **BLOCKED (reachability)**
Deep link `p2pkidsmarketplace://subscription/status` does **not** navigate (React Navigation linking config has no path for it — only the notification-service `deepLink.ts` `DEEP_LINK_ROUTES` maps `/subscription/status`, used when a push payload is tapped). No in-app caller navigates to `SubscriptionStatus`; `AdminDashboardScreen`'s "SUB-007 link" comment is **stale** (it only links ReviewModeration/TrialConversionTest). Only path = a push-payload notification row with `deep_link=/subscription/status` (a DB write the execution-only QA agent cannot make). DT93's remap is **source-verified** (audit clean + `statusColor()` maps active→`#5DBB8E` / trial→`#5B8FB9` / cancelled→`#FFA726` / grace→`#E85D75` / expired→`#808080`). E04 remains fixture-gated.

### 0.6 — JoinKidsClubButton hint — **PASS**
"Manage your membership at passitup.com" renders `#999999` (5.35% text pixels; 0 legacy `#6b7280`).

---

## Batch 1 — Cheap budget-only — 3 PASS

- **E02 PASS** (test-free): Transaction History empty state — gray receipt icon + "No billing history yet." Guide expects verbatim "No Billing History / You haven't been charged yet…" (doc drift). Guide refs `BillingHistoryScreen` (dead per DT93); live route = `TransactionHistory`. `b1-E02-*.png`
- **J03 PASS** (test-free): SP History All / Earned / Spent tabs all show "No transactions yet". `b1-J03-*.png`
- **J04 PASS**: RefreshControl wired in `SpTransactionHistoryScreen.tsx` (L147 `onRefresh={handleRefresh}`); pull gesture executed with no error (empty ledger → no data delta observable; source-corroborated).

---

## Batch 2 — Live-webhook legs

- **L03 PASS (live):** POST to `stripe-webhook-subscriptions` with a bogus `Stripe-Signature` → **HTTP 400** `{"error":{"code":"INVALID_SIGNATURE","message":"No signatures found matching the expected signature for payload…"}}`. No mutation (handler rejects before processing).
- **L02 PARTIAL (unchanged reason):** the mechanism (invoice.payment_failed → `record_payment_attempt` → grace after 3 failures + `triggerSpFreeze`) is present in the deployed v49 EF and `invoice.payment_failed` is subscribed. Driving a **live failing renewal** requires a fixture: active sub + declining/absent PM + test-clock advance + a 3-failure cycle — a dedicated fixture-build task, not fitted to this session.

---

## Batch 3 — Fixture builds (assessed)

| Case | Verdict | Reason |
|---|---|---|
| I08 — SP Wallet "Not Found" | **FIXTURE-GATED** | `getWallet` auto-inserts a missing row; no persona lacks a wallet row. Needs a wallet-deleted/RLS-failure fixture (QA can't write rows). |
| E03 — one failed-charge billing row | **FIXTURE-GATED** | All existing billing_history rows are `succeeded` (QA Task 21). A failed row must be produced by a real failing renewal (ties to L02) or a seed. |
| E04 — Subscription Status push payload | **FIXTURE-GATED** | Reachable only via a notification push-payload deep link (see Batch 0.5). Needs a QA-sanctioned notification-insert helper or dev push fixture. |
| D06/D07 — event/grace-reminder notification timing | **FIXTURE-GATED** | Needs clock + push fixtures (R14 fast-clock) plus DB reminder-flag resets — dedicated fixture session (R41). |

---

## Batch 4 — Remainder ledger (explicit per-case)

**Executed this session (new):** C08 PASS · A02 PASS (render) · D03 reachable+structure verified · A05 doc-drift (KidsClubOverview + SubscriptionPlans both registered to `JoinKidsClubScreen`, AppNavigator L771/775 — no distinct Overview/Plans screen; per-status coverage lives on Manage, verified).

**Carried from QA Task 21 (already PASS / covered / retired) — not re-run (R40 explicit):**
- A01, A03, A04, C01–C07, C10–C12, N01, N02, I01–I05, I07, I09, J01, J02, K01(=E01), M02–M05, F02(adapted), H05 → PASS in QA Task 19/20/21.
- Group B (B01–B13) + D02/D04 → 🔴 RETIRED (web-first; covered by N01/N02 + Web E2E).
- F01, F03–F08, G01–G11 (G02/G03 N/A), H01–H04, H06–H07 → the guide's `PayoutDashboard`/`SellerEarnings`/`RequestPayout` targets are dead/unreachable; live surface = `PayoutSettingsScreen` (QA Task 19 verified). **Remap (F/G/H PayoutSettings) = documented coverage gap** — the guide still needs a refresh mapping these (finding F-D2 carried).

**Remainder with explicit reasons (per QA Task 21 Section E ledger + this session):**
- **A02** → now PASS (render) this session.
- **A05** → doc-drift (Overview aliases JoinKidsClub; see above).
- **C08/C09** → C08 PASS (free state). C09 (expired Manage) → needs an expired sub fixture (no expired persona on staging).
- **D01** → grace banner on the Manage surface verified this session via test-grace (Grace Period badge + frozen-SP warning + Re-subscribe) — effectively covered; SP-wallet grace banner = I05 (QA Task 19 PASS).
- **D03** → reachable + structure verified (this session); the "populated expired-date" leg needs a truly-expired persona fixture.
- **D05** → reactivate-from-cancelled: the cancel → re-enable auto-renew return-to-active was exercised on the QA Task 21 disposable; full in-app "Reactivate Membership" leg still needs a cancelled-in-period persona.
- **I06** → free-user wallet inactive state: test-free's `sp_wallets.state` is `active` → the distinct frozen/inactive branch needs a `state='frozen'/'inactive'` fixture.
- **K02** → empty leg PASS (overlaps E02); error/retry leg needs a load-failure fixture.
- **M01** (loading) → transient state satisfied by navigation; **M06** (Go Back) → trivial nav; **M07** (backend contract) → attach/detach/retry covered by M05/M02 DB read-backs (QA Task 19) — classified, not re-run.
- **N03–N06** → route-alias reachability: N03 (aliases) largely confirmed this session (KidsClubOverview/SubscriptionPlans → JoinKidsClub; Join on web → passitup.com). N04 (ContinueKidsClub active variant), N05 (loading), N06 (trial-ending urgency) → ContinueKidsClub is web-first/retired-adjacent; trial urgency not inducible (`trial_enabled=false`). Remainder fixture-gated.
- **R01–R05** → R01 subscriber-fee-on-checkout + R02 SP consistency covered by prior TRD runs + QA Task 21 Section A (active status + $1.49 fee config). R03 payout-balance (QA Task 19 hero). R04 cancel-reactivate-restores-SP (partially: QA Task 21 cancel→re-enable). R05 config-reflects-live (DT-90). Full R-group re-run queued for a dedicated regression pass.

---

## Findings (ranked)

1. **P1 (money-adjacent) — DT92 item 2 FAIL:** the initial web-purchase charge still produces **no `billing_history` row** on staging despite webhook v49's `recordInitialBillingRow`. `subscriptions` + `subscription_events` write correctly; the initial $5.99 never reaches Transaction History. Dev: reproduce + read EF console; adjust the guard/ordering.
2. **P2 (config anomaly):** `admin_config.grace_period_days = 500` → cancelled/grace copy says "frozen for a **500-day** grace period". Likely a leftover test value; should be ~90.
3. **P3 (doc drift):** SUB guide E01/E02/E04 + Group F/G/H + A05 reference dead/aliased screens: `BillingHistoryScreen` (dead → live `TransactionHistory`), `SubscriptionStatusScreen` (push-payload-only), `KidsClubOverview`/`SubscriptionPlans` (aliases to `JoinKidsClubScreen`), `PayoutDashboard`/`SellerEarnings` (dead → `PayoutSettingsScreen`), "Start 30-Day Free Trial" CTAs (retired, trial disabled).
4. **P3 (stale code comment):** `SubscriptionStatusScreen.tsx` header comment "Accessible via AdminDashboard → SUB-007 link" — the link does not exist in `AdminDashboardScreen`.
5. **P3 (minor copy):** `SubscriptionExpiredScreen` shows "plan ended on **recently**" for a never-subscribed user (placeholder reads awkwardly — only truly-expired users hit it in production) and the renewal line says "Kids Marketplace" (naming carry-over from the pre-"Pass It Up" era).

**Design-System Compliance: PARTIAL — no NEW deviations found on DT93-fixed surfaces.** All four DT93 files render the semantic palette on-device (verified via pixel scans). Non-fixed sibling surfaces still carry prior deviations (see QA Task 21 Finding 7 / DT92 out-of-scope note). The "500-day grace period" copy (P2) is a config/data issue, not a token issue.

---

## Friction / tooling notes
- `mcp_supabase_query_logs` returned a persistent **"Backend error"** all session (same as QA Task 21) — the webhook EF console evidence (the decisive DT92 diagnostic) could not be read; root cause is inferred from source + DB + Stripe-event forensics instead.
- view_image worked for most captures but returned "Image Description unavailable" once — OCR fallback used.
- `rg` not installed; used `grep`. The terminal occasionally ignored a leading `cd`; commands prefixed with `cd /abs/path &&` were used.
- Stripe hosted Checkout needed ~3 extra round-trips (Link interstitial, cardholder name + ZIP revealed after first Subscribe click, phone field) — expected friction per §5.50.

**Evidence:** screenshots under `e2e-test-results/qa-task22-sub-remainder-2026-09-02/screenshots/` (`b0-*`, `b1-*`, `b4-*`). DB/Stripe evidence inline above (all reads read-only; the only mutations were the disposable-user purchase/cancel + strict cleanup, per QA Task 21 A8 discipline).
