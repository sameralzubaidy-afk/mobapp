# Consolidation Manifest

**Date:** 2026-08-12
**Process:** Manual Test Case Consolidation Audit (Discovery → Validity Check → Gap Analysis → Merge → Finalize)

---

## 1. Canonical Files — Final State

| Canonical File | Before | Added | Enriched | Removed | Final Count |
|---|---|---|---|---|---|
| `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` | 256 | +6 (TC-I06–I11) | — | 0 | **262** |
| `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` | 132 | +4 (TC-L06–L08, TC-E08) | 4 (L03/L04/L05/E05) | 0 | **136** |
| `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` | 82 | +7 (Group Q: TC-Q01–Q07) | — | 0 | **89** |
| `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` | 65 | 0 | — | 0 | **65** |
| `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | 72 | +5 (TC-B09–B13) | 1 (E04) | 0 | **77** |
| `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` | 57 | +7 (TC-J06–J12) | 3 (J03/J05/A04) | 0 | **64** |
| **TOTAL** | **664** | **+29** | **8** | **0** | **693** |

> Note: The TradeFlowV2 canonical also gained **60 missing index-table rows** (Groups O-1/O-2/O-3, N09–N14, S14–S24) that previously existed only as body sections — these are not new test cases, they reconcile the index with the body.

---

## 2. Staleness Fixes Applied This Pass

| Canonical | TC-ID | Action |
|---|---|---|
| TradeFlowV2 | TC-D04 | Wording fixed: "Auto-completing in" → "Auto-completes in" |
| TradeFlowV2 | TC-A03 | Added deferral marker (platform-SP cash reward deferred) |
| Messaging | TC-A08 | Updated quick-reply chip list to current 5 chips |
| Messaging | TC-A09 | Updated safety banner to "Trade Smart, Trade Safe" |
| Subscriptions | TC-A02 | Updated button labels ("Free Plan" / "Start {N}-day Trial") |
| Account | TC-B02 | Marked inline "not implemented — needs re-verification" |
| 7 low-confidence items | — | Marked inline "needs re-verification" |

---

## 3. Candidate Source File Disposition

### FULLY ABSORBED → moved to `archive/` (168 files)

**TradeFlowV2 (9):** TradeFlowV2-COMPLETE, FLOW-TradeFlowV2-08, MODULE-15.2, MODULE-15.3-PART3-TAX, TAX-TESTING-CONSOLIDATED, TRADE-V2-002, TRADE-V2-010, TASK-FLOW-08, FLOW-07

**Admin Portal (14):** ADMIN-V2-005/006/007, ADMIN-V3-001/002/004/005/006/007/009, PAY-008 ×2, EDU-008/009

**Auth/Onboarding/Listing/Discovery (38):** AUTH-V2-COMPLETE, AUTH-V3-001→009, MODULE-15.1-FLOW-01/02/04/06/15/16/21, TASK-EDU-004, FLOW-26, NODE-003/006/007, LISTING-V3-001→011, DISCOVERY-V3-001/002/003/005/006/008

**Messaging/Badges/Referrals/Safety/Notifications (57):** MSG-001→006-009-COMPLETE, MODULE-15.1-FLOW-13/14/17, BADGE-008→013, BADGES-V2-005→008, manual_test_badges_v2_001→004, REVIEW-001→007, REF-V2-002/005/006/007/008, REFERRALS-V2, SAFETY-001/002/004/008/009/010/011/012/P001/P002/P003, NOTIF-V2-002→010

**Subscriptions/Payouts/SP Wallet (24):** SUB-002→018, MANUAL-TEST-SUB-EXT-001, FLOW-12, TC-SUB002-008, PAY-001/003/004-005, MANUAL_TEST_PAY-002, MODULE-15.1-FLOW-10-11/22, MANUAL-TEST-SP-001

**Account/Dashboard (3):** MODULE-15.1-FLOW-19, EDU-005/006

**docs/ (5):** manual-test-cases-module-06, TRADE-V2-007, PROD-004, PROD-010, SUB-001

**docs/manual-verification/ (6):** MANUAL-VERIFICATION-DISCOVERY-V2-002, MANUAL-VERIFICATION-READY, SP-ECONOMY-HUB, SUB-011, SUB-015, SUB-020

**.docs/ (1):** PAY-006-MANUAL-TESTS

**p2p-kids-marketplace/ (7):** NOTIF-V2-001/006/008, DISCOVERY-V3-004, LISTING-V3-004, FLOW-22, FLOW-25

**p2p-kids-admin/ (2):** SP-002, SP-003-004

### PARTIALLY ABSORBED → retained in place

| File | Reason |
|---|---|
| `misc./MODULE-15.1.2-TradeFlowV2-DEFERRED-MANUAL-TESTING.md` | Deferred features — retain as implementation reference |
| `docs/manual-verification/ADMIN-V2-003-SP-WALLET-MANUAL-TEST-CASES.md` | Wallet state-enforcement detail now merged; retain for reference |
| `p2p-kids-admin/MANUAL-TEST-WAITLIST-PAGE.md` | Waitlist detail now merged; retain for reference |
| `docs/EDU-002-MANUAL-TESTING-GUIDE.md` | Developer typecheck checks — not manual tests |
| `docs/EDU-003-MANUAL-TESTING-GUIDE.md` | Backend service tests — mobile cases merged into new Group Q |

### SKIPPED (no manual test value) → left in place

Backend-only SQL/RLS verification, build gates (noImplicitAny/ESLint/test-suite), and app-store metadata: `PROD-006/007/008/009/011/012`, `PROD-001-002`, `PROD-003-005`, and similar.

---

## 4. Root-Level Dead/Duplicate Files (left in place — recorded, not deleted)

| File | Finding |
|---|---|
| `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (root) | Byte-for-byte duplicate of `misc./` copy |
| `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (root) | Byte-for-byte duplicate of `misc./` copy |
| `DEPRECATED - MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` (root) | 11-line redirect stub to `misc./` |

Per user decision, these remain in place.

---

## 5. Validity Debt — Remaining Follow-up Items

### Marked "not implemented — needs re-verification" (1)

| Canonical | TC-ID | Issue |
|---|---|---|
| Account/Dashboard | TC-B02 | Email change re-verification flow not found in current app |

### Marked "needs re-verification" (7 — low-confidence wording drift)

| Canonical | TC-ID | Issue |
|---|---|---|
| Messaging | TC-C01 | "Your review has been submitted!" success copy |
| Messaging | TC-G05 | "Recall Alert" vs "Safety Alert" terminology |
| Subscriptions | TC-B06 | "{N} days left in trial" badge wording |
| Subscriptions | TC-C03 | Helper text "You'll continue to have access…" |
| Subscriptions | TC-C06 | "can reactivate" message |
| Subscriptions | TC-D03 | Index title "benefits lost" vs body "What you're missing out on" |
| Account | TC-F02 | "email token" vs deep-link token terminology |

### UNVERIFIABLE by front-end code inspection (~16)

Cases describing backend business logic, timing-dependent, or third-party behavior — chiefly webhook reconciliation (Subscriptions Group L), real-time messaging delivery (Messaging TC-A04), and DB-trigger/RLS behavior across canonicals. These remain valid test cases but cannot be confirmed stale-or-current without runtime/backend verification.

---

## 6. Recommendations Summary

1. ✅ **29 new test cases merged** across 5 canonicals
2. ✅ **4 test cases enriched** (SP Wallet L03/L04/L05, Waitlist E05)
3. ✅ **7 amendments applied** (wording/coverage refinements)
4. ✅ **168 fully-absorbed files archived** to `archive/`
5. ✅ **2 high-confidence + 3 medium-confidence staleness fixed**
6. ⚠️ **8 validity-debt items** remain tracked for follow-up (section 5)

---

*Consolidation complete. The 6 canonical files in this folder are the single source of truth for manual testing.*
