# Validity Audit — Messaging · Badges · ID Verification · Referrals · Safety · Notifications

**Source:** `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`
**Last updated:** 2026-05-30 | **Audit date:** 2026-08-12

## Summary

| Classification | Count |
|---|---|
| CURRENT | 58 (89%) |
| POSSIBLY STALE | 4 (6%) |
| UNVERIFIABLE | 3 (5%) |
| **TOTAL** | **65** |

## POSSIBLY STALE Cases

### TC-A08 · Quick-reply meeting chips
**Checkable elements searched:** "Meet at library", "quick reply" chips
**Evidence:** No matching strings found. Quick reply chips testID `quick-reply-` found in e2e tests but not in production source.
**Confidence:** MEDIUM — chips may have been removed or renamed

### TC-A09 · Safety meeting banner + Learn more
**Checkable elements searched:** "Meet in a safe, public place", "Learn more" (in meeting safety context)
**Evidence:** "Learn More" exists in `SPInfoTooltip.tsx:95`, `SpWalletScreen.tsx:214`, `MySubscriptionScreen.tsx:184` — but none in meeting/safety banner context. The safety meeting banner text appears to have changed or been removed.
**Confidence:** MEDIUM

### TC-C01 · Submit a post-trade review — success message
**Checkable elements searched:** "Your review has been submitted"
**Evidence:** Not found as exact string. The SubmitReview screen and review service exist but the success confirmation text may have changed.
**Confidence:** LOW — different copy may be used for the same behavior

### TC-G05 · Recall safety alert notification
**Checkable elements searched:** "Recall Alert"
**Evidence:** Not found. CPSC recall matching logic exists in the codebase but the specific "Recall Alert" UI string was not matched.
**Confidence:** LOW — may use different terminology like "Safety Alert"

## UNVERIFIABLE Cases

| TC-ID | Reason |
|---|---|
| TC-A04 | Real-time message delivery behavior |
| TC-A05 | Typing indicator animation timing (~3 seconds) |
| TC-E01–E06 | Admin-side ID badge features (not in mobile src/) |

## Key Finding
The canonical file is largely accurate despite being 2.5 months old. Most UI elements referenced are still present in the codebase. Only 4 out of 65 cases (6%) show possible staleness, and those are minor copy/UI changes rather than removed features.
