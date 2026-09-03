# Dev-only test helpers — gating note (DT97, Item 4)

**Finding (QA Task 24, 2026-09-03):** the E2E build showed dev-only helpers —
"New Item" quick-fill/dev-price buttons and Signup persona quick-fill
(Alice/Bob/Charlie). These are NOT a release leak: every helper is gated behind
the global `__DEV__` flag, and QA's tested binary was a Metro **dev build**
(`__DEV__ === true`), so the helpers rendered by design.

## Verified gates (all present in source)

| Surface | Helper(s) | Gate |
|---|---|---|
| `src/screens/ItemCreateScreen.tsx` | `dev-add-test-photo`, `dev-add-test-photo-uploaded`, `dev-set-category`, `dev-other-category`, `dev-fill-item`, `dev-price-input` / `dev-set-price` | `{__DEV__ && (…)}` |
| `src/screens/BulkListingCreateScreen.tsx` | `dev-fill-bulk-items` | `{__DEV__ && (…)}` |
| `src/screens/auth/SignupScreen.tsx` | Alice/Bob/Charlie persona buttons (`dev-fill-*`) | `{__DEV__ && (…)}` |
| `src/screens/auth/SignupScreen.tsx` | deep-link `prefillTestUserId` | `if (!__DEV__ …) return;` |
| `src/services/devTestingService.ts` + `Qa*DeepLinkHandler` | QA fixtures | `__DEV__ || EXPO_PUBLIC_ENVIRONMENT…` composite gate |
| `src/screens/EditListingScreen.tsx` | — (no dev helpers present) | n/a |

## What this means

- **Release builds** (`__DEV__ === false`) never render these helpers.
- **Dev / E2E builds** run `__DEV__ === true`, so helpers appear — expected, not a
  defect. The tested E2E binary is intentionally a dev build for drivability.
- If a build must mirror release while staying drivable, run it as a non-dev
  build (release/QA config) rather than removing the `__DEV__` gates.

No functional change was required for Item 4 — this note documents the verified
state (DT97 decision: verify gates + document).
