# MODULE 15.3 VERIFICATION CHECKLIST: SALES TAX ENGINE

**Module:** Sales Tax Engine  
**Version:** 1.0  
**Total Tasks:** 14 (TAX-001 → TAX-014)  
**Spec Source:** `Prompts/MODULE-15.3-sales-tax-engine.md`  
**Dependencies:** MODULE-15.2 (Cart System), existing `nodes`, `trades`, `admin_config` tables  
**Status:** Ready for Verification

---

## PURPOSE

This checklist verifies that MODULE 15.3 (Sales Tax Engine) has been fully implemented per spec, with:
1. Database schema updated on `nodes`, `trades`, and new `tax_records` table
2. All 6 RPC functions deployed: calculate, apply, refund, summary, export
3. Admin UI for per-node tax rate configuration and reporting dashboard
4. Mobile checkout screen shows real-time tax breakdown
5. Tax integration service wired end-to-end at trade completion
6. End-to-end tax flow tested against all 9 scenarios

---

## CRITICAL DESIGN DECISIONS — MUST VERIFY BEFORE SIGN-OFF

> Violations of these decisions are **blocking** — do not sign off until all pass.

| Decision | Rule | Where to Check |
|---|---|---|
| **D-01** | Tax calculated on **FULL item price** — SP does NOT reduce the taxable base | `calculate_sales_tax` RPC, `CheckoutScreen` display |
| **D-02** | Platform fees are **NOT included** in taxable amount | `calculate_sales_tax` RPC formula |
| **D-03** | Swap Points are **payment tender**, NOT a coupon — do NOT reduce taxable base | `calculate_sales_tax`: `taxable = item_price` (full) |
| **D-04** | Fees (buyer %, seller %, flat) calculated on the **net cash portion**; TAX on **full item price** | `transactions-create` Edge Function / checkout logic |
| **D-05** | Tax rate configured **per node** — NOT a single global rate | `nodes.tax_rate` column, `calculate_sales_tax` reads node rate |
| **D-06** | Tax rate determined by **buyer's node** (destination-based) | `calculate_sales_tax(p_buyer_node_id)` |
| **D-07** | Subscription fees are **non-taxable** by default (admin-toggleable) | `admin_config.subscription_fee_taxable` |
| **D-08** | Tax refund is **proportional** and automatic — NOT manual | `refund_sales_tax` RPC |
| **D-09** | Tax records retained for **audit trail** (3–7 year compliance) | `tax_records` table with `created_at` never deleted |

---

## PHASE 1: DATABASE FOUNDATION

---

### TAX-001: Database Schema Migration

**Migration:** `supabase/migrations/20260510000001_sales_tax_schema.sql`

#### `nodes` Table Additions
- [ ] `nodes.tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0635` added (e.g. 0.0635 for 6.35%)
- [ ] `nodes.tax_jurisdiction TEXT NOT NULL DEFAULT 'Connecticut'` added
- [ ] `nodes.tax_enabled BOOLEAN NOT NULL DEFAULT true` added
- [ ] CHECK constraint on `tax_rate`: value between 0 and 1 (or 0–100 — confirm spec)
- [ ] SQL COMMENTs on all 3 columns

#### `trades` Table Additions
- [ ] `trades.tax_amount_cents INTEGER DEFAULT 0` added
- [ ] `trades.taxable_amount_cents INTEGER DEFAULT 0` added
- [ ] `trades.tax_rate_applied DECIMAL(5,4)` added (snapshot at transaction time)
- [ ] `trades.tax_jurisdiction TEXT` added

#### `tax_records` Table Created
- [ ] `tax_records` table exists with all required fields: `id`, `trade_id`, `buyer_id`, `node_id`, `taxable_amount_cents`, `tax_rate`, `tax_amount_cents`, `tax_jurisdiction`, `refunded_tax_cents`, `created_at`, `updated_at`
- [ ] `trade_id` foreign key references `trades(id)`
- [ ] `buyer_id` foreign key references `auth.users(id)`
- [ ] `node_id` foreign key references `nodes(id)`
- [ ] RLS enabled: authenticated users can SELECT own records; service role full access
- [ ] COMMENT on table explaining retention requirement

