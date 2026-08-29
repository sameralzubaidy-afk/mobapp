# Dev Task 55 — Money-Path Server-Trust Audit (Full Inventory)

> **Audit-only.** No code was changed by this task. Every finding below is either
> `SERVER-AUTHORITATIVE` (confirmed, with evidence) or `GAP FOUND` (client-trusted
> value affecting money, with reproduction + estimated impact). Every GAP becomes
> its own sign-off-gated fix task (see the close-out list at the bottom).
>
> **Date:** 2026-08-29 · **Method:** static read of Edge Functions / RPCs / admin
> routes + live adversarial EF payloads via the same class of hand-built requests
> that found the original DT-54 bug.
>
> ✅ **LIVE-DB CONFIRMED (2026-08-29, owner-approved read-only queries, project
> `drntwgporzabmxdqykrp`):** Findings 1–6 + the systemic posture were confirmed
> against the live staging DB via `information_schema.role_routine_grants`,
> `pg_proc`, and `pg_default_acl`. All ten money RPCs are live-executable by
> `anon` + `authenticated` + `PUBLIC`; all nine queried are `SECURITY DEFINER`;
> the default function ACL grants `anon`/`authenticated`/`service_role` execute
> (no deny-by-default). This is worse than the migration files alone suggested
> (e.g. `complete_trade_v2` still shows `anon` live — the old anon-revoke did
> not stick). See §6 for the exact results.

---

## 1. Executive summary (plain English)

The question behind this audit: *"Are there other places besides the one we already
fixed where the server trusts a number the phone sends it, instead of computing that
number itself?"*

**The good news:** the fee/cash/tax/SP/payout **amount calculations** are almost
entirely server-authoritative. I verified this by sending deliberately wrong numbers
to the live Edge Function — the server ignored them and used its own numbers. The
DT-54 fix holds, including for a 5-item bundle.

**The important discovery:** the biggest money risks are **not** in the amount math —
they are in **who is allowed to call the money-changing functions directly**. Several
database functions that mint/spend Swap Points, change fees, or complete/cancel trades
are callable by *any* logged-in user (or even unauthenticated) through the public
Supabase API, with no check that the caller is allowed to. Because the app's own
screens never call these directly, normal UI-driven testing never triggers them —
exactly the same blind spot that hid the DT-54 bug.

