# Evidence bundle — QA TRD closing pass (post-FIX-Task-35)
Run: `e2e-test-results/qa-trd-closing-post-fix35-2026-09-14/` · 2026-09-14
Platform: **iOS** iPhone 17 Pro Max (`3F3293A3-…`) — mobile-mcp exposed ONLY the iOS simulator this
session (`emulator-5554` was visible to `adb devices` but the toolset rejected it) ⇒ **no Android verdict, R80.**
Stripe key: `STRIPE_QA_BREAK_GLASS` (`sk_test_…` via `STRIPE_QA_READONLY_KEY`) ⇒ every Stripe artifact below is
**`key_scope=SECRET_KEY_BREAK_GLASS`, NOT restricted-key read-only evidence** (owner-known: `rk_test_…` still pending).

---

## 1 · Fixture-harness spot-check (task item 3)

### 1a · Baseline sweep — BEFORE any harness run
`STRIPE_QA_BREAK_GLASS=1 npm run --silent qa:stranded-holds -- --limit 1000 --json`
```json
{ "key_scope": "SECRET_KEY_BREAK_GLASS", "days": 60, "capturable_days": 7, "trades_probed": 490,
  "stranded_count": 0, "stale_count": 0, "completed_without_capture_count": 0, "notes": [] }
```

### 1b · Harness run #1 — real work, all holds released
`npm run qa:reset-offer-fixtures`
```
📋 Found 2 pending offer(s):
   - 365cc0ba…  listing: 0fe228ee…  buyer: 49243010…  status: pending
   - cb4a1339…  listing: 0fe228ee…  buyer: a1234567…  status: pending
✅ Cancelled 2 offer(s).
💳 Stripe holds: 2 cancelled · 0 nothing to cancel · 0 failed
🧾 Tax void: 2 voided · 0 no tax record · 0 already voided/unvoidable · 0 failed
✅ Reset 1 listing(s) to available.
```

### 1c · Sweep immediately after run #1 ⇒ **0 new holds** (the spot-check assertion)
```json
{ "trades_probed": 490, "stranded_count": 0, "stale_count": 0,
  "completed_without_capture_count": 0, "notes": [] }
```

### 1d · Harness run #2 — 1 pending offer, 1 hold released
```
📋 Found 1 pending offer(s):
   - afc8a083…  listing: 0fe228ee…  buyer: a1234567…  status: pending
✅ Cancelled 1 offer(s).
💳 Stripe holds: 1 cancelled · 0 nothing to cancel · 0 failed
🧾 Tax void: 1 voided · 0 no tax record · 0 already voided/unvoidable · 0 failed
✅ Reset 1 listing(s) to available.
```

### 1e · FINAL sweep — 0 stranded / 0 stale, but 3 `completed_without_capture` appeared MID-RUN
```json
{ "trades_probed": 493, "stranded_count": 0, "stale_count": 0,
  "completed_without_capture_count": 3, "completed_without_capture_cents": 5387,
  "completed_without_capture": [
    { "trade_id": "2bb49d39-bb67-44f9-bca2-ee43b8a22b74", "pi": "pi_3UEJrf4I6kCJlvXo1btD4tPR",
      "pi_status": "requires_capture", "held": "$21.40", "captured_cents": 0 },
    { "trade_id": "57d50a84-0aa8-4a5c-b13e-158f2374c579", "pi": "pi_3UEJrf4I6kCJlvXo1uJzeWwr",
      "pi_status": "requires_capture", "held": "$16.00", "captured_cents": 0 },
    { "trade_id": "cdb2a42d-b653-4c2b-82c4-a772c04727a7", "pi": "pi_3UEJrg4I6kCJlvXo00lxdTdO",
      "pi_status": "requires_capture", "held": "$16.47", "captured_cents": 0 } ] }
```
These 3 were **absent from the 1a baseline** because they were still `in_progress` then — see §5 (they were
flipped to `completed` at **21:45:00.484911**, inside this session, by the cron).

---

## 2 · R03 — the previously-stranded PI is released

