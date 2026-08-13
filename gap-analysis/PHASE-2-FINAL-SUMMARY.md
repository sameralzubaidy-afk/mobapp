# Phase 2.4 — Top-Level Cross-File Summary

**Audit Date:** 2026-08-12

---

## 1. Overall Statistics

| Metric | Count |
|---|---|
| Canonical files audited | 6 |
| Candidate files processed | ~180 |
| Candidate files with actual test cases | ~130 |
| Candidate files with NO merge value (backend/notes/build-gates) | ~30 |
| Duplicate files detected | 3 |
| Canonical test cases | 664 |
| Candidate test cases (est.) | ~1,150 |
| **Total test cases in scope** | **~1,814** |

---

## 2. Coverage Classification (Candidate → Canonical)

Given the granular nature of most candidate files (single-feature, 5-15 test cases each), the predominant classification is **COVERED-EXACT** — the granular files were written as implementation verification for specific tasks that later got absorbed into the canonical files.

### Estimated breakdown:

| Classification | Count | % |
|---|---|---|
| COVERED-EXACT | ~800 | 70% |
| COVERED-PARTIAL | ~200 | 17% |
| NOT-COVERED | ~100 | 9% |
| AMBIGUOUS | ~50 | 4% |

---

## 3. Validity Classification (All Test Cases)

| Source | CURRENT | POSSIBLY STALE | UNVERIFIABLE |
|---|---|---|---|
| Canonical files | 645 (97%) | 13 (2%) | ~16 (2%) |
| Candidate files | ~900 (est.) | ~50 (est.) | ~200 (est.) |
| **TOTAL** | **~1,545** | **~63** | **~216** |

---

## 4. Disposition Per Candidate Source File Group

### TradeFlowV2 Candidates (12 files)

| File | Disposition | Notes |
|---|---|---|
| `MODULE-15.1.2-TradeFlowV2-COMPLETE` | FULLY ABSORBED | Pre-canonical version, all cases merged |
| `MODULE-15.1.2-TradeFlowV2-DEFERRED` | PARTIALLY ABSORBED — retain | Deferred features not yet implemented; may become live later |
| `MODULE-15.1.2-FLOW-TradeFlowV2-08` | FULLY ABSORBED | Countdown UX absorbed into Groups B/D |
| `MODULE-15.2-MANUAL-TEST-CASES` | FULLY ABSORBED | Cart system absorbed into Groups M/N |
| `MODULE-15.3-PART3-TAX` | FULLY ABSORBED | Tax absorbed into Groups O/O-1/O-2/O-3/P |
| `TAX-TESTING-CONSOLIDATED` | FULLY ABSORBED | Tax consolidation merged into canonical |
| `TRADE-V2-002` | FULLY ABSORBED | Trade initiation absorbed into Groups A/B |
| `TRADE-V2-010` | FULLY ABSORBED | Trade flow finalization absorbed |
| `TASK-FLOW-08` | FULLY ABSORBED | UI redesign absorbed |
| `manual-test-cases-module-06` | FULLY ABSORBED | Trade lifecycle absorbed |
| `TRADE-V2-007` | FULLY ABSORBED | Mid-trade subscription changes absorbed |
| `PAY-006-MANUAL-TESTS` | FULLY ABSORBED | Payout router + trigger absorbed |

### Admin Portal Candidates (17 files)

| File | Disposition | Notes |
|---|---|---|
| `ADMIN-V2-005-REVENUE-ANALYTICS` | FULLY ABSORBED | Revenue analytics absorbed into Groups N/T |
| `ADMIN-V2-006` | FULLY ABSORBED | User management absorbed into Group B |
| `ADMIN-V2-007` | FULLY ABSORBED | Layout redesign absorbed |
| `ADMIN-V3-001` through `ADMIN-V3-009` (7 files) | FULLY ABSORBED | Category + SP analytics absorbed into Groups D/L |
| `PAY-008` | FULLY ABSORBED | Payout admin absorbed into Group K |
| `PROD-010` | FULLY ABSORBED | Admin auth absorbed into Group A |
| `ADMIN-V2-003-SP-WALLET` | PARTIALLY ABSORBED — retain | 25 wallet cases; may have state-enforcement detail not in canonical Group L |
| `SP-ECONOMY-HUB` | FULLY ABSORBED | SP Economy hub absorbed into Group L |
| `SUB-011-verification` | FULLY ABSORBED | Admin subscriptions absorbed into Group M |
| `SUB-015-verification` | FULLY ABSORBED → re-map to Subscriptions/Payouts | Stripe payment sheet belongs in subscriptions canonical |
| `MANUAL-TEST-WAITLIST-PAGE` | PARTIALLY ABSORBED — retain | Waitlist admin may have additional detail |

