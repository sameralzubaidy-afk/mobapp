# Candidate Extraction Summary — Admin Portal Group

**Phase 2.2a** | **17 files processed**

## File Inventory

| # | File | ~Lines | Test Cases | Topic |
|---|---|---|---|---|
| 1 | `ADMIN-V2-005-REVENUE-ANALYTICS-MANUAL-TESTING.md` | ~340 | 20 | Revenue analytics dashboard (RPCs, metrics, charts, filters) |
| 2 | `ADMIN-V2-006-MANUAL-TESTING-GUIDE.md` | ~520 | ~25 | User management dashboard (list, search, filter, suspend) |
| 3 | `ADMIN-V2-007-MANUAL-TESTING-GUIDE.md` | ~80 | ~8 | Admin panel UI theme & layout redesign |
| 4 | `ADMIN-V3-001-MANUAL-TESTING-GUIDE.md` | ~100 | ~8 | Category schema migrations (DB verification) |
| 5 | `ADMIN-V3-002-MANUAL-TESTING-GUIDE.md` | ~60 | ~4 | Shared TypeScript types (type-checking, no UI) |
| 6 | `ADMIN-V3-004-MANUAL-TESTING-GUIDE.md` | ~150 | ~12 | Category management page (CRUD, DnD reordering) |
| 7 | `ADMIN-V3-005-MANUAL-TESTING-GUIDE.md` | ~80 | ~6 | Category suggestions queue (approve/reject/merge) |
| 8 | `ADMIN-V3-006-MANUAL-TESTING-GUIDE.md` | ~80 | ~6 | SP Analytics dashboard |
| 9 | `ADMIN-V3-007-MANUAL-TESTING-GUIDE.md` | ~80 | ~5 | Mobile integration (bonus badges, category wiring) |
| 10 | `ADMIN-V3-009-MANUAL-TESTING-GUIDE.md` | ~100 | ~8 | Dynamic category management + SP config |
| 11 | `PAY-008-MANUAL-TEST-CASES.md` | ~150 | ~12 | Seller earnings & admin payouts views |
| 12 | `PROD-010-MANUAL-TC.md` | ~75 | ~6 | Admin auth consolidation (verifyAdminAuth middleware) |
| 13 | `ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md` | ~220 | 25 | SP Wallet admin ops (wallet list, detail, adjustments, freeze) |
| 14 | `SP-ECONOMY-HUB-MANUAL-TEST-CASES.md` | ~130 | ~10 | SP Economy Hub admin (sidebar, KPIs, health thresholds) |
| 15 | `SUB-011-verification.md` | ~140 | ~8 | Admin subscription management (MRR, churn, metrics) |
| 16 | `SUB-015-verification.md` | ~170 | ~10 | Stripe Payment Sheet integration |
| 17 | `MANUAL-TEST-WAITLIST-PAGE.md` | ~130 | ~8 | Admin waitlist page |

## Key Findings

1. **SUB-015 is primarily subscription/payment flow** — may map better to Subscriptions/Payouts canonical
2. **ADMIN-V2-003 SP Wallet** has 25 test cases with detailed wallet state enforcement — may contain coverage not in canonical Group L
3. **SUB-011** is admin subscription analytics — overlaps with canonical Group M
4. **ADMIN-V3-002** is TypeScript types only — not manual test cases, can be skipped
