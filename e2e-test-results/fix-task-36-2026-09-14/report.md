# FIX-Task-36 — Auto-Complete Cron Bypassed Stripe Capture (P1)

**Date:** 2026-09-14
**Environment:** Stripe **TEST** mode + Supabase `drntwgporzabmxdqykrp`. No production/real-money impact.
**Source:** finding F1 in `e2e-test-results/qa-trd-closing-post-fix35-2026-09-14/report.md` §3.
**Migration applied:** `20260914000003_fix_task_36_auto_complete_capture_guard_and_cron_ef.sql`

---

## Deliverable summary

| # | Item | Result |
|---|---|---|
| 1 | Fix the cron command (via migration, not a manual edit) | ✅ **APPLIED + VERIFIED LIVE** — jobid 42 → **65**, now `SELECT public.rpc_fire_edge_function('/process-auto-complete');` |
| 2 | Reconcile the 3 affected trades (capture-or-reverse + settle tax) | ✅ **CAPTURED 3/3 — $53.87 collected.** 0 needed reversal. Tax settled out of `quoted` where a record exists |
| 3 | Make `rpc_process_auto_complete` refuse to complete an uncaptured trade | ✅ **APPLIED + PROVEN** — refusal test **and** success-path test, both live |
| 4 | Cron-health check in the QA sweep family + standing rule | ✅ **ADDED + demonstrated catching the original bug**; rule **R110 §5.86** added to the QA playbook |
| — | Confirm whether production has the same issue | ✅ **ANSWERED** — no separate production project exists (see §5) |

---

## 1 — The cron fix

### Pre-fix state (captured live, before the migration)
```
jobid 42 | process-auto-complete | */15 * * * * | active=true
         | SELECT public.rpc_process_auto_complete(100);
```
Two independent proofs that the **cron**, not the Edge Function, was the writer (R12/§5.37):

1. **`financial_audit_log` holds no `payment_captured` row** for any of the 3 trades — the EF writes one per capture (`idempotency_key = capture_<tradeId>`). All three carry only their 2026-09-11 creation rows (`offer_created`, `tax_quoted`, `buyer_fee_charged`, `payment_intent_created`).
2. **The job's own command text** (above) — a clock-only status flip with no payment step.

`payments.derived_state` read `succeeded` with a stamped `captured_at` purely because it is a trigger **mirror** of `trades.status` (`fn_payments_sync_from_trade`, **R100**) — the DB cannot observe Stripe.

### Post-fix state (verified live)
```
jobid 65 | process-auto-complete | */15 * * * * | active=true
         | SELECT public.rpc_fire_edge_function('/process-auto-complete');
```
- Addressed **by `jobname`, never by jobid** — the re-schedule minted a **new jobid (65)**, which is exactly why hardcoding `42` would have been wrong.
- **The job has already fired on its own and succeeded:** `cron.job_run_details` → `last_status = succeeded`, `return_message = 1 row`.
- **End-to-end path proven** (this also closes the DT-39 "is the stored service key real?" risk): invoking the cron's exact payload returned `net._http_response.status_code = 200` with the Edge Function's own body —
  `{"success":true,"request_id":"…","eligible_count":0,"capture_results":[],"captured_count":0,"failed_count":0}`.
  It is **not** a 401. `admin_config.supabase_service_role_key` decodes to `jwt_role = service_role` (the anon-JWT finding from DT-39 is **fixed**; the row was updated 2026-08-29).
- Rollback plan is in the migration header (re-apply FIX-Task-35 BLOCK 1 + re-schedule the old command; only correct alongside disabling the job, since it re-opens the leak).

---

## 2 — The 3 affected trades

All three were completed in **one batch at `2026-09-14 21:45:00.484911`** (a 15-minute tick). Per the standing policy they were **captured**, not reversed — all three PIs were still `requires_capture` at **age 3.8 days**, inside Stripe's ~7-day capture window. Applied with `npm run qa:capture-uncollected-pis -- --days 400 --yes`.