There are also two smaller gaps where a value the phone sends *is* trusted on a
narrow path: the sales-tax amount (only when the server can't compute it), and the
subscription tier / trial length on the web sign-up flow.

---

## 2. Ranked findings table

Priority is by **real-money impact potential**, not fix difficulty.

| # | Surface | Verdict | Evidence (file:line) | Estimated impact | Priority |
|---|---|---|---|---|---|
| 1 | `secure_upsert_admin_config` (admin_config writer) | **GAP FOUND — CRITICAL** | SECURITY DEFINER, **no auth check**; `GRANT ... TO anon, authenticated` (`20260721000003_fix_admin_config_is_active_on_upsert.sql:62,166-167`; `20260207000002:80-81`; `20260721000002:128-129`) | Any caller can rewrite every money lever (fees, caps, payout enable, trial/grace days). EFs read these **live** at transaction time → a tampered value takes effect immediately on every charge/payout. | **P0** |
| 2 | SP ledger RPCs: `credit_sp_for_cancelled_trade`, `debit_sp_for_trade`, `earn_sp_for_trade`, `admin_adjust_sp_wallet` | **GAP FOUND — CRITICAL** | All SECURITY DEFINER, caller-supplied `p_user_id` + `p_points`/`p_amount`, **no `auth.uid()`/role check**, no `REVOKE` → default PUBLIC execute (`20260810000006_n2_idempotency_audit.sql:177,269,361`; `20260323000001:101`) | Unlimited SP mint/drain for any user (idempotency key is per-trade → distinct fake trade UUIDs mint forever). SP is closed-loop but buys items at up to 50% off → real loss. | **P0** |
| 3 | `complete_trade_v2` — self-declared identity | **GAP FOUND — HIGH** | `p_user_id` caller-supplied, compared to trade buyer/seller, **never `auth.uid()`**; granted `anon, authenticated` (`20260727000001:26,116`; `312_prod_p1_stage_security_lockdown.sql:155` revokes **anon only**) | Any authenticated caller can complete **any** trade, and calling the RPC directly **bypasses the EF's Stripe capture** → `seller_payouts` row + SP release without the buyer ever paying. | **P1** |
| 4 | `cancel_trade_v2` — self-declared identity | **GAP FOUND — HIGH** | `p_user_id` compared to trade buyer/seller, never `auth.uid()`; no grant/revoke → default PUBLIC execute (`315_fix_trades_bundle_id_and_cancel_rpc.sql:36`) | Any caller knowing a trade participant id can cancel any trade (SP refund + refund flow triggered). | **P1** |
| 5 | `admin_force_cancel_trade_db` — no role check | **GAP FOUND — HIGH** | SECURITY DEFINER; `p_admin_user_id` used only for audit-log; **no admin check**; `GRANT ... TO authenticated` (`20251227_admin_trade_tools.sql:21-80`; `20241227_admin_force_cancel_trade.sql:138`) | Any authenticated caller can force-cancel any trade (SP refund + status change). | **P1** |
| 6 | `rpc_record_payment_refund` — granted to `authenticated` | **GAP FOUND — HIGH** | `GRANT ... TO service_role, authenticated` (`317_payments_reconciliation_and_partial_refunds.sql:312`) | Non-admin can record refunds/adjustments on arbitrary trades with a fabricated `stripe_refund_id` → corrupts payments/tax ledger without a real Stripe refund. | **P1** |
| 7 | `create-trade-offer` — client `tax_amount_cents` fallback | **GAP FOUND — MED-HIGH** | `finalTaxCents = vServerCalculatedTax ? vTaxAmountCents : clientTaxCents` (`create-trade-offer/index.ts:903`); reachable when seller `node_id` is NULL (tax block skipped, `:763-765`) or server calc throws (`catch` swallows, `:906-913`) | Tampered client tax flows into the Stripe pre-auth/hold when the server can't compute it (e.g. any seller without a node). Normal path is safe (live-verified). | **P1.5** |
| 8 | `create-checkout-session` — client `price_id` + `trial_days` | **GAP FOUND — MED** | `let priceId = body.price_id` used unvalidated (`:126,180`); `const trialDaysToUse = body.trial_days ?? trialDays ?? 30` (`:150`) | Client can subscribe to any Stripe price (cheaper/other tier) and self-grant an arbitrary trial length (one-time). | **P2** |
| 9 | `fn_get_buyer_fee_for_checkout` public | **GAP FOUND — LOW (info)** | `GRANT ... TO anon, authenticated, service_role` (`20260810000009_tiered_buyer_fee_engine.sql:208`) | Read-only `STABLE` RPC — lets a client probe fee tiers. No money movement. | **P3** |
| 10 | `create-trade-offer` response echoes client `cash_amount_cents` | **GAP FOUND — LOW (cosmetic)** | single-item response returns the request value (`create-trade-offer/index.ts:1909`) | Misleading response (showed `999999` in live test) while DB/Stripe use the server value. No money impact. | **P3** |

**Server-authoritative surfaces (confirmed, no gap):** cash portion (single + bundle,
DT-54 holds — live-verified), buyer fee (server `fn_get_buyer_fee_for_checkout`),
seller fee (DB config, base = DB price − SP), `charge_one_fee_per_bundle` distribution
(fee re-derived for **every** item — 5-item bundle live-verified), tax base (item DB
price × rate when the server can compute it), tax-exempt status (category-derived, no
client flag), SP reservation/release/restore amounts (trade DB row + wallet + category
caps, DB-trigger enforced), payout amounts (`initiate-payout` reads
`trade.payout_amount_cents`, refuses NULL), `complete_trade_v2` payout math
(cash − seller_fee, all DB), refund **amounts** (validated per-component against
remaining collected in the EF + RPC), refund idempotency (content-hashed keys +
`charge_already_refunded` + `stripe_refund_id` dedup), admin-config reads (fresh from
DB at transaction time, no client cache), Stripe/PayPal webhooks (signature-verified,
amounts from provider payload), cron RPCs (`rpc_process_*`, `rpc_release_due_payouts`
— service_role-only).

---

## 3. What was live-tested (adversarial, disposable fixtures, fully cleaned up)

| Test | Payload | Server actually did | Verdict |
|---|---|---|---|
| Single-item cash+tax tamper | `cash_amount_cents: 999999`, `tax_amount_cents: 99999`, item $26 | DB row: `cash=2600, fee=149, tax=182`; Stripe hold **2931¢** (= 2600 + 149 + 182). Tampered values ignored. | **SERVER-AUTHORITATIVE** (normal path) |
| 5-item bundle fee tamper | `cash_amount_cents: 2749` (price+fee embedded) on **every** item | Server wrote `cash=2600` + `fee=149` **only on item 0**, `fee=0` on items 1–4, `tax=182` each | **SERVER-AUTHORITATIVE** — fee re-derived per item (DT-52 fix holds at 5 items) |

Cleanup: 6 Stripe PIs canceled (test key `~/.dt11-stripe-key`), 6 trades + 6 items +
1 notification + 9 audit rows deleted, buyer wallet untouched (`available 4 /
reserved 10 / pending 0`), temp harnesses removed. Verified `0` residue.

---

## 4. NOT TESTABLE THIS PASS (with reason)

| Surface | Reason |
|---|---|
| Live reproduction of findings #1–6 (config write, SP mint/drain, trade complete/cancel/force-cancel, refund record) | Would require **mutating** writes to staging admin_config / wallets / trades — destructive, not audit-safe. Static evidence + live grant confirmation (§6) is conclusive. |
| Live repro of #8 (checkout `price_id`/`trial_days`) | Would create a real Stripe subscription + cleanup of a disposable user; statically confirmed with exact code. |
| Live-DB grant/REVOKE state | ✅ **DONE** — owner approved and results recorded in §6. |

---

## 5. Root-cause pattern

Every finding above shares one root cause: **the repo's posture is "revoke each
function explicitly" — there is no `ALTER DEFAULT PRIVILEGES` / blanket
`REVOKE ... FROM PUBLIC`** (grep confirmed zero `ALTER DEFAULT PRIVILEGES` in
migrations). Functions that were forgotten (SP ledger, `cancel_trade_v2`) default to
PUBLIC-executable. Functions that were over-granted (`secure_upsert_admin_config`,
`complete_trade_v2`, `admin_force_cancel_trade_db`, `rpc_record_payment_refund`)
were granted to roles that should not touch money. The EFs and admin routes
themselves gate properly; the gap is that the underlying RPCs are also directly
reachable, bypassing every EF-level guard.

---

## 6. Live-DB confirmation (EXECUTED 2026-08-29 — owner-approved, read-only)

Three read-only queries were run against the live staging project
(`drntwgporzabmxdqykrp`) via Supabase MCP with Samer's approval. Results:

### Q1 — who can EXECUTE the money RPCs (live)?

**All ten are executable by `anon`, `authenticated`, AND `PUBLIC`:**
`secure_upsert_admin_config`, `credit_sp_for_cancelled_trade`, `debit_sp_for_trade`,
`earn_sp_for_trade`, `admin_adjust_sp_wallet`, `complete_trade_v2`, `cancel_trade_v2`,
`admin_force_cancel_trade_db`, `rpc_record_payment_refund`, `fn_get_buyer_fee_for_checkout`.

### Q2 — are they SECURITY DEFINER (live)?

**Yes — all nine queried** (`prosecdef = true`), with `proacl` granting PUBLIC + anon +
authenticated + service_role EXECUTE. They run as the owner and bypass RLS.

### Q3 — does any deny-by-default posture exist (live)?

**No.** `pg_default_acl` for `objtype='f'` (functions) under the `postgres` role is
`{postgres=X, anon=X, authenticated=X, service_role=X}` — every new function
**defaults to PUBLIC+anon+authenticated execute** unless explicitly revoked. This is
the systemic root cause behind findings 1–6.

### Confirmation SQL used (kept for reproducibility) —
The three queries below are the exact statements that produced the results above:

```sql
-- Q1: who can EXECUTE the money RPCs on the LIVE DB?
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name IN (
  'secure_upsert_admin_config','credit_sp_for_cancelled_trade','debit_sp_for_trade',
  'earn_sp_for_trade','admin_adjust_sp_wallet','complete_trade_v2','cancel_trade_v2',
  'admin_force_cancel_trade_db','rpc_record_payment_refund','fn_get_buyer_fee_for_checkout'
)
ORDER BY routine_name, grantee;

-- Q2: are the SECURITY DEFINER money RPCs actually SECURITY DEFINER?
SELECT p.proname, p.prosecdef, p.proacl
FROM pg_proc p
WHERE p.proname IN (
  'secure_upsert_admin_config','credit_sp_for_cancelled_trade','debit_sp_for_trade',
  'earn_sp_for_trade','admin_adjust_sp_wallet','complete_trade_v2','cancel_trade_v2',
  'admin_force_cancel_trade_db'
);

-- Q3: does any DEFAULT/global REVOKE exist that changes the PUBLIC-execute posture?
SELECT d.defaclrole::regrole, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d;
```

---

## 7. The ONLY fix tasks that need to exist (each sign-off-gated, per DT-54 precedent)

> Audit-only — nothing below was fixed here. Each is a separate, one-at-a-time,
> owner-approved task. Ordered by priority.

1. **DT-56 [P0] — Lock down `secure_upsert_admin_config`.** Add `auth.role()`
   /admin check inside the function (or restrict to service_role) and
   `REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated`.
2. **DT-57 [P0] — Scope the 4 SP ledger RPCs.** `credit_sp_for_cancelled_trade`,
   `debit_sp_for_trade`, `earn_sp_for_trade`, `admin_adjust_sp_wallet`:
   enforce `auth.uid()`/role and `REVOKE ... FROM PUBLIC`; keep service_role callable
   (used by EFs/triggers). Verify every caller (trigger, EF, admin route) still works.
3. **DT-58 [P1] — Replace self-declared identity in trade RPCs.** `complete_trade_v2`,
   `cancel_trade_v2`, `admin_force_cancel_trade_db`, `rpc_record_payment_refund`:
   derive identity from `auth.uid()` (or a role check) instead of `p_user_id`, and
   restrict grants. Especially: `complete_trade_v2` must not be directly callable
   without the EF's Stripe-capture step.
4. **DT-59 [P1.5] — Remove the client `tax_amount_cents` fallback in
   `create-trade-offer`.** Fail loud (like the fee path) when the server can't
   compute tax (null seller node or calc error) instead of trusting the client value.
   Fold in the cosmetic response-echo fix (#10).
5. **DT-60 [P2] — Harden `create-checkout-session`.** Validate `price_id` against an
   active `subscription_tiers` row; ignore client `trial_days` and use server config.
6. **DT-61 [P1, systemic hardening] — Establish an explicit allowlist posture.** Add a
   blanket `REVOKE EXECUTE ... FROM PUBLIC` + explicit grants for every money RPC, so
   future functions don't silently default to PUBLIC.

---

## 8. Verification state

- **Live adversarial tests:** 2/2 passed (single-item tamper + 5-item bundle tamper) —
  both confirm the server derives cash/fee/tax independently on the normal path.
- **Static verification:** every CRITICAL/HIGH finding verified by reading the exact
  function body + GRANT/REVOKE lines in the migrations (no reliance on the subagent's
  summary alone).
- **Live-DB grant confirmation:** ✅ DONE (owner-approved, read-only) — findings 1–6
  and the systemic posture confirmed against the live DB (§6).
- **Not run:** destructive reproductions of the authorization gaps (§4) and live repro
  of the checkout `price_id`/`trial_days` gap (§4).
