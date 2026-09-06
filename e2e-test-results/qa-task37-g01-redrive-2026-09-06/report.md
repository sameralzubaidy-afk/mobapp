# QA Task 37 — G01 Re-Drive (Now Instrumented) + DT121/DT122/DT123 On-Device Verification

**Date:** 2026-09-06 · **Agent:** QA Test Agent (execution-only) · **Model:** DeepSeek V4 Flash
**Surfaces:** mobile (iOS Simulator iPhone 17 Pro Max `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) + admin portal (:3001, real session)
**Backend:** staging `drntwgporzabmxdqykrp` · **Mobile HEAD:** `8b1d1294` (DT123) · **Admin HEAD:** `5af0baf7`
**Evidence dir:** `e2e-test-results/qa-task37-g01-redrive-2026-09-06/screenshots/`

---

## Overview

Runs after Dev Task 123. Applied R63–R70 efficiency standing rules from the start (noted: **R63–R70 are not yet codified in the playbook** — see apply-handoff).

- **Batch A** — DT121 UI items on qa-payout-seller (delete-only "Add a method"; resume-path phone re-verify hint).
- **Batch B** — G01 instrumented re-drive (fresh un-onboarded Connect account → full onboarding → drop/resume via DT123 → verified → primary → real withdrawal). Call count tracked.
- **Batch C** — Billing dedupe on-device re-drive (D05-style): real Checkout → grace → in-app Re-subscribe renewal → EXACTLY ONE `billing_history` row per invoice (DT121 dedupe proof).

---

## Batch A — DT121 UI items (qa-payout-seller) — **PASS (2/2)**

| Item | Result | Evidence |
|---|---|---|
| A1 — Delete-only method: alert "Cannot Delete Only Method" → [Cancel \| **Add a method**] → opens add-method flow | ✅ PASS | One method present → method-sheet Delete → guard alert → **"Add a method"** button → `AddPayoutMethodModal` opened (DT121-3) |
| A2 — Returning-seller resume: AddPayoutMethodModal when `resumingOnboarding` shows phone re-verify hint | ✅ PASS | Resume-path success alert includes the phone re-verify hint copy (vs first-time copy verified separately; DT121-4) |

**DT122 I-1 note:** `AddPayoutMethodModal` + `WithdrawModal` buttons are **AX-exposed on-device** this build (one-tap; both previously pixel-only per §5.31). The `PayoutMethodBottomSheet` remains a native RN `Modal` whose option buttons do **not** surface to mobile-mcp this build (drivability build-dependent; OCR + coordinate used where needed).

---

## Batch B — G01 instrumented re-drive — **PASS** (SUB-TC-G01 promoted from Remaining)

Fresh un-onboarded Stripe Connect account **`acct_1UCgIu4HHYZdHIok`** created one-tap on qa-payout-seller (via the now-AX-exposed Add-modal, `add-method-type-stripe`).

1. **DT121 Test/User identity prefill verified** — identity prefilled with Test/User + DOB 01/01/1990 (DT121-2 render).
2. **NO gov-ID document gate** — `currently_due` never contained `individual.verification.document` (QA Task 36's blocker GONE after the DT121 legal-name fix). Only phone / SSN / TOS.
3. **Drop → DT123 resume** — terminated app → cold deep link `p2pkidsmarketplace://payout-settings?success=true` (dev-launcher localhost:8081) → **Continue Onboarding** card CTA (`continue-onboarding-<methodId>`) → resumed at the correct hosted step.
4. **Completed to verified** — Agree and submit → `details_submitted=true`, `payouts_enabled=true`, `charges_enabled=true`, `currently_due=[]`.
5. **Set primary** → `is_primary=true`.
6. **Real withdrawal** — funded $5 via `qa:payout-fixture balance` → Withdraw Now → Confirm (`withdraw-confirm` AX) → payout row `8f085298` (gross 500 / fee 26 / net 474, processing) + balance→0 + history row $4.74/Processing.

**Batch B tool-call count: ~110–120** (vs QA Task 36's ~130–160). Majority of cost was hosted-Express Safari driving (form-field focus/re-touch, SSN re-entry); app-modal interactions were one-tap each (DT122 I-1 payoff).

**Known gaps / noted:**
- **Manual-withdrawal rows are NOT Stripe-dispatched.** `request_seller_payout` creates the row + deducts balance but does not call Stripe; the trade-completion trigger only fires on trade completion (trade_id-NULL rows never dispatched). Pre-existing architecture; matches QA Task 34 H03 acceptance class. Recommend separate dev follow-up (a dispatcher for manual withdrawals).
- **SSN prefill quirk:** hosted Express 8888 prefill failed the name precheck → "Personal details Incomplete" persisted; canonical test SSN `0000` (Cmd+A select-all + retype) cleared `individual.ssn_last_4`. Phone needed a re-touch to persist.
- **App method staleness:** DB row stayed `stripe_onboarding_complete=false` after hosted completion until a direct `sync-stripe-connect-status` EF call with persona JWT; the app's own on-mount sync silently did not fire once (observed; env-timing, not re-failing).

---

## Batch C — Billing dedupe on-device re-drive (D05-style) — **PASS** (DT121 dedupe proof)

Fresh disposable `qa.alice.17887037222848561@kidsmarketplace.test` (pw TestPass123, user `a9132789-46fd-4a77-9a9a-5af6d1b670de`).

1. **Real hosted Checkout** (4242 / 12-34 / 123 / name "QA Task37 C" / ZIP 06850) → subscription `3ec25273` **ACTIVE** (`sub_1UCgva4…`, customer `cus_VD79HhriarejMN`), billing_history `ada8e735` (in_1UCgva4, ch_3UCgva4, $5.99 succeeded).
2. **Saved card on sub** — Manage Kids Club+ → native PaymentSheet → saved Visa ••••4242 → Set up → `subscriptions.stripe_payment_method_id = pm_1UCgvY4…` (DB read-back).
3. **Admin cancel** (real admin portal :3001, confirm dialog) → `grace_period` / `cancel_reason=admin_override`.
4. **Cold relaunch → grace UI** — Home "Grace Period Active → Re-subscribe Now"; Manage Kids Club+ Grace Period badge + SP-frozen banner ("Your Swap Points are frozen…").
5. **In-app Re-subscribe** → charged saved card → **"Subscription Renewed / Your Swap Points are now available."** modal → subscription **ACTIVE** again (new Stripe sub `sub_1UCh0o4…`, cancel_reason null, grace cleared, PM retained, next billing Oct 6).
6. **Dedupe assertion — PASS:** EXACTLY ONE `billing_history` row per invoice:
   - original invoice `in_1UCgva4` → 1 row (`ada8e735`)
   - renewal invoice `in_1UCh0p4` → 1 row (`39cd0e76`, desc "Kids Club+ subscription renewal")
   
   **QA Task 36's NEW MED (two rows for the same invoice) confirmed FIXED** by DT121 `onConflict: stripe_invoice_id`.

Evidence: `BC-manage-kids-club.png`, `BC-grace-home.png`, `BC-grace-manage.png`, `BC-resub-tap.png` (renewal modal), `BC-renewed-active.png`.

---

## Cleanup (R41 / BP-70) — done + read-back verified

- **Stripe API** (`qa37-cleanup.mjs`): customer `cus_VD79HhriarejMN` deleted (cancelled its subs); Batch B Connect account `acct_1UCgIu4HHYZdHIok` deleted. Both HTTP 200.
- **DB (disposable):** `billing_history` (2), `subscriptions`, `sp_wallets`, `profiles` (`5bfd101c`), `auth.users` — all deleted (read-back 0).
- **qa-payout-seller residue:** method row `24ddd76a` + payout row `8f085298` deleted; `seller_balance` 0/0 (lifetime_earnings 500 counter left as a standing cumulative).

---

## Findings & follow-ups (dev)

1. **Manual-withdrawal rows never Stripe-dispatched** (no dispatcher for trade_id-NULL `seller_payouts`) — architectural gap, separate dev task recommended (not a G01/H03 regression).
2. **R63–R70 efficiency rules still NOT codified** in `.github/instructions/QA-Test-Agent.instructions.md` (playbook ends at R62/§5.63); QA Task 37 applied QA Task 36 decision-log patterns as de-facto rules — recommend the apply-handoff codifies them.
3. **Hosted-Express SSN 8888-prefill precheck failure** — canonical test SSN `0000` required (documented for future payout runs).
4. **App method-stale after hosted completion** — silent on-mount sync miss observed once; direct EF sync was the reliable path.
5. **Locator gaps (non-blocking):** Manage Kids Club+ "Add Payment Method" button + grace "Re-subscribe to Kids Club+" button not AX-exposed (coordinate taps used).

Repo working trees remained clean throughout (QA execution-only — no source edits).
