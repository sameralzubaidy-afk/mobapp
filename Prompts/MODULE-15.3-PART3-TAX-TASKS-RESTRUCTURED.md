## PART 3: IMPLEMENTATION TASKS

**Total Tasks:** 14  
**Estimated Duration:** 57 hours  
**Phases:** 5

---

## TASK SUMMARY TABLE

| Phase | Task ID | Task Name | Duration | Priority | Status |
|-------|---------|-----------|----------|----------|--------|
| **Phase 1: Database** | | | **4h** | | |
| 1 | TAX-001 | Database Schema Migration | 4h | P0 | ✅ Ready |
| **Phase 2: RPC Functions** | | | **14h** | | |
| 2 | TAX-002 | RPC - Calculate Sales Tax | 3h | P0 | 🔲 Pending |
| 2 | TAX-003 | RPC - Apply Tax to Transaction | 2h | P0 | 🔲 Pending |
| 2 | TAX-004 | RPC - Refund Sales Tax | 3h | P1 | 🔲 Pending |
| 2 | TAX-005 | RPC - Get Tax Summary | 4h | P1 | 🔲 Pending |
| 2 | TAX-006 | RPC - Get Tax Export Data | 2h | P1 | 🔲 Pending |
| **Phase 3: Admin Site** | | | **17h** | | |
| 3 | TAX-007 | Admin UI - Node Tax Rate Config | 6h | P1 | 🔲 Pending |
| 3 | TAX-008 | Admin UI - Tax Reporting Dashboard | 8h | P1 | 🔲 Pending |
| 3 | TAX-009 | Admin UI - Global Tax Settings | 3h | P2 | 🔲 Pending |
| **Phase 4: Mobile Integration** | | | **16h** | | |
| 4 | TAX-010 | Mobile Hook - useTaxCalculation | 4h | P0 | 🔲 Pending |
| 4 | TAX-011 | Mobile UI - Checkout Tax Display | 5h | P0 | 🔲 Pending |
| 4 | TAX-012 | Mobile UI - Transaction History Tax | 3h | P2 | 🔲 Pending |
| 4 | TAX-013 | Mobile Service - Tax Integration | 4h | P0 | 🔲 Pending |
| **Phase 5: Testing** | | | **6h** | | |
| 5 | TAX-014 | End-to-End Tax Flow Testing | 6h | P1 | 🔲 Pending |

---

## PHASE 1: DATABASE FOUNDATION

---

### TASK TAX-001: Database Schema Migration

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** Existing nodes, trades, admin_config tables

#### Description
Create complete tax database infrastructure in a single migration file:
1. Add tax columns to `nodes` table (tax_rate, tax_jurisdiction, tax_enabled)
2. Add tax columns to `trades` table (tax_amount_cents, taxable_amount_cents, tax_rate_applied, tax_jurisdiction)
3. Create `tax_records` table for audit trail
4. Add tax configuration entries to `admin_config` table
5. Create all indexes, constraints, and RLS policies

#### Acceptance Criteria
- [ ] `nodes` table has tax configuration columns
- [ ] `trades` table stores tax data for each transaction
- [ ] `tax_records` table provides detailed audit trail
- [ ] `admin_config` has global tax settings
- [ ] All indexes created for performance
- [ ] RLS policies secure tax data
- [ ] Migration runs successfully in Supabase

#### Deliverables
- **File:** `supabase/migrations/20260510000001_sales_tax_schema.sql`
- **Tables Modified:** `nodes`, `trades`, `admin_config`
- **Tables Created:** `tax_records`
- **Functions Created:** `get_node_tax_rate()`
- **Indexes:** 6 indexes for performance
- **RLS Policies:** Full row-level security

#### Testing Checklist
- [ ] Migration runs without errors
- [ ] All verification queries pass
- [ ] `nodes` table has 3 new columns
- [ ] `trades` table has 4 new columns
- [ ] `tax_records` table created with all fields
- [ ] 4 new entries in `admin_config`
- [ ] `get_node_tax_rate()` function works
- [ ] RLS policies prevent unauthorized access
- [ ] Existing data unaffected by migration

---

## PHASE 2: RPC FUNCTIONS (TAX CALCULATION & REPORTING)

---

### TASK TAX-002: RPC Function - Calculate Sales Tax

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-001 (Database Schema)

#### Description
Create RPC function to calculate sales tax for a transaction:
- Accepts item price, swap points, and buyer node ID
- Reads node tax rate and global tax settings
- Returns taxable amount and tax amount
- Handles all validation and error cases