#### `admin_config` Entries
- [ ] `tax_enabled` entry added (boolean, default `true`)
- [ ] `subscription_fee_taxable` entry added (boolean, default `false`)
- [ ] `default_tax_rate` entry added (decimal)
- [ ] `tax_remittance_jurisdiction` entry added (text, default `'Connecticut'`)

#### Indexes
- [ ] Index on `tax_records(trade_id)`
- [ ] Index on `tax_records(buyer_id)`
- [ ] Index on `tax_records(node_id)`
- [ ] Index on `tax_records(created_at)`
- [ ] Index on `trades(tax_amount_cents)` WHERE `tax_amount_cents > 0`
- [ ] Index on `nodes(tax_enabled)` WHERE `tax_enabled = true`

#### Helper Function
- [ ] `get_node_tax_rate(p_node_id uuid)` function exists
- [ ] Returns 0 when `tax_enabled = false` for the node
- [ ] Returns 0 when global `tax_enabled` admin_config is false
- [ ] Returns `tax_rate` otherwise

**Verification SQL:**
```sql
-- Verify nodes columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'nodes' AND column_name IN ('tax_rate','tax_jurisdiction','tax_enabled');

-- Verify trades columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'trades' AND column_name IN ('tax_amount_cents','taxable_amount_cents','tax_rate_applied','tax_jurisdiction');

-- Verify tax_records table
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'tax_records';

-- Verify admin_config entries
SELECT key, value FROM admin_config
WHERE key IN ('tax_enabled','subscription_fee_taxable','default_tax_rate','tax_remittance_jurisdiction');
```

---

## PHASE 2: RPC FUNCTIONS

---

### TAX-002: RPC Function — Calculate Sales Tax

**Migration:** `supabase/migrations/20260510000002_rpc_calculate_tax.sql`

#### Function Existence & Signature
- [ ] `calculate_sales_tax(p_item_price_cents INTEGER, p_swap_points_cents INTEGER, p_buyer_node_id UUID)` exists
- [ ] Returns `JSONB` with `{success, data: {taxable_amount_cents, tax_amount_cents, tax_rate, jurisdiction}}`

#### Business Logic
- [ ] `taxable_amount_cents = p_item_price_cents - p_swap_points_cents`
- [ ] `tax_amount_cents = ROUND(taxable_amount_cents * tax_rate)`
- [ ] Returns `tax_amount_cents = 0` when global `tax_enabled = false`
- [ ] Returns `tax_amount_cents = 0` when node `tax_enabled = false`
- [ ] Reads tax rate from `nodes.tax_rate` for `p_buyer_node_id`
- [ ] Returns `{jurisdiction}` from `nodes.tax_jurisdiction`

#### Validation
- [ ] Error when `p_item_price_cents <= 0`
- [ ] Error when `p_buyer_node_id` doesn't exist
- [ ] Error when `p_swap_points_cents > p_item_price_cents` (would make taxable amount negative)

#### Performance
- [ ] Meets < 100ms target (verified with `EXPLAIN ANALYZE`)

**Test Cases:**
- [ ] $100 item, $20 SP, 6.35% rate → taxable=$80, tax=$5.08 ✓
- [ ] Tax disabled globally → tax=$0 ✓
- [ ] Tax disabled for node → tax=$0 ✓
- [ ] Invalid node ID → error returned ✓

---

### TAX-003: RPC Function — Apply Tax to Transaction

**Migration:** `supabase/migrations/20260510000003_rpc_apply_tax.sql`

- [ ] `apply_tax_to_transaction(p_transaction_id UUID, p_taxable_amount_cents INTEGER, p_tax_rate DECIMAL, p_tax_amount_cents INTEGER, p_tax_jurisdiction TEXT, p_node_id UUID)` exists
- [ ] Updates `trades.tax_amount_cents`, `trades.taxable_amount_cents`, `trades.tax_rate_applied`, `trades.tax_jurisdiction`
- [ ] Creates `tax_records` entry (audit trail)
- [ ] Both updates are **atomic** (single transaction — either both succeed or both fail)
- [ ] Validates trade exists before updating
- [ ] Returns `{success, data: {tax_record_id}}`
- [ ] Performance: < 150ms

