# QA Logout Deep Link — Onboarding Stack — Diagnostic + Fix Report

- **Date:** 2026-08-11
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1
- **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`) — Expo dev-client build, staging
- **Commit:** `cd22eb85` (`main`)
- **Preceding report being corrected:** `e2e-test-results/stage3/report-readonly-supabase.md` §5.2

---

## 1. Root cause identified (precise mechanism)

**Neither a mounting-scope issue nor a listener-lifecycle issue.** The handler is correctly
mounted at the root of `AuthProvider` (outside `RootNavigator`), and its foreground
`Linking.addEventListener('url', ...)` listener is active and fires on every trigger from the
onboarding stack. The mechanism is:

1. **The handler fires.** On-device proof via the app's own JS console buffer (Hermes CDP):
   counting `[QaLogoutDeepLink] Logging out via deep link` messages before vs. after a single
   `xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"` while on "Complete Your
   Profile" gave **DELTA = +1 per trigger**. Native `os_log` also showed the app receiving the
   `UIOpenURLAction` in the foreground.
2. **`logout()` is a no-op during onboarding.** During signup, `AuthContext.session` is `null`:
   "Complete Your Profile" (`ProfileSetupScreen`) is registered **only** in the
   *unauthenticated* branch of `RootNavigator` (`!isAuthenticated`), so the app does not
   consider the user authenticated until onboarding completes. `logout()` →
   `setSession(null)` hits the null-signature guard in `AuthContext` and never re-renders the
   navigator, so the screen stays on "Complete Your Profile".
3. **The stage-3 report's "no handler log" was a false inference.** The QA driver inferred
   "no handler log" from "no navigation". JS `console.log` goes to Metro over websocket — it is
   **not** visible in `os_log`, so the driver could not see the handler fire.

Relevant code:
- `p2p-kids-marketplace/src/components/QaLogoutDeepLinkHandler.tsx` (handler, mounted at root)
- `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` (RootNavigator; ProfileSetup only in unauth stack)
- `p2p-kids-marketplace/src/contexts/AuthContext.tsx` (`logout`, `setSession` signature guard)

## 2. Fix applied

`QaLogoutDeepLinkHandler`: after invoking the canonical `AuthContext.logout()`, when there is
**no** AuthContext session (the onboarding stack), it resets the navigation stack to `Landing`
via `navigationRef` — giving QA teardown the same clean end state from onboarding as from
Home/My Trades. A `sessionRef` (synced each render) keeps the current session observable inside
the stable effect closure without re-registering the listener.

Supporting change: `navigationRef` was extracted from `AppNavigator.tsx` into a new
`src/navigation/navigationRef.ts` so the handler can navigate without creating a circular
import (`AppNavigator` imports the handler). `AppNavigator` re-exports it (`export { navigationRef }`),
so the existing consumer `src/services/notifications.ts` is unaffected.

**Explicitly NOT changed:** the URL scheme (`p2pkidsmarketplace://qa-logout`), the production
gate (`__DEV__ || EXPO_PUBLIC_ENVIRONMENT ∈ {development, staging}` — the `enabled` check is
untouched, so the listener is still never registered in production builds), and the
`AuthContext.logout()` call itself.

## 3. Regression check results (previously-working states)

| State | Deep link trigger | Result | Evidence |
|---|---|---|---|
| Home (test-buyer) | `openurl ...qa-logout` | Logged out → **Landing** ✅ | element tree showed Landing (Pass It Up / Get Started / Log In) |
| My Trades (test-buyer) | `openurl ...qa-logout` | Logged out → **Landing** ✅ | element tree showed Landing |

## 4. Previously-broken case now works

| State | Deep link trigger | Result | Evidence |
|---|---|---|---|
| Complete Your Profile (fresh signup, `bob.stage3.dl.fix.1786484977@example.com`) | `openurl ...qa-logout` | Logged out → **Landing** ✅ | element tree showed Landing; handler log confirmed firing |

## 5. Scope of verification (exact states covered)

Tested on-device (foreground, app already running, `xcrun simctl openurl`):
1. **Complete Your Profile** (ProfileSetup, fresh signup, authenticated-account-but-null-session) → Landing ✅
2. **Home** (test-buyer, fully authenticated) → Landing ✅
3. **My Trades** (test-buyer, fully authenticated) → Landing ✅

This is **not** "fully verified across every screen". In particular, I did **not** separately
drive the deep link from `Welcome` / `Feature Highlights` / `Subscription Choice` onboarding
screens. However, the fix is state-based, not screen-based: it resets to Landing whenever the
deep link fires while `AuthContext.session` is `null`, which is true across the **entire**
onboarding stack (all of those screens render in the unauthenticated stack), so the same code
path covers them. The original report's claim that Home was the only verified surface was
accurate for what it tested; this report lists exactly what was re-tested here.

Production-gate inertness: the `enabled` gate is byte-for-byte unchanged; in a production build
`enabled === false`, the effect returns before registering the listener, and no deep-link
handling or reset occurs.

## 6. Commit

- **Commit:** `cd22eb85` — `QA: fix qa-logout deep link to land on Landing from onboarding stack`
- `git status --short` for the touched files: **clean** (committed). Remaining untracked files
  (`e2e-test-results/stage3/*`, `temp/ocr.swift`) are pre-existing stage-3 artifacts, not part
  of this fix.
- **No native rebuild needed:** JS-only change (3 TS/TSX files), delivered via Metro into the
  running dev-client; verified live on-device.

## Tier-0 gate

- `npm run typecheck` (tsc -p tsconfig.json --noEmit): **PASS** (exit 0)
- `npx eslint <3 changed files>`: **PASS** (exit 0); repo-wide `npm run lint` has pre-existing
  debt in test/detox files unrelated to this change.
- `get_errors` on all changed files + `notifications.ts`: **no errors**.
