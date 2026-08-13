# Validity Audit — Subscriptions · Payouts · SP Wallet

**Source:** `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
**Last updated:** 2026-05-30 | **Audit date:** 2026-08-12

## Summary

| Classification | Count |
|---|---|
| CURRENT | 66 (92%) |
| POSSIBLY STALE | 6 (8%) |
| UNVERIFIABLE | 0 (0%) |
| **TOTAL** | **72** |

## POSSIBLY STALE Cases

| TC-ID | Checkable Element | Evidence |
|---|---|---|
| TC-A02 | "Choose Kids Club+" button label | Not found. "Choose Free" exists (`SubscriptionChoiceScreen.tsx:399`) but counterpart button label absent |
| TC-B03 | "You're now a Kids Club+ member!" success copy | Not found as exact string. `SubscriptionSuccessScreen.tsx` exists but uses different copy |
| TC-B06 | "days left in trial" exact phrase | Not found. Related copy in `trialReminders.ts` uses different wording |
| TC-C03 | "You'll continue to have access until the end of your current billing period" | Not found. Cancel flow uses different retention copy |
| TC-C06 | "can reactivate" as displayed message | "Reactivate" exists in `KidsClubOverviewScreen.tsx:168` but not "can reactivate" as a separate message |
| TC-D03 | "benefits lost" exact phrase | Not found. Related messaging: "Don't let your benefits slip away" (`SubscriptionExpiredScreen.tsx:122`) |

## Key Finding
The canonical file is ~92% accurate. All 6 POSSIBLY STALE items are **copy text drift** — the features still exist but the exact wording in the test cases doesn't match the current app. The underlying features (plan comparison, payment flow, cancel flow, grace period) are all present.
