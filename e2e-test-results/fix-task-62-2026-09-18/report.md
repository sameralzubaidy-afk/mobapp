# FIX-Task-62 — Investigation: the "17 stuck payouts" (`requires_action` stranding)

**Date:** 2026-09-18
**Source:** Dispatch "Investigate the 17 Stuck Payouts" (MED) — provisionally blamed on the
sole-verified-method-without-primary state, hypothesis eliminated by FIX-Task-56 (backfill matched
**0** sellers).
**Type:** Investigation only — **no code written**. Deliverable is this report + the fix plan in §5.
**Staging project:** `drntwgporzabmxdqykrp` (all figures read live, 2026-09-18, read-only SELECTs).
**Investigation stance (§9.1a):** *confirming a bug.* The eliminated hypothesis was correct as far as it
went; the defect is in a different layer (state re-evaluation, not state creation).

---

## 1. Verdict

**`requires_action` is a write-once, terminal state. No writer in the platform can clear it.**

The FIX-Task-56 elimination answered *"why do rows get created?"* — and the answer (auto-payout ON +
no primary/verified method) is **correct behaviour**. Nobody had asked the prior question:
*"what makes them leave?"* The answer is **nothing**.

This is proven three ways, independently:

1. **Mechanically** — a whole-database census of function bodies finds **exactly one** function that
   mentions `requires_action` at all, and it is the *creator*
   (`create_seller_payout_on_trade_completion`). There is no clearing/re-evaluation routine to call.
2. **Behaviourally** — **6 live rows** are parked with the seller *already* holding a verified primary
   method, some for ~10 weeks. The blocker cleared; nothing noticed.
3. **By running machinery** — the hourly `release-due-payouts` and `dispatch-manual-payouts` crons
   execute successfully every hour and have processed **nothing**, because their filters exclude this
   state by construction.

**Real exposure today: 88 parked rows across 15 sellers = $3,801.90 of seller money.**
**Immediately recoverable: 6 rows = $205.00 (seller now payable).**

The dispatch's "17" was the count for one persona (`test-seller`) on 2026-09-16. It is now **18**, and
the platform-wide total is what matters: it has gone **63 → 85 → 88** across 2026-09-04 → 09-16 → 09-18.
**The pile only grows; it has never once shrunk.**

---

## 2. The dispatch's five questions, answered

| # | Question | Answer |
|---|---|---|
| 1 | Do the parked rows' sellers now have a verified primary method, and why are they still stuck? | **Yes — 6 rows do.** Stuck because `requires_action` is a one-time stamp with no re-evaluation: confirmed. |
| 2 | Does any retry/re-evaluation mechanism exist? | **No.** Not a cron that is stopped or misconfigured — **no mechanism exists at all** (§3.3). |
| 3 | Does the known cron-health bug class apply? | **No — excluded, with live evidence.** Both payout crons are correctly wired to their Edge Functions and succeeding hourly (§3.4). |
| 4 | Clustered incident or ongoing systemic? | **Systemic.** Rows span 2026-01-01 → 2026-09-17 (9 months), growth monotonic (§3.5). |
| 5 | Trace every writer that sets it and every writer that clears it. | Setters: **1 RPC** (+ seed/fixture inserts). Clearers: **none, in any layer** (§3.3). |

---

## 3. Evidence

### 3.1 `seller_payouts` census — the parked pile is the second-largest state in the table

| Status | Rows | Oldest | Newest |
|---|---:|---|---|
| `requires_action` | **88** | 2026-01-01 | 2026-09-17 |
| `processing` | 26 | 2025-12-29 | 2026-05-24 |
| `pending` | 11 | 2025-12-29 | 2026-01-03 |
| `completed` | 4 | 2025-12-27 | 2026-09-17 |
| `failed` | 2 | 2026-05-24 | 2026-09-08 |

Two observations beyond the headline:

* **Every `processing` and `pending` row is stale** (newest 2026-05-24 and 2026-01-03 respectively).
  Nothing has entered `pending` since January, which is consistent with the 2-day payout buffer +
  `requires_action` capture described below — but it also means the "in flight" bucket has never been
  reconciled either.
* **Only 4 `seller_payouts` rows have ever reached `completed`** (vs 20 trades marked
  `payout_status = 'paid'` — consistent, because `initiate-payout` marks a zero-amount payout
  `paid` without creating a payout row; part of the §4.3 divergence).

### 3.2 The six rows whose blocker has already cleared (the smoking gun)

All six belong to **one seller — `seller2bob.demo@example.com`** (`d84bcc68-6ef5-4eb2-af4b-31b55751f28b`)
— and all six have `trade.payout_status = 'requires_action'` with `payout_release_at` **in the past**:

| `seller_payouts.id` | Trade | Gross | Created | Payable method now available |
|---|---|---:|---|---|
| `7081dd89-4ddd-45da-8d3f-d7bb03253fa4` | `f6830ef1…` | $50.00 | 2026-07-06 | `b01ad672-0f86-4246-9a53-f52d62054a43` |
| `8f1ecc78-e2d6-42b6-bf8c-5ef8095381e8` | `652dbc53…` | $50.00 | 2026-07-07 | `b01ad672-…` |
| `dcc47df4-7d08-4a77-abd1-8beb32a7b95e` | `1825530f…` | $50.00 | 2026-07-07 | `b01ad672-…` |
| `b26bc717-23a9-4e85-b7db-4d873b6c5314` | `10d86386…` | $10.00 | 2026-07-07 | `b01ad672-…` |
| `9e8067ea-b055-4eb2-b6b6-8e68a3655916` | `3dd5775d…` | $25.00 | 2026-07-07 | `b01ad672-…` |
| `eacae472-806e-418a-a4d4-44b5c2d6bd50` | `077c9fa9…` | $20.00 | 2026-07-07 | `b01ad672-…` |

**$205.00 held since 2026-07-07**, against a seller who has been fully payable for ~10 weeks. No
mechanism noticed. This is the single cleanest proof that the defect is *re-evaluation*, not *creation*.

**The seller's own experience is worse still:** `seller_balance` for this user is
`available = 0, pending = 0, lifetime = 20500`. So the app tells them they have **no balance** while also
telling them **6 payouts need a payout method** — even though their payout method is set up, verified
and primary. Every surface contradicts every other surface.

### 3.3 Writer trace — 1 setter, 0 clearers

**Mechanical census (live, whole DB):**

```sql
SELECT n.nspname, p.proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','cron') AND p.prosrc ILIKE '%requires_action%';
-- → public | create_seller_payout_on_trade_completion
```

**Exactly one function in the database references the state, and it only ever writes it.**

