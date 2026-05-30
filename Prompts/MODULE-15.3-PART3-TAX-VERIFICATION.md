# MODULE 15.3 — PART 3 TASKS VERIFICATION CHECKLIST

**Module:** Sales Tax Engine — Part 3 Restructured Tasks  
**Version:** 1.0  
**Total Tasks:** 14 (TAX-001 → TAX-014)  
**Spec Source:** `Prompts/MODULE-15.3-PART3-TASKS-RESTRUCTURED.md`  
**Companion Verification:** See also `V3/MODULE-15.3-sales-tax-VERIFICATION.md` for full design decisions  
**Status:** Ready for Verification

---

## PURPOSE

This checklist is the task-level delivery verification for the **restructured** Part 3 of MODULE 15.3. It maps directly to each task in `MODULE-15.3-PART3-TASKS-RESTRUCTURED.md` and ensures:
1. Each task's **acceptance criteria** are individually met
2. Each task's **deliverable files** exist at the specified paths
3. Each task's **testing checklist** has been executed and passes
4. Cross-task dependencies are satisfied in order

---

## TASK DEPENDENCY ORDER

Tasks **must** be verified in this order — later tasks depend on earlier ones:

```
TAX-001 (DB Schema)
  ↓
TAX-002 (Calculate Tax RPC)
  ↓
TAX-003 (Apply Tax RPC)
  ↓
TAX-004 (Refund Tax RPC)    TAX-005 (Tax Summary RPC)    TAX-006 (Export RPC)
  ↓                              ↓                              ↓
TAX-007 (Admin Node UI)     TAX-008 (Admin Reports)       TAX-009 (Admin Settings)
  ↓
TAX-010 (useTaxCalculation hook)
  ↓
TAX-011 (Checkout UI)       TAX-012 (History UI)          TAX-013 (Tax Service)
  ↓
TAX-014 (E2E Testing)
```

---

## PHASE 1: DATABASE FOUNDATION

---

### TAX-001: Database Schema Migration ✅ (P0)

**Duration Budget:** 4 hours  
**Deliverable File:** `supabase/migrations/20260510000001_sales_tax_schema.sql`

#### Acceptance Criteria
- [ ] Migration file exists at the specified path
- [ ] `nodes` table has 3 new columns: `tax_rate`, `tax_jurisdiction`, `tax_enabled`
- [ ] `trades` table has 4 new columns: `tax_amount_cents`, `taxable_amount_cents`, `tax_rate_applied`, `tax_jurisdiction`
- [ ] `tax_records` table created with all required fields
- [ ] `admin_config` has 4 new tax configuration entries
- [ ] 6 performance indexes created
- [ ] RLS policies secure tax data
- [ ] `get_node_tax_rate()` helper function created

#### Testing Checklist
- [ ] Migration runs without errors on clean database
- [ ] All verification queries in spec pass
- [ ] `nodes` table shows 3 new columns via `information_schema`
- [ ] `trades` table shows 4 new columns via `information_schema`
- [ ] `tax_records` table created with RLS enabled
- [ ] 4 admin_config rows exist with correct keys
- [ ] `get_node_tax_rate()` function returns correct rate for enabled node
- [ ] `get_node_tax_rate()` returns 0 for disabled node
- [ ] Existing production data unaffected (existing trades show `tax_amount_cents = 0`)

---

## PHASE 2: RPC FUNCTIONS

---

### TAX-002: RPC Function — Calculate Sales Tax (P0)

**Duration Budget:** 3 hours  
**Deliverable File:** `supabase/migrations/20260510000002_rpc_calculate_tax.sql`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] `calculate_sales_tax(p_item_price_cents, p_swap_points_cents, p_buyer_node_id)` deployed
- [ ] Computes correct tax based on `(item price - SP discount)` — confirmed with $100/$20 example
- [ ] Reads tax rate from buyer's `nodes.tax_rate`
- [ ] Returns 0 tax when global `tax_enabled = false`
- [ ] Returns 0 tax when node `tax_enabled = false`
- [ ] Returns JSONB `{success, data: {taxable_amount_cents, tax_amount_cents, tax_rate, jurisdiction}}`
- [ ] Validates `p_item_price_cents > 0`
- [ ] Validates `p_buyer_node_id` is a valid node

