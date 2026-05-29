# PROD-011 — Android Data Safety & Google Play Families Policy — Manual TC

## Tier 0 Gate
- Mobile typecheck: `npx tsc -p tsconfig.json --noEmit` → **0 errors** ✅
- Lint (changed files): `npx eslint App.tsx src/services/analytics.ts` → **0 errors / 0 warnings** ✅
- `app.json` parses (verified via `node -e "require('./app.json')"`) ✅
- No advertising SDKs in `package.json` (grep for admob/facebook-ads/mopub/ironsource/applovin/unity-ads → empty) ✅

## Files Changed
- `p2p-kids-marketplace/app.json` — android block now declares `compileSdkVersion: 35`, `targetSdkVersion: 35`, `minSdkVersion: 24`.
- `p2p-kids-marketplace/src/services/analytics.ts` — added `initAnalytics()` (COPPA-compliant; stub today because Firebase SDK is not installed, ready to wire).
- `p2p-kids-marketplace/App.tsx` — calls `initAnalytics()` once at mount alongside `NotificationAnalyticsService.initialize()`.
- `docs/GOOGLE-PLAY-DATA-SAFETY.md` — NEW. Complete Data Safety form answers + Families Policy checklist + Firebase Console manual steps.

## Manual TC

### A. SDK target verification
1. Open `p2p-kids-marketplace/app.json`.
2. Confirm `expo.android.targetSdkVersion === 35` (>= 34 required by Google Play).
3. Confirm `compileSdkVersion === 35`, `minSdkVersion === 24`.

### B. Analytics init
1. Cold start app: expect log `[Analytics] initAnalytics() called (COPPA-compliant defaults; SDK stub)` in dev console.
2. Confirm app boot is unaffected if `initAnalytics` throws (it is wrapped in `try/catch` and the call in `App.tsx` is `.catch()`-guarded).

### C. Families Policy
1. Open `docs/GOOGLE-PLAY-DATA-SAFETY.md`; confirm all checklist items are checked.
2. Verify `package.json` has zero ad SDK dependencies (manual `grep -iE "admob|facebook-ads|mopub|ironsource|applovin|unity-ads" package.json` should be empty).

### D. Release-time only (NOT executed in this commit)
Before submitting to Play Console:
1. Run `npx expo prebuild --platform android --clean` and verify it succeeds.
2. Confirm generated `android/app/build.gradle` reflects `targetSdkVersion 35`.
3. Inspect `android/app/src/main/AndroidManifest.xml` permissions; cross-check with the Data Safety form.
4. In Firebase Console, perform the manual steps listed at the bottom of `docs/GOOGLE-PLAY-DATA-SAFETY.md`.

## Rollback
- `git revert` of the PROD-011 commit restores prior `app.json`, `analytics.ts`, `App.tsx`, and removes the data-safety doc.
- No DB / runtime state to roll back.