| Trade | Cash | PI | Stripe result | Tax before → after |
|---|---|---|---|---|
| `57d50a84-0aa8-4a5c-b13e-158f2374c579` | $16.00 | `pi_3UEJrf4I6kCJlvXo1uJzeWwr` | ✅ `succeeded`, `amount_received=1600`, charge `ch_3UEJrf4I6kCJlvXo1djYtyy0` | *(no tax record — `noop`)* |
| `2bb49d39-bb67-44f9-bca2-ee43b8a22b74` | $20.00 | `pi_3UEJrf4I6kCJlvXo1btD4tPR` | ✅ `succeeded`, `amount_received=2140`, charge `ch_3UEJrf4I6kCJlvXo1VU0nvL6` | `quoted` → **`collected`** ($1.40) |
| `cdb2a42d-b653-4c2b-82c4-a772c04727a7` | $14.00 | `pi_3UEJrg4I6kCJlvXo00lxdTdO` | ✅ `succeeded`, `amount_received=1647`, charge `ch_3UEJrg4I6kCJlvXo0ibqtkkQ` | `quoted` → **`collected`** ($0.98) |

**Captured 3/3 — $53.87 collected.** `NEEDS REVERSAL: 0`, so the reversal half of the policy was not required.
Note the amounts: `cash_amount_cents` is the *item* cash ($16.00 / $20.00 / $14.00) while the PI amount includes buyer fee + tax ($16.00 / $21.40 / $16.47). Don't conflate the two when reconciling.

### Payout exposure — checked, and clean
The `fn_queue_payout_on_complete` trigger fires `initiate-payout` on completion, so "did money reach a seller?" had to be answered before treating this as uncollected-buyer-money only. **All four affected `seller_payouts` rows were `requires_action` with `provider`, `provider_reference_id`, `initiated_at` and `completed_at` ALL NULL** — no payout was ever sent. Exposure was uncollected buyer money exclusively.

### Audit trail — gap closed (approved further-consideration 2B)
`qa:capture-uncollected-pis` now writes the same `financial_audit_log` rows the Edge Function writes (`payment_captured` → `capture_<tradeId>`, `tax_collected` → `tax_collected_<tradeId>`), with `after_state.source = 'qa_capture_remediation'` so a remediation is never mistaken for a normal auto-complete. Verified live:

| Trade | `payment_captured` | `tax_collected` |
|---|---|---|
| `57d50a84` | ✅ (1600) | — *(correctly omitted: no tax record)* |
| `2bb49d39` | ✅ (2000) | ✅ |
| `cdb2a42d` | ✅ (1400) | ✅ |

`tax_collected` is written **only when the tax ledger actually moved** (`data.data.new_status === 'collected'`) — stricter than the EF, which logs it unconditionally. One spurious row (written for `57d50a84`, which has no tax record) was written by the first pass and **deleted**.

---

## 3 — Database-level capture guard

New invariant in `rpc_process_auto_complete`: a caller that supplies **no `p_trade_ids`** may not complete any trade carrying money (`cash_amount_cents > 0` **or** a `stripe_payment_intent_id`). Refusals are counted and `WARNING`-logged so a bare caller fails **loudly** — the return value lands in `cron.job_run_details.return_message`.