#### Testing Checklist
- [ ] $100 item, $20 SP → $80 taxable, $5.08 tax (at 6.35%)
- [ ] Tax disabled globally → $0 tax returned with `success: true`
- [ ] Tax disabled for node → $0 tax returned with `success: true`
- [ ] Invalid node ID → `success: false` with proper error message
- [ ] Negative item price → `success: false` with validation error
- [ ] Performance < 100ms (verified with database timing)

---

### TAX-003: RPC Function — Apply Tax to Transaction (P0)

**Duration Budget:** 2 hours  
**Deliverable File:** `supabase/migrations/20260510000003_rpc_apply_tax.sql`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] `apply_tax_to_transaction(p_transaction_id, p_taxable_amount_cents, p_tax_rate, p_tax_amount_cents, p_tax_jurisdiction, p_node_id)` deployed
- [ ] Updates `trades.tax_amount_cents` field
- [ ] Creates `tax_records` audit entry
- [ ] Both updates are atomic (wrapped in transaction)
- [ ] Validates transaction exists before updating
- [ ] Returns `{success, data: {tax_record_id}}`

#### Testing Checklist
- [ ] Tax successfully applied to a valid transaction
- [ ] Both `trades` and `tax_records` rows updated in same operation
- [ ] Invalid transaction ID → proper error returned
- [ ] `tax_records` row has all required fields populated (no NULLs in required columns)
- [ ] Audit trail verifiable: query `tax_records WHERE trade_id = ?`
- [ ] Performance < 150ms

---

### TAX-004: RPC Function — Refund Sales Tax (P1)

**Duration Budget:** 3 hours  
**Deliverable File:** `supabase/migrations/20260510000004_rpc_refund_tax.sql`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] `refund_sales_tax(p_transaction_id, p_refund_amount_cents, p_refund_reason)` deployed
- [ ] Supports multiple partial refunds (cumulative tracking)
- [ ] Prevents over-refund (cannot refund more tax than collected)
- [ ] Updates both `tax_records.refunded_tax_cents` and `trades`
- [ ] Includes refund reason in audit trail
- [ ] Returns refund details with breakdown

#### Testing Checklist
- [ ] 50% refund → exactly 50% of tax refunded (no rounding issues)
- [ ] Two separate 25% refunds → cumulative total matches single 50% refund
- [ ] Attempting to refund more than collected → `success: false` with clear error
- [ ] Refund reason stored in `tax_records`
- [ ] Math precision correct (ROUND to nearest cent)
- [ ] Performance < 200ms

---

### TAX-005: RPC Function — Get Tax Summary (P1)

**Duration Budget:** 4 hours  
**Deliverable File:** `supabase/migrations/20260510000005_rpc_tax_summary.sql`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] `get_tax_summary(p_start_date, p_end_date, p_node_id, p_report_type)` deployed
- [ ] All 7 report types implemented: `summary`, `transactions`, `refunds`, `jurisdictions`, `by_period`, `tax_exempt`, `audit_trail`
- [ ] Date range filtering is accurate (inclusive bounds)
- [ ] Jurisdiction breakdown groups correctly by node
- [ ] Net tax = collected − refunded (no rounding errors)
- [ ] Audit trail capped at 1000 records
- [ ] All monetary values converted to USD (cents ÷ 100, 2 decimal places)

#### Testing Checklist
- [ ] `summary` type returns 5 fields: `total_collected_cents`, `total_refunded_cents`, `net_tax_cents`, `transaction_count`, `avg_tax_cents`
- [ ] `jurisdictions` type groups correctly by `tax_jurisdiction`
- [ ] Date filter: transactions outside range NOT included
- [ ] `p_node_id = NULL` → all nodes included
- [ ] Empty date range → empty result (no error)
- [ ] Performance < 1 second for 30-day range
- [ ] Performance < 2 seconds for 1-year range

---

### TAX-006: RPC Function — Get Tax Export Data (P1)

**Duration Budget:** 2 hours  
**Deliverable File:** `supabase/migrations/20260510000006_rpc_tax_export.sql`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] `get_tax_export_data(p_start_date, p_end_date)` deployed
- [ ] Returns TABLE format (not JSONB)
- [ ] All 8 required columns present: `transaction_date`, `buyer_email`, `node_name`, `taxable_amount`, `tax_rate`, `tax_amount`, `refunded_tax`, `net_tax`
- [ ] Joins `auth.users` for `buyer_email`
- [ ] Joins `nodes` for `node_name`
- [ ] Dollar amounts formatted to 2 decimal places (not cents)

