# MODULE-15.3: SALES TAX ENGINE - 14-TASK MANIFEST

**Purpose:** This document shows the proper 14-task breakdown for MODULE-15.3, following the same structure as MODULE-15.2 (Cart System).

---

## PHASE 1: DATABASE FOUNDATION (1 Task)

### ✅ TAX-001: Database Schema Migration
- **Duration:** 4 hours | **Priority:** P0
- **Deliverables:**
  - Add tax columns to `nodes` table
  - Add tax columns to `trades` table  
  - Create `tax_records` table
  - Add tax config to `admin_config`
  - All indexes, RLS policies, helper functions

---

## PHASE 2: RPC FUNCTIONS (5 Tasks)

### ✅ TAX-002: RPC Function - Calculate Sales Tax
- **Duration:** 3 hours | **Priority:** P0
- **Deliverables:**
  - `calculate_sales_tax(p_item_price_cents, p_swap_points_cents, p_buyer_node_id)`
  - Returns: {taxable_amount_cents, tax_amount_cents, tax_rate, jurisdiction}
  - Validates inputs, handles disabled tax, reads node rate

### 🔲 TAX-003: RPC Function - Apply Tax to Transaction
- **Duration:** 2 hours | **Priority:** P0
- **Deliverables:**
  - `apply_tax_to_transaction(p_transaction_id, p_taxable_amount_cents, p_tax_rate, p_tax_amount_cents, p_tax_jurisdiction, p_node_id)`
  - Updates `trades` table with tax data
  - Creates `tax_records` entry for audit trail

### 🔲 TAX-004: RPC Function - Refund Sales Tax
- **Duration:** 3 hours | **Priority:** P1
- **Deliverables:**
  - `refund_sales_tax(p_transaction_id, p_refund_amount_cents, p_refund_reason)`
  - Calculates proportional tax refund
  - Updates `tax_records` and `trades` tables
  - Tracks cumulative refunds

### 🔲 TAX-005: RPC Function - Get Tax Summary
- **Duration:** 4 hours | **Priority:** P1
- **Deliverables:**
  - `get_tax_summary(p_start_date, p_end_date, p_node_id, p_report_type)`
  - Returns all 7 report types: summary, transactions, refunds, jurisdictions, by_period, tax_exempt, audit_trail
  - Aggregates tax collected, refunded, net owed
  - Jurisdiction breakdown

### 🔲 TAX-006: RPC Function - Get Tax Export Data
- **Duration:** 2 hours | **Priority:** P1
- **Deliverables:**
  - `get_tax_export_data(p_start_date, p_end_date)`
  - Returns CSV-friendly table format
  - Includes: transaction_date, buyer_email, node_name, taxable_amount, tax_rate, tax_amount, refunded_tax, net_tax
  - Optimized for CT DRS filing

---

## PHASE 3: ADMIN SITE (3 Tasks)

### 🔲 TAX-007: Admin UI - Node Tax Rate Configuration
- **Duration:** 6 hours | **Priority:** P1  
- **Deliverables:**
  - Page: `p2p-kids-admin/src/app/tax/nodes/page.tsx`
  - View/edit tax rate per node
  - Bulk update capability
  - Tax enabled/disabled toggle per node
  - Input validation (0-100% rate)

### 🔲 TAX-008: Admin UI - Tax Reporting Dashboard
- **Duration:** 8 hours | **Priority:** P1
- **Deliverables:**
  - Page: `p2p-kids-admin/src/app/tax/reports/page.tsx`
  - Summary cards (collected, refunded, net owed, transaction count)
  - Date range presets (This Month, Last Month, YTD, etc.)
  - Jurisdiction breakdown table
  - All 7 report type selector
  - CSV export button

### 🔲 TAX-009: Admin UI - Global Tax Settings
- **Duration:** 3 hours | **Priority:** P2
- **Deliverables:**
  - Page: `p2p-kids-admin/src/app/tax/settings/page.tsx`
  - Global tax enabled/disabled toggle
  - Default tax rate configuration
  - Subscription fee taxable toggle
  - Tax remittance jurisdiction setting
  - Integrates with existing `admin_config` UI patterns

---

## PHASE 4: MOBILE INTEGRATION (4 Tasks)

### 🔲 TAX-010: Mobile Hook - useTaxCalculation
- **Duration:** 4 hours | **Priority:** P0
- **Deliverables:**
  - Hook: `p2p-kids-marketplace/src/hooks/useTaxCalculation.ts`
  - Calls `calculate_sales_tax` RPC
  - Debounced recalculation (300ms) on SP changes
  - Returns: {taxableAmount, taxAmount, taxRate, jurisdiction, loading, error}
  - Handles tax-disabled scenarios