`DOTENV_CONFIG_QUIET=true npm run qa:stripe-inspect -- pi pi_3UFO9f4I6kCJlvXo0iCaV1UR --break-glass-secret-key`
```
status: canceled   amount: 1789   amount_capturable: 0   amount_received: 0
canceled_at: 2026-09-14T16:03:00.000Z   customer: cus_Ungj4MptKp9CUg
metadata.item_id: 0fe228ee-6430-40fa-bcb4-ae07fc252f27  (Science Kit)
```

---

## 3 · R03 — competing-offers re-drive (live flow)

### 3a · Fixture (setup via the sanctioned EF harness, R90 — accounting for the `max_pending_offers_per_seller=3` live config)
| Offer | Buyer | Listing | SP | trade_id | PI |
|---|---|---|---|---|---|
| A (winner) | test-buyer-2 | `61e15611-e8fa-471c-a5e4-579c67f5a73d` ($15) | 0 | `fcd43de6-…` | `pi_3UFher4I6kCJlvXo0D9M8Wcq` |
| B (**rival**) | test-buyer (subscriber) | `61e15611-…` ($15) | **5** | `a73cd764-…` | `pi_3UFhf44I6kCJlvXo06lBTq7M` |
| C (harness victim) | test-buyer-3 | `0fe228ee-…` (Science Kit $20) | 0 | `afc8a083-…` | `pi_3UFhfA4I6kCJlvXo1BVbxDvX` |

Pre-state DB: all 3 `pending`; `sp_wallets` test-buyer **453 available / 5 reserved**.
Provider pre-state (rival hold **LIVE**):
```
=== payment_intent pi_3UFhf44I6kCJlvXo06lBTq7M ===
  status: requires_capture   amount: 1254   amount_capturable: 1254   amount_received: 0
```

### 3b · Seller accept, driven **on-device in the app UI**
Login `p2pkidsmarketplace://qa-login-as?persona=test-seller` → `p2pkidsmarketplace://trades`.
AX tree showed `trade-summary-needs-action-hint` = **"2 offers to review"** and both offer cards each carrying
`trade-offer-competition-…` = **"1 other buyer is competing on this item"**.
Tapped `trade-offer-row-fcd43de6-…-review` → Review Offer → `accept-trade-button` → confirm modal:
> **"Are you sure you want to accept this offer? … Accepting will decline the other 1 offer; their SP is returned."**

`accept-trade-confirm-button` → alert **"Offer Accepted!"** / *"Payment authorized. Trade is now in progress.
The buyer can confirm receipt."* (copy is the corrected **"Payment authorized"**, not "captured").

### 3c · Post-state — DB (all three assertions)
| trade | buyer | status | reason | `cancelled_at` | tax | SP |
|---|---|---|---|---|---|---|
| `fcd43de6` | test-buyer-2 | **in_progress** | – | – | `quoted` (correct) | – |
| `a73cd764` | test-buyer | **cancelled** | **`offer_expired_competing`** | **`2026-09-14 21:46:08.163+00` (stamped — F1 fixed)** | **`voided`** (`voided_at` 21:46:09.47, `refunded_tax_cents 0`, `reconciliation_status` NULL) | **458 available / 0 reserved** (was 453/5) |
| `afc8a083` | test-buyer-3 | pending | – | – | `quoted` | – |

Winner `auto_complete_at = 2026-09-17 21:46:08.163+00` ⇒ correct.

### 3d · Post-state — **PROVIDER (the decisive R03 assertion)**
```
=== payment_intent pi_3UFhf44I6kCJlvXo06lBTq7M ===
  status: canceled   amount: 1254   amount_capturable: 0   amount_received: 0
  canceled_at: 2026-09-14T21:46:09.000Z
```
⇒ the rival's authorization hold is released **by the live accept flow** (`transactions-update` →
`_shared/competing-offer-cancel.ts` → `paymentIntents.cancel`), **not** by manual cleanup.

