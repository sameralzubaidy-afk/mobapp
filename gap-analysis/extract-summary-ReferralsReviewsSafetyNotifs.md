# Candidate Extraction Summary — Referrals/Reviews/Safety/Notifications

**Phase 2.2c (continued)** | **36 files processed**

## Breakdown

| Domain | Files | Notes |
|---|---|---|
| Referrals | 7 | Mix of mobile UI + admin + SQL |
| Reviews | 7 | All have UI elements |
| Safety | 11 | Mix of CPSC/SQL, Vision API, admin workflow |
| Notifications | 10 | Push, email, in-app, preferences |

## Key Findings

1. **SAFETY-001/002 are CPSC SQL/API tests** — not manual UI tests
2. **SAFETY-P001 is storage bucket RLS** — not manual tests
3. **SAFETY-010/011/012 (TOS/Privacy/Liability)** — these map to Account/Dashboard/Help/Legal canonical, NOT to Messaging/Badges
4. **Many notifications files have significant overlap** — NOTIF-V2-002 through N10 cover similar ground
5. **REVIEW-00{1-7} are well-structured UI test cases** — strong candidates for merging

## Cross-canonical mapping issues
- SAFETY-010/011/012 → should map to Account/Dashboard/Help/Legal
- Several admin-facing files → may map to Admin Portal