**Why not `REVOKE service_role EXECUTE`** (the brief's alternative): the `process-auto-complete` Edge Function calls this RPC **as `service_role` too** — the same credential the cron uses. There is no database-observable difference between the two callers, so revoking would break the EF without isolating it. The only sound discriminator is the **argument**: the EF always passes the id set it just captured; a bare caller passes only a batch size. (Same reasoning as FIX-Task-35's `p_capture_confirmed` attestation — the DB cannot see Stripe, so the capture leg must attest and the RPC refuses anyone who hasn't.)

**No signature change** → `CREATE OR REPLACE` only, **no DROP** (no missing-function window, no ambiguous overload per BP-12) and **no Edge Function redeploy** — the EF's existing named-arg call `{ p_batch_size, p_trade_ids }` is already compatible.

### Verified live — both legs

| Leg | Action | Result |
|---|---|---|
| **Refusal** | fixture `cb6d6850` (cash $24.00, no PI), fast-clocked past `auto_complete_at`, then `SELECT public.rpc_process_auto_complete(100);` | ✅ `{success:true, auto_completed_count:**0**, refused_count:**1**}` — trade left `in_progress`, `auto_completed_at` NULL, item still `available` |
| **Success** | `SELECT public.rpc_process_auto_complete(100, ARRAY['cb6d6850-…']::uuid[]);` | ✅ `{success:true, auto_completed_count:**1**, refused_count:0}` — trade `completed`, item `sold`, `payout_amount_cents=2400`, 1 `seller_payouts` row |

Fixture created via `npm run qa:r41-in-progress-trade -- create --with-auto-complete` and removed with `-- reset` (reported `1/1 tagged trade(s) removed`; 4 `user_notifications` cleared). The fixture deliberately has `cash > 0` and no PI, so it exercises exactly the guarded shape.

---

## 4 — Cron-health sweep + standing rule

### New tooling
- `p2p-kids-marketplace/scripts/qa/lib/cron-health-rules.mjs` — a **pure** classifier (no I/O) so the live sweep and the self-test share ONE implementation.
- `p2p-kids-marketplace/scripts/qa/cron-health.mjs` — `--self-test`, `--json`, `--strict`, `--command "<sql>"`, `--include-inactive`. Exit `0` clean / `1` violation / `2` setup.
- npm script `qa:cron-health` added.
- Reads `cron.job` through the **already-existing** `public.get_cron_jobs_with_last_run()` (SECURITY DEFINER, returns `command`, granted to `service_role`) — the `cron` schema is not exposed to PostgREST, so **no new RPC was needed**.

Verdicts: **FAIL** when a routine that structurally needs its Edge Function (a provider step, an audit/ledger write) is invoked bare; **WARN** when the EF is currently a pure pass-through (equivalent today, silently diverges later — `--strict` escalates); **PASS** when the job reaches an EF (`rpc_fire_edge_function(...)`, `net.http_post(...)`, `invoke_*_cron(...)`, `rpc_fire_process_extension_timeouts(...)`) or an explicitly allowlisted non-money routine.

### Demonstrated against the pre-fix state
Run **before** the migration, against the live broken DB:
```
❌ #42  process-auto-complete   FAIL  rpc_process_auto_complete() reached BARE — Stripe PaymentIntent
                                        capture + payment_captured / tax_collected audit exist ONLY in
                                        the process-auto-complete Edge Function (FIX-Task-36)
  PASS 19 · WARN 1 · FAIL 1          → exit 1
```
`--self-test` additionally pins the **verbatim pre-fix command** as fixture #1 (13 fixtures, all passing), so the rule can never silently stop catching this bug.

### Post-fix run
```
✅ #65  process-auto-complete   PASS  invokes an Edge Function via rpc_fire_edge_function(...)
  PASS 20 · WARN 1 · FAIL 0          → exit 0   "✅ cron health OK"
```

### The WARN is a real second instance of the class (left in place, out of scope)
`jobid 49 release-pending-sp` runs `SELECT public.rpc_release_pending_sp(200);` bare. Reading its Edge Function first (`supabase/functions/release-pending-sp/index.ts`) shows it is a **pure pass-through** — it just forwards to the RPC — so the bare call is behaviourally **equivalent today**, with **no money at risk**. It is flagged WARN rather than FAIL for exactly that reason, and it is the same latent shape that bit auto-complete: the day the EF grows a side effect, the cron silently misses it. **Recommendation:** re-point it to `rpc_fire_edge_function('/release-pending-sp')` in a follow-up (a one-liner). The same applies to the legacy inline `net.http_post` shape still used by jobid 48 (`process-expired-offers`) and jobid 56 (`release-due-payouts`) — those DO reach their EFs today, so they pass, but they violate BP-22 hygiene.

### Standing rule
Added **§5.86 / R110 — "name the cron/caller, not just the function"** to `.github/instructions/QA-Test-Agent.instructions.md`: no money-path finding closes until the scheduled caller is checked. R14 (drive the EF) is the **tester's** leg, R100 (name the writer) is the **reader's** leg — neither obliged anyone to ask what the **timer** invokes, which is how this defect survived two application-code fixes.

Also annotated `archive/misc./MODULE-15.1.2-TFV2-DB-FIX-BLOCKS.sql` as **⛔ DEPRECATED — DO NOT RUN**: its BLOCK 2 is the only artifact in the repo carrying `cron.schedule('process-auto-complete','*/15 * * * *', $$SELECT public.rpc_process_auto_complete(100);$$)` and is the identified source of the drift. Re-running it would recreate the bug.

---

## 5 — Production determination (item 1's second half)

**There is no separate production Supabase project.** A repo-wide sweep for project refs returns exactly one: `drntwgporzabmxdqykrp` — the project this migration was applied to (labelled "staging" in the instructions; a few legacy docs call the same ref "prod, dev data only"). `supabase/config.toml` names no project, and no CI workflow applies migrations (`db push`/`reset` appear in none of them). `Prompts/MODULE-16-DEPLOYMENT.md` plans a *separate* production project but names no ref.

**So:** the fix **is** live for everything that exists today, and there is no second environment to patch. Two things to carry forward rather than treat as closed:
1. When the MODULE-16 production project is created, the migration set must be applied there — **cron definitions are not declarative**, nothing propagates them automatically, and `pg_cron`/`pg_net` plus `admin_config.supabase_service_role_key` must be provisioned there too.
2. The archived `DB-FIX-BLOCKS.sql` landmine must not be re-run in that environment.

---

## Verification matrix

| Check | Result |
|---|---|
| `qa:cron-health` live (pre-fix) | ❌ FAIL on jobid 42 — **exit 1** *(the required "catches the original bug" proof)* |
| `qa:cron-health --self-test` | ✅ 13/13 fixtures (incl. the verbatim pre-fix command) |
| `qa:cron-health` live (post-fix) | ✅ 20 PASS / 1 WARN / 0 FAIL — **exit 0** |
| Guard **refusal** test (live fixture) | ✅ `auto_completed_count: 0`, `refused_count: 1`, trade untouched |
| Guard **success** test (live fixture) | ✅ `auto_completed_count: 1`, item `sold`, payout row created |
| Cron command live | ✅ `SELECT public.rpc_fire_edge_function('/process-auto-complete');` |
| Cron's own run history | ✅ `last_status = succeeded` |
| Cron path end-to-end | ✅ `net._http_response` **HTTP 200** + EF's own JSON body |
| `qa:uncaptured-pi-sweep` (provider-first) | ✅ `UNCOLLECTED_MONEY 0` / $0.00 (was 3 / $53.87); `STRANDED_HOLD 0`, `STALE_AUTH 0`, `ORPHAN_PI 0` |
| `qa:stranded-holds` | ✅ no live stranded holds (493 trades probed) |
| `qa:fix32-verify` | ✅ **5/5 PASS — I2 now PASSES** (it was FAILing on `cdb2a42d` + `2bb49d39`, the two I2 rows, confirming the QA report's diagnosis that I2 was a *symptom* of this root cause) |
| Payout exposure | ✅ no payout initiated on any affected trade |
| Fixture cleanup | ✅ `1/1 tagged trade(s) removed` |

---

## Tier 2 — smoke suite + DB rebuild (honest status)

Classification for this change is **A (DB/RPC) + F (money/state machine)**, which mandates Tier 2. Status per leg:

| Tier-2 leg | Status | Evidence / blocker |
|---|---|---|
| Real invocation of **every changed branch** in the live DB (the "Postgres compiles lazily" rule) | ✅ **PASS** | refusal branch *and* success branch both invoked live; cron path invoked → HTTP 200; `rpc_process_auto_complete` grants re-read live (`anon=false`, `authenticated=false`, `service_role=true` — the intended set) |
| `scripts/smoke` → **`transactions`** (FLOW-08) | ✅ **PASS** (exit 0) | needs env assembled from `p2p-kids-marketplace/.env.staging` + `~/.dt11-stripe-key`; the runner has no root `.env` |
| `scripts/smoke` → **`tax-flow`** (FLOW-21) | ⚠️ **2 pre-existing FAILs — NOT caused by this change** | both are a **grant** mismatch: the smoke runs as **anon**, and `get_tax_summary_for_period` denies anon (`anon_can_execute = false`; authenticated + service_role = true, read live). This function is untouched by FIX-Task-36. **Needs separate triage.** |
| `scripts/smoke` → **`payouts`** (FLOW-11/payouts) | ⛔ **BLOCKED — env** | requires `PAYPAL_CLIENT_ID`, which does not exist in this environment (fails fast with an explicit message, not a false positive) |
| `scripts/smoke` → `referrals`, `dispute-evidence` | ⏭ **not run** | unrelated flows (not impacted by this change) |
| **`supabase db reset`** (DB rebuild from migrations) | ⛔ **DEFERRED — pre-existing structural blocker** | documented in FIX-Task-35: `supabase/migrations/` holds 111 legacy-numbered files that sort before the base schema, so a fresh replay dies at `007_add_member_count_to_nodes.sql` (`42P01 relation "public.nodes" does not exist`). Unrelated to this change and unchanged by it; repairing the chain is its own task. |
| DB lint | ⏭ not run | bundled with the local-stack path above |

**Net:** every branch this change touches was invoked and read back **live**; the flow smoke for the trade state machine passes; the one smoke failure set is a pre-existing grant mismatch on an untouched function; the DB-rebuild leg remains blocked by a known, separately-owned migration-chain defect. Tier 2 is therefore **PARTIAL**, not PASS.

## Post-fix soak — 40.5 hours of unattended operation (verified 2026-09-16)

Re-verified two days after the fix, which is stronger evidence than the same-session checks:

| Check | Result |
|---|---|
| `process-auto-complete` cron run history | ✅ **162 runs, ALL `succeeded`**, `2026-09-14 22:30` → `2026-09-16 14:45` — no failures, no 401s, no clock misfires |
| Trades auto-completed since the fix | ✅ **0** — nothing else moved through the path |
| `qa:cron-health` | ✅ 20 PASS / 1 WARN / 0 FAIL (exit 0) |
| `qa:uncaptured-pi-sweep` (provider-first) | ✅ `UNCOLLECTED_MONEY 0`; `STRANDED_HOLD 0`; `STALE_AUTH 0`; `ORPHAN_PI 0` |
| `qa:fix32-verify` | ✅ 5/5 PASS |
| The 3 reconciled trades' payouts | ✅ none dispatched (all `requires_action`, `initiated_at` NULL — seller not payout-ready); the 3 become payout-eligible `2026-09-16 21:45`, legitimately captured |

## Known gaps / not done yet

- **The `release-pending-sp` WARN (jobid 49) is deliberately left in place** — its EF is a pass-through, so there is no live risk; re-pointing is a recommended follow-up, not a fix required for this task.
- **BP-22 hygiene on jobid 48 / 56** (legacy inline `net.http_post` shapes) — out of scope, they pass the sweep.
- **Android** — not exercised; this is a DB/cron change with no mobile surface.
- **`qa:cron-health` is not yet wired into `run-suite.sh` / the CI Tier-2 gate** — it is a standalone sweep today.
- **New, unrelated observation — `tax-flow` smoke fails on a grant mismatch.** `get_tax_summary_for_period` denies `anon` (verified live: `anon=false`, `authenticated=true`, `service_role=true`), but `scripts/smoke/tax-flow.mjs` calls it with the **anon** key, so 2 of its assertions fail. Nothing in this task touched that function. Either the smoke should use an `authenticated` session or the grant is wrong — **needs its own triage decision**, and until then `--all` cannot exit 0.
- **The migration chain is still structurally un-repairable** (`supabase db reset` cannot pass — the FIX-Task-35 finding about 111 legacy-numbered migration files replaying before the base schema). Unrelated to this task and unchanged by it.
- ~~DB-clock anomaly~~ — **RULED OUT / RETRACTED (2026-09-16)**: there is no clock skew; the earlier readings were ~40 h apart in real time because the session was suspended mid-turn. See the retraction section below.

## ✅ RETRACTED (2026-09-16) — the "DB clock jumped 40 h" observation was a FALSE POSITIVE

The observation below was raised during the fix session and is now **withdrawn**. All four independent clocks agree to the second, so **the database clock was never skewed**:

| Clock source | Time |
|---|---|
| Local machine (`date -u`) | `2026-09-16 14:52:32` |
| Google (independent internet reference, `Date` header) | `Wed, 16 Sep 2026 14:52:32 GMT` |
| Stripe (`Date` header) | `Wed, 16 Sep 2026 14:52:32 GMT` |
| **Database (`now()`)** | **`2026-09-16 14:52:32.144776+00`** |

**What actually happened — the session was suspended and resumed mid-turn.** The two "contradictory" readings were ~40 hours apart in **real** time, not 14 minutes:

- The migration file was written at `Sep 14 18:17` local (**22:17 UTC**) — matching the DB's first reading exactly.
- The report file was written at `Sep 16 10:34` local (**14:34 UTC**) — matching the DB's second reading.
- My assumption that the intervening tool calls were minutes apart was simply wrong; the turn spanned **~1.7 days** of wall clock.

**Independent corroboration that ~40.5 h had genuinely elapsed:** `cron.job_run_details` records **162 runs** of `process-auto-complete`, all `succeeded`, from `2026-09-14 22:30` to `2026-09-16 14:45`. 162 ticks × 15 min = **40.5 hours** — an exact match for the elapsed wall clock, and impossible if the clock had jumped. `pg_postmaster_start_time()` is `2026-09-13 14:27` — the server has not restarted, so no clock step occurred.

**The "80 payouts due" figure was not a symptom of anything.** `release-due-payouts` has run hourly throughout and correctly has **not** paid any of them: the 4 sampled rows remain `requires_action` with `provider`/`initiated_at` NULL (seller not payout-ready). No gate misfired.

**Lesson worth keeping (the only durable output of this observation):** a multi-hour gap between two clock readings taken in one assistant turn is far more likely to be a **suspended session** than a **clock jump** — check the wall clock against an independent source (an HTTP `Date` header is free and needs no credentials) and against **file mtimes** before filing an environment defect. Note also that a "future" `cron.job_run_details.start_time` relative to your last reading is the same artifact, not a bug in the sweep.

---

## (Superseded — kept for the record) the original observation as filed

At `2026-09-14 22:17` UTC the server's `now()` agreed with Stripe and with the local clock (the fixture's `now() + 72 h` landed on `2026-09-17 22:17`). Roughly 14 minutes later, `SELECT now()` returned **`2026-09-16 14:31:42`** — while Stripe and the local machine still say 2026-09-14. `cron.job_run_details.start_time` and `net._http_response.created` both report timestamps in that jumped-forward frame (they are consistent with each other).

**Consequence as originally reasoned (now moot):** every **time-based gate fires early** — auto-complete eligibility, offer expiry, payout release, SP release. Measured at the time of writing: `auto_complete_eligible_now = 0` (no live exposure) but `payouts_release_due_now = 80` (historical `requires_action` payout rows whose release date has passed). **Both readings were correct for their own moment in real time; nothing fired early.**

**⚠️ WITHDRAWN — this conclusion was WRONG; there was no anomaly.** The paragraph below is preserved verbatim only as the record of what was filed. **Not caused by this change** — and not an environment problem either. It does not invalidate any result above: the Stripe-side facts, the cron command, the guard tests and the sweep are all clock-independent, and the guard test's "fast-clock" step used the same clock for both the write and the read.

## App state left behind

- The 3 trades are `completed` **and fully captured** ($53.87 collected) with `tax_records` settled where a record exists.
- **1 disposable fixture trade removed**; no orphans reported by the reset tool.
- **Cron:** `process-auto-complete` now on **jobid 65**, active, `*/15`, pointing at the Edge Function; `release-pending-sp` left as-is (WARN); no other job changed.
- **No Edge Function was deployed or modified**; no `config.toml` change.
- **One audit row deleted** (the spurious `tax_collected` for `57d50a84`, written by the first capture pass; that trade has no tax record).
- Files added/changed: the migration, `scripts/qa/cron-health.mjs`, `scripts/qa/lib/cron-health-rules.mjs`, `p2p-kids-marketplace/package.json` (npm script), `scripts/qa/capture-uncollected-pis.mjs` (audit rows), `.github/instructions/QA-Test-Agent.instructions.md` (R110), `archive/misc./MODULE-15.1.2-TFV2-DB-FIX-BLOCKS.sql` (DEPRECATED header).