#### Acceptance Criteria
- [ ] `calculate_sales_tax()` computes correct tax based on (item price - SP discount)
- [ ] Reads tax_rate from buyer's node
- [ ] Returns 0 if tax globally disabled or node tax disabled
- [ ] Validates input parameters (item_price > 0, valid node_id)
- [ ] Returns JSONB with {success, data: {taxable_amount_cents, tax_amount_cents, tax_rate, jurisdiction}}
- [ ] Performance: < 100ms
- [ ] Comprehensive error handling

#### Deliverables
- **File:** `supabase/migrations/20260510000002_rpc_calculate_tax.sql`
- **Function:** `calculate_sales_tax(p_item_price_cents, p_swap_points_cents, p_buyer_node_id)`
- **Returns:** JSONB with tax calculation details

#### Testing Checklist
- [ ] $100 item, $20 SP → $80 taxable, correct tax calculated
- [ ] Tax disabled globally → $0 tax returned
- [ ] Tax disabled for node → $0 tax returned
- [ ] Invalid node ID → proper error returned
- [ ] Negative item price → proper error returned
- [ ] Performance target met (< 100ms)

---

### TASK TAX-003: RPC Function - Apply Tax to Transaction

**Duration:** 2 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-001, TAX-002

#### Description
Create RPC function to store tax data when a transaction completes:
- Updates `trades` table with tax information
- Creates `tax_records` entry for audit trail
- Links tax record to transaction and user
- Validates transaction exists before applying tax

#### Acceptance Criteria
- [ ] `apply_tax_to_transaction()` updates `trades.tax_amount_cents`
- [ ] Creates corresponding `tax_records` entry
- [ ] Links to correct buyer user_id and node_id
- [ ] Validates transaction exists
- [ ] Returns tax_record_id on success
- [ ] Atomic operation (both updates succeed or both fail)
- [ ] Performance: < 150ms

#### Deliverables
- **File:** `supabase/migrations/20260510000003_rpc_apply_tax.sql`
- **Function:** `apply_tax_to_transaction(p_transaction_id, p_taxable_amount_cents, p_tax_rate, p_tax_amount_cents, p_tax_jurisdiction, p_node_id)`
- **Returns:** JSONB with {success, data: {tax_record_id}}

#### Testing Checklist
- [ ] Tax applied to valid transaction
- [ ] Both `trades` and `tax_records` updated
- [ ] Invalid transaction ID → error returned
- [ ] Tax record has all required fields
- [ ] Audit trail complete

---

### TASK TAX-004: RPC Function - Refund Sales Tax

**Duration:** 3 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-002, TAX-003

#### Description
Create RPC function to handle proportional tax refunds:
- Calculates refund percentage based on refund amount vs original price
- Updates `tax_records` with refunded_tax_cents
- Updates `trades` to reflect reduced tax
- Tracks cumulative refunds (supports multiple partial refunds)

#### Acceptance Criteria
- [ ] `refund_sales_tax()` calculates proportional tax refund
- [ ] Supports multiple partial refunds
- [ ] Prevents refunding more tax than collected
- [ ] Updates both `tax_records` and `trades` tables
- [ ] Includes refund reason in audit trail
- [ ] Returns refund details with breakdown
- [ ] Performance: < 200ms

#### Deliverables
- **File:** `supabase/migrations/20260510000004_rpc_refund_tax.sql`
- **Function:** `refund_sales_tax(p_transaction_id, p_refund_amount_cents, p_refund_reason)`
- **Returns:** JSONB with refund details and cumulative tracking

#### Testing Checklist
- [ ] 50% refund → 50% of tax refunded
- [ ] Multiple refunds tracked correctly
- [ ] Cannot refund more than collected
- [ ] Refund reason stored in audit trail
- [ ] Math precision correct (no rounding errors)

---

### TASK TAX-005: RPC Function - Get Tax Summary

**Duration:** 4 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-003

#### Description
Create comprehensive tax reporting RPC function:
- Supports 7 report types (summary, transactions, refunds, jurisdictions, by_period, tax_exempt, audit_trail)
- Aggregates tax collected, refunded, net owed
- Groups by jurisdiction for multi-node reporting
- Filters by date range and optional node
- Returns data ready for admin dashboard display

