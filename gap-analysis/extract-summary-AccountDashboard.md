# Candidate Extraction Summary — Account/Dashboard/Help/Legal

**Phase 2.2d (continued)** | **14 files processed**

## Breakdown

| Domain | Files | Notes |
|---|---|---|
| Help & Education | 4 | FLOW-19, EDU-005/006/008/009 |
| Cart & Bundling UI | 1 | FLOW-07 (actually maps to TradeFlowV2!) |
| PROD build gates | 5 | PROD-006/007/008/009/011 — mostly not manual tests |
| Safety/Legal | 2 | PROD-P001-P005, PROD-P003-P004 |
| Settings/Legal UI | 1 | FLOW-25 |

## Key Findings

1. **MODULE-15.1-FLOW-07 (Cart UI) maps to TradeFlowV2, not Account** — cross-canonical issue
2. **PROD-006/007/008 are build gates** (noImplicitAny, ESLint, test suite green) — not manual test cases
3. **PROD-009 is app store metadata** — not manual test cases
4. **PROD-011 is Android data safety** — limited manual testing value
5. **EDU-008/009 are admin-facing** — may map better to Admin Portal canonical

## Cross-canonical re-assignments
- FLOW-07 (Cart UI) → TradeFlowV2
- EDU-008/009 (Admin education) → Admin Portal
- SAFETY-010/011/012 (TOS/Privacy/Liability) → Account/Dashboard/Help/Legal