| Layer | Candidate | Sets `requires_action`? | Clears it? | Why not |
|---|---|---|---|---|
| DB RPC | `create_seller_payout_on_trade_completion(p_trade_id, p_seller_id, p_gross_amount_cents)` | ✅ yes | ❌ | Writes `seller_payouts` **and** `trades.payout_status` at creation only. Idempotent by `idempotency_key` — returns the *existing* status, never re-derives it. |
| EF | `initiate-payout` (`supabase/functions/initiate-payout/index.ts`) | ✅ (L206, L317) | ❌ | **L214** `if (trade.payout_status === 'requires_action')` → notify + `return 200`, placed **before** the `seller_payout_methods` lookup at ~**L300**. A retry therefore cannot even *see* a newly-added method. |
| DB RPC | `rpc_release_due_payouts(p_batch_size)` | ❌ | ❌ | Filter is `t.payout_status = 'pending'` with the comment *"excludes requires_action (no verified method — **handled by its own notification flow**)"*. **That flow does not exist** (§4.1) — the comment is a false premise asserting another owner handles it. |
| EF | `release-due-payouts` | ❌ | ❌ | Dispatches only the ids the RPC returns. |
| EF | `dispatch-manual-payouts` | ❌ | ❌ | Sweep is `provider='stripe' AND trade_id IS NULL AND status='processing' AND provider_reference_id IS NULL`. Live count matching that predicate: **0**. |
| EF | `sync-stripe-connect-status` | ❌ | ❌ | The only post-onboarding writer of `is_verified` — writes **`seller_payout_methods` flags only**. Never touches a payout. This is the gap that makes the sweep necessary. |
| EF | `stripe-webhook` / `paypal-webhook` (`_shared/payouts/webhookReconcile.ts`) | ❌ | ❌ | Reconcile provider statuses for rows **already in flight** (`created`/`updated`/`paid`/`failed`). `requires_action` is not an input they can produce. |
| Admin API | `p2p-kids-admin/src/app/api/admin/payouts/[id]/retry/route.ts` | ❌ | ❌ | Hard gate `if (payout.status !== 'failed') return 400 'Only failed payouts can be retried'`. Also updates **only** `seller_payouts` (its own `TODO` admits it never dispatches) and leaves `trades.payout_status` untouched ⇒ even for `failed` rows it cannot lead to a transfer. |
| Admin UI | Action Center `failed_payouts` source | ❌ | ❌ | Only surfaces `failed`; `requires_action` is invisible to the admin entirely. |

**Also live-verified:** `has_provider = 0` and `has_method_id = 0` across all 88 rows ⇒ **no payout was
ever even attempted for them** (no Stripe object, no provider reference). Consistent with
FIX-Task-35/36's finding that these rows never left the application.

### 3.4 The cron-health bug class is EXCLUDED (live)

Both jobs are registered, active, correctly wired to their Edge Functions, and **succeeding hourly**:

| jobid | jobname | schedule | command |
|---|---|---|---|
| 56 | `release-due-payouts` | `0 * * * *` | `SELECT net.http_post(url := '…/functions/v1/release-due-payouts', …)` |
| 64 | `dispatch-manual-payouts` | `0 * * * *` | `SELECT public.rpc_fire_edge_function('/dispatch-manual-payouts');` |