#### Acceptance Criteria
- [ ] `get_tax_summary()` returns all 7 report types
- [ ] Date range filtering works correctly
- [ ] Jurisdiction breakdown groups properly
- [ ] Net tax calculation is accurate (collected - refunded)
- [ ] Audit trail limited to 1000 records for performance
- [ ] Performance: < 1 second for 30-day range
- [ ] All monetary values converted to USD correctly

#### Deliverables
- **File:** `supabase/migrations/20260510000005_rpc_tax_summary.sql`
- **Function:** `get_tax_summary(p_start_date, p_end_date, p_node_id, p_report_type)`
- **Returns:** JSONB with comprehensive tax report data

#### Testing Checklist
- [ ] Summary section includes collected/refunded/net
- [ ] Jurisdiction breakdown accurate
- [ ] Date filtering works
- [ ] Report type selector filters correctly
- [ ] Performance target met
- [ ] Empty data sets handled gracefully

---

### TASK TAX-006: RPC Function - Get Tax Export Data

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-003

#### Description
Create RPC function for CSV export:
- Returns table format (not JSONB) for easy CSV conversion
- Includes all fields required for CT DRS filing
- Joins with users/nodes for complete data
- Optimized for large date ranges

#### Acceptance Criteria
- [ ] `get_tax_export_data()` returns TABLE format
- [ ] Includes: transaction_date, buyer_email, node_name, taxable_amount, tax_rate, tax_amount, refunded_tax, net_tax
- [ ] Joins with `auth.users` for buyer_email
- [ ] Joins with `nodes` for node_name
- [ ] Date range filtering works
- [ ] Performance: < 2 seconds for 1-year data

#### Deliverables
- **File:** `supabase/migrations/20260510000006_rpc_tax_export.sql`
- **Function:** `get_tax_export_data(p_start_date, p_end_date)`
- **Returns:** TABLE (CSV-friendly format)

#### Testing Checklist
- [ ] Returns table rows (not JSON)
- [ ] All required fields present
- [ ] Decimal formatting correct (2 decimals for USD)
- [ ] Date range filtering accurate
- [ ] Performance acceptable for large datasets

---

## PHASE 3: ADMIN SITE TAX MANAGEMENT

---

### TASK TAX-007: Admin UI - Node Tax Rate Configuration

**Duration:** 6 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001 (Database Schema), Existing admin_config infrastructure

#### Description
Create admin interface for managing tax rates at the node level:
1. **Node Tax Settings Page:** View/edit tax configuration for each geographic node
2. **Bulk Tax Update:** Update multiple nodes at once (e.g., when CT changes state rate)
3. **Tax Rate History:** Track when rates change (audit trail for compliance)
4. **Global Tax Toggle:** Enable/disable tax collection globally

#### Acceptance Criteria
- [ ] Admin can view tax_rate, tax_jurisdiction, tax_enabled for each node
- [ ] Admin can edit tax rate per node with validation (0-100%)
- [ ] Changes require confirmation modal (preventing accidental updates)
- [ ] Bulk update UI for applying same rate to multiple nodes
- [ ] Tax rate change history logged (who changed, when, old/new values)
- [ ] Global tax enabled/disabled toggle synced with admin_config
- [ ] Input validation: Tax rate must be 0-100%, jurisdiction required
- [ ] Success/error notifications on save
- [ ] Loading states during API calls

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/nodes/page.tsx`
- **Components:** NodeTaxConfigPage, NodeTaxEditForm
- **API Integration:** Supabase queries to nodes table
- **UI Elements:** Table, edit modals, bulk update form, global toggle

#### Testing Checklist
- [ ] Page loads and displays all nodes
- [ ] Global tax toggle updates admin_config correctly
- [ ] Individual node tax rate can be edited
- [ ] Bulk update applies to all enabled nodes only
- [ ] Validation prevents invalid tax rates (< 0 or > 100)
- [ ] Success/error toasts display appropriately
- [ ] Loading states shown during API calls
- [ ] Tax enabled/disabled toggle works per node
- [ ] Changes persist after page refresh

---

### TASK TAX-008: Admin UI - Tax Reporting Dashboard

**Duration:** 8 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-005, TAX-006 (Tax Reporting RPCs)

#### Description
Create comprehensive tax reporting dashboard for admin site:
1. **Summary Card View:** Total tax collected, refunded, net owed (current month/year/all-time)
2. **Jurisdiction Breakdown:** Tax by node/jurisdiction with drill-down
3. **Date Range Filter:** Custom date range selector for reports
4. **7 Report Types:** All CT DRS filing requirements (summary, transactions, refunds, jurisdictions, by-period, tax-exempt, audit trail)
5. **CSV Export:** Download tax data for CT DRS filing

#### Acceptance Criteria
- [ ] Dashboard displays tax summary (collected, refunded, net owed)
- [ ] Date range picker with presets (This Month, Last Month, Q1-Q4, YTD, All Time)
- [ ] Jurisdiction breakdown table with amounts per node
- [ ] Transaction count and average tax per transaction
- [ ] All 7 report types accessible (tabs or dropdown selector)
- [ ] CSV export button downloads data in CT DRS format
- [ ] Charts/visualizations for tax trends over time
- [ ] Performance: Load time < 2 seconds for 1-year data
- [ ] Responsive design for mobile admin access

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/reports/page.tsx`
- **Components:** TaxReportsPage, SummaryCards, JurisdictionTable, DateRangePicker, CSVExportButton
- **API Integration:** Calls get_tax_summary and get_tax_export_data RPCs
- **UI Elements:** Summary cards, data table, date picker, export button