#### Testing Checklist
- [ ] Returns rows (not JSON blob)
- [ ] All 8 columns present in output
- [ ] `taxable_amount` displayed as dollars (e.g., 8000 → 80.00)
- [ ] `buyer_email` populated from auth.users join
- [ ] Date filtering accurate
- [ ] Empty range returns zero rows (no error)
- [ ] Performance < 2 seconds for 1-year data

---

## PHASE 3: ADMIN SITE

---

### TAX-007: Admin UI — Node Tax Rate Configuration (P1)

**Duration Budget:** 6 hours  
**Deliverable File:** `p2p-kids-admin/src/app/tax/nodes/page.tsx`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] Page is accessible at `/tax/nodes` route in admin portal
- [ ] Displays all nodes with: name, `tax_jurisdiction`, `tax_rate` (as %), `tax_enabled` toggle
- [ ] Individual node tax rate is editable (click-to-edit pattern)
- [ ] Tax rate validated: 0–100% range enforced, non-numeric rejected
- [ ] Changes require confirmation modal
- [ ] Bulk update UI: select multiple nodes + apply same rate
- [ ] Tax enabled/disabled toggle per node works
- [ ] Global tax toggle reads/writes `admin_config.tax_enabled`
- [ ] Success/error toast notifications on save
- [ ] Loading states during API calls

#### Testing Checklist
- [ ] Page loads and populates all nodes
- [ ] Global tax toggle updates admin_config (verify in DB)
- [ ] Individual node rate edited and persisted after page refresh
- [ ] Bulk update applies to all selected nodes
- [ ] Rate `< 0` rejected with validation message
- [ ] Rate `> 100` rejected with validation message
- [ ] Non-numeric input rejected
- [ ] Success toast shown on valid save
- [ ] Error toast shown on DB error
- [ ] Loading spinner during save

---

### TAX-008: Admin UI — Tax Reporting Dashboard (P1)

**Duration Budget:** 8 hours  
**Deliverable File:** `p2p-kids-admin/src/app/tax/reports/page.tsx`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] Page accessible at `/tax/reports`
- [ ] 4 summary cards: Tax Collected, Tax Refunded, Net Tax Owed, Transaction Count
- [ ] Date range picker with presets (This Month, Last Month, Q1–Q4, YTD, All Time)
- [ ] Custom date range selection
- [ ] All 7 report types accessible (tabs or dropdown)
- [ ] Jurisdiction breakdown table
- [ ] CSV export downloads CT DRS-formatted file
- [ ] At least 1 chart/visualization for tax trends
- [ ] Page load < 2 seconds for 1-year data

#### Testing Checklist
- [ ] Dashboard loads with real data (not all zeros)
- [ ] Date preset "This Month" shows current month data only
- [ ] Date preset "YTD" shows January 1 to today
- [ ] Custom range: manually entered dates filter correctly
- [ ] Each of 7 report types renders without error
- [ ] Jurisdiction table totals match summary card
- [ ] CSV export: file downloads, contains correct columns
- [ ] CSV filename includes date range
- [ ] Chart renders (no blank chart area)
- [ ] Responsive on tablet viewport (1024px)

---

### TAX-009: Admin UI — Global Tax Settings (P2)

**Duration Budget:** 3 hours  
**Deliverable File:** `p2p-kids-admin/src/app/tax/settings/page.tsx`

#### Acceptance Criteria
- [ ] File exists at specified path
- [ ] Page accessible at `/tax/settings`
- [ ] Global tax enabled/disabled toggle
- [ ] Default tax rate field
- [ ] Subscription fee taxable toggle
- [ ] Tax remittance jurisdiction text field
- [ ] Follows existing admin_config UI patterns
- [ ] Warning banner when global tax is OFF
- [ ] Confirmation required to disable tax globally

#### Testing Checklist
- [ ] Page renders all 4 settings
- [ ] Toggle global tax OFF → warning banner appears immediately
- [ ] Disabling global tax shows confirmation dialog
- [ ] After confirming OFF: `admin_config.tax_enabled = false` verified in DB
- [ ] Default tax rate saved as decimal (e.g., input "6.35" → stored 0.0635)
- [ ] Subscription fee taxable toggle persists after refresh
- [ ] Settings match what's shown on nodes page global toggle