### 3e · Read-only invariant verifier
`npm run qa:fix32-verify -- --listing 61e15611-…`
```
✅ PASS I1 cancelled trades with voidable tax — 0 found
❌ FAIL I2 completed trades with voidable tax — 2 found   ← residual, NOT R03/O2-C12 (see §6)
✅ PASS I3 cancelled trades with NULL cancelled_at — 0 found
✅ PASS I4 cancelled payments carrying refunded amounts — 0 found
✅ PASS I5 F2 proof trade tax record is voided
✅ PASS I6 listing 61e15611…: 1 cancelled rival; voidable tax=0, missing cancelled_at=0
```

---

## 4 · O2-C12 — void-vs-refund on an UNCAPTURED authorization

Driven through the **admin portal's own UI** (`http://localhost:3001/trades/fcd43de6-…`) — the trade is an
`in_progress` trade whose PI is still `requires_capture`, i.e. the authentic "partial refund requested before
capture" scenario (the UI itself gates the action to `completed | in_progress | payment_processing`).
`Issue Partial Refund` → price **$5.00** / fee **$0** / tax **$0** + reason → confirm (**"Refund $5.00"**) →
`POST /api/admin/trades/partial-refund` → `trade-refund` EF.

### 4a · Edge Function response (route proxy)
The portal route proxies to `trade-refund`; the EF's uncaptured branch ran (`paymentIntents.cancel`), and the
response body shape is the void leg (`action: 'voided_uncaptured'`, `refunded_cents: 0`) — no
`rpc_record_payment_refund` call. *(The portal's success alert reloads the page, so the alert text is not a
durable channel; the DB + provider artifacts below are the evidence.)*

### 4b · DB — every 2026-09-13 defect symptom is gone
```json
{ "trade": "fcd43de6-…", "status": "in_progress",
  "payments": { "derived_state": "cancelled", "refunded_cents": 0, "refunded_price_cents": 0,
                "refunded_fee_cents": 0, "refunded_tax_cents": 0, "refunded_at": null },
  "tax_records": [ { "tax_status": "voided", "voided_at": "2026-09-14T21:50:54.432004+00:00",
                     "refunded_tax_cents": 0, "stripe_refund_id": null,
                     "reconciliation_status": null, "captured_at": null } ],
  "trade_refunds": [] }
```

### 4c · PROVIDER
```json
{ "pi": { "id": "pi_3UFher4I6kCJlvXo0D9M8Wcq", "status": "canceled", "amount": 1879,
          "amount_capturable": 0, "amount_received": 0,
          "canceled_at": "2026-09-14T21:50:54.000Z" },
  "charge": { "captured": false, "paid": true, "amount_refunded": 1879, "refunded": true },
  "refunds": [ { "id": "re_3UFher4I6kCJlvXo0fV0bfRM", "amount": 1879, "status": "succeeded" } ],
  "checks": { "pi_amount_vs_db_total_charged": { "stripe_amount": 1879, "db_total_charged_cents": 1879, "verdict": "AGREE" },
              "capture_state": { "stripe_amount_received": 0, "stripe_amount_capturable": 0, "db_tax_voided": true },
              "refund_count": { "stripe_refund_count": 1, "db_trade_refund_rows": 0, "verdict": "DISAGREE" } } }
```
`refund_count → DISAGREE` is **`AGREE (by design — uncaptured authorization)` per playbook §5.37 rule 7**: Stripe
books an authorization-cancel as a refund object while the app deliberately writes no `trade_refunds` row. Ruled
OUT as a finding (same precedent as `50849c0b`, FIX-Task-33 F3).

### 4d · Cleanup
`fcd43de6` terminalized via the admin **Force Cancel** (`btn-force-cancel-trade` → reason →
`btn-confirm-force-cancel`) → `cancelled` + `cancelled_at`; listing back to `available`;
`post_acceptance_cancellation_count` **unchanged at 7** and `admin_review_flagged_at` unchanged ⇒ the admin path
applied **no** seller consequence (so no R89 restore was needed).

---

## 5 · 🔴 NEW P1 — the live auto-complete CRON bypasses Stripe capture