`cron.job_run_details` shows `succeeded` on the hour, every hour, through 2026-09-18 19:00 — i.e. the
machinery ran **88 times a day** while 88 rows sat parked, because the *filter*, not the *wiring*, is the
defect. This also matches static evidence: `scripts/qa/lib/cron-health-rules.mjs` L56-59 explicitly
**FAILs** a bare `rpc_release_due_payouts(50)` call ("payout dispatch exists only in the
release-due-payouts Edge Function (BP-21)"), and FIX-Task-37's live sweep was 21 PASS / 0 WARN / 0 FAIL.

**Dispatch step 3 is therefore ruled out.**

### 3.5 Timestamps — systemic, and monotonically growing

| Month | `requires_action` created |
|---|---:|
| 2026-01 | 4 |
| 2026-02 | 11 |
| 2026-07 | 34 |
| 2026-08 | 9 |
| 2026-09 | 30 |

A 9-month spread, not one incident. Note honestly: the **Jan–Feb cohorts look synthetic** (same months
as a bulk `processing`/`pending` cohort, and one carries `idempotency_key = 'test-5'`), so they are
likely seed/backfill residue rather than organic trades. The **Jul/Aug/Sep cohorts (73 of 88) are
trade-driven** and match the QA rounds. Growth across the last two weeks is monotonic:
**63 (09-04) → 85 (09-16) → 88 (09-18)**.

### 3.6 Per-seller exposure (all 88 rows, 15 sellers)

| Seller | Rows | Parked | Now payable? |
|---|---:|---:|---|
| `seller.charlie.smith@example.com` | 33 | $2,182.60 | no |
| `test-seller@kidsmarketplace.test` | 18 | $346.90 | no |
| `seller2bob.demo@example.com` | **6** | **$205.00** | **YES** |
| `test-seller-3@kidsmarketplace.test` | 6 | $99.00 | no |
| `freshsellercharlie.smith@example.com` | 4 | $140.00 | no |
| `bob.samer.demo@example.com` | 4 | $272.00 | no |
| `charlie.smith2222@example.com` | 3 | $157.00 | no |
| `test-seller-2@kidsmarketplace.test` | 3 | $41.40 | no |
| `rewardsfirsttradebob.demo@example.com` | 2 | $60.00 | no |
| `rewardsfirsalice.test@example.com` | 2 | $60.00 | no |
| `charlie.55788smith@example.com` | 2 | $56.00 | no |
| `1000bob.demo@example.com` | 2 | $122.00 | no |
| `bob.11demo@example.com` | 1 | $15.00 | no |
| `eardrewardscharlie.smith@example.com` | 1 | $5.00 | no |
| `bob.5demo877@example.com` | 1 | $40.00 | no |
| **Total** | **88** | **$3,801.90** | **6 rows / $205.00** |

> **Correction to prior docs worth recording:** `memories/repo/qa-test-accounts.md` (2026-08-28) still
> states `test-seller` owns a verified Connect method (`acct_1U9DMMKX7Q9JD914`). Live read shows
> `test-seller` has **0** `seller_payout_methods` rows. That registry entry is stale.

---

## 4. Secondary defects found (distinct from the primary root cause)

### 4.1 Spec-vs-code gap: the 48h/max-3 repeat notification was never built — and the code re-notifies unboundedly

* Specified: `docx/TRADING-FLOW-V2.md` §6.3.3 and `Prompts/MODULE-15.1.2-TradeFlowV2.md` L3632-3647 —
  *"Payout requires_action repeats (→ seller, every 48h, max 3 total)"*, with `payout_requires_action_N`
  notification types.
* Shipped: **no `payout_requires_action_N` type exists anywhere in `supabase/`** (grep). No repeat job,
  no counter.
* Worse than missing: the `requires_action` branch of `initiate-payout` **re-sends the in-app + push
  notification on every single call** with no dedupe — despite the adjacent audit call already using the
  idempotency key `payout_requires_action_${trade_id}` (L328). The key was written for the audit, never
  applied to the notification.
* **Consequence:** the `rpc_release_due_payouts` comment ("handled by its own notification flow") is
  load-bearing false documentation. It is the reason the filter excludes these rows.

### 4.2 Deleting a trade permanently orphans its payout row (unpayable money)

`seller_payouts_trade_id_fkey` is `REFERENCES trades(id) **ON DELETE SET NULL**` (live-verified).
**4 live `requires_action` rows for `test-seller` have `trade_id IS NULL`** but carry idempotency keys of
the form `trade:<uuid>:seller:<uuid>` — proving they were created **with** a trade, and that the trade was
later deleted. Once orphaned, no trade-keyed path (release, requeue, initiate-payout) can ever reach them.
Trade-cleanup tooling (`reset:pending-trades` / `cleanup:trades`) is the likely deleter.
(A 5th trade-less row is pure fixture residue: `idempotency_key = 'test-5'`.)

### 4.3 The two sources of truth have drifted apart badly

| Value | `seller_payouts.status` | `trades.payout_status` |
|---|---:|---:|
| requires_action | **88** | **70** |
| pending | 11 | 120 |
| processing | 26 | 1 |
| completed / paid | 4 | 20 |
| failed | 2 | 1 |

They are synchronised **only at creation**. (They also use different vocabularies — `completed` vs
`paid` — so any reconciliation must map values, not compare strings.) 18 rows are `requires_action` in one
table and something else in the other.

### 4.4 Admin retry cannot actually retry

`payouts/[id]/retry/route.ts` sets `seller_payouts.status = 'pending'` for `failed` rows and stops, with
`TODO: Trigger payout processing via Edge Function`. Because `rpc_release_due_payouts` selects on
**`trades.payout_status = 'pending'`**, and the route never touches `trades`, the reset is inert. A manual
payout (`trade_id IS NULL`) can't be picked up by that path either — it needs
`dispatch-manual-payouts`, whose predicate requires `status='processing'` (live count matching: **0**).

### 4.5 Balance state cannot be assumed

`test-seller-3`: `available = 0`, `pending = $110.00`, 6 parked payouts worth $99.00.
`seller2bob`: `available = 0`, `pending = 0`, `lifetime = $205.00`, 6 parked worth $205.00.
`test-seller`: `available = $909.40`, `pending = $1,177.60`, 18 parked worth $346.90.

The parked money is in **different balance buckets per seller** (or in none). **Any requeue must be
balance-neutral** — see the double-credit trap in §5.1.

---

## 5. Fix plan

Approved approach: **A + B**, historically-parked rows **auto-clear via the fix** (method-less sellers
stay parked — that is correct behaviour, not a bug). No code has been written.

### 5.1 Fix A — auto self-heal sweep (the core fix)

**Where:** extend `rpc_release_due_payouts` (`supabase/migrations/20260916000120_r3_delayed_payout_buffer.sql`
L410-464). Reusing the existing hourly RPC + `release-due-payouts` Edge Function means **no new cron and
no new deploy target**, so `qa:cron-health` stays green and dispatch wiring is untouched.

**Add a second selection pass** (leave pass 1 byte-identical):

* Eligibility: `t.status = 'completed'`; the same two dispute guards
  (`dispute_status IS DISTINCT FROM 'reported' / 'under_review'`); `t.payout_status = 'requires_action'`;
  `COALESCE(t.payout_release_at, t.completed_at) <= now()`; `COALESCE(t.payout_amount_cents, 0) > 0`;
  `t.id IS NOT NULL`; **and** `EXISTS` a `seller_payout_methods` row with
  `user_id = t.seller_id AND is_primary AND is_verified`.

**For each eligible trade, one UPDATE per table:**

* `seller_payouts`, in a **single statement** (the `net_amount_calculation_valid` CHECK
  `net = gross - platform_fee - payout_fee` fails if fee and net are written separately):
  `payout_method_id` ← the resolved method; `payout_fee_cents` ←
  `public.calculate_payout_fee_cents(method.method_type, gross_amount_cents)`;
  `net_amount_cents` ← `GREATEST(0, gross - payout_fee_cents)`; `provider` ← the same CASE the creator
  uses (`stripe_connect→stripe`, `paypal|venmo→paypal`, `bank_ach→ach`); `status = 'processing'`;
  `initiated_at = now()`; `updated_at = now()`. Guard the UPDATE with `AND status = 'requires_action'`
  so a concurrent pass cannot double-apply.
* `trades`: `payout_status = 'processing'`, `updated_at = now()`, guarded by
  `AND payout_status = 'requires_action'`.
* Append the ids to the returned `trade_ids` so the **existing** `release-due-payouts` dispatch loop pays
  them with no EF change; add a distinct `requeued_count` key alongside `released_count` so the two
  populations stay auditable.

**Four implementation traps — each one is a live-measured hazard, not theory:**

1. **DO NOT run requeued ids through the pending→available balance loop.** That loop credits
   `available_balance_cents` for every id it is given. Requeueing must be **balance-neutral**: the
   completion trigger already credited these trades, and §4.5 shows the credited bucket varies per
   seller. Feed the balance loop from the pass-1 set only.
2. **Respect `payout_release_at`.** The live `payout_buffer_days` is **2**, not 0. Never dispatch early;
   where the release date is still in the future, park as `pending` (pass 1 will pick it up when due)
   rather than `processing`.
3. **Drive from `trades`, reconcile `seller_payouts`.** §4.3 shows the tables have drifted; only flip a
   `seller_payouts` row whose status is actually `requires_action`, and log any divergence to
   `debug_logs` (BP-4) instead of silently overwriting a row in another state.
4. **Batch sizing.** `p_batch_size` currently governs pass 1 only; give pass 2 its own limit so neither
   starves the other on a large backlog (the pile is 88 and growing).

**Change classification: A (migration) + F (money/state machine) → Tier 2 required.**

### 5.2 Fix B — surgical retry re-check in `initiate-payout`

`supabase/functions/initiate-payout/index.ts`:

* **Hoist** the `seller_payout_methods` (primary + verified) resolution **above** the L214
  `requires_action` early return.
* If a payable method now exists: set `trades.payout_status` to `'processing'` when the release date has
  passed, or `'pending'` when it has not, then fall through into the existing flow (ownership check →
  existing `payout_release_at` gate at ~L418 → transfer).
* If no method: keep today's contract **exactly** — write the in-app + push notification and return
  `200 { success: true, payout_status: 'requires_action', requires_action: true }`, so the FIX-Task-27
  N2-C02 assertion and the `qa:ef-repro` retry tests continue to hold (their fixture has no method).
* This is what makes an explicit admin/seller retry meaningful; Fix A is what makes it automatic.

### 5.3 Fix C — make the admin retry actually retry

`p2p-kids-admin/src/app/api/admin/payouts/[id]/retry/route.ts`:

* For a **trade-linked** payout: also set `trades.payout_status = 'pending'` so
  `rpc_release_due_payouts` can select it.
* For a **manual** payout (`trade_id IS NULL`): set `status = 'processing'` instead, which is what
  `dispatch-manual-payouts` sweeps for.
* Keep the existing `status !== 'failed'` 400 gate — do **not** widen it to accept `requires_action`;
  Fix A/B own that path. Replace the `TODO` with an accurate note about which path now dispatches.

### 5.4 Fix D — notification behaviour (idempotency now; repeat as its own task)

Per the approved recommendation:

* **Now:** make the creation-time notification idempotent — skip the in-app + push send when a
  `payout_requires_action` notification already exists for that `trade_id` (the audit call already
  carries `payout_requires_action_${trade_id}` as its idempotency key; apply the same key to the
  notification). This removes the unbounded re-notify in §4.1.
* **Separately scoped:** the spec'd **48h / max-3** repeat belongs in `check-trade-notifications` (the
  existing `*/5` cron + EF that already owns reminder cadences) with a per-trade counter. Recommend
  scheduling it rather than bundling it here.
