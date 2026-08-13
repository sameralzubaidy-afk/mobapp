# Candidate Extraction Summary — TradeFlowV2 Group

**Phase 2.2a** | **12 files processed**

## File Inventory

| # | File | ~Lines | Test Cases | Topic |
|---|---|---|---|---|
| 1 | `MODULE-15.1.2-TradeFlowV2-COMPLETE-MANUAL-TESTING.md` | ~1100 | ~50+ | Full TFV2 pre-canonical testing (migrations, triggers, UI components, screens, flows) |
| 2 | `MODULE-15.1.2-TradeFlowV2-DEFERRED-MANUAL-TESTING.md` | ~50 | ~5 | Deferred features (platform SP for cash-only, donate listings) |
| 3 | `MODULE-15.1.2-FLOW-TradeFlowV2-08-MANUAL-TESTING.md` | ~80 | 7 | FLOW-08 offer expiry countdown, auto-complete reminders |
| 4 | `MODULE-15.2-MANUAL-TEST-CASES.md` | ~200 | 20 | Cart system (add/remove, min value, max carts, expiry) |
| 5 | `MODULE-15.3-PART3-TAX-MANUAL-TEST-CASES.md` | ~150 | 14 | Sales tax engine (calculation, rounding, per-node rates) |
| 6 | `TAX-TESTING-CONSOLIDATED.md` | ~300 | ~25 | Tax testing consolidation — architecture, Stripe reconciliation |
| 7 | `TRADE-V2-002-MANUAL-TESTING.md` | ~80 | ~8 | Trade initiation with subscription & SP context |
| 8 | `TRADE-V2-010-MANUAL-TEST-GUIDE.md` | ~100 | ~10 | Trade flow finalization — comprehensive testing |
| 9 | `TASK-FLOW-08-MANUAL-TESTING.md` | ~100 | ~6 | Trade Flow UI redesign |
| 10 | `docs/manual-test-cases-module-06.md` | ~230 | ~15 | Trade Lifecycle V2 (initiation, state transitions, SP integration) |
| 11 | `docs/TRADE-V2-007-MANUAL-TEST.md` | ~95 | ~5 | Mid-trade subscription changes |
| 12 | `.docs/PAY-006-MANUAL-TESTS.md` | ~120 | ~8 | Payout router + trade completion trigger |

## Key Findings

1. **COMPLETE file is a pre-canonical superset** — covers 50+ DB-level and UI test cases most likely already merged into canonical
2. **DEFERRED file** — features not yet implemented, should NOT be merged
3. **TAX-TESTING-CONSOLIDATED.md** — appears to be a focused extract that was merged into canonical Groups O-1/O-2/O-3 (which are missing from the canonical index!)
4. **MODULE-15.2/15.3** — Cart & Tax granular files likely covered by canonical Groups M/N/O/P
