# MODULE 15.3 — TASK MANIFEST VERIFICATION CHECKLIST

**Module:** Sales Tax Engine — 14-Task Manifest Cross-Check  
**Version:** 1.0  
**Spec Source:** `Prompts/MODULE-15.3-TASK-MANIFEST.md`  
**Companion Docs:** `MODULE-15.3-sales-tax-engine.md`, `MODULE-15.3-PART3-TASKS-RESTRUCTURED.md`  
**Purpose:** Verify that every task listed in the manifest is accounted for, properly scoped, and fully delivered

---

## PURPOSE

The `MODULE-15.3-TASK-MANIFEST.md` is the **authoritative task registry** for the Sales Tax Engine. This verification file ensures:
1. All 14 tasks in the manifest are fully implemented (no skipped tasks)
2. Each task's declared deliverables match what was actually built
3. Phase sequencing is respected (no phase 4 before phase 2 is complete)
4. Priority levels (P0/P1/P2) are honored — all P0s before any P1, all P1s before any P2
5. Estimated duration vs actual duration is captured for planning accuracy

---

## MANIFEST COMPLETENESS CHECK

Verify every task from the manifest is present and accounted for:

| Task ID | Task Name | Priority | Est. Hours | Deliverable File | Status |
|---------|-----------|----------|-----------|-----------------|--------|
| TAX-001 | Database Schema Migration | P0 | 4h | `supabase/migrations/20260510000001_sales_tax_schema.sql` | ⬜ |
| TAX-002 | RPC — Calculate Sales Tax | P0 | 3h | `supabase/migrations/20260510000002_rpc_calculate_tax.sql` | ⬜ |
| TAX-003 | RPC — Apply Tax to Transaction | P0 | 2h | `supabase/migrations/20260510000003_rpc_apply_tax.sql` | ⬜ |
| TAX-004 | RPC — Refund Sales Tax | P1 | 3h | `supabase/migrations/20260510000004_rpc_refund_tax.sql` | ⬜ |
| TAX-005 | RPC — Get Tax Summary | P1 | 4h | `supabase/migrations/20260510000005_rpc_tax_summary.sql` | ⬜ |
| TAX-006 | RPC — Get Tax Export Data | P1 | 2h | `supabase/migrations/20260510000006_rpc_tax_export.sql` | ⬜ |
| TAX-007 | Admin UI — Node Tax Rate Config | P1 | 6h | `p2p-kids-admin/src/app/tax/nodes/page.tsx` | ⬜ |
| TAX-008 | Admin UI — Tax Reporting Dashboard | P1 | 8h | `p2p-kids-admin/src/app/tax/reports/page.tsx` | ⬜ |
| TAX-009 | Admin UI — Global Tax Settings | P2 | 3h | `p2p-kids-admin/src/app/tax/settings/page.tsx` | ⬜ |
| TAX-010 | Mobile Hook — useTaxCalculation | P0 | 4h | `src/hooks/useTaxCalculation.ts` | ⬜ |
| TAX-011 | Mobile UI — Checkout Tax Display | P0 | 5h | `src/screens/trade/CheckoutScreen.tsx` (updated) | ⬜ |
| TAX-012 | Mobile UI — Transaction History Tax | P2 | 3h | `src/screens/trade/TransactionHistoryScreen.tsx` (updated) | ⬜ |
| TAX-013 | Mobile Service — Tax Integration | P0 | 4h | `src/services/tax.ts` | ⬜ |
| TAX-014 | End-to-End Tax Flow Testing | P1 | 6h | `src/__tests__/tax-e2e.test.ts` + `scripts/smoke/tax-flow.mjs` | ⬜ |

**Manifest Totals:**
- Total Tasks: 14 ✓
- Total Estimated Hours: 57h ✓
- P0 Tasks (critical blockers): 5 (TAX-001, 002, 003, 010, 011, 013 — note TAX-013 is P0 per manifest)
- P1 Tasks (high priority): 6 (TAX-004, 005, 006, 007, 008, 014)
- P2 Tasks (standard): 2 (TAX-009, 012)