#### Testing Checklist
- [ ] Dashboard loads tax summary correctly
- [ ] Date preset selector updates data
- [ ] All 4 summary cards display correct totals
- [ ] Jurisdiction breakdown table populated
- [ ] CSV export downloads with correct data
- [ ] Report type selector filters data
- [ ] Loading states shown during fetch
- [ ] Error handling displays toast notifications
- [ ] Responsive design works on mobile
- [ ] Performance: < 2s load time for 1-year data

---

### TASK TAX-009: Admin UI - Global Tax Settings

**Duration:** 3 hours  
**Priority:** Medium (P2)  
**Dependencies:** TAX-001 (Database Schema)

#### Description
Create dedicated admin page for global tax configuration:
- Global tax enabled/disabled toggle
- Default tax rate configuration (fallback when node missing rate)
- Subscription fee taxable toggle
- Tax remittance jurisdiction setting
- Integrates with existing admin_config UI patterns

#### Acceptance Criteria
- [ ] Page displays all tax-related admin_config entries
- [ ] Toggle for sales_tax_enabled (global on/off)
- [ ] Input for default_sales_tax_rate with validation
- [ ] Toggle for subscription_fee_taxable
- [ ] Input for tax_remittance_jurisdiction
- [ ] Changes saved to admin_config table
- [ ] Warning banner when tax disabled globally
- [ ] Success/error notifications
- [ ] Audit log of config changes

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/settings/page.tsx`
- **Components:** TaxSettingsPage, ConfigToggle, ConfigInput
- **API Integration:** admin_config table queries
- **UI Elements:** Toggles, inputs, save button, warning banners

#### Testing Checklist
- [ ] All tax config settings displayed
- [ ] Toggles update admin_config
- [ ] Default rate validation (0-100%)
- [ ] Jurisdiction input saves correctly
- [ ] Warning shown when tax disabled
- [ ] Changes persist after refresh
- [ ] Audit trail logged

---

## PHASE 4: MOBILE APP INTEGRATION

---

### TASK TAX-010: Mobile Hook - useTaxCalculation

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-002 (Calculate Tax RPC)

#### Description
Create React hook for tax calculation in mobile app:
- Calls `calculate_sales_tax` RPC function
- Debounced recalculation (300ms) as SP slider changes
- Handles loading, error, and disabled states
- Caches node tax rate for performance
- Returns structured tax data for UI display

#### Acceptance Criteria
- [ ] Hook accepts item_price, swap_points, node_id
- [ ] Calls calculate_sales_tax RPC with debounce (300ms)
- [ ] Returns: {taxableAmount, taxAmount, taxRate, jurisdiction, loading, error}
- [ ] Handles tax-disabled scenarios (returns $0)
- [ ] Error handling with retry capability
- [ ] TypeScript types for all inputs/outputs
- [ ] Unit tests for hook logic

#### Deliverables
- **File:** `p2p-kids-marketplace/src/hooks/useTaxCalculation.ts`
- **Hook:** `useTaxCalculation(itemPrice, swapPoints, nodeId)`
- **Types:** TaxCalculationResult, TaxCalculationError
- **Tests:** `src/__tests__/hooks/useTaxCalculation.test.ts`

#### Testing Checklist
- [ ] Hook calculates tax correctly
- [ ] Debounce prevents excessive RPC calls
- [ ] Loading state accurate
- [ ] Error state handled gracefully
- [ ] Tax-disabled returns $0 without error
- [ ] TypeScript compile clean
- [ ] Unit tests pass

---

### TASK TAX-011: Mobile UI - Checkout Tax Display

**Duration:** 5 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-010 (useTaxCalculation hook)

#### Description
Update checkout screen to display sales tax:
- Add tax breakdown section below SP slider
- Real-time tax updates as SP amount changes
- Display: Item Price → SP Discount → Subtotal → Tax → Platform Fee → Total
- Kid-friendly labels ("Sales Tax" not "CT State Tax")
- Integrate with existing fee calculation
- Show tax-exempt indicator if applicable

#### Acceptance Criteria
- [ ] Tax breakdown section added to CheckoutScreen
- [ ] Real-time tax recalculation as SP changes
- [ ] Breakdown shows: Item Price, SP Discount, Subtotal, Tax, Platform Fee, Total
- [ ] Kid-friendly label: "Sales Tax" used
- [ ] Tax updates within 300ms of SP change (debounced)
- [ ] Tax-exempt users see "Tax Free" badge
- [ ] Loading state during tax calculation
- [ ] Error handling if tax calculation fails

#### Deliverables
- **File:** `p2p-kids-marketplace/src/screens/trade/CheckoutScreen.tsx`
- **Components:** TaxBreakdownSection, TaxLineItem
- **Hooks Used:** useTaxCalculation, existing fee hooks
- **UI Elements:** Breakdown card, line items, badges

#### Testing Checklist
- [ ] Tax breakdown renders correctly
- [ ] SP slider change triggers tax recalc
- [ ] All breakdown items display
- [ ] Labels are kid-friendly
- [ ] Tax-exempt badge shows when applicable
- [ ] Loading indicator during calculation
- [ ] Error state displays user-friendly message
- [ ] Visual design matches design system

---

### TASK TAX-012: Mobile UI - Transaction History Tax Details

**Duration:** 3 hours  
**Priority:** Medium (P2)  
**Dependencies:** TAX-003 (Apply Tax RPC)

#### Description
Add tax information to transaction history:
- Show tax amount in transaction list items
- Create tax breakdown detail view (modal/sheet)
- Display: taxable amount, tax rate, tax jurisdiction, refunds
- Link to full transaction details

#### Acceptance Criteria
- [ ] Transaction list shows tax amount per transaction
- [ ] "View Tax Details" button/link available
- [ ] Tax detail modal shows: taxable_amount, tax_rate, jurisdiction, refunds
- [ ] Refunded tax shown separately (if applicable)
- [ ] Net tax displayed (collected - refunded)
- [ ] Tax rate formatted as percentage (e.g., "6.35%")
- [ ] All amounts formatted as USD

#### Deliverables
- **File:** `p2p-kids-marketplace/src/screens/trade/TransactionHistoryScreen.tsx`
- **Components:** TaxDetailModal, TaxLineItem
- **Queries:** Fetch tax_records for transaction
- **UI Elements:** Modal, breakdown table, badges

#### Testing Checklist
- [ ] Tax amount shown in transaction list
- [ ] Tax detail modal opens correctly
- [ ] All tax fields displayed
- [ ] Refund tracking accurate
- [ ] Formatting consistent (USD, percentages)
- [ ] Modal dismisses properly

---

### TASK TAX-013: Mobile Service - Tax Integration

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-002, TAX-003, TAX-010

#### Description
Create tax service layer for mobile app:
- Wrapper functions for all tax RPCs
- Integration with existing transaction service
- Call `apply_tax_to_transaction` when trade completes
- Error handling and retry logic
- TypeScript types for all tax operations

#### Acceptance Criteria
- [ ] Tax service created with methods: calculateTax, applyTax, getTaxSummary
- [ ] Integrated into transaction creation flow
- [ ] Tax applied automatically when transaction completes
- [ ] Error handling with structured error types
- [ ] Retry logic for network failures
- [ ] TypeScript types for all inputs/outputs
- [ ] Unit tests for service methods

#### Deliverables
- **File:** `p2p-kids-marketplace/src/services/tax.ts`
- **Methods:** calculateTax, applyTax, getTaxSummary, refundTax
- **Types:** TaxCalculation, TaxRecord, TaxSummary
- **Tests:** `src/__tests__/services/tax.test.ts`

#### Testing Checklist
- [ ] Service methods call correct RPCs
- [ ] Transaction integration works
- [ ] Tax applied on transaction completion
- [ ] Error handling robust
- [ ] Retry logic prevents data loss
- [ ] TypeScript compile clean
- [ ] Unit tests pass

---

## PHASE 5: TESTING & VALIDATION

---

### TASK TAX-014: End-to-End Tax Flow Testing

**Duration:** 6 hours  
**Priority:** High (P1)  
**Dependencies:** All previous tasks

#### Description
Create comprehensive end-to-end tests for tax flows:
- Unit tests for all RPC functions
- Integration tests for mobile hooks/services
- E2E tests for complete tax scenarios
- Smoke test script for manual validation
- Test data fixtures for all scenarios

#### Acceptance Criteria
- [ ] Unit tests for all 5 RPC functions (TAX-002 to TAX-006)
- [ ] Integration tests for mobile tax hook
- [ ] E2E tests covering 9 key scenarios (see below)
- [ ] Smoke test script executable via npm/yarn
- [ ] Test fixtures for users, nodes, items, transactions
- [ ] All tests pass in CI/CD pipeline
- [ ] Test coverage > 80% for tax-related code

#### Test Scenarios
1. **Purchase with 0% SP** → full tax on item price
2. **Purchase with 50% SP** → tax on discounted amount  
3. **Tax disabled globally** → $0 tax collected
4. **Tax disabled for node** → $0 tax for that node
5. **Partial refund** → proportional tax refunded
6. **Full refund** → full tax refunded
7. **Multiple refunds** → cumulative tracking works
8. **Admin changes tax rate** → new transactions use new rate
9. **CSV export** → data matches expectations

#### Deliverables
- **File:** `p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts`
- **Smoke Script:** `scripts/smoke/tax-flow.mjs`
- **Test Fixtures:** `src/test-data/tax-fixtures.ts`
- **Documentation:** `TESTING-TAX-FLOWS.md`

#### Testing Checklist
- [ ] All 9 scenarios pass
- [ ] Unit tests cover edge cases
- [ ] Integration tests stable
- [ ] Smoke script runs successfully
- [ ] Test data fixtures complete
- [ ] CI/CD integration verified
- [ ] Documentation updated

---

## ✅ MODULE-15.3 COMPLETE

**Total Deliverables:**
- 1 Database migration (3 tables, 6 functions, RLS policies)
- 5 RPC functions (calculate, apply, refund, summary, export)
- 3 Admin pages (node config, reporting, settings)
- 4 Mobile integrations (hook, checkout UI, history UI, service)
- 1 Comprehensive test suite

**Files Created/Modified:**
- 6 SQL migration files
- 3 Admin pages (Next.js/TypeScript)
- 4 Mobile files (React Native/TypeScript)
- 5 Test files (Jest/React Native Testing Library)

**Database Objects:**
- 3 tables modified (nodes, trades, admin_config)
- 1 table created (tax_records)
- 6 RPC functions
- 12+ indexes
- 10+ RLS policies

---

## AGENT EXECUTION NOTES

### Recommended Order
1. **TAX-001** (Database) - Foundation for everything
2. **TAX-002, TAX-003, TAX-004** (Core RPCs) - Tax calculation logic
3. **TAX-005, TAX-006** (Reporting RPCs) - Admin reporting
4. **TAX-007, TAX-008, TAX-009** (Admin UI) - Admin configuration
5. **TAX-010, TAX-013** (Mobile services) - Mobile backend
6. **TAX-011, TAX-012** (Mobile UI) - Mobile frontend
7. **TAX-014** (Testing) - Validation

### Dependencies Graph
```
TAX-001 (Database)
    ├─> TAX-002 (Calculate RPC)
    │       ├─> TAX-003 (Apply RPC)
    │       │       ├─> TAX-004 (Refund RPC)
    │       │       ├─> TAX-005 (Summary RPC)
    │       │       ├─> TAX-006 (Export RPC)
    │       │       └─> TAX-007, TAX-008, TAX-009 (Admin UI)
    │       └─> TAX-010 (Mobile Hook)
    │               ├─> TAX-011 (Checkout UI)
    │               ├─> TAX-012 (History UI)
    │               └─> TAX-013 (Mobile Service)
    └─> TAX-014 (Testing - depends on all)
```

### Performance Targets
- Database queries: < 200ms
- RPC functions: < 500ms
- Admin page load: < 2s
- Mobile tax calculation: < 300ms (debounced)
- CSV export (1 year): < 5s

### Error Handling Standards
All RPC functions must return:
```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

**END OF MODULE-15.3: SALES TAX ENGINE**