### 5a · The 3 trades
Created `2026-09-11 02:06:54` (a single seeded batch); **all three `completed_at = 2026-09-14 21:45:00.484911`**,
with `auto_complete_at = 2026-09-14 21:37:32.4x` and PIs still `requires_capture` / `amount_received = 0`.
`tax_status` remains `quoted` (`cdb2a42d`, `2bb49d39`); `payments.derived_state` reads `succeeded` (trigger
**mirror** — R100 — while Stripe says the opposite; `payments.captured_at` is likewise a mirror).

### 5b · Writer named (R100/R12) — the audit journal rules the EF OUT
`financial_audit_log` for all 3 trade ids contains ONLY the 2026-09-11 creation rows
(`offer_created`, `tax_quoted`, `buyer_fee_charged`, `payment_intent_created`). There is **NO `payment_captured`
row** (the EF writes one per capture with `idempotency_key = capture_<tradeId>`) and no completion audit row.

### 5c · The cron definition — root cause
```
SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobname;
jobid 42 | process-auto-complete | */15 * * * * | active=true
         | SELECT public.rpc_process_auto_complete(100);
```
`21:45:00` is exactly a `*/15` tick. `rpc_process_auto_complete`'s body is a pure clock UPDATE
(`status='in_progress' AND auto_complete_at <= now()` → `status='completed'`), **with no capture and no payment
check** (`supabase/migrations/20260528000005_auto_complete_cron.sql` L14-52). The migration *scheduled the EF*
via `net.http_post('/process-auto-complete')`, but the **live job now calls the bare RPC** — so FIX-Task-35's
capture invariant (which lives in the EF) can never run on this path.

**Class:** identical to playbook **R14**'s auto-complete correction (fixed in the EF + playbook, never fixed in
the cron). **Blast radius:** any trade that reaches its `auto_complete_at` without a buyer/seller completion is
completed **uncaptured** — with `payments.derived_state='succeeded'`/`captured_at` stamped by the mirror, so the
DB *looks* collected. **Remediation (1 line):** point jobid 42 at the EF, as the sibling jobs do
(`SELECT public.rpc_fire_edge_function('/process-auto-complete');`), and reconcile the 3 rows + the 2 I2 rows.

---

## 6 · Task item 4 — the 2 previously-uncaptured trades are CLEAN (3 layers)

`47bdab0a-7f52-4133-bb45-793e9bb3a2dc` · PI `pi_3UDjGl4I6kCJlvXo1aYETeKt`
`acb4939a-fbfd-4dfb-8f06-c5ebbfa5af12` · PI `pi_3UDjCU4I6kCJlvXo0mv21dEy`

| trade | DB | Stripe PI | charge | amount check |
|---|---|---|---|---|
| `47bdab0a` | `completed`; `payments.refunded_cents 0`, `total_charged_cents 2849` | `succeeded`, `amount_received 2849`, `amount_capturable 0` | `captured: true`, `amount_refunded 0` | **2849 = 2849 AGREE** |
| `acb4939a` | `completed`; `payments.refunded_cents 0`, `total_charged_cents 2503` | `succeeded`, `amount_received 2503`, `amount_capturable 0` | `captured: true`, `amount_refunded 0` | **2503 = 2503 AGREE** |

Both `stripe-inspect` runs returned `capture_state` with `stripe_amount_received > 0` and
`refund_count → AGREE`. **No discrepancy remains on either trade at any layer.**

*(Known, pre-existing, NOT a regression: `acb4939a`'s `tax_records` row is `voided` because FIX-Task-35's
`rpc_mark_tax_collected` cannot move `voided → collected`, so its $1.54 collected tax is not in the tax ledger —
already documented as an owed ledger-write/accept decision in FIX-Task-35. `47bdab0a` has no tax row at all.)*

---

## 7 · Residual reported by the verifier (pre-existing, non-blocking)

`qa:fix32-verify` **I2 FAIL — 2 completed trades with voidable (`quoted`) tax**: `cdb2a42d` ($0.98) and
`2bb49d39` ($1.40) — these are **two of the §5 uncaptured trades**, so they are a *symptom* of the §5 root cause
(completed by the clock, tax never collected), not an independent defect. Tracked with the §5 finding.