---

### TAX-004: RPC Function — Refund Sales Tax

**Migration:** `supabase/migrations/20260510000004_rpc_refund_tax.sql`

- [ ] `refund_sales_tax(p_transaction_id UUID, p_refund_amount_cents INTEGER, p_refund_reason TEXT)` exists
- [ ] Calculates proportional refund: `refund_tax = (p_refund_amount_cents / original_price) * original_tax_paid`
- [ ] Supports multiple partial refunds — tracks cumulative `refunded_tax_cents`
- [ ] Prevents refunding more tax than originally collected
- [ ] Updates `tax_records.refunded_tax_cents` (cumulative)
- [ ] Stores `refund_reason` in `tax_records` for audit trail
- [ ] Returns `{success, data: {refunded_tax_cents, cumulative_refunded_tax_cents, remaining_tax_cents}}`
- [ ] Performance: < 200ms

**Test Cases:**
- [ ] 50% refund → exactly 50% of tax refunded ✓
- [ ] Multiple partial refunds accumulate correctly ✓
- [ ] Cannot refund more than collected → error ✓

---

### TAX-005: RPC Function — Get Tax Summary

**Migration:** `supabase/migrations/20260510000005_rpc_tax_summary.sql`

- [ ] `get_tax_summary(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ, p_node_id UUID DEFAULT NULL, p_report_type TEXT DEFAULT 'summary')` exists
- [ ] Supports all 7 report types: `'summary'`, `'transactions'`, `'refunds'`, `'jurisdictions'`, `'by_period'`, `'tax_exempt'`, `'audit_trail'`
- [ ] `summary` report returns: `total_collected_cents`, `total_refunded_cents`, `net_tax_cents`, `transaction_count`, `avg_tax_cents`
- [ ] `jurisdictions` report groups by `tax_jurisdiction` with subtotals
- [ ] `audit_trail` limited to 1000 records for performance
- [ ] Date range filtering works (inclusive on both ends)
- [ ] `p_node_id = NULL` returns data for ALL nodes
- [ ] Performance: < 1 second for 30-day date range

---

### TAX-006: RPC Function — Get Tax Export Data

**Migration:** `supabase/migrations/20260510000006_rpc_tax_export.sql`

- [ ] `get_tax_export_data(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)` exists
- [ ] Returns TABLE format (not JSONB) — CSV-friendly rows
- [ ] Output columns: `transaction_date`, `buyer_email`, `node_name`, `taxable_amount_usd`, `tax_rate`, `tax_amount_usd`, `refunded_tax_usd`, `net_tax_usd`
- [ ] Joins `auth.users` for `buyer_email`
- [ ] Joins `nodes` for `node_name`
- [ ] Dollar amounts formatted to 2 decimal places
- [ ] Performance: < 2 seconds for 1-year data range

---

## PHASE 3: ADMIN SITE TAX MANAGEMENT

---

### TAX-007: Admin UI — Node Tax Rate Configuration

**File:** `p2p-kids-admin/src/app/tax/nodes/page.tsx`

- [ ] Page exists and renders without errors
- [ ] Displays all nodes in a table with columns: node name, `tax_jurisdiction`, `tax_rate`, `tax_enabled` toggle
- [ ] Inline edit: admin can click tax rate to edit it
- [ ] Rate validation: input must be 0–100% (entered as percentage e.g., "6.35")
- [ ] Confirmation modal shown before saving changes (prevents accidental updates)
- [ ] Bulk update: checkbox to select multiple nodes + "Apply Rate to Selected" action
- [ ] Per-node `tax_enabled` toggle updates immediately with optimistic UI
- [ ] Global tax toggle reads from and writes to `admin_config.tax_enabled`
- [ ] Tax rate change history displayed (who changed, when, old value → new value)
- [ ] Success / error toast notifications on save
- [ ] Loading skeleton during API calls

---

### TAX-008: Admin UI — Tax Reporting Dashboard

**File:** `p2p-kids-admin/src/app/tax/reports/page.tsx`

