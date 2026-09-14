# Ledger — TRD closing round (R03 + O2-C12), 2026-09-13

Platform: Android `Medium_Phone_API_36.1` (`emulator-5554`). iOS booted, NOT driven (R80).
Run folder: `e2e-test-results/qa-trd-close-r03-o2c12-2026-09-13/`. ≈62 tool calls.

## Per-case verdicts

| TC-ID | Verdict | One-line reason |
|---|---|---|
| `TRD-TC-R03` (expiry limb) | ✅ PASS | `process-expired-offers` EF: `expired_offers_processed 1`; `cancelled` / `'Offer expired'` / `cancelled_at` struck / `tax_status='voided'` (`refunded_tax_cents 0`) / SP restored (458, reserved 0) / 2 notifications. |
| `TRD-TC-R03` (competing-offers limb) | 🟡 PARTIAL | Cancel + exact reason + SP restore + notifications all PASS on-device; **"holds restored" clause unmet** → F1 (`cancelled_at` NULL) + F2 (hold not released, tax stranded `quoted`). |
| `TRD-TC-R03` (overall row) | 🟡 PARTIAL retained | Reason changed from *"competing limb owed"* → *"both limbs driven; F1/F2 defects filed"*. |
| `TRD-TC-O2-C12` | 🟡 PARTIAL retained | **Determination: NOT already-void ⇒ dev fix.** `trade-refund` voids at Stripe but books the uncaptured amount as a refund in the ledger. Latent (0 production instances). |
| `TRD-TC-O2-C12` (9-row residual) | disposition decided, **not applied** | 9 × completed + `quoted`, $80.63, all `captured_at NULL` ⇒ per the owner's decision these end **`voided`**; needs separate data-action approval. |

## Fixture ledger (all verified)

| Artifact | Created | Terminal state | Reverted? |
|---|---|---|---|
| Offer `67ba29fc…` (test-buyer, 5 SP) | `qa:ef-repro` | `cancelled` / `offer_expired_competing`; SP restored (458 / 0; 1 × `earn_refund +5`) | ✅ fully reverted (residual: F2's stranded `quoted` tax row, **kept deliberately as evidence**) |
| Offer `11cd34e0…` (test-buyer-2, cash) | `qa:ef-repro` | accepted → `in_progress` → then `cancelled` via `cancel-trade` EF (reason `other`), `tax_status='voided'` | ✅ reverted |
| Offer `67b14e93…` (test-buyer, 5 SP, expiry limb) | `qa:ef-repro` | `cancelled` / `'Offer expired'`; SP restored | ✅ self-cleaned |
| Listing "Science Kit" `0fe228ee…` | pre-existing | `available` (restored) | ✅ |
| `test-buyer-2` saved card | `qa:ensure-cards` (old PM was invalid/expired) | valid MASTERCARD •••• 4444 | fixture-side change, expected |

Writes issued this round: fast-clock `UPDATE trades.offer_expires_at` (owner-approved, R03) + sanctioned fixture tools + the `cancel-trade` fixture reset. Nothing else.

## Key DB evidence (staging `drntwgporzabmxdqykrp`, read-only)

| Metric | Value |
|---|---|
| Pre-state — `test-buyer` wallet | `available 453`, `reserved_sp 5` |
| Post-competing-cancel — `test-buyer` wallet | `available 458`, `reserved_sp 0` |
| Post-competing-cancel — rival trade | `cancelled` / `offer_expired_competing` / **`cancelled_at NULL`** / `tax_status quoted` |
| Post-expiry — expiry trade | `cancelled` / `'Offer expired'` / `cancelled_at` set / `tax_status voided` / `refunded_tax_cents 0` |
| `cancelled` trades with `quoted` tax | **1** (this fixture) — not self-healing (`check-authorization-expiry` scans `pending` only) |
| `cancelled_at IS NULL` | **60** (`seller_declined` 50, `NULL` 7, `offer_expired_competing` 2, `dispute_resolved_refund` 1) |
| `trade_refunds` with `cancelled_` prefix | **0** (O2-C12 defect is latent) |
| `tax_records` with `reconciliation_status` | **0** |
| 9-row backfill residual | 9 rows / **8063¢ ($80.63)** / all `captured_at NULL` — exact match to the tracker |

## Findings

| ID | Sev | One-line |
|---|---|---|
| F1 | MED | Competing-offer cancel never stamps `cancelled_at` (`transactions-update` accept branch + `transactions-accept-bundle:149`); the trigger that would have is **dead** (`payment_processing` only). |
| F2 | MED | Rival's uncaptured hold is never released and its tax row is stranded `quoted` — the one cancellation writer missing the `cancelled_` void discriminator. FIX-Task-24 backfilled 52 such rows (one reason = `offer_expired_competing`) but never changed the writer. |
| F3 | LOW | `tax_voided_count: 0` in the expiry EF response even though the EF did void (telemetry only). |
| F4 | LOW (doc) | Duplicate `TRD-TC-R03` ID inside one guide (L5100 vs L7005). |
| F5 | LOW (copy) | Losing buyer's cancellation notification omits the reason, while the `sp_ledger` row for the same event is reason-aware. |
