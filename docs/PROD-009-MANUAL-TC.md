# PROD-009 — App Store Metadata & Privacy Policy — Manual Test Checklist

**Module:** MODULE-15.5 Production Readiness — PROD-009
**Type:** Documentation + URL wiring
**Dependencies:** PROD-P001 (iOS privacy descriptions)

## Deliverables (per spec)

1. ✅ [docs/STORE-SUBMISSION-CHECKLIST.md](STORE-SUBMISSION-CHECKLIST.md) — complete iOS + Android checklist
2. ✅ [docs/PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md) — marked DRAFT, COPPA-aware
3. ✅ [docs/TERMS-OF-SERVICE-DRAFT.md](TERMS-OF-SERVICE-DRAFT.md) — marked DRAFT
4. ✅ `p2p-kids-marketplace/src/constants/legal.ts` — `LEGAL_URLS` single source of truth (Privacy/ToS/Support)

## In-App Surfaces (already wired pre-PROD-009)
- Privacy Policy screen: `src/screens/profile/PrivacyPolicyScreen.tsx` — DB-backed via `privacyPolicyService`.
- Signup terms acceptance: `src/screens/auth/SignupScreen.tsx` references `terms_of_service` / `privacy_policy`.

## Tier 0 Gate
- `npx tsc --noEmit` → **exit 0, 0 errors** (new `legal.ts` is typed strict).
- `npx eslint src/constants/legal.ts` → **0 errors**.
- Full Jest suite: not re-run for this commit — pure docs + new typed constants file with no
  runtime references yet (callers will be wired in future store-listing PR).

## Manual TC
This is a documentation-and-constants task. No UI verification needed.

When final URLs are available, set in `.env`:
```
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<final-host>/privacy
EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://<final-host>/terms
```

## Required Follow-ups (out of PROD-009 scope, tracked in checklist)
- [ ] Legal counsel review of the two DRAFT documents.
- [ ] Replace placeholder URLs with hosted-page URLs.
- [ ] Set Privacy Policy URL in App Store Connect.
- [ ] Set Privacy Policy URL in Google Play Console.

## Rollback
Pure file additions; `git revert <commit>` removes the new docs + constants.