- [ ] Page exists and renders with real data
- [ ] **4 summary cards**: Tax Collected, Tax Refunded, Net Tax Owed, Transaction Count
- [ ] Date range picker with presets: This Month, Last Month, Q1, Q2, Q3, Q4, YTD, All Time
- [ ] Custom date range selection works
- [ ] **7 report type tabs** (or dropdown): summary, transactions, refunds, jurisdictions, by_period, tax_exempt, audit_trail
- [ ] Jurisdiction breakdown table with amounts per node
- [ ] **CSV Export button** downloads data in CT DRS format
- [ ] Export filename includes date range (e.g., `tax-export-2026-01-01-to-2026-03-31.csv`)
- [ ] Charts/graphs for tax trends over time (at least a bar or line chart)
- [ ] Page loads in < 2 seconds for 1-year data
- [ ] Responsive layout for tablet-sized screens

---

### TAX-009: Admin UI — Global Tax Settings

**File:** `p2p-kids-admin/src/app/tax/settings/page.tsx`

- [ ] Page exists at `/tax/settings` route in admin portal
- [ ] **Global tax enabled/disabled** toggle (writes to `admin_config.tax_enabled`)
- [ ] **Default tax rate** input field (writes to `admin_config.default_tax_rate`)
- [ ] **Subscription fee taxable** toggle (writes to `admin_config.subscription_fee_taxable`)
- [ ] **Tax remittance jurisdiction** text field (writes to `admin_config.tax_remittance_jurisdiction`)
- [ ] All fields use existing admin_config UI patterns from other settings pages
- [ ] Warning banner when global tax is disabled: "Tax collection is currently OFF"
- [ ] Save button with confirmation for destructive changes (toggling tax off)

---

## PHASE 4: MOBILE INTEGRATION

---

### TAX-010: Mobile Hook — `useTaxCalculation`

**File:** `src/hooks/useTaxCalculation.ts`

- [ ] Hook exported from file
- [ ] Accepts `{ itemPriceCents, swapPointsCents, buyerNodeId }` as input
- [ ] Calls `calculate_sales_tax` RPC on input changes
- [ ] **Debounced** recalculation — 300ms delay after `swapPointsCents` changes (prevents spam calls as user moves SP slider)
- [ ] Returns `{ taxableAmount, taxAmount, taxRate, jurisdiction, loading, error }`
- [ ] Returns `taxAmount = 0` gracefully when tax is disabled (no error thrown)
- [ ] Cleans up debounce timer on unmount

---

### TAX-011: Mobile UI — Checkout Tax Display

**File:** `src/screens/trade/CheckoutScreen.tsx`

- [ ] Tax breakdown section added to checkout screen
- [ ] Display order: Item Price → SP Discount → Subtotal → **Sales Tax** → Platform Fee → **Total**
- [ ] Tax amount updates in **real-time** as SP slider moves (via `useTaxCalculation` hook)
- [ ] Label shown as "Sales Tax" (kid-friendly — NOT "CT State Tax 6.35%")
- [ ] Tax amount displayed as "$5.08" (formatted dollars)
- [ ] When tax is $0 (disabled): tax line still shown as "$0.00" (not hidden) OR omitted with "Tax-exempt" badge
- [ ] Jurisdiction shown as small subtitle under "Sales Tax": e.g., "Connecticut 6.35%"
- [ ] No blank screen / crash when `useTaxCalculation` is loading

---

### TAX-012: Mobile UI — Transaction History Tax Details

**File:** `src/screens/trade/TransactionHistoryScreen.tsx`

- [ ] Tax amount shown as a line item in transaction list cards
- [ ] "View Tax Details" button visible on completed transactions with tax > 0
- [ ] Tax details modal/sheet shows: Taxable Amount, Tax Rate, Tax Amount, Refunded Tax (if any), Jurisdiction
- [ ] Refunded tax shown clearly when partial refund occurred
- [ ] No crash when `tax_amount_cents` is 0 or null on older transactions

---

### TAX-013: Mobile Service — Tax Integration

**File:** `src/services/tax.ts`

