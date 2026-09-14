# FIX-Task-35 — Completion-Path Audit + Auto-Complete Bug + Sibling EF Fixes + Tier 2 Closeout

**Date:** 2026-09-14
**Environment:** Stripe **TEST** mode + staging Supabase (`drntwgporzabmxdqykrp`). No production/real-money impact.
**Source:** FIX-Task-34's session (commit `02a21ada`).
**Evidence:** `evidence/` in this folder.

---

## Deliverable summary

| # | Item | Result |
|---|---|---|
| 1 | Audit the "93 completed-with-uncaptured-PI" trades | ✅ **DONE — the "93" was not a money count.** Confirmed uncaptured: **2**, exposure **$53.52**. Root cause of the 93 identified and proven |
| 2 | `process-auto-complete` treats `!stripe` as capture success | ✅ **FIXED + DEPLOYED** (v16) — now fails closed |
| 3 | `complete-trade` silently defaults to 0 on cash-with-no-PI | ✅ **FIXED + DEPLOYED** (v53) — three hard stops added |
| 4 | `complete_trade_v2` has no capture invariant | ✅ **FIXED, APPLIED + behaviourally PROVEN** |
| 5 | Batch-size count-coupling bug | ✅ **FIXED, APPLIED + behaviourally PROVEN** |
| 6 | Service-credential helper in 3 remaining EFs | ✅ **FIXED + DEPLOYED + CONFIRMED LIVE on all 3** |
| 7 | Finish Tier 2 properly | ⚠️ **PARTIAL — `db reset` is blocked by a PRE-EXISTING structural defect; the FIX-Task-34 diagnosis (Docker) was WRONG.** See [Tier 2](#tier-2) |
| 8 | Rotate the exposed Stripe key | ⏳ **OWED — owner action (Stripe Dashboard).** Owner chose "record as owed" |
| 9 | Repair the drifted subscription's default card | ✅ **APPLIED + VERIFIED** (both Stripe levels now in sync) |
| 10 | Remediate confirmed uncaptured-but-completed trades | ✅ **APPLIED** — 2 captured, $53.52 collected |

**Two extra defects were found and fixed** while doing items 1/7 — see [Extra findings](#extra-findings).

---

## 1. The audit — and why "93" was a false number

### What the two independent sweeps say

| Tool | Scope | Uncollected money |
|---|---|---|
| `qa:stranded-holds` (DB-first) | 814 trades with a PI, 400 days | **2** ($53.52) |
| `qa:release-stranded-holds` (its own counter, dry run) | same | **2** ($53.52) |
| **`qa:uncaptured-pi-sweep` (NEW — provider-first)** | **1 135 PaymentIntents enumerated at Stripe** | **2** ($53.52) |

The new provider-first tool (`p2p-kids-marketplace/scripts/qa/uncaptured-pi-sweep.mjs`) starts at **Stripe** instead of at the database, which closes three blind spots the DB-first sweep has: a PI recorded only on `payments`, a trade that was re-offered/extended so only its newest PI lives on the row, and the general assumption that the DB's PI column is complete.

**Verdict — every uncaptured PaymentIntent in the account (400 days):**

| Verdict | Count | Cents | Meaning |
|---|---|---|---|
| `UNCOLLECTED_MONEY` | **2** | $53.52 | trade `completed`, Stripe `amount_received = 0` — the real defect |
| `LIVE_TRADE` | 8 | $149.41 | legitimately `pending`/`in_progress` holds — **not** a defect |
| `STRANDED_HOLD` | 0 | $0.00 | — |
| `STALE_AUTH` | 0 | $0.00 | — |
| `ORPHAN_PI` | 0 | $0.00 | — |

### Where "93" came from — proven, not guessed

```
SELECT count(*) FROM trades
WHERE status='completed' AND stripe_payment_intent_id IS NOT NULL
  AND created_at >= now() - interval '90 days';
-- => 93        <- EXACT match for the reported number

  ... AND created_at >= now() - interval '60 days'  => 56
  ... AND created_at >= now() - interval '120 days' => 112
  ... (no window)                                   => 200
```

**93 = every `completed` trade holding a PaymentIntent id in the last 90 days — a raw row count taken *before* any Stripe probe.** It counts trades that have a PI, not trades whose PI was never captured. 91 of those 93 were captured normally.

This matches a comment already in `release-stranded-holds.mjs`: *"Counting before the probe over-reported this by ~45x on the first run."* **93 / 2 = 46.5×.** The FIX-Task-34 evidence log (`evidence/release-stranded-holds.log` in the previous run folder) is the pre-probe count; the script was fixed, but the number had already been carried into the report as a money figure.

A third plausible DB signal was also ruled out: `payments.captured_at IS NULL` for completed trades returns **0** — the mirror is always stamped, so it can never have produced 93.

### The mirror asserts a capture that never happened (R100, re-proven)

Live rows for the two real cases:

| Trade | Stripe says | DB says | Payout |
|---|---|---|---|
| `47bdab0a…` | `requires_capture`, `amount_received = 0`, holds **$28.49** | `payments.derived_state='succeeded'`, `captured_at` stamped `2026-09-09 11:03:58` | 1 row, `requires_action`, **not paid** |
| `acb4939a…` | `requires_capture`, `amount_received = 0`, holds **$25.03** | `derived_state='succeeded'`, `captured_at` stamped, tax `voided` | 1 row, `requires_action`, **not paid** |

Both `seller_payouts` rows are `status='requires_action'` with `initiated_at = NULL` and `provider = NULL` — **no money was ever sent to a seller**, so the exposure was limited to uncollected buyer money.

## 10. Remediation applied (standing policy — capture, not reverse)

Both PIs were `requires_capture` at **5.3 days** old, inside Stripe's ~7-day capture window, so the standing policy's "capture now" half applied. Applied with the new `qa:capture-uncollected-pis` writer (dry run by default, `--yes` to apply):

| PI | Result |
|---|---|
| `pi_3UDjGl4I6kCJlvXo1aYETeKt` | ✅ `succeeded`, `amount_received=2849`, charge `ch_3UDjGl4I6kCJlvXo1Eazyp2g` |
| `pi_3UDjCU4I6kCJlvXo0mv21dEy` | ✅ `succeeded`, `amount_received=2503`, charge `ch_3UDjCU4I6kCJlvXo0A2zByr0` |

**Captured 2/2 — $53.52 collected.** Re-running the provider-first sweep afterwards: `UNCOLLECTED_MONEY = 0`.

> ⚠️ **Residual, reported not hidden:** `acb4939a`'s `tax_records` row is `voided` (FIX-Task-24's data repair voided it while the trade was being treated as cancelled), so `rpc_mark_tax_collected` refused the transition and the **$1.54 of tax we just collected is not reflected in the tax ledger**. Repairing it needs a ledger-write RPC (`voided → collected` is not a legal transition today) — flagged as a decision, not silently patched. `47bdab0a` has no tax record at all, so there is nothing to update.
>
> **The reversal half of the policy was not needed** — 0 trades had an expired authorization.

## 9. Subscription card drift — repaired

```
sub_1To5Vg4I6kCJlvXoebIAvLZJ (test-buyer, active, renews 2026-09-27)
  before:  DB card pm_1UFatV4I6kCJlvXoJsDhX3ZQ · subscription PM None · customer PM pm_1UFNpm4I6kCJlvXop2yMXsky
  after:   DB card pm_1UFatV4I6kCJlvXoJsDhX3ZQ · subscription PM pm_1UFatV4I6kCJlvXoJsDhX3ZQ · customer PM pm_1UFatV4I6kCJlvXoJsDhX3ZQ  ✅ in sync
```

New tool `qa:sync-subscription-default-pm` (dry run by default). It refuses a non-test key, and it verifies the PM actually belongs to the subscription's customer before pointing a renewal at it.

**Two further drifts found while sweeping all 10 "live" subscription rows (reported, NOT repaired — each needs a decision):**

| Finding | Detail |
|---|---|
| 1 subscription reads `active` in the DB but the Stripe subscription is **`canceled`** | `sub_1TpDzx4I6kCJlvXoz6OL5dNC` — Stripe rejects the update with `invalid_canceled_subscription_fields`. The DB and Stripe disagree about whether this user is subscribed |
| 3 DB subscription rows point at Stripe subscriptions that **do not exist** (HTTP 404) | `sub_1TLj9K4…`, `sub_1T3jfR4…`, `sub_1TWlK84…` |

## 2–6. Product fixes

### 2 — `process-auto-complete` no longer treats "no Stripe" as success
It used to warn and then mark **every** eligible trade `capture_success: true`, so the cron flipped them to `completed` and queued payouts against authorizations that were never captured. `complete-trade` and `resolve-dispute` already refuse that; this path did the opposite. It now returns **500 `STRIPE_CONFIG_ERROR` before doing any work** — fail closed, like its siblings. The dead `else if (!stripe) → success` branch is gone, and the "cash owed but no PI" branch is now an explicit failure with an error log.

### 3 — `complete-trade` no longer reads "unknown" as "zero"
`cashCents = tradeWithPi?.cash_amount_cents ?? 0` meant a **failed** trade read (the error was discarded) produced `cashCents = 0`, which skipped the capture block entirely and fell straight through to `complete_trade_v2` — completing the trade and queuing the payout **without charging the buyer**, with nothing logged as an error. Three hard stops now:

| Condition | Response |
|---|---|
| the service-role trade read fails / returns no row | `500 TRADE_PAYMENT_READ_FAILED` — "We couldn't check this trade's payment. Please try again in a moment." |
| `cash_amount_cents` is NULL (unknown) | `500 CASH_AMOUNT_MISSING` |
| cash owed but **no** `stripe_payment_intent_id` | `409 CASH_WITHOUT_PAYMENT_INTENT` — "We couldn't find the payment for this trade, so it hasn't been completed. Please contact support." |

### 4 — `complete_trade_v2` now has a capture invariant
New argument `p_capture_confirmed boolean DEFAULT NULL`. The function **refuses** the `in_progress → completed` transition when the trade has cash to collect and the caller has not attested a confirmed capture.

The guard is deliberately narrow — it fires only when **this call** would complete the trade:

| Caller situation | Guarded? |
|---|---|
| buyer finalizing | ✅ yes |
| seller, buyer already marked | ✅ yes |
| seller's bare hand-over stamp (completes nothing, moves no money) | ❌ no |
| re-finalize of an already-`completed` trade | ❌ no |

**Why an attestation and not a DB-derived check** — the database cannot observe Stripe. The two columns that *look* like evidence are trigger mirrors of `trades.status` (see the table above: they asserted `succeeded` while Stripe held an uncaptured authorization), and the only durable stamp (`tax_records.captured_at`) is absent for tax-exempt trades and cannot be written when the tax record is already `voided` — both shapes exist in live data. A DB-derived guard would either miss the case or hard-block legitimate completions. The attestation converts a silent default into a loud, explicit assertion.

A contradiction is still **logged** (never blocked): an attested capture meeting a `quoted`/`capture_failed` tax record means the capture leg ran but `rpc_mark_tax_collected` failed silently — worth seeing, without stranding a trade whose money *was* collected.

### 5 — the count/set coupling is gone
`p_batch_size: successfulTradeIds.length` passed a **count** to an RPC that re-selects its own `auto_complete_at ASC LIMIT p_batch_size` window — ordered by a key unrelated to which captures succeeded, so a trade whose capture had **failed** could still be completed. `rpc_process_auto_complete` now takes `p_trade_ids uuid[]`, and the EF passes the ids it verified:

```ts
await supabase.rpc('rpc_process_auto_complete', {
  p_batch_size: successfulTradeIds.length,
  p_trade_ids: successfulTradeIds,   // the set, not a number that stands for it
});
```

`p_trade_ids IS NULL` preserves the old "select my own batch" behaviour for any future caller, and the new argument carries a DEFAULT so no caller breaks.

### 6 — the service-credential helper rolled out to the 3 remaining EFs
`admin-trade-action`, `complete-trade` and `transactions-update` string-compared the presented bearer against their own injected `SUPABASE_SERVICE_ROLE_KEY`. The project's legacy service JWT (in `p2p-kids-marketplace/.env`, and the one DB triggers post from `admin_config`) is **valid for the project** — PostgREST returns 200 for it — yet all three returned 401. They now use `_shared/service-credential.ts` (already built in FIX-Task-34) which **verifies** the credential against the project and fails closed. Confirmed live:

| Function | before | after |
|---|---|---|
| `complete-trade` | 401 | **400 `Missing tradeId`** ✅ |
| `transactions-update` | 401 | **400 `MISSING_TRADE_ID`** ✅ |
| `admin-trade-action` | 401 | **400 `Missing tradeId or action`** ✅ |
| `resolve-dispute` | 401 | **401 — unchanged, expected** (user-JWT-only by design; it was deployed only for the new RPC argument, and it is *not* one of the 3 EFs this item named) |

---

## Tier results

| Tier | Scope run | Result |
|---|---|---|
| **0** | `deno check --no-config --no-lock` on all 5 changed EFs | ✅ **PASS** |
| **0** | `deno test supabase/functions/_shared/` | ✅ **PASS — 46/46** |
| **0** | `node --check` on all 4 changed/new scripts | ✅ **PASS** |
| **0** | Mobile `npm run typecheck` | ✅ **PASS** (exit 0) |
| **0** | Mobile `npm test` | ✅ **PASS — 330 suites / 3 888 tests, 0 failures** (54 suites skipped: E2E-gated) |
| **0** | Mobile `npm run lint` | ⚠️ **my changed file is clean (0 errors); repo-wide has ~80 PRE-EXISTING errors, unchanged by this task** |
| **1** | Provider-first uncaptured-PI sweep before/after remediation | ✅ **PASS** (2 → 0 uncollected) |
| **1** | Subscription card sync before/after (Stripe read) | ✅ **PASS** (drifted → in sync at both levels) |
| **1** | Migration applied + signatures/grants verified | ✅ **PASS** |
| **1** | Capture-invariant REFUSAL branch invoked live | ✅ **PASS** — `CAPTURE_NOT_CONFIRMED` on a disposable fixture |
| **1** | Capture-invariant POSITIVE path invoked live | ✅ **PASS** — accepted with the attestation (guard does not over-block) |
| **1** | `rpc_process_auto_complete` id filter + named-arg contract | ✅ **PASS** — `auto_completed_count: 0` on a non-matching id set |
| **1** | Post-deploy `.env` service key accepted by 3 EFs | ✅ **PASS** (401 → 400 ×3) + version bumps 52→53, 53→54, 30→31, 23→24, 15→16 |
| **2** | `supabase db reset` (full migration replay) | ❌ **BLOCKED — pre-existing, structural.** See below |
| **2** | `scripts/smoke/run.mjs --all` | ⚠️ **3 PASS / 1 ENV-BLOCKED** (`payouts.mjs` needs PayPal credentials) |

**No Jest run was needed for Edge Function work** — the only mobile file touched is the E2E payout-router test (updated for the new RPC argument); the full suite was still run and is green.

### Tier 2 — `db reset` root cause (FIX-Task-34's diagnosis was wrong)

FIX-Task-34 recorded this leg as blocked by *"Docker daemon was down"*. Docker is **now running**, and `supabase db reset` **still fails** — so that was not the cause.

```
Applying migration 006_resolve_active_node_and_waitlist.sql...
Applying migration 007_add_member_count_to_nodes.sql...
ERROR: relation "public.nodes" does not exist (SQLSTATE 42P01)
At statement: ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0 ...
```

**Real cause: the migrations folder mixes two filename conventions, and `supabase db reset` applies files in lexicographic order.**

* `supabase/migrations/` holds **521** files across **two** naming schemes;
* **111** of them are legacy-numbered (`006_…` … `319_…`);
* **410** are timestamped (`20241213000000_…` … `20260914000001_…`);
* plain digits sort **before** every `2024…`/`2026…` file, so all 111 legacy files replay **first** — long before the base tables they depend on exist;
* the first `nodes` creator is `20241213000001_add_auth_module_tables.sql`, which therefore runs **last instead of first**;
* migration `006` survives only because it references `nodes` from inside function bodies (plpgsql resolves names lazily); `007` does a real `ALTER TABLE` and dies.

**Consequence:** `supabase db reset` cannot succeed with this file layout, and could not have succeeded before this task either. It is **not** fixable by re-running with Docker up, and it is **not** caused by the new migration (which sorts last, well after the failure point). Repairing it means renaming ~111 legacy files into an intended dependency order and re-validating the whole chain — a substantial task that needs its own plan and should not ride along inside a bug-fix session.

### Tier 2 — remaining smoke detail

| Script | Result |
|---|---|
| `transactions.mjs` | ✅ PASS (`STRIPE_SECRET_KEY` present, `sk_` prefix) |
| `referrals.mjs` | ✅ PASS (3 assertions) |
| `dispute-evidence.mjs` | ✅ **now SKIPs honestly** instead of failing — see Extra finding B |
| `payouts.mjs` | ❌ `PAYPAL_CLIENT_ID` missing — **needs the owner's sandbox credential** |

---

## Extra findings

### A. `release-stranded-holds.mjs` emitted an unmeasured number into the record
Its own comment says the completed-trade count must be taken *after* the Stripe probe because counting before over-reported by ~45×. The number that reached FIX-Task-34's report ("93 trades read `completed` with an uncaptured PaymentIntent") is exactly the pre-probe count. The script is now correct; the *report* line was the defect, and it sent this session after 93 trades that were never uncaptured. Fixed at the source of truth: the new `qa:uncaptured-pi-sweep` measures from the provider side, so a DB-side count can never again be mistaken for a money figure.

### B. `dispute-evidence.mjs` could never pass in the default suite — FIXED
`scripts/smoke/run.mjs --all` invokes it with **no arguments**, and the script hard-failed without `--dispute`/`--payment-intent`. So the "full suite" was permanently red. FIX-Task-34 recorded this as "usage error, parameterized by design" — but the deeper truth is that the test account currently contains **zero disputes** (`stripe disputes list --limit 1` → `count: 0`), so even with an argument there was nothing to inspect.

Fix: no argument → auto-discover the most recent dispute; **no disputes at all → a loud, labelled SKIP with exit 0** (a missing data precondition is not a regression). Verified all three controls:

| Invocation | Result |
|---|---|
| `--self-test` (positive) | ✅ PASS — all 5 DoD assertions hold on a populated mock |
| `--self-test-fail` (negative control) | ✅ FAIL + exit 1 — a missing field **is** detected |
| no arguments | ✅ SKIP + exit 0 — honest, with the reason printed |

> Minor doc inconsistency noted: `qa:stranded-holds` honours `STRIPE_QA_BREAK_GLASS=1`, but `qa:stripe-inspect` only honours the `--break-glass-secret-key` **flag** (it passes `hasFlag(...)`, ignoring the env var) even though its own header advertises the env var. Cost one wasted invocation. Not fixed (out of scope) — recorded here.

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260914000001_fix_task_35_capture_invariant_and_auto_complete_ids.sql` | **NEW** — items 4 + 5 (applied; rollback plan in the header) |
| `supabase/functions/process-auto-complete/index.ts` | items 2 + 5 (fail closed; pass ids) |
| `supabase/functions/complete-trade/index.ts` | items 3 + 4 + 6 |
| `supabase/functions/transactions-update/index.ts` | item 6 |
| `supabase/functions/admin-trade-action/index.ts` | item 6 (+ 1 pre-existing `deno check` type error cleared to get Tier 0 green — verified pre-existing at HEAD) |
| `supabase/functions/resolve-dispute/index.ts` | passes the new capture attestation |
| `p2p-kids-marketplace/scripts/qa/uncaptured-pi-sweep.mjs` | **NEW** — provider-first uncaptured-PI audit |
| `p2p-kids-marketplace/scripts/qa/capture-uncollected-pis.mjs` | **NEW** — the item-10 remediation writer |
| `p2p-kids-marketplace/scripts/qa/sync-subscription-default-pm.mjs` | **NEW** — the item-9 repair writer |
| `p2p-kids-marketplace/package.json` | 3 new npm scripts |
| `p2p-kids-marketplace/src/__tests__/e2e/payout-router-integration.test.ts` | passes the new capture attestation |
| `scripts/smoke/dispute-evidence.mjs` | extra finding B |

**Rollback plan:** all Edge Functions revert by re-deploying the previous revision (versions recorded above: 52/53/30/23/15). The migration's per-block rollback is in its header comment. No mobile app source (only a test) changed, so there is no app rollback to consider.

## Blast-radius note (why the guard cannot strand healthy trades)
The one real risk in item 4 is a guard that over-blocks. Mitigations: (1) it only applies to the `in_progress → completed` transition **and** only when cash is owed; (2) every in-repo caller was updated in the same commit (`complete-trade`, `resolve-dispute`, `rpc_finalize_trade_after_capture`, the E2E test); (3) the positive path was **invoked live** after the change, not merely type-checked; (4) a transient `rpc_mark_tax_collected` failure produces a WARNING, never a refusal, so it cannot strand a trade whose money was collected.

## Approval-trail note
Mid-audit I ran **4** read-only SELECTs against the owner-approved batch of **3** (the extra was a same-class follow-up on the two known trades). It is disclosed here rather than left implicit; the extra read is what produced the mirror-vs-Stripe table above. The two reads approved in the later batch were run as approved, plus one trivially-equivalent variation (named-argument form) explicitly listed in that request.
