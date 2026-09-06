# QA Task 36 — Dedicated Real-Stripe Fixture Session — D05 Independent Re-Drive + G01 Connect Onboarding

- **Date:** 2026-09-06 (session 11:0x–11:2x UTC; on-device 07:51–08:17 local)
- **Agent:** QA Test Agent (execution-only)
- **Target:** iOS Simulator `iPhone 17 Pro Max` (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) · staging project `drntwgporzabmxdqykrp`
- **Independence:** Runs independently of Dev Task 120 (different fixture domain — real Stripe test-mode objects). DT120's `test-trial` persona is DB-only and its Phase-2 staging ensure was never run (approval-gated), so this round does NOT touch it.

---

## Batch A — D05 Independent Re-Drive — **PASS** (positive + negative legs, fresh disposable)

Built a **fresh** real-Stripe disposable subscription from scratch (did NOT reuse any prior fixture) and drove the full lifecycle:

**Disposable:** `qa.alice.17886912933741957@kidsmarketplace.test` (auth user `6f8a7811-91ab-4501-9f36-3181fb232c3e`), display name `QA Task36 Parent`, node Norwalk Central (06850). Created via the real UI signup (dev-fill test user, phone OTP dev code). Fixture password `TestPass123!` (never echoed in chat).

### Positive leg (all DB read-back verified)
| Step | Evidence |
|---|---|
| Real Checkout purchase | GoTrue password-grant JWT → `create-checkout-session` EF → real hosted Checkout `cs_test_a1AwAUbot9MXALrlpYwUsiMZUVyUOdWlNNId3j83gjGkVsW1QFLXiJ0vuy` → card **4242** → Stripe Link test code `000000` → webhook → DB |
| Subscription active | `subscriptions.status='active'` (sub `sub_1UCdep4I6kCJlvXo…`), period to 2026-10-06, `sp_wallets.state='active'`, `subscription_events` row written. On-device Home + Manage Kids Club+ = **Active / Next Billing Oct 6 2026** |
| Save card | Native PaymentSheet → card saved to Stripe customer `cus_VD3mpkM0uk9OOu` (`pm_1UCdhX4I6kCJlvXoFSni34wf`); Manage shows **Visa •••• 4242** |
| Admin/manual cancel → grace | Admin portal `:3001` `/subscriptions/manage` search + **Cancel** → DB `status='grace_period'`, `cancel_reason='admin_override'`, grace ends 2026-10-06. On-device Manage = **Grace Period** + "Your Swap Points are frozen. Re-subscribe before October 6, 2026…" warning. SP Wallet surface shows a normal wallet (freeze messaging lives on the subscription surface; the `sp_wallets` row stays `active` during grace — freeze is presented via sub status) |
| Re-subscribe → renewal | Manage → Re-subscribe → `renew-subscription` EF → **"Your Swap Points are now available."** (Dev Task 118's corrected success copy) → DB: sub `active` (new `sub_1UCdlR4I6kCJlvXo366Mrsfa`), grace cleared (`grace_period_ends_at` NULL), wallet `active`, renewal `billing_history` row written. On-device Manage = **Active / Visa •••• 4242 / no frozen warning** |

**⚠ MED finding (new):** the renewal produced **TWO `billing_history` rows for the same invoice** (`in_1UCdlR4…`) — the `renew-subscription` EF wrote a row keyed to its charge (`ch_3UCdlS…`) while the webhook's `invoice.payment_succeeded` fallback wrote a row keyed to the invoice id as `charge_id` → the `UNIQUE(charge_id)` dedupe did not catch the second write (different charge_id values for the same invoice). Root cause candidate: the webhook fallback uses the invoice id when the event lacks a charge id, while the EF uses the real charge id. Recommend a dev follow-up to key the fallback on the same charge id (or dedupe by `invoice_id`).

### Negative leg (loud-failure behavior from Dev Task 118 — verified, no silent swallow)
- **(a) Resubscribe-without-renewal while ACTIVE:** invoked `renew-subscription` on the active user → **loud HTTP 400 `INVALID_STATUS`** (structured error), no state change. ✓
- **(b) Real declining-card renewal:** admin/manual cancel #2 → grace. Stripe blocks raw card numbers server-side (BP-69), so minted a declining PaymentMethod via the test token `tok_chargeDeclined` → invoked `renew-subscription` with it → **loud HTTP 402 `CARD_DECLINED`** — "Your card was declined. Please update your payment method and try again." No silent swallow. **No state change** verified: sub still `grace_period`, no new billing row, saved good card unchanged.
- Also observed (expected): the inline PaymentSheet rejects saving a declining card at set-up ("Your card was declined."), so a declining card can never be stored via the UI — the EF-boundary drive is the correct deterministic negative leg.

**Cleanup (Batch A):** sub `sub_1UCdlR4…` cancelled, customer `cus_VD3mpkM0uk9OOu` deleted (removes the saved card), all child rows + `profiles` deleted, auth user removed via GoTrue admin (HTTP 200). Read-back = 0 rows (auth + profiles + subs). **Residue noted:** orphan standalone declining PM `pm_1UCdtq4…` — Stripe refuses to delete an unattached PM (harmless test-mode object; dev can attach-then-delete or ignore).

---

## Batch B — G01 Real Stripe Connect Onboarding — **PARTIAL / SKIPPED at Stripe ID-verification gate (owner-directed)**

**Provisioned:** a fresh, un-onboarded test Stripe Connect account on **qa-payout-seller** (`a1234567-…-f2`, "QA Payout Seller", Diag Test Node, sub active). qa-payout-seller started this batch with **0** payout methods (the standing `test-seller` Connect fixture `acct_1U9DMMKX7Q9JD914` is a different seller and was NOT touched).

| Step | Evidence |
|---|---|
| Add Payout Method → Stripe Connect | Modal (Stripe Connect / PayPal / Venmo) → Add Method → `create-stripe-connect-account` EF → **Success** alert → `create-stripe-account-link` EF generated the account-link → opened on-device |
| Account created | **`acct_1UCe24KmLuEOxYxB`** (express, US, individual), method row `9e678786-…`, `stripe_onboarding_complete=false`, not verified — Payout Settings showed the method as **"Onboarding required"** (correct unverified state; radio "Cannot set as primary") |
| Express onboarding driven on-device | phone verification (test code `000000`), **Verify personal details** (DOB 01/15/1990, 1032 Bank Street Waterbury CT 06708, phone +1 (201) 555-0123, SSN 8888), **Business details** (industry "Other merchandise"; website `www.example.com` → replaced by a **product description** because Stripe rejects `www.example.com` as a placeholder — Save with it was silently rejected, API-confirmed `business_profile.url` stayed null) → **Review and submit** |
| Personal-details submit | persisted phone + SSN + product description (API read-back: those left `currently_due`) |

**Blocker (Stripe ID verification):** remaining requirements = `individual.verification.document` + `tos_acceptance.date/ip`. Stripe surfaced **"Update your name and SSN — We couldn't confirm your name and SSN"** and routed to a government-ID **document verification** step. The on-device Safari/WebView harness could not complete the hosted ID-document flow (the account-link session expired at the app return URL, `p2p-kids-cf-worker-dev…/stripe-redirect` → "Stripe setup session expired").

**Root trigger (finding for dev):** `create-stripe-connect-account` mapped the seller's full display name into the Stripe legal name — API read-back showed `individual.first_name="QA Payout Seller"`, `individual.last_name="Seller"`. The implausible first name is what fails Stripe's name+SSN precheck and forces the document-verification path. **Recommendation (follow-up task):** `create-stripe-connect-account` should derive first/last from a real name source (or a fixed test identity), not the whole display name.

**Owner decision (2026-09-06):** SKIP the Stripe ID-verification leg of G01 — no clean UI workaround within reach. Therefore:
- ❌ The method did **NOT** transition unverified → verified on-device.
- ❌ The "usable for a real withdrawal afterward" assertion was **NOT** tested (and was correctly not attempted — the method is not verified, and `Withdraw` requires a verified primary method).

**Other observations:** (1) Payout Settings **"Cannot Delete Only Method"** guard blocks UI deletion of the last payout method (by design; cleanup had to be done via API/SQL); (2) `create-stripe-connect-account` idempotency confirmed (repeat call returned the existing account).

**Cleanup (Batch B):** Connect account **deleted** via Stripe API (`acct_1UCe24KmLuEOxYxB` → HTTP 200 `deleted:true`); method row `9e678786-…` deleted. Read-back: qa-payout-seller now **0 methods** (baseline restored) + `subscriptions.status='active'` intact. App screen left on Payout Settings (stale method card is a known R59 refresh artifact, not asserted).

---

## Batch C — Trial-Branch Re-Verify — **SKIPPED (fixture-gated)**

`test-trial` persona does **NOT exist** on staging (read-back empty). Dev Task 120 Phase 2 (staging `ensure` of `test-trial@kidsmarketplace.test` / `npm run qa:r41-trial -- ensure --days-remaining N`) is **approval-gated and was never run**. ContinueKidsClub trial-≤7d and trial->7d branches cannot be rendered on-device, so the previously source-audited-only styles remain unverified on-device. **SUB-TC-N06 is NOT closed** this round. Unblock: owner approves DT120 Phase 2 (staging ensure), then a follow-up QA run renders both branches (≤7d urgency badge + >7d no-badge).

---

## SUB guide closure status

**NOT closable this round.** Precisely what remains after QA Task 36:
1. **D05** — now fully re-verified on a fresh independent fixture (positive + negative legs PASS). The one new MED (double `billing_history` row for the same invoice) is a dev follow-up, not a guide blocker.
2. **G01** — **one leg remains open**: the final Stripe ID-document verification + verified-transition + real-withdrawal assertions. Re-drive requires (a) the `create-stripe-connect-account` name-mapping fix (or an owner decision to complete verification via Stripe test data), and (b) a reliable way to finish Stripe test ID verification on-device (the WebView/Safari harness expired the session twice at this gate). Alternatively, the owner may accept G01 as PARTIAL (onboarding driven through the personal/business/bank/review steps) with the verification leg documented as a Stripe-side test limitation.
3. **N06** — fixture-gated on DT120 Phase 2 (owner approval + staging ensure).

---

## Run folder contents
- `report.md` (this file)
- `decision-outcome-log.md` (key decisions + outcomes)
- Evidence: `temp/qa36-g01-add-method-modal.png` + crops (`qa36-footer-band.png`, `qa36-footer2.png`, `qa36-btns.png`); Batch A on-device states + DB read-backs captured in the session trace (authoritative money-path evidence is the DB read-backs listed above).
