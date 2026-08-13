# Candidate Extraction Summary — Auth/Onboarding/Nodes/Listing/Discovery

**Phase 2.2b** | **45 files processed**

## Breakdown by Sub-domain

| Sub-domain | Files | Test Cases | Merge Status |
|---|---|---|---|
| Auth & Onboarding | 14 | ~80 | Most map to Groups A–I |
| Listing Management | 10 | ~80 | Map to Groups J–L |
| Discovery & Search | 7 | ~35 | Map to Groups M–N |
| Nodes & Location | 3 | ~15 | Map to Groups F–G |
| Profiles/Dashboard/Misc | 4 | ~20 | Map to Groups H, O |
| docs/ (Education, PROD) | 5 | ~45 | Mix of backend (EDU) and UI (PROD-004) |
| docs/manual-verification/ | 2 | ~10 | Discovery verification |
| p2p-kids-marketplace/ | 2 | ~12 | Listing & Discovery V3 |

## Key Findings

1. **AUTH-V3-001/002 are pure SQL/type tests** — nothing to merge (no UI)
2. **LISTING-V3-001 is SQL-only** — 15 DB migration tests, no UI, skip
3. **LISTING-V3-002 is ~80% backend** — only 2 UI-adjacent cases (confidence filtering, category fuzzy matching)
4. **EDU-002/003 are type-system + service tests** — not end-user manual tests, may warrant separate status
5. **PROD-004 (Node Isolation)** — structured test cases with current validity; strongest candidate for new coverage in Groups F/G
6. **MODULE-15.1-FLOW-* files** — UI redesign test guides, likely already absorbed by canonical
