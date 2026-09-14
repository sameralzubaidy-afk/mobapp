# FIX-Task-34 — Stranded PI Cancel + F6 Renewal Card Risk + FIX-Task-32 Tier-2 Closeout + BP-87 + Key Wiring

**Date:** 2026-09-14
**Environment:** Stripe TEST mode + staging Supabase (`drntwgporzabmxdqykrp`). No production/real-money impact.
**Source:** FIX-Task-33's Stripe read-only audit (2026-09-14).
**Evidence:** `evidence/` in this folder.

---

## Deliverable summary

| # | Item | Result |
|---|---|---|
| 1 | Cancel the stranded PaymentIntent | ✅ **DONE** — PI `pi_3UFO9f4I6kCJlvXo0iCaV1UR` now `canceled`, `amount_capturable: 0` |
| 2 | Investigate F6 (saved-card drift on renewal) | ✅ **REAL, not cosmetic** — Stripe would charge the wrong card |
| 3 | Fix F6 | ✅ **DONE** — shared sync helper wired into the 2 drift writers |
| 4 | FIX-Task-32's remaining Tier-2 gate | ⚠️ **PARTIAL** — see [Tier results](#tier-results); `db reset` leg blocked (Docker) |
| 5 | Commit + push | ✅ done — see [Commit](#commit) |
| 6 | BP-87: `trade-refund` rejects the `.env` service key | ✅ **DONE + DEPLOYED + CONFIRMED LIVE** |
| 7 | Wire the restricted Stripe key | ⚠️ **wired, but NOT `RESTRICTED_READ_ONLY`** — see [Key](#key-wiring-result) |

**Two extra defects were found and fixed** while answering item 1 (a QA harness that strands buyer holds, and the playbook recipe that skips a Stripe capture). Details in [Extra findings](#extra-findings-the-strand-holds-review).

---

## 1. Stranded PaymentIntent — CANCELLED

Trade `67ba29fc-cf01-4713-8e8b-21e3fc460701`, PI `pi_3UFO9f4I6kCJlvXo0iCaV1UR` ($17.89).

Implemented as a Stripe `paymentIntents.cancel` (owner-approved). The cancel succeeding is itself proof the hold was **still live** (not merely stale bookkeeping).

| | before | after |
|---|---|---|
| `status` | `requires_capture` | **`canceled`** |
| `amount_capturable` | **1789** | **0** |
| `amount_received` | 0 | 0 |

- `evidence/stripe-by-trade-before.json` / `stripe-by-trade-after.json` (from `qa:stripe-inspect -- by-trade`)
- `evidence/pi-cancel-response.json` (raw Stripe response, HTTP 200)

**Note on the refund object:** the cancel created Stripe refund `re_3UFO9f4I6kCJlvXo0C3FDpQS` (1789, `succeeded`) and `qa:stripe-inspect` now reports `refund_count → DISAGREE` (Stripe 1, `trade_refunds` 0). This is **by design** — Stripe books an authorization-cancel as a refund; the app deliberately books nothing. Codified as §5.37 rule 7 (FIX-Task-33 F3, same shape as `50849c0b` / `0e33f356`).

### Does this close R03's "holds restored" clause?

**Not by itself — and this is the important nuance.** Releasing item 1's hold was necessary but not sufficient. A new sweep (`qa:stranded-holds`) found **25 further live holds, $646.68**, all `cancelled` / `buyer_cancelled`.

- Writer identified: `p2p-kids-marketplace/scripts/qa/reset-offer-fixtures.mjs` cancels by **raw status UPDATE** and never calls Stripe. It voids the tax but leaves the buyer's card authorized. **This is QA tooling, not a product defect** — the product `cancel-trade` path does cancel the PI (verified in source).
- With the owner's approval those 25 holds were released: `evidence/release-stranded-holds.log` → **released 25/25**.
- Post-release sweep (`evidence/stranded-holds-after.json`, 641 trades probed): **LIVE STRANDED = 0, STALE = 0.**

➡️ **R03's "holds restored" clause is now cleanly closeable**, provided the harness fix ships (it does — item in [Extra findings](#extra-findings-the-strand-holds-review)) so a later QA run does not re-create the residue.

---

## 2 & 3. F6 — saved-card drift on renewal: **REAL**, and fixed

### The investigation

The question was whether the renewal path charges via **Stripe's customer default** (real risk) or explicitly passes the DB's card (cosmetic).

**Answer: real.** A recurring renewal is charged by **Stripe**, not by an Edge Function, so no app code is in the loop to pass a card. Stripe resolves:

1. `subscription.default_payment_method`
2. `customer.invoice_settings.default_payment_method`
3. `customer.default_source`

Live state for `test-buyer` (`cus_Ungj4MptKp9CUg`, `sub_1To5Vg4I6kCJlvXoebIAvLZJ`, `active`, renews **2026-09-27**):

| Source | Card |
|---|---|
| `subscriptions.stripe_payment_method_id` (DB — what the app shows) | `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` — **mastercard •••• 4444**, exp 9/2027 |
| `subscription.default_payment_method` | **`null`** → falls through |
| `customer.invoice_settings.default_payment_method` | `pm_1UFNpm4I6kCJlvXop2yMXsky` — **visa •••• 4242**, exp 12/2034 |

**Both cards are valid and unexpired**, so this is not a failed-renewal risk — it is a **wrong-card charge**: the user replaced their card, the app's DB recorded the new one, and Stripe would still charge the old one.

The renewal leg of `renew-subscription` (the grace-period path) *does* pass the PM explicitly at both levels, so it was never the problem. The gap is the **scheduled** renewal, which nothing app-side intercepts.

### Root cause — two writers that move the DB without telling Stripe

| Writer | What it did | Why it drifts |
|---|---|---|
| `get-payment-method` | Re-points `subscriptions.stripe_payment_method_id` via its deterministic-selection fallback | Wrote **nothing** to Stripe |
| `attach-payment-method` | Set the **customer** default only | Never wrote the **subscription** default (the level Stripe reads first), and the customer call was `console.warn(... 'continuing')` — a silent failure |

### The fix

- **NEW `supabase/functions/_shared/subscription-payment-method.ts`** — `syncStripeDefaultPaymentMethod()` writes the same card to **both** Stripe levels (subscription first — that is the one renewals consult — then customer). Best-effort: failures are logged and returned, never thrown, so replacing a card cannot fail because a sync call did. Structurally typed, because the Stripe-calling EFs are pinned to both SDK v12 and v14.
- **`get-payment-method/index.ts`** — now syncs Stripe after persisting the DB choice.
- **`attach-payment-method/index.ts`** — replaced the customer-only, failure-swallowing update with the shared helper.
- **NEW `_shared/subscription-payment-method.test.ts`** — 5 tests (both levels written; no-op without a PM; customer-only; subscription-only; a Stripe failure is reported, never thrown, and never skips the other level).

### ⚠️ Follow-up owed (not done — needs approval)

The **live** subscription is still drifted: `sub_1To5Vg4I6kCJlvXoebIAvLZJ` has `default_payment_method: null` and the customer default names the older visa, while the DB says mastercard 4444. **The fix is forward-looking only** — it stops new drift, it does not repair this row. Until that one-off sync is applied, `test-buyer`'s 2026-09-27 renewal still resolves the older card. This is a single Stripe write and is **not** included in the owner's approval for this session.

---

## 4. BP-87 — `trade-refund` rejecting the `.env` service key: FIXED

### Triage (this is what makes the fix targeted rather than guessed)

| Probe | Result |
|---|---|
| The `.env` service key against PostgREST (`/rest/v1/admin_config`) | **HTTP 200** — the key is *valid for the project* |
| The same key against `trade-refund` | **HTTP 401 UNAUTHORIZED** |
| `release-payment`, `initiate-payout` (never compare the key) | **accepted** (400 `MISSING_TRADE_ID` = past auth) |
| `admin-trade-action`, `complete-trade`, `transactions-update` | **401** — same pattern as `trade-refund` |

So the key is not stale: the deployed functions compare the presented bearer to their own injected `SUPABASE_SERVICE_ROLE_KEY`, which is a **different string**. Rejecting the drift is exactly BP-87's class.

### The fix — verify, don't compare

- **NEW `supabase/functions/_shared/service-credential.ts`** — instead of string-comparing, it asks the **project** whether the credential is service-role (`/auth/v1/admin/users`, which succeeds only for a real service key). Drift-proof, unspoofable, **fail-closed** on every error path, with a local pre-filter so an ordinary user JWT costs zero network calls.
- **`trade-refund/index.ts`** — keeps the env comparison as a cheap first check, then verifies the credential rather than dropping the caller.
- **NEW `_shared/service-credential.test.ts`** — 7 tests, including the exact regression (a valid service credential that is *not* our env key must be accepted) and all three fail-closed paths.

### ⚠️ Same drift remains in 3 siblings

`admin-trade-action`, `complete-trade` and `transactions-update` still use the strict comparison and still 401 on the same key. They now have a drop-in helper available; changing them was **out of scope** here and is recommended as a follow-up.

### Deploy + live confirmation (BP-41 rule 8)

Three functions deployed via the standing CLI path, server-side bundled:

```bash
supabase functions deploy trade-refund get-payment-method attach-payment-method \
  --project-ref drntwgporzabmxdqykrp --use-api --yes
```

- `verify_jwt` reconciled IMMEDIATELY before the deploy: all three probe as gateway `401 UNAUTHORIZED_NO_AUTH_HEADER` and are absent from `config.toml` (CLI default `true`) ⇒ **no drift, nothing was flipped**. Re-probed after deploy: unchanged.
- The new `_shared` assets were uploaded (`service-credential.ts`, `subscription-payment-method.ts`), which is how we know the `../_shared/*` imports resolved.
- **Post-deploy behaviour check (the confirmation):**

| | `.env` service key → `trade-refund` |
|---|---|
| before deploy | `401 {"success":false,"error":{"code":"UNAUTHORIZED"}}` |
| **after deploy** | **`400 {"code":"MISSING_TRADE_ID"}`** — past auth, inside the function body ✅ |

---

## 5. Key wiring result

`STRIPE_QA_READONLY_KEY` was added to the gitignored `p2p-kids-marketplace/.env` (line 37 of `.gitignore` — confirmed not committable).

**The owner-provided key is `sk_test_51ShGft4I6kCJlvXoE…` — a standard SECRET key (107 chars), not a restricted `rk_test_…` key.** `scripts/qa/lib/stripe-read.mjs` rejects `sk_test_` by design, so:

```
$ npm run --silent qa:stripe-inspect -- by-trade <uuid>
REFUSED: STRIPE_QA_READONLY_KEY holds a full SECRET key (sk_test_...), not a restricted read-only key.
EXIT=2
```

**`key_scope` does NOT read `RESTRICTED_READ_ONLY`.** Owner's decision this session: keep the `sk_test_` key and always run with `--break-glass-secret-key`, so every artifact is self-labelled `SECRET_KEY_BREAK_GLASS`.

To get `RESTRICTED_READ_ONLY`: Stripe Dashboard → Developers → API keys → **Create restricted key** (TEST, all-READ, plus connected-account read), and copy the `rk_test_…` value from the **Restricted keys** table.

**Connected-account read:** not verified under a restricted scope (there is no restricted key yet). What *was* verified is the platform-level reads this audit needed (`pm`, `customer`, `subscription`, `payment_intent`, `refunds`). The `--account acct_…` path remains untested.

⚠️ **Security note:** the key was pasted into chat, so treat it as exposed and rotate it once this task is closed.

---

## Extra findings (the strand-holds review)

Answering item 1 required looking at *every* hold, not just one — which surfaced two in-repo writers in the same class.

### A. `reset-offer-fixtures.mjs` stranded buyer holds — FIXED

It cancels by raw status UPDATE (deliberately — it must not depend on app auth) and therefore reproduced only *some* of what the product cancel path does: it voided the tax from FIX-Task-24 onward, but never cancelled the PI. That is the entire source of the 25 live holds.

**Fix:** added `releaseStripeHolds()`, mirroring `_shared/competing-offer-cancel.ts` — cancel uncaptured authorizations, never touch a captured charge. Uses `~/.dt11-stripe-key`, reports failures instead of swallowing them, and dry-runs cleanly.

### B. QA playbook R14 skipped a Stripe capture — FIXED

`.github/instructions/QA-Test-Agent.instructions.md` R14 documented the auto-complete fast clock as `UPDATE trades SET auto_complete_at = …` **+ `rpc_process_auto_complete`**. That RPC only does the DB status change — the **PI capture lives in the `process-auto-complete` Edge Function**. Two live trades from the 2026-09-09 TRD session (`47bdab0a…` $28.49, `acb4939a…` $25.03) read `completed`, have `seller_payouts` rows, and **were never captured** (`amount_received=0`).

`payments.captured_at` looks like evidence here but is a **trigger mirror** of `trades.status` (`fn_payments_sync_from_trade` stamps `now()` for any `in_progress`/`completed` trade) — R100 in action.

This is the **exact sibling** of the FIX-Task-24 expiry correction already in the file (§9.1c in-file inconsistency): same fast-clock pattern, same "the cron's EF does something the bare RPC does not", one sibling fixed and this one left.

**Fix:** added the mirrored correction block (+ updated R14's inline recipe) with the generalisation so it is not re-learned a third time.

### C. 3 latent product gaps — REPORTED, NOT FIXED (need a decision)

Found while tracing the above; all in the same completion class:

1. **`process-auto-complete` treats "Stripe not configured" as success** — `else if (!stripe) { captureResults.push({ capture_success: true }) }`. If `STRIPE_SECRET_KEY` is absent, every eligible trade is marked captured and the cron completes them, scheduling payouts against uncaptured holds. Unlike `complete-trade` and the admin dispute route, it does **not** fail closed.
2. **`complete-trade` completes a cash trade with no PI** — warns and continues; and `cashCents` is `?? 0`, so a null `svcClient` read silently skips the capture block entirely.
3. **`complete_trade_v2` is granted to `authenticated`** with no capture guard and no DB-level invariant requiring capture before `status→completed`.

Plus a **count-coupling bug**: `process-auto-complete` passes `p_batch_size: successfulTradeIds.length` (a count, not ids) to an RPC whose own `LIMIT` window is ordered differently, so an uncaptured trade can be included.

Also noted, for a separate look: **93 trades read `completed` with an uncaptured PI** on the wider query — 2 of them ($53.52) are the ones above with `amount_received = 0`. The remainder were not diagnosed (my sweep's `--limit` default of 500 under-reported this; use `--limit 1000`).

---

## Tier results

| Tier | Scope run | Result |
|---|---|---|
| **0** | `deno check --no-config --no-lock` on all 5 changed EF files | ✅ **PASS** (clean) |
| **0** | `deno test` on `supabase/functions/_shared/` | ✅ **PASS — 26/26** |
| **0** | `node --check` on both new/changed QA scripts | ✅ **PASS** |
| **0** | Prettier / JSX checklist | N/A — no `.tsx` touched |
| **1** | Live provider verification of item 1 (before/after Stripe read) | ✅ **PASS** |
| **1** | Live triage of the BP-87 auth drift (4-EF probe matrix) | ✅ **PASS** |
| **1** | Post-deploy live confirmation that `trade-refund` accepts the `.env` service key | ✅ **PASS** (401 → 400) |
| **2** | `supabase db reset` + local smoke | ❌ **NOT RUN — BLOCKED** (Docker daemon not running) |
| **2** | `scripts/smoke/run.mjs --all` (against staging, owner-approved) | ⚠️ **2 PASS / 2 ENV-BLOCKED** |

**Smoke detail:**

- `transactions.mjs` — ✅ PASS (`STRIPE_SECRET_KEY` present, `sk_` prefix)
- `referrals.mjs` — ✅ PASS (3 assertions: referral code generated, `profiles.referred_by` + `referred_by_code` persisted)
- `payouts.mjs` — ❌ `PAYPAL_CLIENT_ID` missing/blank (**environment**, not a regression)
- `dispute-evidence.mjs` — ❌ usage error, requires `--dispute <dp_id>` or `--payment-intent <pi_id>` (**parameterized by design**)

**➡️ Tier 2 is PARTIAL, not PASS.** Two legs are outstanding: the migration replay (`supabase db reset`, blocked on Docker) and the two environment-blocked smoke scripts. To finish:

```bash
# 1. start Docker Desktop, then:
cd supabase && supabase start && supabase db reset
# 2. re-run the sweep with PayPal creds present and a real dispute id:
PAYPAL_CLIENT_ID=… node scripts/smoke/run.mjs --all
node scripts/smoke/dispute-evidence.mjs --payment-intent <pi_id>
```

**No Jest run was needed** — no file under `p2p-kids-marketplace/src/**` was touched.

---

## Files changed

| File | Change |
|---|---|
| `supabase/functions/_shared/service-credential.ts` | **NEW** — verified (not compared) service-role credential check |
| `supabase/functions/_shared/service-credential.test.ts` | **NEW** — 7 tests |
| `supabase/functions/_shared/subscription-payment-method.ts` | **NEW** — write a card to both Stripe default levels |
| `supabase/functions/_shared/subscription-payment-method.test.ts` | **NEW** — 5 tests |
| `supabase/functions/trade-refund/index.ts` | BP-87 auth fix |
| `supabase/functions/get-payment-method/index.ts` | F6 — sync Stripe after re-pointing the DB card |
| `supabase/functions/attach-payment-method/index.ts` | F6 — shared helper (both levels); + 1-line pre-existing type fix to unblock `deno check` |
| `scripts/qa/stranded-holds.mjs` (app) | **NEW** — read-only stranded-hold sweep |
| `scripts/qa/release-stranded-holds.mjs` (app) | **NEW** — owner-approved repair path (`--yes` to write) |
| `scripts/qa/reset-offer-fixtures.mjs` (app) | Release the holds it was stranding |
| `p2p-kids-marketplace/package.json` | `qa:stranded-holds`, `qa:release-stranded-holds` |
| `.github/instructions/QA-Test-Agent.instructions.md` | R14 auto-complete correction |

**Rollback plan** (Edge Functions only, no migrations):

```bash
git revert <this-commit>
supabase functions deploy trade-refund get-payment-method attach-payment-method \
  --project-ref drntwgporzabmxdqykrp --use-api --yes
```

No DB migration was applied, so there is nothing to un-apply. The 26 Stripe cancellations are **not** reversible (a cancelled authorization cannot be re-opened) — but each one released funds on a trade that was already `cancelled` or already unrecoverable, so there is no money to restore.
## Commit

See the Session Handoff — commit pushed to `main`.