---

## PHASE 4: MOBILE INTEGRATION

---

### TAX-010: Mobile Hook — `useTaxCalculation` (P0)

**Duration Budget:** 4 hours  
**Deliverable File:** `src/hooks/useTaxCalculation.ts`

#### Acceptance Criteria
- [ ] File exists at `p2p-kids-marketplace/src/hooks/useTaxCalculation.ts`
- [ ] Exported as named or default hook
- [ ] Accepts `{ itemPriceCents: number, swapPointsCents: number, buyerNodeId: string }`
- [ ] Calls `calculate_sales_tax` RPC
- [ ] Debounced: 300ms delay on `swapPointsCents` changes
- [ ] Returns `{ taxableAmount, taxAmount, taxRate, jurisdiction, loading, error }`
- [ ] `taxAmount = 0` when tax disabled (no error state)
- [ ] Cleanup: debounce timer cancelled on unmount

#### Testing Checklist
- [ ] TypeScript types: no `any`, no implicit `any`
- [ ] Returns correct values for $100/$20 SP scenario
- [ ] Debounce: rapid SP slider changes → only 1 API call per 300ms window
- [ ] Loading state: `loading: true` while RPC in flight
- [ ] Error state: network error sets `error` field
- [ ] Unmount cleanup: no "Can't perform state update on unmounted component" warnings
- [ ] `tsc --noEmit` passes on this file

---

### TAX-011: Mobile UI — Checkout Tax Display (P0)

**Duration Budget:** 5 hours  
**Deliverable File:** `src/screens/trade/CheckoutScreen.tsx` (updated)

#### Acceptance Criteria
- [ ] Tax breakdown section added to CheckoutScreen
- [ ] Display order: Item Price → SP Discount → Subtotal → Sales Tax → Platform Fee → Total
- [ ] Tax updates in real-time as SP slider moves
- [ ] Label: "Sales Tax" (kid-friendly)
- [ ] Jurisdiction shown as subtitle: e.g., "Connecticut 6.35%"
- [ ] Tax shown as 0 or hidden when tax disabled
- [ ] No crash/blank screen during hook loading state

#### Testing Checklist
- [ ] Checkout screen renders with tax line
- [ ] Move SP slider → tax amount updates within 300ms
- [ ] Total calculation correct: `(item - SP) + fees + tax`
- [ ] Tax label is "Sales Tax" (not "CT State Tax" or technical label)
- [ ] When tax disabled: no confusing UI (either $0.00 shown or line hidden gracefully)
- [ ] Loading spinner or skeleton shown while tax is calculating
- [ ] Accessibility: tax amount readable by screen reader

---

### TAX-012: Mobile UI — Transaction History Tax Details (P2)

**Duration Budget:** 3 hours  
**Deliverable File:** `src/screens/trade/TransactionHistoryScreen.tsx` (updated)

#### Acceptance Criteria
- [ ] Tax amount shown in transaction list item
- [ ] "View Tax Details" button on completed transactions with `tax_amount_cents > 0`
- [ ] Tax details modal/sheet shows: Taxable Amount, Tax Rate, Tax Amount, Refunded Tax, Jurisdiction
- [ ] No crash for transactions with `tax_amount_cents = 0` or null

#### Testing Checklist
- [ ] Tax line renders for recent transactions
- [ ] "View Tax Details" button tappable and opens modal
- [ ] Modal shows all 5 required fields
- [ ] Refunded tax shows correctly for refunded transactions
- [ ] Old transactions (no tax columns) render without error
- [ ] Modal dismissible (tap outside or close button)

---

### TAX-013: Mobile Service — Tax Integration (P0)

**Duration Budget:** 4 hours  
**Deliverable File:** `src/services/tax.ts`

#### Acceptance Criteria
- [ ] File exists at `p2p-kids-marketplace/src/services/tax.ts`
- [ ] `calculateTax(itemPriceCents, swapPointsCents, buyerNodeId)` exported
- [ ] `applyTax(transactionId, taxData)` exported
- [ ] `getTaxSummary(startDate, endDate)` exported
- [ ] Error handling: all Supabase errors caught and re-thrown with typed `TaxError`
- [ ] Retry logic on `applyTax`: 1 retry on transient failure
- [ ] `applyTax` called from trade completion flow

