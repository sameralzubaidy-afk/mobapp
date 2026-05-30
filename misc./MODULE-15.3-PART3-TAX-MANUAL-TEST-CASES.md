# MODULE-15.3-PART3 — Sales Tax Manual Test Cases

**Module**: Sales tax (TAX-001 → TAX-014)
**Scope**: PROD Supabase (`drntwgporzabmxdqykrp`) + iOS / Android simulators + admin portal
**Pre-reqs**: Admin user, one Kids Club+ buyer, one seller with an active listing, at least one node.

> Tax rate is stored as a DECIMAL fraction. UI shows percent (0.0635 ↔ 6.35%).
> Taxable base = `cash_amount_cents - buyer_transaction_fee_cents`. **Platform fee is NOT taxed.**
> Rounding rule = `FLOOR((amount × rate) + 0.5)`.

---

## TC-TAX-01 — DB schema present (TAX-001)
**Setup**: Open Supabase SQL editor.
**Steps**:
1. Run:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='nodes' AND column_name LIKE 'tax_%';
SELECT column_name FROM information_schema.columns
WHERE table_name='trades' AND column_name LIKE 'tax_%';
SELECT to_regclass('public.tax_records');
SELECT key, value FROM admin_config
WHERE key IN ('sales_tax_enabled','default_sales_tax_rate','subscription_fee_taxable','tax_remittance_jurisdiction');
```
**Expected**:
- `nodes`: `tax_rate`, `tax_enabled`, `tax_jurisdiction`
- `trades`: `tax_amount_cents`, `taxable_amount_cents`, `tax_rate_applied`, `tax_jurisdiction`
- `tax_records` exists
- 4 admin_config rows present (default rate = `0.0635`).

---

## TC-TAX-02 — `calculate_tax` rounding (TAX-002)
**Steps**:
```sql
SELECT calculate_tax(NULL, 12345);
SELECT calculate_tax(NULL, 0);
```
**Expected**:
- Returns JSONB `{success:true, data:{...}}`.
- For `12345` cents at rate `0.0635` → `tax_amount_cents = FLOOR((12345*0.0635)+0.5) = 784`.
- For `0` cents → `tax_amount_cents = 0`.

---

## TC-TAX-03 — Apply tax to trade is idempotent (TAX-003)
**Setup**: Create or pick a completed trade with `cash_amount_cents > buyer_transaction_fee_cents`.
**Steps**:
1. `SELECT apply_tax_to_trade('<trade-uuid>');` → note `tax_record_id`, `idempotent_hit=false`.
2. Call again with same `trade-uuid`.
**Expected**: Second call returns same `tax_record_id`, `idempotent_hit=true`, no duplicate rows in `tax_records`.

---

## TC-TAX-04 — Refund tax respects cap (TAX-004)
**Setup**: Same trade as TC-TAX-03.
**Steps**:
1. `SELECT refund_tax('<trade-uuid>', 100, 'TC-TAX-04 partial');` — partial refund.
2. `SELECT refund_tax('<trade-uuid>', 99999999, 'over-refund');`
**Expected**:
- Step 1: `success:true`, `refunded_total = 100`.
- Step 2: `success:false`, error code indicates refund exceeds collected.

---

## TC-TAX-05 — Tax summary aggregation (TAX-005)
**Steps**:
```sql
SELECT get_tax_summary_for_period(
  (current_date - INTERVAL '30 day')::date, current_date, NULL
);
```
**Expected**: `success:true`, totals and per-jurisdiction array; numbers consistent with sum of `tax_records` in window.

---

## TC-TAX-06 — Admin gate on `update_node_tax_config` (TAX-006)
**Steps** (in SQL editor signed in as anon role or as non-admin user):
```sql
SELECT update_node_tax_config(
  '<some-node-uuid>'::uuid, 0.05, 'XX', false
);
```
**Expected**: `success:false`, error code = `FORBIDDEN`. As admin user the same call returns `success:true` and the row in `nodes` is updated.

---

## TC-TAX-07 — Admin UI: per-node config (TAX-007)
**Setup**: Sign in to admin portal as admin user. Navigate to **Tax Nodes** in sidebar.
**Steps**:
1. Locate a node, change Tax Rate (%) to `6.35`, Jurisdiction to `CT`, check **Enabled**.
2. Click **Save**.
3. Reload page.
**Expected**: Values persist. In DB, `nodes.tax_rate = 0.0635`, `tax_jurisdiction='CT'`, `tax_enabled=true`. Audit log entry created.

---

## TC-TAX-08 — Admin UI: reports (TAX-008)
**Setup**: Navigate to **Tax Reports**.
**Steps**:
1. Pick a date range, optional node, click **Run Report**.
2. Click **Export CSV**.
**Expected**: Stats render (transactions, taxable total, collected, net). CSV file downloads with header row + per-jurisdiction rows.

---

## TC-TAX-09 — Admin UI: global settings (TAX-009)
**Setup**: Navigate to **Tax Settings**.
**Steps**:
1. Toggle **Enable sales tax globally**.
2. Change default rate to `7.00`, save.
3. Reload page.
**Expected**: Values persist; `admin_config.default_sales_tax_rate = '0.0700'`. Audit log entry created.

---

## TC-TAX-10 — Mobile hook live preview (TAX-010)
**Setup**: Install app on iOS simulator with PROD Supabase env. Log in as buyer.
**Steps**:
1. Open an item from a node where tax is enabled (rate 6.35%).
2. Press **Buy Now** → land on Trade Initiation screen.
3. Adjust SP slider; observe Order Summary.
**Expected**:
- "Sales Tax" row appears under Platform Fee.
- Amount changes within ~300ms when SP slider changes.
- Rate label shows e.g. `6.35% · CT`.

---

## TC-TAX-11 — Checkout: tax-in-total math (TAX-011)
**Setup**: Same as TC-TAX-10.
**Steps**:
1. Item price $100.00, SP discount $20.00, platform fee $2.99, node rate 6.35%.
2. Read the Total.
**Expected**:
- Taxable base = `100 − 20 = $80.00 → 8000 cents`.
- Tax = `FLOOR(8000 × 0.0635 + 0.5) = 508 cents = $5.08`.
- Total = `80.00 + 2.99 + 5.08 = $88.07`.

---

## TC-TAX-12 — Trade detail row + modal (TAX-012)
**Setup**: Open a completed trade where tax was applied.
**Steps**:
1. Open **Trade Detail**.
2. Tap the "Sales Tax" row.
**Expected**:
- Row shows tax amount and rate.
- Total includes tax.
- Modal opens with: Taxable Amount, Tax Rate, Jurisdiction, Tax Collected.

---

## TC-TAX-13 — Trade completion triggers tax apply (TAX-013)
**Setup**: Initiate a trade, mark complete from both sides.
**Steps**: Inspect `trades.tax_*` cols + `tax_records` for that trade id.
**Expected**: Row in `tax_records`; `trades.tax_amount_cents` matches; re-completion attempts do NOT create extra rows.

---

## TC-TAX-14 — Tax disabled is no-op
**Setup**: Set `admin_config.sales_tax_enabled='false'` OR set node `tax_enabled=false`.
**Steps**: Repeat TC-TAX-11.
**Expected**:
- Sales Tax row hidden in checkout.
- Total = subtotal + platform fee (no tax).
- `apply_tax_to_trade` returns `tax_amount_cents=0`, no row in `tax_records`.

---

## TC-TAX-15 — Run automated regression
**Steps**:
```bash
# Tier 0 (mobile)
cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit
cd p2p-kids-marketplace && npx eslint .

# Tier 0 (admin)
cd p2p-kids-admin && npm run build

# Unit tests
cd p2p-kids-marketplace && npx jest src/__tests__/services/tax.test.ts src/__tests__/hooks/useTaxCalculation.test.ts

# Smoke (read-only)
node scripts/smoke/tax-flow.mjs

# E2E against PROD (optional)
RUN_SUPABASE_E2E=true npx jest src/__tests__/tax-e2e.test.ts

# Maestro (requires running app)
maestro test .maestro/tax-checkout.yaml
```
**Expected**: All commands exit `0`; smoke prints `PASS` lines.
