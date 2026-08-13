# Validity Audit — Account · Home Dashboard · Help & Education · Legal

**Source:** `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`
**Last updated:** 2026-05-30 | **Audit date:** 2026-08-12

## Summary

| Classification | Count |
|---|---|
| CURRENT | 52 (91%) |
| POSSIBLY STALE | 2 (4%) |
| UNVERIFIABLE | 3 (5%) |
| **TOTAL** | **57** |

## POSSIBLY STALE Cases

| TC-ID | Checkable Element | Evidence |
|---|---|---|
| TC-B02 | Email change requires re-verification | No edit-profile email verification UI found. Email verification is in `IDVerificationUploadScreen.tsx` (ID docs context), not in the edit-profile flow. The test case describes behavior that may not exist in the current app. |
| TC-F02 | "email token" exact string for unsubscribe | `UnsubscribeScreen.tsx` exists but uses route params, not "email token" terminology |

## UNVERIFIABLE Cases

| TC-ID | Reason |
|---|---|
| TC-D02 | Optimistic toggle revert behavior — UX behavior, not string-searchable |
| TC-H03 | FAQ offline fallback behavior — runtime behavior |
| TC-I05 | Education analytics events fire — analytics event, not UI-verifiable |

## Key Finding
91% accuracy. The only substantive finding is TC-B02 (email change re-verification) which appears to describe a feature not implemented in the current app. This is the highest-confidence staleness finding across all 3 stale canonicals.