- [ ] `calculateTax(itemPriceCents, swapPointsCents, buyerNodeId)` function exists
- [ ] `applyTax(transactionId, taxData)` function exists — called when trade completes
- [ ] `getTaxSummary(startDate, endDate)` function exists
- [ ] Error handling: network errors are caught and surfaced gracefully (not crash)
- [ ] Retry logic: failed `applyTax` calls retry once before surfacing error
- [ ] `applyTax` is called from trade completion flow (integrated with `tradeServiceV2.completeTradeV2()` or `complete-trade` Edge Function)
- [ ] TypeScript types for all function params and return values

---

## PHASE 5: TESTING

---

### TAX-014: End-to-End Tax Flow Testing

**Files:** `src/__tests__/tax-e2e.test.ts`, `scripts/smoke/tax-flow.mjs`

#### Test Scenarios (all must pass)
- [ ] **Scenario 1:** Purchase with 0% SP → full item price taxed, correct amount returned
- [ ] **Scenario 2:** Purchase with 50% SP → taxable = item_price - sp, tax on discounted amount
- [ ] **Scenario 3:** Tax disabled globally → $0 tax collected for any transaction
- [ ] **Scenario 4:** Tax disabled for specific node → $0 tax for transactions in that node
- [ ] **Scenario 5:** Partial refund (50%) → exactly 50% of tax refunded
- [ ] **Scenario 6:** Full refund → 100% of tax refunded, net_tax = 0
- [ ] **Scenario 7:** Multiple partial refunds → cumulative tracking correct, no over-refund
- [ ] **Scenario 8:** Admin changes tax rate → new transactions use new rate, old records unchanged
- [ ] **Scenario 9:** CSV export → data matches tax_records table, formatting correct

#### Unit Tests
- [ ] `calculateTax()` service function: 10+ unit tests covering edge cases
- [ ] `refundSalesTax()` RPC: proportional calculation tested with floating-point precision
- [ ] `useTaxCalculation` hook: debounce behavior tested, loading/error states tested

#### Smoke Test Script
- [ ] `scripts/smoke/tax-flow.mjs` runs without error against test environment
- [ ] Script output shows: calculated tax, applied tax record ID, export row count

---

## SIGN-OFF CHECKLIST

Before marking MODULE 15.3 complete, verify ALL of the following:

### Database
- [ ] Migration `20260510000001_sales_tax_schema.sql` applied to live Supabase project
- [ ] `nodes` table has 3 new tax columns with correct defaults
- [ ] `trades` table has 4 new tax columns
- [ ] `tax_records` table created with RLS enabled
- [ ] All 4 `admin_config` tax entries present
- [ ] All 6 indexes created

### RPC Functions (all 6 deployed and tested)
- [ ] `calculate_sales_tax` ✓
- [ ] `apply_tax_to_transaction` ✓
- [ ] `refund_sales_tax` ✓
- [ ] `get_tax_summary` (7 report types) ✓
- [ ] `get_tax_export_data` ✓
- [ ] `get_node_tax_rate` helper ✓

### Critical Business Rules
- [ ] Tax calculated on FULL item price (D-01) — SP never reduces the taxable base
- [ ] Platform fees excluded from taxable amount (D-02)
- [ ] Destination-based tax (buyer's node) enforced (D-06)
- [ ] Proportional automatic refunds (D-08)

### Admin UI
- [ ] `/tax/nodes` — per-node tax configuration working
- [ ] `/tax/reports` — dashboard with CSV export working
- [ ] `/tax/settings` — global settings working

### Mobile
- [ ] Checkout shows real-time tax breakdown
- [ ] `useTaxCalculation` debounced and performant
- [ ] `applyTax` called at trade completion

### Quality Gates
- [ ] TypeScript: zero errors in `tax.ts` and `useTaxCalculation.ts`
- [ ] All 9 E2E test scenarios pass
- [ ] `calculate_sales_tax` RPC: < 100ms
- [ ] `get_tax_summary` RPC: < 1s for 30-day range

---

**Verification Sign-off**

| Area | Verifier | Date | Status |
|------|----------|------|--------|
| Database migration | | | ⬜ |
| RPC functions (6) | | | ⬜ |
| Admin UI (3 pages) | | | ⬜ |
| Mobile integration | | | ⬜ |
| E2E tests (9 scenarios) | | | ⬜ |
| Performance targets | | | ⬜ |
| CT DRS compliance check | | | ⬜ |