### 🔲 TAX-011: Mobile UI - Checkout Tax Display
- **Duration:** 5 hours | **Priority:** P0
- **Deliverables:**
  - Update: `p2p-kids-marketplace/src/screens/trade/CheckoutScreen.tsx`
  - Add tax breakdown section
  - Real-time tax updates as SP slider moves
  - Display: Item Price → SP Discount → Subtotal → Tax → Platform Fee → Total
  - Kid-friendly labels ("Sales Tax" not "CT State Tax")

### 🔲 TAX-012: Mobile UI - Transaction History Tax Details
- **Duration:** 3 hours | **Priority:** P2
- **Deliverables:**
  - Update: `p2p-kids-marketplace/src/screens/trade/TransactionHistoryScreen.tsx`
  - Show tax amount in transaction list
  - Add "View Tax Details" button
  - Modal/sheet showing full tax breakdown (taxable amount, rate, jurisdiction, refunds)

### 🔲 TAX-013: Mobile Service - Tax Integration
- **Duration:** 4 hours | **Priority:** P0
- **Deliverables:**
  - Service: `p2p-kids-marketplace/src/services/tax.ts`
  - Functions: calculateTax(), applyTax(), getTaxSummary()
  - Error handling and retry logic
  - Integration with existing transaction service
  - Call `apply_tax_to_transaction` when trade completes

---

## PHASE 5: TESTING & VALIDATION (1 Task)

### 🔲 TAX-014: End-to-End Tax Flow Testing
- **Duration:** 6 hours | **Priority:** P1
- **Deliverables:**
  - Test file: `p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts`
  - Test scenarios:
    1. Purchase with 0% SP → full tax on item price
    2. Purchase with 50% SP → tax on discounted amount
    3. Tax disabled globally → $0 tax collected
    4. Tax disabled for node → $0 tax for that node
    5. Partial refund → proportional tax refunded
    6. Full refund → full tax refunded
    7. Multiple refunds → cumulative tracking works
    8. Admin changes tax rate → new transactions use new rate
    9. CSV export → data matches expectations
  - Smoke test script: `scripts/smoke/tax-flow.mjs`

---

## TASK SUMMARY

| Phase | Tasks | Total Hours | Status |
|-------|-------|-------------|--------|
| Phase 1: Database | 1 (TAX-001) | 4h | ✅ Complete |
| Phase 2: RPC Functions | 5 (TAX-002 to TAX-006) | 14h | 🔲 1/5 Complete |
| Phase 3: Admin Site | 3 (TAX-007 to TAX-009) | 17h | 🔲 0/3 Complete |
| Phase 4: Mobile Integration | 4 (TAX-010 to TAX-013) | 16h | 🔲 0/4 Complete |
| Phase 5: Testing | 1 (TAX-014) | 6h | 🔲 0/1 Complete |
| **TOTAL** | **14 Tasks** | **57 hours** | **1/14 Complete** |

---

## COMPARISON TO MODULE-15.2 (CART SYSTEM)

MODULE-15.2 had 16 tasks across 5 phases:
- Phase 1: Database (2 tasks)
- Phase 2: Cart RPCs (7 tasks)
- Phase 3: Favorites RPCs (1 task)
- Phase 4: TypeScript Services (2 tasks)
- Phase 5: Mobile Integration (4 tasks)

MODULE-15.3 has 14 tasks across 5 phases (similar structure, fewer tasks because tax is simpler than cart):
- Phase 1: Database (1 task - simpler than cart)
- Phase 2: Tax RPCs (5 tasks - fewer than cart's 7)
- Phase 3: Admin Site (3 tasks - cart didn't have admin UI)
- Phase 4: Mobile Integration (4 tasks - same as cart)
- Phase 5: Testing (1 task - comprehensive E2E)

---

## NEXT STEPS

1. **Review this manifest** - Confirm this 14-task breakdown matches your expectations
2. **Update MODULE-15.3.md** - Restructure the module file to match this manifest
3. **Implement remaining tasks** - TAX-003 through TAX-014 in order

---

## QUESTIONS FOR REVIEW

1. ✅ Does the 14-task breakdown make sense? (vs the current 5 tasks)
2. ✅ Should we split TAX-002 (currently contains calculate + apply + refund) into 3 separate tasks?
3. ✅ Should TAX-009 (Global Tax Settings) be a separate admin page or integrated into TAX-007?
4. ✅ Do we need TAX-014 (Testing) as a formal task, or should testing be embedded in each task?
5. ✅ Any other adjustments needed before we restructure the full module file?
