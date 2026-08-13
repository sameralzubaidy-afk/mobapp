# Validity Audit — TradeFlowV2

**Last updated:** 2026-08-01 | **Audit date:** 2026-08-12

## Summary

| Classification | Count |
|---|---|
| CURRENT | 255+ |
| POSSIBLY STALE (wording drift) | 1 |
| UNVERIFIABLE | ~10 (webhook/DB-trigger behavior) |
| **TOTAL** | **256** |

## POSSIBLY STALE

| TC-ID | Element | Evidence |
|---|---|---|
| TC-D04 | "Auto-completing in" banner text | Component exists at `AutoCompleteBanner.tsx:56-57` but renders **"Auto-completes in"** (present tense), not "Auto-completing in" (gerund). Minor string mismatch. |

## UNVERIFIABLE Cases
Approximately 10 test cases reference backend triggers, webhook processing, or DB-level behavior that cannot be verified by reading frontend source code alone (e.g., TC-TFV2-003-A SP reserve trigger, webhook reconciliation cases).