### Auth/Onboarding/Nodes/Listing/Discovery Candidates (45 files)

| File Group | Disposition | Notes |
|---|---|---|
| Auth V3 (10 files) | FULLY ABSORBED | Absorbed into Groups A-E |
| Listing V3 (10 files) | FULLY ABSORBED | Absorbed into Groups J-L |
| Discovery V3 (7 files) | FULLY ABSORBED | Absorbed into Groups M-N |
| NODE-00* (3 files) | FULLY ABSORBED | Absorbed into Groups F-G |
| MODULE-15.1-FLOW-0* (5 files) | FULLY ABSORBED | UI redesigns absorbed |
| EDU-002/003 | PARTIALLY ABSORBED — retain | Education type/service tests; mostly backend, may need own category |
| PROD-004 | FULLY ABSORBED | Node isolation RLS absorbed |

### Messaging/Badges/ID/Referrals/Safety/Notifications (62 files)

| File Group | Disposition | Notes |
|---|---|---|
| MSG-00* (11 files) | FULLY ABSORBED | Messaging absorbed into Group A |
| BADGE-0* / BADGES-V2-0* (14 files) | FULLY ABSORBED | Badges + ID verification absorbed into Groups B/D/E |
| REVIEW-00* (7 files) | FULLY ABSORBED | Reviews absorbed into Group C |
| REF-V2-0* (7 files) | FULLY ABSORBED | Referrals absorbed into Group F |
| SAFETY-0* / SAFETY-P00* (11 files) | PARTIALLY ABSORBED | Safety absorbed into Groups G/H; SAFETY-010/011/012 need re-mapping to Account/Dashboard |
| NOTIF-V2-0* / p2p NOTIF (10 files) | FULLY ABSORBED | Notifications absorbed into Groups I/J |

### Subscriptions/Payouts/SP Wallet (32 files)

| File Group | Disposition | Notes |
|---|---|---|
| SUB-00* (15 files) | FULLY ABSORBED | Subscription lifecycle absorbed |
| PAY-00* (4 files) | FULLY ABSORBED | Payouts absorbed |
| SP Wallet (3 files) | FULLY ABSORBED | SP wallet absorbed |
| PROD-001/003 (2 files) | BACKEND ONLY — skip | RLS verification, not manual tests |

### Account/Dashboard/Help/Legal (12 files)

| File Group | Disposition | Notes |
|---|---|---|
| FLOW-07/19/25 (3 files) | FULLY ABSORBED (FLOW-07 → TradeFlowV2) | Cart UI belongs in TradeFlowV2 |
| EDU-005/006 (2 files) | FULLY ABSORBED | Education absorbed into Groups H/I |
| EDU-008/009 (2 files) | FULLY ABSORBED → re-map to Admin Portal | Admin education belongs in Admin Portal |
| PROD-006/007/008/009/011 (5 files) | BUILD GATE ONLY — skip | Not manual test cases |

---

## 5. Validity Debt — Items Requiring Follow-up

### High-confidence staleness (needs action):

| # | TC-ID | Canonical | Issue | Recommended Action |
|---|---|---|---|---|
| 1 | TC-D04 | TradeFlowV2 | "Auto-completing in" → "Auto-completes in" | Update canonical wording |
| 2 | TC-B02 | Account/Dashboard | Email change re-verification flow not found | Remove or mark "not implemented" |

### Medium-confidence staleness (needs verification):

| # | TC-ID | Canonical | Issue |
|---|---|---|---|
| 3 | TC-A08 | Messaging/Badges | Quick-reply meeting chips |
| 4 | TC-A09 | Messaging/Badges | Safety meeting banner text |
| 5 | TC-A02 | Subscriptions | "Choose Kids Club+" button label |
| 6 | TC-B03 | Subscriptions | Success copy text |

### Low-confidence staleness (likely just wording drift, verify before changing):

7 remaining items with minor copy variations. See individual validity audit reports for details.

---

## 6. Recommendations

1. **SAFE TO ARCHIVE**: ~100 candidate files are FULLY ABSORBED and can be archived after Phase 3/4
2. **RETAIN for review**: ~15 files with PARTIALLY ABSORBED status need manual review
3. **RE-MAP**: 5 files should be re-assigned to different canonical files
4. **FIX CANONICAL**: 2 high-confidence staleness issues in canonical files
5. **SKIP**: ~25 files are backend/build-gate/notes with no manual test value
