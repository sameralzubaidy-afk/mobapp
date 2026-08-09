---
description: "Use when adding or modifying navigation in the Kids P2P Marketplace mobile app: route ownership, auth/onboarding stack boundaries, logout flow, and route param handling."
applyTo: "p2p-kids-marketplace/src/navigation/**"
---

# Navigation Hardening Protocol

## NAV-0: Navigation Contract (single source of truth)

For the MOBILE app only, the repo MUST have:
- `p2p-kids-marketplace/src/navigation/routes.ts`
- `p2p-kids-marketplace/src/navigation/types.ts`

For the ADMIN app (Next.js), routing is filesystem-based under `p2p-kids-admin/src/app/*`.

Rule: Mobile screens MUST import route constants + typed params; never hardcode `"Welcome"`/`"Home"` strings. Admin routes must be added via files under `src/app/` (no manual string route map).

## NAV-1: Route Ownership Rule (prevents RESET not handled)

Before making ANY navigation change, you MUST:
- Locate the navigator definitions (e.g., `RootNavigator`, `AuthStack`, `AppStack`, `OnboardingStack`).
- Build a small "Route Ownership Map" in your response: `RouteName -> Which navigator it belongs to` (AuthStack vs AppStack, etc.)
- You MUST NOT call `navigation.reset`/`navigate` to a route that is not owned by the CURRENT navigator. If a route is in a different navigator, switch stacks by changing STATE (auth/onboarding flags) or by navigating at the ROOT level.

## NAV-2: Auth Boundary Rule (Logout/Login/Onboarding)

For auth boundary transitions:
- Logout MUST NOT try to navigate into unauth routes from inside the authenticated stack.
- Logout MUST use ONE canonical function only: `AuthContext.logout()` (or equivalent) and NEVER call a lower-level `signOut()` directly from screens.
- The `RootNavigator` MUST be the only place that chooses between: Unauthenticated stack (Welcome/Login), Authenticated stack (App), Onboarding stack (Features/Profile completion). Screens must change state (logout / onboardingComplete) and let `RootNavigator` redirect.

## NAV-3: Onboarding Completion Rule

Any "Skip / Complete profile / Get Started" button must:
- Update onboarding completion state in the canonical store (`AuthContext` / profile flag)
- Then either: A) do NO navigation (`RootNavigator` redirects), OR B) reset within the SAME navigator only, using route constants that are verified owned.

## NAV-4: Preflight Checklist (required before code edit)

Before editing navigation:
- Confirm route constants exist and are used in the touched files.
- Confirm target route exists in the correct navigator.
- Confirm canonical auth/onboarding functions exist and are imported from ONE place.
- If anything is unclear, STOP and add `// TODO(NAV):` question... rather than guessing.

## NAV-5: Navigation Regression Tests (Tier rules)

Every nav change MUST include:
- Tier 0 (always): Typecheck + lint must pass (this catches route typos and TS param mismatches).
- Tier 1 (targeted nav smoke for impacted flows): provide a manual smoke checklist OR an automated test for the affected flow(s). Minimum required manual checks (with expected results):
  - Logout -> shows Welcome
  - Onboarding Skip/Complete -> lands on Dashboard
  - Back button behavior (stack cleaned appropriately)
- Tier 2 required when RootNavigator/auth/onboarding switching logic changes: run full flow regression (auth + onboarding + dashboard entry).

## NAV-6: "No repeated guessing" rule

If a navigation fix fails once:
- You MUST diagnose using the exact error/warning, navigator ownership map, and current stack state.
- You MUST NOT propose another navigation call until ownership is proven from code.

## BP-43: Learned Navigation & Params Rules

Full text lives in `Kids P2P App Builder.agent.md` (Bug Prevention Rule Index, BP-43) — the canonical single source for the numbered BP library. Summary: verify callers actually pass route params (not just the type def), verify which screen file the navigator actually imports before editing, and check both buyer AND seller navigation paths for completion flows.

## NAV-7: Backward Compatibility

Navigation changes must not break screens already shipped on user phones, or deep-link/notification links that point at old routes.

- **New route params MUST be optional with defaults.** Existing callers won't pass a newly added param — reading it without a default silently falls back (see BP-43-1). Use `route.params?.someParam ?? default`.
- **Never rename or remove a route constant** without updating ALL callers AND any deep-link / notification / external link that references it. During a transition, keep the old name working as an alias or redirect.
- **Moving a route between navigators is a breaking change.** A `navigate`/`reset` from the old owner will fail (see NAV-1). Keep routes owned by the same navigator during the transition, or ship the ownership move together with all its callers.
- **Adding a screen to a stack is safe**; removing or reordering existing screens is not. Verify against the Route Ownership Map before reordering.
