# PROD-P003 + PROD-P004 — Manual Test Cases

**Scope:** Global ErrorBoundary (PROD-P003) + Sentry crash reporting (PROD-P004)
**App:** `p2p-kids-marketplace/`
**Module spec:** `Prompts/MODULE-15.5-prod-readiness.md`

---

## Prerequisites

1. `cd p2p-kids-marketplace && npm install` (installs `@sentry/react-native`).
2. **Native side (required for Sentry to capture native crashes):**
   ```bash
   cd p2p-kids-marketplace
   npx expo prebuild --platform ios --clean
   npx expo prebuild --platform android --clean
   cd ios && pod install && cd ..
   ```
   _Skip this step for ErrorBoundary-only tests (JS crashes captured without native linking)._
3. **Sentry DSN:** Add to `p2p-kids-marketplace/.env.local`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://<your-key>@<org>.ingest.sentry.io/<project-id>
   ```
   Leave blank to test the "DSN-missing safe no-op" path.

---

## TC-P003-01 — ErrorBoundary catches a JS render error and shows fallback

**Goal:** Verify a render-time exception in any screen shows the friendly fallback instead of a redbox/white-screen.

**Steps:**
1. Temporarily add a "throw" trigger in a dev-only spot (e.g. add this to `App.tsx` _temporarily_ inside the render tree, under `__DEV__`):
   ```tsx
   {__DEV__ && false && (() => { throw new Error('manual-test-crash'); })()}
   ```
   Flip `false` → `true` to fire.
2. Launch app on iOS Simulator: `npm run start` then press `i`.
3. Observe fallback screen renders.

**Expected:**
- Screen shows 😵 emoji, title "Something went wrong", subtitle, "Try Again" button.
- In dev: yellow DEV details box shows `manual-test-crash`.
- Console logs `[ErrorBoundary] caught Error: manual-test-crash`.
- App does **not** show the red error screen.

**Recovery:** Tap "Try Again" → fallback dismisses → app returns to normal navigation (you'll need to flip the trigger back to `false` to avoid re-throwing).

---

## TC-P003-02 — Custom fallback prop is respected

**Goal:** Confirm callers can override the default fallback UI.

**Steps:** (covered by unit test `ErrorBoundary.test.tsx > renders custom fallback when provided`)

**Expected:** Unit test passes; no manual run required.

---

## TC-P004-01 — Sentry receives a captured exception (DSN configured)

**Goal:** Verify Sentry dashboard records errors caught by ErrorBoundary.

**Prerequisites:**
- DSN configured in `.env.local`.
- Native prebuild + pod install completed (above).
- Built dev client via `npx expo run:ios` or `npm run ios` (not Expo Go — Sentry requires native linking).

**Steps:**
1. Trigger the same crash from TC-P003-01.
2. Wait 30–60s.
3. Open the Sentry project dashboard → Issues.

**Expected:**
- New issue appears with title containing `manual-test-crash`.
- Tags include `source: ErrorBoundary`.
- Extra context includes `componentStack`.
- Release tag matches `app.json` version (`1.0.0`).
- Environment tag matches `EXPO_PUBLIC_ENVIRONMENT` (default `development`).

---

## TC-P004-02 — App boots safely when DSN is missing (no-op path)

**Goal:** Confirm app starts cleanly with no Sentry DSN configured.

**Steps:**
1. Remove or comment out `EXPO_PUBLIC_SENTRY_DSN` in `.env.local`.
2. Restart Metro: `npm run start --clear`.
3. Launch on simulator.
4. Watch Metro console.

**Expected:**
- App boots normally to login screen.
- Console shows: `[errorReporter] EXPO_PUBLIC_SENTRY_DSN missing — reporter disabled`.
- No red error screen, no crash.
- All app features behave normally (errorReporter is fully no-op).

---

## TC-P004-03 — captureException fallback logs to console when reporter disabled

**Goal:** Verify caught errors still surface to dev when Sentry is disabled.

**Steps:** (covered by unit test `errorReporter.test.ts > captureException falls back to console.error when reporter disabled`)

**Expected:** Unit test passes.

---

## Automated coverage

| Test file | What it covers |
|-----------|---------------|
| `src/components/__tests__/ErrorBoundary.test.tsx` | 6 tests: render children, show fallback, report to reporter, onError hook, retry recovery, custom fallback |
| `src/services/__tests__/errorReporter.test.ts` | 6 tests: no-op when DSN missing, fallback logging, safe no-ops, idempotent init |

**Run:**
```bash
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern='(ErrorBoundary|errorReporter)'
```

**Expected:** `Tests: 12 passed, 12 total`.

---

## Tier 0 Preflight Gate (this phase)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `npm run typecheck` | ✅ PASS (0 errors) |
| Lint (touched files) | `npx eslint App.tsx src/components/ErrorBoundary.tsx src/components/__tests__/ErrorBoundary.test.tsx src/services/errorReporter.ts src/services/__tests__/errorReporter.test.ts` | ✅ PASS (0 errors, 0 warnings) |
| Unit tests | `npm run test:unit -- --testPathPattern='(ErrorBoundary\|errorReporter)'` | ✅ PASS (12/12) |
