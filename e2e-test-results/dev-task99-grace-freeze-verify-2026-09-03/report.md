# DEV-TASK-99 (v2) — Wire the Missing Grace/Freeze Transition: Dev Handoff + Independent QA Verification

**Date:** 2026-09-03 · **Project:** staging `drntwgporzabmxdqykrp` · **Owner decision:** R6 model (grace = spendable SP wallet `grace_period`; freeze only after the grace window ends)

---

## PART 1 — Dev handoff (code + Tier 0 + Tier 1 live self-check)

### Root cause (confirmed)
- `triggerSpFreeze` in `stripe-webhook-subscriptions` no-oped: it POSTed to `SP_SUBSCRIPTION_LAPSE_URL` — a MODULE-09 external lapse endpoint that was **never deployed** (`TODO(MODULE-09)`); no lapse EF exists.
- The FINAL `record_payment_attempt` RPC only increments the retry counter — the auto-grace-transition lived in a superseded v1 migration. So on the 3rd payment failure nothing ever moved the subscription to grace and nothing touched the SP wallet.

### Fix (live)
| File | Change |
|---|---|
| `supabase/functions/stripe-webhook-subscriptions/index.ts` | Grace entry on the 3rd payment failure (and on the subscription.deleted / subscription.updated-to-grace paths) now transitions `subscriptions.status -> grace_period` (grace_started_at/grace_ends_at from admin_config) via a **direct table update** (avoids a live ambiguous `update_subscription_status` RPC overload on staging) + sets `sp_wallets.state -> grace_period` via `rpc_set_sp_wallet_state`. Old `triggerSpFreeze` renamed → `enterGracePeriodAndSyncWallet`. Added the **reverse-direction** wallet restore (`-> active`) on successful renewal out of grace in BOTH `invoice.payment_succeeded` AND `customer.subscription.updated` (Stripe can send subscription.updated(active) before invoice.payment_succeeded — found + fixed during verification). |
| `supabase/functions/retry-failed-payment/index.ts` | Success path now restores `sp_wallets.state -> active` (previously sub-only). Also fixed 10 pre-existing deno type errors (`message?: string`) — behavior-preserving. |

**Deployed:** `stripe-webhook-subscriptions` **v54** (ACTIVE) · `retry-failed-payment` **v31** (ACTIVE).

**Tier 0:** `deno check` clean on both EFs · webhook unit tests **22/22**.

**Dev Tier-1 live self-check (fresh disposable user, `qa:r41-l02-failing-renewal --advances 22`):** PASS — sub → `grace_period` (grace_started_at ~1–2 s after the 3rd failure), `grace_ends_at` = **+30 d** (staging `grace_period_days=30`), `wallet.state=grace_period`, `frozen_at=null`, 3 critical payment-failed notifications, residue 0.

### QA tooling added (fresh-drive, disposable users, DB read-backs, BP-70 cleanup)
- `scripts/qa/lib/qa99-common.mjs` (shared helpers)
- `scripts/qa/qa99-leg2-success-renewal.mjs` → npm `qa:dt99-leg2-success-renewal`
- `scripts/qa/qa99-leg3-return-to-active.mjs` → npm `qa:dt99-leg3-return-to-active`
- `scripts/qa/dev-task-r41-l02-failing-renewal.mjs` (updated to R6 expectation + settle-poll)

---

## PART 2 — Independent QA verification report (QA Test Agent, fresh runs on new disposable users)

LIVE code verified: webhook **v54** (20:15:47) + retry-failed-payment **v31** (20:02:33). No code/scripts/config touched by QA. Residue independently verified 0 on every run (all tables + Stripe objects).

### LEG 1 — Grace/freeze transition on the 3rd payment failure → **PASS** (after harness fix; re-verified)
- `subscriptions.status = grace_period` · `payment_retry_count = 3` · `payment_failed_at` set
- `grace_started_at = 20:37:10.362Z` (~0.95 s after the 3rd failure at 20:37:09.4Z) → **transition fires immediately after the 3rd failure, not later**
- `grace_ends_at = 2026-10-03` = exactly **+30 d**
- `sp_wallets.state = grace_period`, `frozen_at = null` (R6 — **not** frozen at grace entry)
- 3 critical payment-failed notifications · residue 0 · exit 0
- **Note:** the QA agent's first fresh run FAILED only on a **read-back race in the leg-1 harness** (its decisive read ran ~0.7 s before the grace write, which lands ~1.8 s after the RPC because the notification send sits between). Webhook execution logs + LEG 3 Phase A (separate fresh user) independently confirmed the product was correct. The harness now settle-polls up to 24 s and LEG 1 re-verified **PASS**.

### LEG 2 — Success-path non-regression → **PASS**
- Clean renewal (no failures): `current_period_end` advanced (2026-10-03 → **2026-11-03**), a **second succeeded `billing_history` row** written, no grace fields, `payment_retry_count=0`, `wallet.state=active`. Residue 0 · exit 0.

### LEG 3 — Return-to-active edge case (grace → successful payment before window ends) → **PASS**
- **Phase A** (3 failures): sub + wallet both `grace_period` (`grace_ends_at` +30 d).
- **Phase B** (PM re-attached, clock advanced): `sub.status=active` **and** `wallet.state=active` (unfrozen), new **recovery-charge** billing row, period advanced, retry reset. Residue 0 · exit 0.
- This is the two-direction state machine working — the QA probe the original implementer didn't think to test caught a real gap (subscription.updated-first ordering left the wallet in grace), which was fixed and re-verified.

---

## DT-99 INDEPENDENT QA VERDICT: **PASS** ✅
1. Live grace transition on the 3rd failure: **confirmed** (sub → `grace_period`, wallet → `grace_period`, immediate timing, +30 d window).
2. Success path not regressed: **confirmed** (period advance + billing row + wallet stays active).
3. Successful payment during grace returns to active + wallet unfrozen: **confirmed**.

## Flags / follow-ups (NOT in scope, recommended for a future session)
- `cancel-subscription` EF still has its own `freezeSpWallet` (sets `frozen` on a trial-cancel-with-SP) — a pre-R6 divergence vs `downgrade_trial_to_grace`; needs a product reconcile decision.
- Staging carries an orphaned 12-arg live overload of `update_subscription_status` (exists only in the DB, not in migrations) — the reason grace entry uses a direct table update. Recommend a cleanup migration.
- No migration written by this task (reused existing RPCs + direct update) — nothing to apply.
- Doc staleness: `docx/SYSTEM_REQUIREMENTS_V2.md` §3.2/§4.2 (BR-SUB-004) still says wallet is frozen during grace — pre-R6; recommend a doc-sync pass.