---

## PHASE COMPLETION GATES

### Phase 1 Gate: Database Foundation Complete
All items must be ✅ before proceeding to Phase 2:
- [ ] TAX-001 migration applied and verified
- [ ] `tax_records` table exists with RLS enabled
- [ ] `nodes`, `trades`, `admin_config` columns added
- [ ] `get_node_tax_rate()` helper function deployed

### Phase 2 Gate: RPC Functions Complete
All P0 RPCs must be ✅ before proceeding to Phase 4 (Mobile):
- [ ] TAX-002 `calculate_sales_tax` deployed and tested
- [ ] TAX-003 `apply_tax_to_transaction` deployed and tested
- [ ] TAX-004 `refund_sales_tax` deployed (can proceed to Phase 3 in parallel)
- [ ] TAX-005 `get_tax_summary` deployed (can proceed to Phase 3 in parallel)
- [ ] TAX-006 `get_tax_export_data` deployed (can proceed to Phase 3 in parallel)

### Phase 3 Gate: Admin Site Complete
All items must be ✅ before declaring admin complete:
- [ ] TAX-007 node tax rate config page working end-to-end
- [ ] TAX-008 reporting dashboard with CSV export working
- [ ] TAX-009 global settings page working (P2 — can defer if needed)

### Phase 4 Gate: Mobile Integration Complete
All P0 mobile tasks must be ✅ before Phase 5:
- [ ] TAX-010 `useTaxCalculation` hook implemented and debounced
- [ ] TAX-011 checkout tax display live and updating
- [ ] TAX-013 tax service functions integrated with trade completion

### Phase 5 Gate: Testing Complete (Module Sign-off)
- [ ] TAX-014 all 9 E2E scenarios pass
- [ ] Smoke test script runs clean
- [ ] No regressions in existing trade flow tests

---

## DELIVERABLE FILE EXISTENCE CHECK

Run these file system checks to confirm all deliverables are present:

```bash
# Phase 1 - Database
ls supabase/migrations/20260510000001_sales_tax_schema.sql

# Phase 2 - RPC Functions
ls supabase/migrations/20260510000002_rpc_calculate_tax.sql
ls supabase/migrations/20260510000003_rpc_apply_tax.sql
ls supabase/migrations/20260510000004_rpc_refund_tax.sql
ls supabase/migrations/20260510000005_rpc_tax_summary.sql
ls supabase/migrations/20260510000006_rpc_tax_export.sql

# Phase 3 - Admin Site
ls p2p-kids-admin/src/app/tax/nodes/page.tsx
ls p2p-kids-admin/src/app/tax/reports/page.tsx
ls p2p-kids-admin/src/app/tax/settings/page.tsx

# Phase 4 - Mobile
ls p2p-kids-marketplace/src/hooks/useTaxCalculation.ts
ls p2p-kids-marketplace/src/services/tax.ts
# (CheckoutScreen.tsx and TransactionHistoryScreen.tsx are modifications, not new files)

# Phase 5 - Tests
ls p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts
ls scripts/smoke/tax-flow.mjs
```

- [ ] All 14 deliverable files/modifications exist
- [ ] No deliverable file is empty or a placeholder stub

---

## SCOPE VERIFICATION

Verify the manifest scope matches the implementation — no scope creep and no missing scope:

### In Scope (must be implemented)
- [ ] Connecticut 6.35% tax rate only (MVP — no multi-state logic)
- [ ] In-person pickup transactions only (no shipping tax logic)
- [ ] Destination-based tax (buyer's node only)
- [ ] Swap points as promotional discount reducing taxable base
- [ ] Manual CSV export for CT DRS filing (no auto-remittance in MVP)

### Out of Scope (must NOT be implemented in this module)
- [ ] Automatic tax remittance to Connecticut DRS ← NOT built (manual process)
- [ ] Multi-state tax logic ← NOT built (future expansion)
- [ ] Shipping/delivery tax ← NOT applicable (in-person only)
- [ ] Tax on platform subscription fees ← NOT built (non-taxable per CT law, admin toggle for future)
- [ ] Real-time tax API integrations (TaxJar, Avalara) ← NOT built (flat rate only)

---

## INTEGRATION POINTS VERIFICATION

The manifest specifies these cross-module integrations — verify each is wired:

| Integration Point | From | To | Verified |
|---|---|---|---|
| Tax calculated at checkout | `CheckoutScreen.tsx` | `calculate_sales_tax` RPC | ⬜ |
| Tax applied at trade completion | `completeTradeV2()` or `complete-trade` EF | `apply_tax_to_transaction` RPC | ⬜ |
| Tax refunded at dispute resolution | Dispute resolution flow | `refund_sales_tax` RPC | ⬜ |
| Tax reporting in admin dashboard | `reports/page.tsx` | `get_tax_summary` RPC | ⬜ |
| CSV export for CT DRS | Admin UI button | `get_tax_export_data` RPC | ⬜ |
| Node tax rate read by checkout | `calculate_sales_tax` | `nodes.tax_rate` column | ⬜ |

---

## PRIORITY SEQUENCING AUDIT

Confirm that implementation followed the priority order specified in the manifest:

### P0 Tasks First (must all be done before P1s shipped to production)
- [ ] TAX-001 — DB Schema: ✅/⬜
- [ ] TAX-002 — Calculate Tax RPC: ✅/⬜
- [ ] TAX-003 — Apply Tax RPC: ✅/⬜
- [ ] TAX-010 — useTaxCalculation hook: ✅/⬜
- [ ] TAX-011 — Checkout Tax Display: ✅/⬜
- [ ] TAX-013 — Tax Service: ✅/⬜

**P0 Gate:** [ ] All 6 P0 tasks complete before P1 tasks shipped

### P1 Tasks (must all be done before P2s)
- [ ] TAX-004 — Refund Tax RPC: ✅/⬜
- [ ] TAX-005 — Tax Summary RPC: ✅/⬜
- [ ] TAX-006 — Tax Export RPC: ✅/⬜
- [ ] TAX-007 — Admin Node Tax Config: ✅/⬜
- [ ] TAX-008 — Admin Reports Dashboard: ✅/⬜
- [ ] TAX-014 — E2E Testing: ✅/⬜

**P1 Gate:** [ ] All 6 P1 tasks complete before P2 tasks shipped

### P2 Tasks (can be deferred to post-launch patch)
- [ ] TAX-009 — Admin Global Settings: ✅/⬜
- [ ] TAX-012 — Transaction History Tax: ✅/⬜

---

## DURATION ACCURACY LOG

Track actual vs. estimated hours to improve future planning:

| Task | Estimated | Actual | Delta | Notes |
|------|-----------|--------|-------|-------|
| TAX-001 | 4h | | | |
| TAX-002 | 3h | | | |
| TAX-003 | 2h | | | |
| TAX-004 | 3h | | | |
| TAX-005 | 4h | | | |
| TAX-006 | 2h | | | |
| TAX-007 | 6h | | | |
| TAX-008 | 8h | | | |
| TAX-009 | 3h | | | |
| TAX-010 | 4h | | | |
| TAX-011 | 5h | | | |
| TAX-012 | 3h | | | |
| TAX-013 | 4h | | | |
| TAX-014 | 6h | | | |
| **TOTAL** | **57h** | | | |

---

## FINAL MANIFEST SIGN-OFF

- [ ] All 14 tasks from the manifest are implemented
- [ ] All deliverable files exist (file existence check passed)
- [ ] No out-of-scope features were added
- [ ] All in-scope requirements are present
- [ ] Phase gates passed in order (1 → 2 → 3 → 4 → 5)
- [ ] P0 tasks deployed before P1; P1 before P2
- [ ] Integration points verified end-to-end

**Signed off by:** _________________ **Date:** _________________