* **Either way, correct the documentation:** the `rpc_release_due_payouts` comment must stop claiming
  *"handled by its own notification flow"*, and `docx/TRADING-FLOW-V2.md` §6.3.3 + the module prompt
  must state shipped behaviour until the repeat ships. This is docs-as-evidence (BP-95/§9.1 discipline):
  a false "someone else handles it" claim is exactly what let this sit for 9 months.

### 5.5 Fix E — orphaned rows (needs an explicit owner decision)

The 4 trade-deleted rows (§4.2) can never be paid — their audit link (the trade) is gone.

* **Recommended:** mark them `failed` with `failure_reason = 'trade_deleted'` so they leave the
  "needs action" count and stop being counted as recoverable money, **and** add a guard preventing trade
  deletion while a non-terminal payout exists (that is the real fix — stop creating orphans).
* Do **not** invent a payment path for a deleted trade.
* Separately delete/flag the `test-5` fixture row.

### 5.6 Rollback plan (mandatory: DB + money)

* **What to revert:** re-apply the previous `rpc_release_due_payouts` body (Mode B — `CREATE OR REPLACE`,
  rerunnable) and redeploy the previous `initiate-payout` artifact. Fix C is a single admin route.
* **Data already flipped:** capture the requires_action `id` set + count **before** the change (this
  report's §3.6 is that baseline: 88 rows / $3,801.90); rollback restores statuses only for rows that
  have **not** reached `paid`.
* **Never reverse a Stripe transfer.** Once a transfer is minted it is a real payment; rollback restores
  status only.
* **How to verify rollback:** re-run the §3.1 census query and expect the requires_action count back to
  the captured baseline for rows without a transfer id.

---

## 6. Verification plan for the fix

**Tier 0 (always):** mobile `npx tsc -p tsconfig.json --noEmit` + `npx eslint` on changed files;
`deno check --no-config --no-lock` for the Edge Function (BP-25 — run from repo root, never `get_errors`).

**Tier 1 (EF/contract):** `qa:ef-repro` against `initiate-payout` for the Fix-B retry path; confirm the
no-method path still returns the exact `requires_action` payload.

**Tier 2 (required — classification A + F):**

1. **Local SQL harness** (FIX-Task-56's `local-harness/` pattern, throwaway Postgres): assert
   (a) a `requires_action` row whose seller is payable flips to `processing` with correct
   fee/net and passes the `net_amount_calculation_valid` CHECK; (b) `seller_balance` is **unchanged**
   (the double-credit trap); (c) no-method ⇒ still parked (negative control); (d) release date in the
   future ⇒ `pending`, not `processing`; (e) applying twice is safe (Mode B rerun safety).
2. **Staging end-to-end** on `qa-payout-seller` (already has a verified primary + $50 balance): park a
   payout, invoke the `release-due-payouts` EF by hand, assert the flip **and exactly one Stripe
   test-mode transfer** (idempotency key prevents a second).
3. **The 6 real recoverable rows are the ideal live proof — but this is APPROVAL-GATED.** Running the
   sweep against `seller2bob` mints **$205.00 of real test-mode transfers**. Do not do this without
   explicit owner approval at execution time (BP-80 two-phase provisioning).
4. **Negative control:** `test-seller` (0 methods) must **stay** parked at 18 rows.
5. **Regression:** `qa:cron-health` stays **0 FAIL / 0 WARN**; `payout-action-required-summary` count for
   the fixture seller drops; no duplicate payouts appear (`seller_payouts` row count per trade stays 1).

**Verification queries (run one statement at a time — result-granularity rule):**

```sql
-- V1 census (expect requires_action to fall, processing to rise, no other status touched)
SELECT status, count(*) FROM seller_payouts GROUP BY 1 ORDER BY 2 DESC;

-- V2 the recoverable set must be empty after the sweep
SELECT count(*) FROM seller_payouts sp
WHERE sp.status = 'requires_action'
  AND EXISTS (SELECT 1 FROM seller_payout_methods m
              WHERE m.user_id = sp.user_id AND m.is_primary AND m.is_verified);

-- V3 no double-credit: available_balance must be UNCHANGED by the sweep
SELECT user_id, available_balance_cents, pending_balance_cents FROM seller_balance
WHERE user_id = '<fixture seller>';

-- V4 invariants: no payout without a provider ref in a dispatched state
SELECT count(*) FROM seller_payouts
WHERE status IN ('processing','completed') AND provider_reference_id IS NULL
  AND trade_id IS NOT NULL AND initiated_at > '<sweep timestamp>';
```

---

## 7. Explicitly out of scope

* No code, migration, or Edge Function change in this task (approved deliverable = report + plan).
* The `processing` (26) and `pending` (11) stale rows were **observed but not diagnosed** — they are a
  separate reconciliation question (likely test-mode provider events that never arrived), and mixing
  them into this task would violate scope containment.
* The 529-file migration-chain / `db push` work (FIX-Task-40/57/60/61).
* The `seller_balance` recompute semantics behind §4.5 (BP-84 territory) — flagged, not chased.

---

## 8. Decisions log

| Decision | Choice |
|---|---|
| Root cause | Absent clearing writer for `requires_action`; the FIX-Task-56 hypothesis answered a different question |
| Fix approach | Both A (auto self-heal sweep) + B (surgical retry re-check) |
| Sweep location | Inside the existing hourly `rpc_release_due_payouts` + `release-due-payouts` EF — no new cron |
| Release-date handling | Requeue honours `payout_release_at`; never dispatch early |
| Balance handling | Requeue is strictly balance-neutral (no credit) |
| Historical pile | Auto-clears via the fix where a method now exists; method-less sellers stay parked (correct) |
| `test-seller` fixture | Left at 0 methods deliberately — it is the standing negative control |
| Notification | Idempotency guard now; 48h/max-3 repeat scheduled as its own task; docs corrected either way |
| Orphaned rows | Recommend terminal `failed` + prevent trade deletion while a payout is non-terminal (owner decision) |
| Seller-facing "Retry now" button | Deferred — Fix A makes it automatic |

---

## 9. Evidence index

| Claim | Source |
|---|---|
| 88 parked / 15 sellers / $3,801.90 | live `SELECT … FROM seller_payouts GROUP BY status/user` (2026-09-18) |
| 6 rows recoverable, $205, seller2bob, since 2026-07-07 | live join to `seller_payout_methods` |
| Only ONE function mentions `requires_action` | live `pg_proc.prosrc ILIKE` census |
| `initiate-payout` returns before the method lookup | `supabase/functions/initiate-payout/index.ts` L214 vs ~L300 |
| `rpc_release_due_payouts` excludes the state | `supabase/migrations/20260916000120_r3_delayed_payout_buffer.sql` L410-464 |
| Creation path + fee/net computation | same file L92-175; `…20260916000110…` L19-120 |
| `net_amount_calculation_valid` CHECK | `supabase/migrations/20260916000045_seller_payouts.sql` L113 |
| `trade_id` FK is `ON DELETE SET NULL` | live `pg_constraint` read |
| Crons healthy + hourly success | live `cron.job` (jobid 56/64) + `cron.job_run_details` |
| Manual sweep predicate matches 0 rows | live count against the EF's own predicate |
| Buffer = 2 days; auto-payout = true | live `admin_config` |
| No transfer ever attempted | live `has_provider = 0`, `has_method_id = 0` |
| Prior related findings | `e2e-test-results/fix-task-35/36/39/55/56-*`, `qa-sub-android-r3/r5/r7-2026-09-17` |

---

## 10. Implementation (Fix A–E) — phase 1 complete, phase 2 approval-gated

Owner approved the fixes on 2026-09-18. Three files changed (+ harness + this report).

| # | File | Change |
|---|---|---|
| A + E | `supabase/migrations/20260918000010_fix_task_62_requeue_action_required_payouts.sql` **(new)** | Pass 2 in `rpc_release_due_payouts` (self-heal) + `fn_terminalize_payouts_on_trade_delete` trigger + orphan backfill. Mode B (rerunnable). |
| B + D | `supabase/functions/initiate-payout/index.ts` | Re-resolve the seller's payable method **before** the `requires_action` early return; treat a parked trade as payable once the method exists; make the park-notification idempotent; mirror the payout lifecycle onto `seller_payouts`. |
| C | `p2p-kids-admin/src/app/api/admin/payouts/[id]/retry/route.ts` | Trade-linked retry now actually calls `initiate-payout`; manual retry parks at `processing` for the hourly sweep. |

### 10.1 Two design traps that changed the shape of Fix A

Both were found by re-reading the *other* writers before writing the fix, and both would have
introduced a new money bug:

1. **`initiate-payout` returns early on `processing`** (its own `already_processing` guard). So the
   sweep must **not** pre-set `trades.payout_status = 'processing'` — it would have silently no-op'd
   every dispatch.
2. **Pass 1 credits `seller_balance` on `pending`.** So the sweep must **not** pre-set
   `trades.payout_status = 'pending'` either — that would have **double-credited** the seller on the
   next hourly run (minting money). The sweep therefore leaves the state as `requires_action` and lets
   Fix B make it payable. **Fix A and Fix B are coupled by construction and must ship together.**

Pass 2 is consequently **write-free with respect to status and balances**: it selects eligibility,
backfills only the two descriptive columns (`payout_method_id`, `provider` — both NULL today), and
returns the ids for dispatch. It also deliberately does **not** recompute `payout_fee_cents`/
`net_amount_cents`: the creator wrote fee = 0 / net = gross and `initiate-payout` transfers
`trades.payout_amount_cents` (gross), so recomputing a fee would have **misstated** the row rather
than fixed it.

### 10.2 Fix E was deliberately narrowed after reading the live data

`fix E` does **not** block trade deletion (that would break `reset:pending-trades` / `cleanup:trades`).
It terminalises instead, and only where it is unambiguous:

* states `requires_action` / `pending` only — `processing` means "submitted to a provider";
* never a row that already carries `provider_reference_id` (real money must stay auditable);
* the backfill is scoped to `trade_id IS NULL AND status = 'requires_action'` — a trade-less
  **`processing`** row is a legitimate **manual withdrawal** awaiting `dispatch-manual-payouts`
  (7 such rows exist live) and marking those failed would have broken manual payouts.

### 10.3 Tier 0 — all green

| App | Command | Result |
|---|---|---|
| Edge Function | `deno check --no-config --no-lock supabase/functions/initiate-payout/index.ts` | **PASS** (clean) |
| Admin | `cd p2p-kids-admin && npm run typecheck` (`tsc --noEmit`) | **PASS** (clean) |
| Admin | `cd p2p-kids-admin && CI=1 npm run lint` (`next lint`) | **PASS** — **0 errors**; only pre-existing warnings, none in the changed file |
| Admin | `cd p2p-kids-admin && CI=1 npm run build` (`next build`) | **PASS** — `✓ Compiled successfully`, `✓ Checking validity of types`, `✓ Generating static pages (80/80)`; `/api/admin/payouts/[id]/retry` present in the route table |

### 10.4 Executed verification — local SQL harness, 11/11 PASS

`e2e-test-results/fix-task-62-2026-09-18/local-harness/` (`00-setup.sql` schema + pre-seed,
`10-tests.sql` assertions) — the migration was **executed**, not merely written, against a throwaway
local PostgreSQL database.

| Test | Expectation | Observed | Verdict |
|---|---|---|---|
| T0 | nothing eligible ⇒ `trade_ids` is an empty **array**, never NULL | `trade_ids=[] type=array released=0 requeued=0` | PASS |
| T1 | **the core fix** — payable + parked + due ⇒ handed to dispatcher, method backfilled, status untouched | `listed=t method_backfilled=t provider=stripe status=requires_action` | PASS |
| T2 | **negative control** — no method at all ⇒ stays parked | `listed=f` | PASS |
| T3 | **negative control** — unverified, or verified-but-not-primary ⇒ neither unlocks | `unverified_listed=f nonprimary_listed=f` | PASS |
| T4 | release date in the future ⇒ never dispatches early | `listed=f` | PASS |
| T5 | **balance neutrality** — no cent moves | `available 0->0 pending 0->0` | PASS |
| T6 | **pass 1 regression** — a due `pending` payout is still released + dispatched | `available=2000 pending=0 released_count=1` | PASS |
| T7 | two consecutive runs ⇒ still exactly 1 payout row, no balance move | `rows=1 status=requires_action available=0` | PASS |
| T8 | Fix E trigger: parked → `failed`/`trade_deleted`; submitted + transferred rows untouched | `parked=failed processing=processing transferred=pending trade_id=NULL` | PASS |
| T9 | Fix E backfill: orphaned parked row terminalised; manual `processing` row untouched | `orphan=failed reason=trade_deleted manual=processing` | PASS |
| T10 | BP-79 grants re-asserted (no PUBLIC/anon/authenticated) | owner + `service_role` only | PASS |

### 10.5 Phase 2 — NOT done (requires fresh explicit approval)

Deliberately **not** performed in this session:

* **Applying the migration to staging** (`apply_migration`) and **deploying
  `initiate-payout`** (CLI `--use-api`, BP-41). Both are writes.
* ⚠️ **Applying Fix A makes the next hourly `release-due-payouts` run dispatch the 6 already-payable
  rows, minting 6 Stripe test-mode transfers (~$205).** That is the fix working, but it changes staging
  state and QA fixture counts, so it needs an explicit go-ahead — it was flagged as approval-gated in
  §5/§6 of this report and in the handoff.
* **Fix E's backfill** will also flip **5** orphaned rows to `failed`, moving `test-seller` from
  18 `requires_action` to 14 (+5 `failed`). The negative-control fixture still holds (14 rows remain),
  but the expected count changes and the guide/tracker rows that quote "18" must be updated.
* **Tier 2 "DB rebuild from migrations"** remains **BLOCKED by a pre-existing repo defect**
  (FIX-Task-35/40/57: legacy-numbered files sort before the base schema, so `supabase db reset` cannot
  pass). Per Blocked-Tier Discipline this needs an **owner decision** — scheduled as its own task, or
  explicitly accepted-degraded — and is not silently re-deferred a further time.
* The historical **`seller_payouts` ↔ `trades` status divergence** (88 vs 70; 4 vs 20) is **not**
  backfilled: a blanket `paid ⇒ completed` repair would mark never-paid rows as completed and hide real
  stranded money. Fixes A/B now keep the two tables in lockstep **going forward**.

---

## 11. Phase-2 verification — and a SECOND root cause found by refusing to assume

Applying Fix A and deploying Fix B was **not** sufficient, and the report would have been wrong to stop
there. The first real invocation of the production path returned:

```
HTTP 200  {"success":true,"released_count":0,"trade_ids":[],"dispatched":0,"failed":0}
```

`trade_ids: []` — the 6 known-payable payouts were **still not dispatched**. Per-trade predicate
evaluation (not guesswork) showed why:

### 11.1 Root cause #2: `trades.payout_amount_cents` is NULL — a third, independent stranding mechanism

All 6 trades carry `payout_amount_cents = NULL` while `cash_amount_cents` holds the real proceeds. That
single NULL excluded them from **every** payout path:

| Path | Why the NULL blocks it |
|---|---|
| pass 2 (the new self-heal) | predicate `COALESCE(t.payout_amount_cents, 0) > 0` |
| **pass 1 (the pre-existing sweep)** | **the same predicate** — so these rows were never reachable even before this task |
| `initiate-payout` | a deliberate DEV-TASK-48 guard refuses a NULL amount and re-parks the trade (`409 PAYOUT_AMOUNT_MISSING`, "needs admin review") |

So "no re-evaluation path exists" (root cause #1) and "the amount was never written onto the trade"
(root cause #2) are **both** required to strand these rows, and only #1 was visible from the code trace.
Neither FIX-Task-37 nor FIX-Task-56 had identified #2.

### 11.2 The repair (`20260918000011_fix_task_62_backfill_payout_amount_cents.sql`, applied)

Measured before applying, not assumed:

* **67 trades / $3,669.91** have a NULL amount with a non-terminal payout;
* **0** of the 67 have a disagreement between `seller_payouts.gross_amount_cents` and
  `trades.cash_amount_cents` — the two independent records agree exactly, so the value is corroborated
  rather than invented;
* the statement keeps the DT48 invariant (only `> 0` amounts) and touches only
  `requires_action`/`pending`/`processing` rows — never paid/failed history;
* it is guarded by `sp.gross_amount_cents = t.cash_amount_cents`, so any future disagreement leaves the
  row NULL for review instead of paying a guessed amount.

Evidence: `confirm the migration` → `provider` and `payout_method_id` were then backfilled on all 6 rows
by pass 2, proving the repair made them **visible** to the sweep.

### 11.3 What phase 2 demonstrated

| Check | Result |
|---|---|
| Migration applied (Fix A + Fix E) | ✅ `{"success":true}` |
| Trigger attached + enabled | ✅ `trg_terminalize_payouts_on_trade_delete`, `tgenabled = O` |
| Pass 2 present in the live body | ✅ `prosrc LIKE '%requeued_count%'` |
| Grants re-asserted (BP-79) | ✅ `postgres` + `service_role` only — no PUBLIC/anon/authenticated |
| Fix E backfill effect | ✅ parked **88 → 83**, failed **2 → 7**, orphans **5 → 0** (exactly as scoped) |
| `initiate-payout` deployed | ✅ CLI `--use-api` |
| Real invocation of the production path | ✅ HTTP 200, real response body captured |
| **Recovery of the 6 payable rows** | ✅ **6/6 paid at 19:39:03–19:39:11** — Fix A + Fix B + the repair work end-to-end (see §12 for the consequence) |

### 11.4 End-to-end result — the mechanism is proven

| Payout | Amount | Stripe transfer | Trade |
|---|---:|---|---|
| `7081dd89…` | $50.00 | `tr_1UH7cg4I6kCJlvXogjdMRXO6` | `paid` |
| `8f1ecc78…` | $50.00 | `tr_1UH7ci4I6kCJlvXoLrw18ikO` | `paid` |
| `dcc47df4…` | $50.00 | `tr_1UH7cj4I6kCJlvXoLKSYDc9i` | `paid` |
| `b26bc717…` | $10.00 | `tr_1UH7cl4I6kCJlvXoEA2BiXhp` | `paid` |
| `9e8067ea…` | $25.00 | `tr_1UH7cn4I6kCJlvXoq3k04Md5` | `paid` |
| `eacae472…` | $20.00 | `tr_1UH7co4I6kCJlvXoAVytvwxB` | `paid` |
| **Total** | **$205.00** | 6 transfers | all `paid` |

The new mirror-sync also fired correctly on every row (`seller_payouts.status='completed'`,
`provider_reference_id` = the transfer id, `completed_at` set) — the divergence fix works.
**Blast radius: exactly 1 seller / 6 rows / $20,500 in the last hour — no collateral payments.**

---

## 12. ⚠️ INCIDENT — the approved run double-paid $205.00 (test mode)

**This section is deliberately prominent. The fix works; its first live run also revealed that the
"stranded money" I quantified in §3 was, for this seller, already paid — and my phase-2 execution paid
it a second time.**

### 12.1 What happened

While enumerating the 6 rows' sibling records *after* the transfer attempt, a **7th payout for the same
seller** appeared:

| Row | Amount | Status | Transfer | Completed |
|---|---:|---|---|---|
| `082d46d6-c4e0-4e82-8169-1c61764f9ba3` | **$205.00** | `completed` | `tr_1UChi74I6kCJlvXoCmZ5YSdS` | **2026-09-06 15:10:23** |

Its amount is **exactly the sum of the 6 parked rows** ($50+$50+$50+$10+$25+$20), it is trade-less
(`trade_id IS NULL`, i.e. a manual/aggregate settlement), and the seller's `seller_balance` is
`available = 0 / pending = 0 / lifetime = 20500` — consistent with the whole $205 having already been
withdrawn. **The seller had already been paid for these 6 trades on 2026-09-06.**

### 12.2 Why neither the investigation nor the plan caught it

Every one of my exposure queries filtered on `status = 'requires_action'`. A compensating **aggregate
manual payout is invisible to that lens** — it is a `completed`, `trade_id IS NULL` row that no
"stranded payouts" query returns. The 6 rows therefore looked like $205 of recoverable money when they
were in fact **stale duplicates of an already-settled amount**. There is no code path or schema
invariant that marks them as superseded.

**Lesson (proposed agent rule, §13):** never quantify "money stranded in state X" without reading the
seller's *other* settlement rows for the same period. A compensating manual payout is a legitimate
operator action that appears in no state-filtered query, and paying on top of it double-pays.

### 12.3 State now

* 6 transfers minted, all **Stripe test-mode** — no real money moved, but the platform's records now
  show **$410 paid against $205 of completed trade value** for this seller.
* The 6 trades are `paid` and their payouts `completed`, so **pass 2 has no eligible rows left and the
  bleeding is self-limiting** — the hourly cron cannot re-pay them.
* The remaining 83 `requires_action` rows belong to sellers with **no** payable method, so they stay
  correctly parked (verified negative control).
* Rollback of *my* code does **not** un-mint a transfer; reversing the duplicate is a Stripe action.

### 12.4 Required owner decisions

| # | Decision | Options |
|---|---|---|
| D1 | Remediate the $205 duplicate | **(a)** reverse the 6 test-mode transfers via Stripe transfer reversal; **(b)** accept as a test-mode write-off and record the rows as superseded; **(c)** leave as-is |
| D2 | Durable guard against this class | Add a pass-2 precondition that a stranded payout is only dispatched when the seller's proceeds are **not already settled** (needs an agreed rule — e.g. net of completed trade-less settlements created after the trade completed), **or** keep pass 2 but require an explicit flag |
| D3 | How to record the 6 superseded rows | `failed` + `failure_reason='superseded_by_manual_payout'`, or leave `completed` and annotate |

**Until D2 is decided, Fix A's pass 2 is live.** It is currently harmless (0 eligible rows) and it will
correctly pay genuinely-unpaid stranded rows — but the double-payment class is not yet structurally
prevented.

---

## 13. Proposed agent rule (from this incident)

**Never quantify "money stranded in state X" without reading the seller's OTHER settlement rows.**
Any exposure figure derived from a single state filter (`status='requires_action'`) is an **upper
bound, not a liability**: an aggregate manual payout is a `completed`, trade-less row that no
state-filtered query returns, and it silently makes the stranded rows duplicates. Concretely: before
proposing or executing any action that *pays* stranded rows, run
`SELECT status, count(*), sum(gross_amount_cents) FROM seller_payouts WHERE user_id = <seller> GROUP BY status`
for every affected seller, and treat a completed trade-less payout ≈ the parked sum as a
**presumed duplicate until disproven**. This is the money side of §9.1g's "trace the readers" discipline
and of the Copy-Consistency Class Sweep — sweep the *whole* settlement record, not the state you happen
to be fixing.
---

## 14. Owner decisions taken (2026-09-18) and final verified state

| # | Decision | Outcome |
|---|---|---|
| D1 | The $205 duplicate | **Accepted as a test-mode write-off.** The 6 rows stay `completed` (materially accurate — they *were* paid) and are recorded as **superseded duplicates** here and in §12. No Stripe reversal. |
| D2 | Durable guard | **Fail-closed kill switch implemented** — `20260918000012_fix_task_62_gate_requeue_behind_flag.sql`, applied. |
| D3 | Session scope | **Stop here** after the gate; the dispatch rule is a separate task. |

### 14.1 The kill switch (D2)

`admin_config.payout_requeue_enabled` is seeded **`'0'`** (Mode B, `ON CONFLICT DO NOTHING`, so an
operator's choice is never clobbered). Pass 2 is wrapped in
`fn_admin_config_int('payout_requeue_enabled', 0) = 1` and emits a `NOTICE` naming how many rows are
left parked while it is off. Pass 1 is untouched, so with the switch off the function behaves exactly as
it did before this task for the pre-existing path.

**To enable once the dispatch rule is agreed** (BP-48 — shared RPC, never a raw table write):

```sql
SELECT * FROM public.upsert_admin_config_setting(
  p_key => 'payout_requeue_enabled', p_value => '1', p_category => 'feature_flags',
  p_data_type => 'number', p_is_secret => false, p_is_active => true,
  p_admin_id => '<admin user id>');
```

> ⚠️ **Never invoke `rpc_release_due_payouts` by hand to "test" it.** Pass 1 moves `seller_balance`
> pending → available **without** dispatching, so a manual call makes the next Edge-Function run credit
> those trades **twice**. Gate behaviour is proven in the local harness (`T11`/`T12`), not by hand.

### 14.2 Final verified state (staging, `drntwgporzabmxdqykrp`)

| Metric | Before | After |
|---|---:|---:|
| `requires_action` | 88 | **77** |
| `completed` | 4 | **10** (+6) |
| `failed` | 2 | **7** (+5 `trade_deleted`) |
| orphaned (`trade_id IS NULL` + parked) | 5 | **0** |
| **parked with a payable method** | **6** | **0** |
| `payout_requeue_enabled` | — | **`0`** (fail-closed) → **`1`** as of the follow-up session (§15) |

**Pass 2 has zero eligible rows, so the live sweep is inert.** The 77 remaining parked rows all
belong to sellers with no payout method — correct behaviour, and the standing negative control.
**Confirmed again after the switch was turned ON (§15.3): the flag is `1`, the sweep was invoked live, and the
status census came back byte-identical — nothing was paid.**

### 14.3 Status of the items above (re-verified 2026-09-18, follow-up session — see §15)

1. **RESOLVED.** The "proceeds already settled" precondition is defined AND enforced inside the sweep, and
   `payout_requeue_enabled` is now **`'1'` (LIVE)** — see §15.
2. **RESOLVED — but on a NEW and much narrower basis.** The historical defect (111 legacy-numbered files
   sorting before the base schema) is **GONE**: the chain now replays **544/544 in a single pass with zero
   deferrals** (§15.2). The real `supabase db reset` still fails, now at **file 5 of 544** on a pre-existing
   2025-12 migration that runs `CREATE POLICY … ON storage.objects` (`must be owner of table objects` — an
   EXECUTION-CONTEXT limit, not a content/ordering one). Option A therefore still stands, but this is the
   reason now — the old one was retired.
3. **RESOLVED.** All **eight** stale "18" references were corrected (QA tracker ×7, agent-memory registry
   ×1), and the current figures were re-verified live from staging (§15.3).
4. (unchanged — still out of scope, as declared in §5/§7.)

---

## 15. D2 — THE PRECONDITION, IMPLEMENTED AND LIVE (2026-09-18, follow-up session)

### 15.1 The rule (owner decision D2)

A seller is treated as **presumptively already settled** — and NONE of their parked payouts are requeued —
when a **completed, trade-less (manual) payout exists for that seller whose gross amount exactly equals the
total gross of that seller's currently-parked (`requires_action`) payouts**.

* Evaluated **inside** `rpc_release_due_payouts` (not a pre-flight query a human must remember to run), so no
  caller can requeue past it.
* Computed over each seller's **full** parked set, not the batch, so the decision cannot be re-ordered into a
  payment by a batch boundary.
* A skipped seller is **not silently dropped**: one idempotent `financial_audit_log` row per seller with the
  new mutation type **`payout_requeue_skipped`** (reason + parked count/total + the matched payout id, amount,
  completion date and **idempotency key**). Deterministic key ⇒ one row per seller regardless of how many
  hourly runs pass, so a permanently-blocked seller cannot flood the journal.
* **`amount_cents` is deliberately NULL** on that row: nothing moved, and the `/audit` page sums
  `amount_cents` — putting the parked total there would inflate a money total with funds that never left.
* Sellers are judged only when the sweep is ON. With the switch OFF pass 2 does nothing, so there is nothing
  to guard and nothing to flag.

### 15.2 The `db reset` leg — corrected

| | Claim | Status |
|---|---|---|
| Old | `db reset` blocked by 111 legacy-numbered files sorting before the base schema | **RETIRED — no longer true** |
| New | chain replays **544/544, `pass 1: applied 544, deferred 0`** (`replay-probe.mjs`) | ✅ VERIFIED |
| New | `supabase db reset` fails at file **5/544**, `20241214000005_create_user_avatars_bucket.sql` → `ERROR: must be owner of table objects (SQLSTATE 42501)` on `CREATE POLICY … ON storage.objects` | ✅ REPRODUCED |
| Attribution | With **this session's migration moved out**, `db reset` fails at the **identical** statement ⇒ **not caused by this change** | ✅ PROVEN |

Classified per BP-96 rule 9 as an **execution-context** limit, not content — and the `CREATE POLICY` on
`storage.objects` was **NOT** fail-softened to get a green light. Option A (accept the probe as the equivalent
Tier-2 evidence) is confirmed, on this narrower basis.

### 15.3 Evidence

**Local harness** — `e2e-test-results/fix-task-62-2026-09-18/local-harness/`, now **16 assertions**:

| Test | What it proves | Result |
|---|---|---|
| T13 | **D2 negative control** (the §12 incident shape: 3 parked × $50 = $150 + a completed trade-less $150 payout) ⇒ not requeued, flagged in `skipped_presumed_settled`, exactly 1 audit row, still 1 after a re-run, 3 rows left parked, balance 0→0 | ✅ PASS |
| T14 | **D2 positive control** (parked $80 vs an unrelated $25 manual payout) ⇒ **still requeued**, nothing flagged — the guard is not a blanket block | ✅ PASS |
| T15 | allow-list **widened, not narrowed**: new type accepted, the four live-only witness values intact, an invented type still **rejected** | ✅ PASS |

**Non-vacuity (§9.1h) — both new assertions were watched to FAIL with the protection removed:**

| Probe | Observed |
|---|---|
| D2 guard disabled (`AND TRUE`) | **T13 FAIL** — `dispatched=t`: the matching seller WOULD have been paid |
| allow-list left dropped | **T15 FAIL** — `rejects_unknown=f`: the CHECK is gone |
| with both probes | exactly **T13 + T15** fail; the other 14 still PASS (surgical, not a blanket break) |
| probes restored | **16/16 PASS** |

**Staging (live reads, `drntwgporzabmxdqykrp`):**

| Read | Value |
|---|---|
| `test-seller` census | `{requires_action: 14, failed: 5}` ⇒ total **19** |
| pass 2 eligible rows **before** the flip | **0** ⇒ flipping is inert |
| D2 would-skip sellers before the flip | **0** |
| pass 1 would-release rows before the flip | **0** ⇒ the live invocation moves no balance, mints no transfer |
| function body | D2 guard present; exclusion present; returns `skipped_count` |
| grants (BP-79) | `postgres=X/postgres \| service_role=X/postgres`; **anon/authenticated EXECUTE both FALSE** |
| constraint | allows `payout_requeue_skipped` **and** still carries the four live-only values |
| after flip + live invocation | flag `1`; `skip_flags 0`; payouts `{failed 7, pending 11, completed 10, processing 26, requires_action 77}` — **identical to before**; orphans 0 |

**Live invocation** (sanctioned path): `npm run qa:ef-repro -- --persona test-admin --ef release-due-payouts
--body '{"batch_size":100}'` → **HTTP 200** `{success:true, released_count:0, trade_ids:[], dispatched:0,
failed:0, failures:[]}` — the deployed dispatcher ran with the switch ON and the safeguard active, and paid
nothing. **No EF redeploy was needed** (the dispatcher only reads `trade_ids`/`released_count`; the new keys
are additive).

### 15.4 TWO LANDMINES FOUND WHILE DOING THIS (both worth carrying forward)

**(a) The live `financial_audit_log` constraint allows FOUR values no migration file lists** —
`payout_scheduled`, `trade_extension_reauth`, `extension_requested`, `dispute_evidence_staged`. This
migration's first attempt reconstructed the allow-list from `20260916000118`, which **narrowed** it and failed
`23514 … is violated by some row` against the 1 207 existing journal rows. It rolled back atomically
(constraint intact, function unreplaced, no residue). The migration now reads the **live** definition and
extends it in place, with a RAISE if the shape is unrecognised — narrowing is structurally impossible, and
T15 guards it. **Lesson: the file is not the object (BP-47/BP-96), and a narrowed allow-list is a silent
integrity regression waiting for the next writer.**

**(b) 🔴 THE OBVIOUS WIDENING OF D2 IS A TRAP — owner decision needed.** Asked to widen the rule to catch
*partial* manual settlements, the natural limbs are "any completed trade-less payout blocks the seller" or
"the seller's manual total ≥ the parked total". **Both would rebuild the exact bug FIX-Task-62 exists to
fix.** Live evidence: the row that double-paid in §12 (`082d46d6…`) carries
`idempotency_key = 'manual_withdrawal:d84bcc68-…:1783460036'` — it was **a normal manual withdrawal produced
by the app's own withdraw flow**, and every other completed trade-less row on staging has the same
`manual_withdrawal:<seller>:<ts>` shape. So "any manual payout" means **"any seller who ever successfully
withdrew their money"**, which would make the self-heal sweep permanently refuse exactly the sellers whose
money most recently moved — stranding their future parked payouts behind a manual review that, on the
evidence of §1, may never happen.

* Currently the blast radius is **zero** (`parked_sellers_with_any_manual = 0`), so the exact-match rule ships
  with no false positives at all today. The landmine is latent, not active.
* **Recommended instead:** keep the proven exact-match rule, and — if partial settlements must be caught —
  make the discriminator *amount-correspondence against a subset of the parked rows*, not the mere existence
  of a manual payout. That needs its own scoped task plus a decision on who reviews the flag.
* **Do NOT** enable an existence-based limb without re-reading this section.

### 15.5 Still owed (this round)

1. **The D2 widening** — blocked on the above; owner decision required (§15.4b).
2. **End-to-end proof of the SKIP path on staging** — not driven: staging currently has nothing to skip
   (`d2_would_skip = 0`), and building a fixture would create parked payout rows plus a fake manual payout.
   The detection + flag logic is proven locally (T13), and the flag's insert path is proven structurally
   (the constraint lists the type, and local T15 inserts it successfully). An owed leg, named.
3. Historical `seller_payouts` ↔ `trades` divergence, `processing`/`pending` stale-row reconciliation, and the
   48h/max-3 reminder feature remain out of scope (as declared in §5/§7).
4. Historical `seller_payouts` ↔ `trades` status divergence, `processing`/`pending` stale-row
   reconciliation, and the 48h/max-3 reminder feature remain out of scope (as declared in §5/§7).