#### Testing Checklist
- [ ] `calculateTax` calls correct RPC with correct params
- [ ] `applyTax` creates `tax_records` row (verified in DB after call)
- [ ] Network error in `calculateTax` returns typed error (not unhandled exception)
- [ ] `applyTax` retry: if first call fails, second attempt made automatically
- [ ] `TypeScript tsc --noEmit` passes on `tax.ts`
- [ ] Integration with `completeTradeV2()` or `complete-trade` EF confirmed

---

## PHASE 5: TESTING & VALIDATION

---

### TAX-014: End-to-End Tax Flow Testing (P1)

**Duration Budget:** 6 hours  
**Deliverable Files:**  
- `p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts`  
- `scripts/smoke/tax-flow.mjs`

#### Acceptance Criteria (All 9 Scenarios Must Pass)
- [ ] **Scenario 1:** $100 item, $0 SP, 6.35% → tax = $6.35 ✓
- [ ] **Scenario 2:** $100 item, $20 SP, 6.35% → taxable = $80, tax = $5.08 ✓
- [ ] **Scenario 3:** Global tax disabled → tax = $0 for any transaction ✓
- [ ] **Scenario 4:** Node tax disabled → tax = $0 for transactions in that node ✓
- [ ] **Scenario 5:** 50% partial refund → 50% of tax refunded ✓
- [ ] **Scenario 6:** Full refund → 100% of tax refunded ✓
- [ ] **Scenario 7:** Two 25% refunds → same cumulative result as one 50% refund ✓
- [ ] **Scenario 8:** Admin changes tax rate → new transactions use new rate, historical unchanged ✓
- [ ] **Scenario 9:** CSV export → row count matches `tax_records` table, USD formatting correct ✓

#### Smoke Test
- [ ] `scripts/smoke/tax-flow.mjs` file exists
- [ ] Script runs without errors: `node scripts/smoke/tax-flow.mjs`
- [ ] Script output shows calculated tax amount, applied record ID, export row count
- [ ] Script exits with code 0

#### Unit Test Coverage
- [ ] `calculateTax()`: minimum 8 unit tests covering all validation branches
- [ ] `refundSalesTax()` RPC: proportional math tested with multiple percentages
- [ ] `useTaxCalculation` hook: debounce behavior, loading, and error states tested
- [ ] Test file: `npx jest tax-e2e --verbose` shows all tests passing

---

## CROSS-TASK INTEGRATION VERIFICATION

These items span multiple tasks and must be verified end-to-end:

- [ ] **Full purchase flow:** User adds item to cart → checkout → SP applied → tax calculated and displayed → trade created → `apply_tax_to_transaction` called → `tax_records` row exists
- [ ] **Refund flow:** Dispute resolved → `refund_sales_tax` called → `tax_records.refunded_tax_cents` updated → Transaction History shows refunded amount
- [ ] **Admin rate change propagation:** Admin changes node tax rate → next calculation uses new rate (no cache)
- [ ] **Tax report matches transactions:** `get_tax_summary` totals match manually summed `tax_records` entries for same date range

---

## SIGN-OFF CHECKLIST

| Task | Deliverable Exists | Acceptance Criteria Met | Tests Passing | Reviewer |
|------|-------------------|------------------------|---------------|----------|
| TAX-001 | ⬜ | ⬜ | ⬜ | |
| TAX-002 | ⬜ | ⬜ | ⬜ | |
| TAX-003 | ⬜ | ⬜ | ⬜ | |
| TAX-004 | ⬜ | ⬜ | ⬜ | |
| TAX-005 | ⬜ | ⬜ | ⬜ | |
| TAX-006 | ⬜ | ⬜ | ⬜ | |
| TAX-007 | ⬜ | ⬜ | ⬜ | |
| TAX-008 | ⬜ | ⬜ | ⬜ | |
| TAX-009 | ⬜ | ⬜ | ⬜ | |
| TAX-010 | ⬜ | ⬜ | ⬜ | |
| TAX-011 | ⬜ | ⬜ | ⬜ | |
| TAX-012 | ⬜ | ⬜ | ⬜ | |
| TAX-013 | ⬜ | ⬜ | ⬜ | |
| TAX-014 | ⬜ | ⬜ | ⬜ | |

**Overall Status:** ⬜ Not Started / ⬜ In Progress / ⬜ Complete
