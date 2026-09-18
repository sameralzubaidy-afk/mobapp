---
description: "Use when writing or reviewing client-side code in the Kids P2P Marketplace mobile app (screens, services, hooks): result-checking, Realtime subscriptions, caching, UI patterns, and error parsing for Supabase/Stripe calls."
applyTo: "p2p-kids-marketplace/src/**"
---

# Mobile Client Hardening Protocol

Related bug-prevention rules with full detail below: BP-8 (typed service errors), BP-15 (pull-to-refresh cache bypass), BP-23 (Realtime callback mirrors mount-time side effects), BP-24 (partial reverts leave `DEFERRED-DECISION` comments), BP-29 (downstream reference audit after data-source renames), BP-33 (persistent UI at root level), BP-34 (Alert→Toast success-path audit), BP-35 (check mutating service call results), BP-36 (Realtime subscription table/publication verification), BP-39 (`FunctionsHttpError.context` parsing), BP-42 (trade detail tax preview from joined listing price), BP-53 (QA-testID controls must set `accessible` + `accessibilityRole` and be confirmed on-device), BP-58 (bottom-anchored UI must clear the floating pill nav), BP-59 (verify scripted JSX mass-edits with more than typecheck alone), BP-60 (shared test-render helpers must receive explicit clean params — test isolation), BP-82 (account/subscription screens must use Pass It Up semantic tokens — no Material/Tailwind/system-blue leakage) — see the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all rules.

### Rule Index (scan this first; open the full rule below only when it's relevant to your current task)

- BP-8 TS service errors — return typed `ServiceResult<T>`, never swallow to null.
- BP-15 Pull-to-refresh — must pass forceRefresh=true to bypass client caches.
- BP-23 Realtime callbacks — must mirror the same side effects the mount-time effect performs.
- BP-24 Partial reverts — leave a `// DEFERRED-DECISION` comment on code that survives a partial revert.
- BP-29 Data-source renames — audit every downstream reference (empty states, filters, counters) after a restructure.
- BP-33 Persistent UI (tab bars/headers) — render once at the root stack, never per-screen.
- BP-34 Alert→Toast migrations — classify every call site individually (success/toast, error/blocking, choice/blocking).
- BP-35 Mutating service calls — always check the `{success}` result before a dependent step.
- BP-36 Realtime subscriptions — confirm the table is in the `supabase_realtime` publication; watch for RLS-filtered events.
- BP-39 FunctionsHttpError — `.message` is hardcoded; always parse `.context.clone().json()`.
- BP-42 Trade detail tax preview — derive from the joined listing's `price`, never from `cash_amount_cents`.
- BP-53 QA-testID controls — must set `accessible` + `accessibilityRole` (mirror `ui/Button`) so identifiers surface on the iOS tree; confirm on-device — unit tests alone are insufficient. Never use `accessibilityRole="tab"/"tablist"` on iOS (RN 0.81 — doesn't register in the AX tree); use `"button"` + `accessibilityState`. Modal containers that are `Pressable`s group their children and hide them from the AX tree — set `accessible={false}` on the overlay/sheet so the buttons surface.
- BP-54 Dynamic `import('react-native')` / export enumeration — never use it; Metro's `importAll` iterates RN's lazy getters (e.g. `PushNotificationIOS`) and can crash with `new NativeEventEmitter() requires a non-null argument` when the linked native module is absent — use static imports only.
- BP-56 Design tokens — Discover/design code must import `ds` from `@/theme/discoveryTokens`, which must stay reconciled to `docx/design-system-passitup.md` (#5DBB8E); never source from legacy `design-system.md` (#4A7C59) or hardcode hex in Discover components.
- BP-57 Behavior-fix test drift — a fix that makes an auto-verify/auto-submit path actually work will break tests written around the old broken behavior (they relied on a manual fallback); audit & update those tests — the failure is evidence the fix worked, not a regression.
- BP-58 Bottom-anchored UI on pill-nav screens — scroll content `paddingBottom: 100`, fixed bottom bars `bottom: 120`, in-flow bars above a fixed bar `marginBottom: 200`, so CTAs/buttons are never hidden behind the floating pill (PersistentTabBar). **Padding only helps when the content actually overflows the viewport** — a screen whose content fits never scrolls, so verify overflow before treating padding as the fix (otherwise it is a layout change).
- BP-59 Scripted JSX mass-edits — verify with more than typecheck alone: (a) typecheck, (b) grep for a bare prop-like line immediately followed by a JSX child (text-children corruption), (c) Prettier and confirm it doesn't rewrite the region unexpectedly.
- BP-60 Test isolation — a `renderScreen()`-style helper that accepts/defaults to a shared mutable route/params object leaks state between tests; ALWAYS pass explicit, freshly-constructed params per test, and suspect this pattern before blaming the feature code for a “flaky” failure.
- BP-61 Accessibility props in `<Text>` — never paste `accessible`/`accessibilityRole`/`accessibilityLabel` as literal children; they must be attributes on the opening tag (recurred 3×: `WelcomeScreen`, `ResumeDraftBanner`, `CartScreen`); cheap to grep for (`accessible accessibilityRole`) whenever writing or reviewing `<Text>` components.
- BP-82 Account/subscription screens (incl. ContinueKidsClub, all branches) — Pass It Up semantic tokens only (`#5DBB8E` primary/success, `#E85D75` error, `#FFA726` warning, `#5B8FB9` info, `#1A1A1A`/`#6B6B6B`/`#999999` neutrals); no Material (`#4CAF50`/`#E53935`/`#29B6F6`), Tailwind gray/amber (`#111827`/`#6B7280`/`#D1D5DB`/`#D97706`), iOS system blue (`#0066CC`/`#007AFF`/`#93C5FD`), or legacy-design-system tokens (`#4A7C59`/`#4D4D4D`/`#808080`) leakage; EVERY rendered branch of a screen must be on-brand (QA Task 34: ContinueKidsClub active branch correct, its upsell branch leaked `#4A7C59`).
- BP-85 Money display units — cents-stored values MUST use a cents formatter (`formatPrice(cents)` → "$1.49"), never the dollars formatter (`formatDollarAmount` expects DOLLARS → "$149"); know the unit of each source config/field before picking a formatter.
- BP-86 Membership/value-prop copy — subscription surfaces must render the CANONICAL in-app benefit set (ManageKidsClub "Kids Club+ Benefits" card / JoinKidsClub `STATIC_BENEFITS`), never an invented list; grep the whole class (every screen/branch) before shipping.
- BP-88 Error/defensive branches need a trigger that actually fires on the REAL runtime path — a unit test mocking the error into existence can green-light dead code (`signInWithOAuth({skipBrowserRedirect:true})` returns a URL without throwing for a disabled provider → ProviderDisabled classification unreachable, raw JSON shown; FIX-Task-2 Item 4, 2026-09-07). **Same class, second face: a user-visible value derived from an async read** — when the fetch comes back null the FALLBACK is the only branch that ever renders, so verify the rendered string on the real path and pick a fixture that exercises the branch you changed (FIX-Task-21 Item 2, 2026-09-12). **Third face: an invented mock shape** — copy the fixture from the SDK's documented constructor/`error_code` (real wrong-password = `400` + `invalid_credentials`, NOT `401` + no code), because a classification test asserting a shape the SDK never emits keeps an unreachable branch green and silently ships the wrong copy (FIX-Task-26 verification, 2026-09-13).
- BP-91 Mobile UI changes need an in-session on-device attempt — otherwise the Session Handoff must enumerate each owed device leg concretely (screen → action → expected observation), never a generic "device verification pending"; a UI change is never "verified" from typecheck/lint/unit tests alone, budget the device pass BEFORE the code work, and re-read the AX tree/element list instead of trusting a screenshot taken immediately after a tap (FIX-Task-25, 2026-09-13).
- BP-92 Paint only authoritative values — every displayed number must derive from the SAME array/state its visible list renders (no parallel state written by a second fetcher), all counters of one quantity must share one helper, and a money/state value must never be painted from a placeholder fallback that a fetch will correct — withhold it (`—`/skeleton) and disable any control that submits it until it is authoritative (FIX-Task-26, 2026-09-13).
- BP-93 Jest mocks must return identity-stable objects — a mock that returns a fresh object literal per render (e.g. `useNavigation: () => ({ navigate, goBack })`) re-creates every `useCallback` depending on it, so a `useFocusEffect` re-subscribes → fetch → setState → render → loop and the screen never leaves its loading state; return a module-level constant named with a `mock` prefix (babel-jest hoist) and debug by asserting mock call counts, not `console.log` (jest output is suppressed in this repo) (FIX-Task-26, 2026-09-13).
- BP-94 A `jest.mock()` factory must mirror the module's FULL export surface, and a BARE `jest.mock('<mod>')` (no factory) AUTO-mocks the entire module — every export becomes a `jest.fn()` returning `undefined`, so pure render-time logic (status/entitlement predicates, formatters, mappers) placed behind an I/O module silently disappears for every caller; add the export to every factory in the SAME pass AND keep dependency-free logic in its own leaf module the service re-exports (FIX-Task-28, 2026-09-13; auto-mock face FIX-Task-53, 2026-09-17).
- BP-95 Client-side in-memory caches of USER-SCOPED data must be keyed by user and cleared on auth transitions (`SIGNED_OUT`/`SIGNED_IN`/`USER_UPDATED`) — never one process-global slot read without a session check, or a warm account switch serves the previous user's data (a `_pmCache` leak showed one account another's saved card; QA SUB Android Round 1, 2026-09-16). Companion of BP-15 (refresh Bypass).
- Backward compatibility — defensively parse server responses (new fields optional, feature-detect), never crash on absent fields, keep old UI paths working during rolling deploys.

## BP-8: TypeScript Service Error Handling
Problem: App services catch errors and return undefined, making debugging impossible.

Rules:
- Services MUST return typed results:
```typescript
type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```
- NEVER: `catch (e) { return null; }`
- ALWAYS: `catch (e) { console.error('[serviceName]', e); throw e; }` or return structured error.

## BP-15: Pull-to-Refresh Must Bypass Client-Side Caches
Problem: The wallet screen calls `getSPReleaseDays()` and `getSPExpirationDays()` without `forceRefresh=true`. Both functions read from `getAdminConfig()` which has a 5-minute in-memory cache. Admin changes take up to 5 minutes to appear even after pull-to-refresh.

Rules:
- Every pull-to-refresh handler MUST pass `forceRefresh = true` to config/data fetching functions.
- When implementing in-memory caches (`CACHE_TTL_MS`), always expose a way to bypass them on refresh.
- Session Handoff Config Rule: At the end of every session, the "Suggested to improve agent rules" field MUST include any cache-bypass gaps discovered.

## BP-23: Realtime Callback Must Mirror Mount-Time Side Effects
Problem: A component runs important side effects (status updates, counts, derived state) on mount for existing data. When new data arrives via Realtime subscription, the handler only updates UI state — it silently skips those same side effects, causing stale/inconsistent state for all subsequent items. This is the class of bug that caused chat "delivered/read" status to only work for the first message.

Rules:
- For EVERY Realtime INSERT callback, ask: "What side effects run on mount for this same screen? Do they also need to run for newly arriving items?"
- The answer is almost always yes — if you mark items as "read" on mount, you must also mark new items as "read" when they arrive while the screen is open.
- Structure Realtime callbacks to check whether the arriving data needs treatment (e.g., only messages from the other user, not your own), then re-apply the same mount-time side effects.
- Document the decision explicitly in a comment above the callback:
```typescript
// SYNC-SIDE-EFFECT: This callback also runs [effect name]
// because new items arriving via Realtime need the same treatment
// as items loaded on mount. If you change the mount effect, update this too.
```

Detection checklist — for every component with a `useEffect` + Realtime subscription pair:
1. Find `useEffect` with side effects on mount.
2. Find Realtime subscription in the same component.
3. Is the INSERT/UPDATE callback doing everything the mount effect does for new data?
4. If no → BUG.

Common examples where this fires: chat read/delivered status, unread badge counts, wallet/balance updates, "new item" flags, auto-sync of state to server, analytics events for item views.

## BP-29: Downstream Reference Audit When Renaming or Restructuring Data Sources
Problem: When renaming, regrouping, or restructuring a data source variable (e.g., replacing a flat `submittedOffers` array with a `groupedSubmittedOffers` memo that returns a different shape), other references to the original variable are missed.

Mandatory audit checklist (search the entire file for the original variable name):
1. **Empty state checks** — Does the empty state condition still reference the old variable name? If so, it won't reflect the new grouped data correctly (e.g., `submittedOffers.length === 0` → must become `groupedSubmittedOffers.length === 0`).
2. **Conditional renders** — Does any `{variable.length > 0 && (...)}` guard still use the old name? It will show/hide the wrong section.
3. **Filter conditions** — Does any filter or `selectedFilter` comparison reference the old variable?
4. **Summary counters** — Does any count or badge use the old variable instead of the restructured one?

Common example: You replace a flat array with a grouped memo of `{type: 'single' | 'bundle', ...}` rows. The section renders from the new `groupedVariable`, but the empty state check still reads `oldVariable.length === 0` — the empty state never shows because the old variable is still populated, but the section reads from the new variable. Both are stale and inconsistent.

## BP-33: Globally Persistent UI Elements Must Be Rendered at Root Level
Problem: Bottom nav bars, headers, and other globally persistent UI elements are inconsistently rendered when individual screens are responsible for importing and rendering them. Some screens show the element, others don't, and the element's behavior varies by screen.

Rules:
1. Any UI element that should appear on 100% of authenticated screens (tab bar, global header, footer) MUST be rendered ONCE at the root authenticated stack level (outside the `Stack.Navigator` but inside the `NavigationContainer`).
2. Individual screens MUST NOT import or render globally persistent elements — doing so creates inconsistency.
3. The element's state (active tab, badge counts, visibility) must be managed by a shared context or navigation state, not per-screen props.
4. When converting from a per-screen pattern to a root-level pattern, remove ALL per-screen imports and renderings in the same change — do not leave orphaned imports.

Detection checklist:
- Search for `<PersistentTabBar` or similar component across all screen files — if it appears in more than one file, it should be at root level.
- Verify the element is present on every screen: tab screens, stacked screens, modal screens, and deep-linked screens.

## BP-34: Alert → Toast Replacement Must Audit ALL Success Paths
Problem: When replacing a blocking `Alert.alert("Added to Cart", ...)` with a non-blocking toast, it's easy to replace only the primary success path and miss nested success callbacks (e.g., inside `showDifferentSellerModal` callbacks), leaving an inconsistent UX.

Rules:
1. **Identify ALL success paths** in the handler where the item was successfully added/created. Search for every `Alert.alert` call that has a success message (not an error message).
2. **Verify error paths stay blocking** — error alerts MUST remain as blocking alerts so users cannot miss failure states.
3. **Verify choice modals stay blocking** — Modals that require user input MUST remain as blocking modals — only the *resulting success confirmation* should use a toast.
4. **Update all three layers** in every success callback: set toast message/subtitle, call `setShowToast(true)`, verify the badge-update function runs *before* the toast appears.
5. **Never blanket-replace** all `Alert.alert` calls in a file — each call site must be individually classified as success/toast, error/blocking, or choice/blocking.

## BP-35: Return Value Gate — Every Mutating Service Call Must Check Its Result
Problem: Service/API/RPC calls that return a `{ success: true/false }` result object are silently ignored by callers. When a mutation fails, the code proceeds as if it succeeded — the app shows a success state, but the database was never changed.

Rules:
1. **Every mutating service call that has a dependent next step MUST have its return value checked.**
2. **Pattern:**
```typescript
// ❌ WRONG — result ignored
await clearCart();

// ✅ CORRECT — result checked
const cleared = await clearCart();
if (!cleared.success) {
  Alert.alert('Could not clear cart', cleared.error.message);
  return;
}
```
3. **No silent fallbacks:** If the mutation fails, do not proceed with dependent operations. Surface the error to the user with an actionable message.
4. **Applies to ALL result-returning service functions:** `cartService`, `listingService`, `tradeService`, `spService`, `notificationService`, `subscriptionService`, etc.

## BP-36: Realtime Subscription Table Membership Verification
Problem: A `postgres_changes` subscription silently does nothing if the target table isn't in the `supabase_realtime` publication — no errors, no warnings.

Rules:
1. **Every `postgres_changes` subscription MUST have its target table confirmed in the `supabase_realtime` publication** via a migration.
2. **Verification query:**
```sql
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename IN (<table1>, <table2>);
```
Zero rows for any subscribed table = the subscription silently does nothing.
3. **RLS filtering awareness** — Even if the table is in the publication, Supabase Realtime filters events through RLS. If the subscribing user cannot `SELECT` the new row state, the event is silently dropped.
4. **Effect lifecycle hygiene** — Use a `useRef` to hold the unsubscribe function, use a `cancelled` flag to prevent async callbacks from setting state after unmount, and do NOT include the data array in the dependency array unless re-subscription is intentional.
5. **Migration + code must ship together** — If a subscription requires adding a table to `supabase_realtime`, the migration and code change MUST be in the same PR.

## BP-39: `FunctionsHttpError.message` Is Hardcoded — Always Parse `.context` for the Real Error
Problem: The `@supabase/functions-js` `FunctionsHttpError` class has `.message` hardcoded to `"Edge Function returned a non-2xx status code"`. The real response body is only accessible via `.context`, a `Response` object.

Rules:
1. **Never rely on `FunctionsHttpError.message` for diagnosis.**
2. **Always parse `.context.clone().json()`:**
```typescript
if (error && 'context' in error) {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json();
      console.error('[ServiceName] Edge Function error:', body?.error);
      throw new Error(body?.error || error.message);
    } catch { /* fall through */ }
  }
}
```
3. **Use `.clone()` before reading the body** — the `Response` body can only be read once.
4. The component/service calling `supabase.functions.invoke` should parse `.context`, not a generic error handler.

## BP-42: Tax Preview on Trade Detail Screens Must Use Joined Listing Price, Not `cash_amount_cents`
Problem: `TradeDetailScreen.tsx` and `TradeTimelineScreen.tsx` computed their live tax preview using `trade.cash_amount_cents` as the taxable base — which is the item price MINUS any Swap Points applied, not the full item price. Same class of bug as BP-37 (see `supabase-sql`/business-logic docs), but for screens that consume trade objects instead of listing objects.

Rules:
1. Any screen computing a tax preview from a trade/offer object MUST derive the taxable base from the joined listing's stored `price` field, never from `cash_amount_cents`/`offerAmountCents`/similar post-SP fields.
2. Pattern:
```typescript
// ✅ CORRECT — full item price from joined listing
const taxableAmountCents = Math.round((((trade as any)?.listing as any)?.price ?? 0) * 100);

// ❌ WRONG — this is price minus SP
const taxableAmountCents = trade.cash_amount_cents;
```
3. Audit all `useTaxCalculation(` call sites when fixing or reviewing a tax-related PR.

## BP-53: QA-Automation `testID`s Must Be Exposed as Real iOS Accessibility Elements

Problem: A control shipped with a `testID` (intended for QA automation) does not appear in the iOS accessibility tree unless it is a real accessibility element. A bare `<TouchableOpacity>` with only `testID` renders on screen but its identifier is invisible to the tree, so automation cannot target it — the "stable identifier" a task promised doesn't exist on-device. Unit/widget tests pass because they query the React tree directly, which is NOT the same as the native iOS accessibility tree. (2026-08-11 Stage 3 QA: the GlobalAlertProvider's 4 dialogs — age gate, invalid referral ×2 buttons, OTP dev-bypass, OTP success — were visually branded, but none of their button testIDs surfaced on the simulator's tree; the pre-existing `ui/Button`-based dialogs DID, because `ui/Button` sets `accessible` + `accessibilityRole`.)

Rules:
1. Any control that carries a `testID` for QA/automation MUST also set `accessible` (and, for buttons, `accessibilityRole="button"` plus `accessibilityLabel` equal to the visible text) so the identifier is exposed to the iOS accessibility tree. Mirror `src/components/ui/Button.tsx`, which already does this.
2. When adding or migrating a dialog/modal with identifier-carrying buttons, verify the `testID` resolves with the accessibility-tree/element-listing tool on the running simulator — unit/widget tests alone are insufficient evidence of iOS discoverability.
3. Pattern:
```tsx
// ✅ CORRECT — identifier surfaces on iOS
<TouchableOpacity
  testID="age-gate-dialog-ok-button"
  accessible
  accessibilityRole="button"
  accessibilityLabel="OK"
  onPress={...}
/>

// ❌ WRONG — renders but identifier is invisible to the iOS tree
<TouchableOpacity testID="age-gate-dialog-ok-button" onPress={...} />
```
4. Detection checklist: after a modal/alert/button change, run the element-listing tool on the simulator and confirm each intended `testID` appears; if the identifier is missing but the element renders, it's an exposure bug (add `accessible`/`accessibilityRole`), not a tooling limitation.
   - If a modal's buttons carry `testID` + `accessible` + `accessibilityRole` + `accessibilityLabel` yet STILL don't surface, inspect the modal's CONTAINERS: any `Pressable`/`Touchable*` backdrop or sheet will group its children into one accessibility element. Set `accessible={false}` on those containers (the overlay AND the sheet) — `accessibilityViewIsModal` on the `<Modal>` alone is NOT sufficient.
5. **RN `<Modal>` containers that are `Pressable`s GROUP their children and hide them from the AX tree** (2026-09-01, DT84 / QA Task 17 F-4): a branded modal whose backdrop/sheet are `Pressable`s defaults to `accessible={true}` and collapses the whole overlay into one accessibility element — the modal's buttons vanish even when each carries `testID` + `accessible` + `accessibilityRole` + `accessibilityLabel`. `GlobalAlertProvider` never hit this because its backdrop is a plain `<View>` (non-grouping). Pattern:
```tsx
// ✅ CORRECT — buttons surface individually (accessible={false} on the Pressable containers)
<Modal visible transparent animationType="slide" accessibilityViewIsModal onRequestClose={close}>
  <Pressable accessible={false} style={overlay} onPress={close}>
    <Pressable accessible={false} style={sheet} onPress={(e) => e.stopPropagation()}>
      <TouchableOpacity
        testID="btn-accept-all-confirm"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Accept All"
        onPress={...}
      />
    </Pressable>
  </Pressable>
</Modal>

// ❌ WRONG — the Pressable backdrop/sheet group their children; buttons are invisible to the AX tree
<Modal visible transparent animationType="slide" accessibilityViewIsModal onRequestClose={close}>
  <Pressable style={overlay} onPress={close}>
    <Pressable style={sheet} onPress={(e) => e.stopPropagation()}>
      <TouchableOpacity testID="btn-accept-all-confirm" accessible accessibilityRole="button" accessibilityLabel="Accept All" ... />
    </Pressable>
  </Pressable>
</Modal>
```
6. **Some `accessibilityRole` VALUES never register on iOS, even with `accessible` set.** On RN 0.81 (Fabric), `accessibilityRole="tab"` (and `"tablist"` on a container) does NOT surface in the iOS accessibility tree — confirmed on-device 2026-08-20 (the bulk `bulk-step-*` step indicator on `BulkListingCreateScreen` was invisible until the role was changed to `"button"`; removing the container's `tablist` role and disabled-node flattening were both ruled out by controlled on-device experiments). For tappable steps/tabs, use `accessibilityRole="button"` and carry current state via `accessibilityState` + the label (e.g. `"Step 2: Group, current"`). Do NOT use `tab`/`tablist` on iOS.
Pattern (tab-like tappable step that actually surfaces):
```tsx
// ✅ CORRECT — registers on the iOS tree; current step carried in label + state
<TouchableOpacity
  testID="bulk-step-group"
  accessible
  accessibilityRole="button"
  accessibilityState={{ selected: isCurrent, disabled: !isTappable }}
  accessibilityLabel={`Step 2: Group${isCurrent ? ', current' : ''}`}
/>

// ❌ WRONG — accessibilityRole="tab" renders but never registers in the iOS tree
<TouchableOpacity testID="bulk-step-group" accessible accessibilityRole="tab" ... />
```

## BP-54: Never Use Dynamic `import('react-native')` / Enumerate RN's Exports — Lazy-Getter Load Can Crash on Missing Native Modules

Problem: `ResetPasswordScreen` parsed the reset-password deep link with `(await import('react-native')).Linking.getInitialURL()`. Metro compiles a dynamic `import('react-native')` into an async require whose `importAll()` interop enumerates every own property of RN's exports object (`for...in`). React Native exposes many modules as **lazy getters** to defer their load — one is `PushNotificationIOS`. Touching that getter loads `PushNotificationIOS.js`, whose module scope runs `new NativeEventEmitter(NativePushNotificationManagerIOS)`; that native module is `null` when the `React-RCTPushNotification` pod isn't linked (this app uses `expo-notifications`; the pod is NOT installed), producing a fatal `new NativeEventEmitter() requires a non-null argument.` redbox on the reset-password deep link, plus a caught `Cannot read property 'default' of undefined` inside the same TurboModule-load path. This affects Release too, not just dev — the pod absence and the `importAll` enumeration are build-wide (the LogBox overlay is dev-only; the underlying throw would still fire in production).

Rules:
1. NEVER use a dynamic `import('react-native')` / `import * as RN from 'react-native'` and then access or iterate RN's exports — the enumeration force-loads RN's lazy getters and crashes when an optional native module isn't linked.
2. ALWAYS import the specific symbol with a static import (`import { Linking } from 'react-native'`), resolved at bundle time — it never triggers the getter enumeration. `expo-linking` (static) is the preferred alternative for deep-link parsing.
3. Pattern:
```ts
// ✅ CORRECT — static import, bundle-time resolution
import { Linking } from 'react-native';
...
Linking.getInitialURL().then(handleResetUrl);

// ❌ WRONG — dynamic import enumerates RN's lazy getters
const url = await (await import('react-native')).Linking.getInitialURL();
```
4. Detection checklist: if a deep link (or any screen) that dynamically imports `react-native` crashes with `new NativeEventEmitter() requires a non-null argument.` / `Cannot read property 'default' of undefined`, search for `import('react-native')` and replace it with a static import; then verify warm AND cold deep-link delivery on-device plus a tokenized link still parses (fake token → expected auth error, not a crash).

## BP-56: Discover/Design Code Must Use the Canonical Pass-It-Up Tokens — Never Legacy `design-system.md` or Raw Hex

Problem: The Discover screen's design tokens (`src/theme/discoveryTokens.ts`) were sourced from the legacy `docx/design-system.md` (primary `#4A7C59`), while the canonical palette in `docx/design-system-passitup.md` (primary `#5DBB8E`) is what `src/theme/colors.ts` and the QA design-system audit use. The drift produced mixed palettes on one screen (Filters sheet Apply button `#4A7C59` next to a correct `#5DBB8E` Reset), iOS system blue (`#007AFF`/`#EEF6FF`) in the sort dropdown, and raw legacy hex scattered in components. (2026-08-17 QA design-system audit — 14 deviations, all from the wrong token source.)

Rules:
1. Before writing any new Discover/design code, verify `src/theme/discoveryTokens.ts` is still reconciled to the CANONICAL `docx/design-system-passitup.md` (primary `#5DBB8E`, tint `#E8F5F0`, secondary text `#6B6B6B`, border `#E0E0E0`) — its color values MUST match `src/theme/colors.ts`.
2. NEVER source Discover colors from the legacy `docx/design-system.md` (primary `#4A7C59`) — that file is deprecated for new code.
3. NEVER hardcode hex colors in Discover components — import the `ds` tokens from `@/theme/discoveryTokens` (the pattern `SortDropdown.tsx` and `RadiusSlider.tsx` were converted to).
4. No iOS system blue (`#007AFF`/`#EEF6FF`) or Tailwind-style grays (`#E5E7EB`, `#1F2937`, `#4D4D4D`) on Discover — use the passitup treatment (e.g. selected pill = `ds.primary[100]` tint + `ds.primary[500]` text).
5. Pattern:
```ts
import { ds } from '@/theme/discoveryTokens';
// ✅ CORRECT — selected sort option uses passitup tint + primary
backgroundColor: ds.primary[100],
color: ds.primary[500],
// ❌ WRONG — iOS system blue / legacy palette / raw hex
backgroundColor: '#eef6ff',
color: '#007AFF',
color: '#4A7C59',
```
Detection checklist: on the Discover screen, scan for any legacy primary (`#4A7C59`), iOS system blue (`#007AFF`/`#EEF6FF`), or raw Tailwind grays (`#E5E7EB`, `#1F2937`, `#4D4D4D`) — and confirm `discoveryTokens.ts` still matches `colors.ts`.

## BP-57: A Behavior Fix That Makes an Auto-Verify/Auto-Submit Path Work Will Break Tests Written Around the Old Broken Behavior — Audit & Update Them

Problem: When a fix makes an auto-verify / auto-submit / auto-advance path actually work (it previously failed silently, so tests relied on a manual fallback), the tests written around the OLD broken behavior break. Real case (2026-08-21, Group L backlog Fix 2): `usePhoneVerification.verifyCode(overrideCode?)` fixed the OTP auto-verify state race (the freshly-typed code is now passed through instead of reading a stale `state.code`) — the modal now closes on the 6th digit — which broke 3 `PhoneVerificationModal` tests that typed 6 digits and then tapped the manual Verify button (the button was unreachable because auto-verify had already succeeded and closed the modal). Those failures were EVIDENCE the fix worked, not regressions.

Rules:
1. When a fix changes an auto-verify / auto-submit / auto-advance behavior, run the affected test suites BEFORE merging. If they fail, audit whether they were written around the old broken behavior (e.g., a test that manually taps a fallback button because the auto-path used to fail).
2. Update those tests to assert the CORRECT new behavior (e.g., the 6th digit auto-verifies and calls `onSuccess`/`onClose`; an auto-fired error surfaces immediately) rather than "fixing" them to re-exercise the manual fallback.
3. If the manual-fallback UI still exists as a real affordance, keep ONE dedicated test for it (e.g., the DEV autofill button) — just don't let the happy-path test depend on it because the auto-path used to be broken.
4. NEVER revert or weaken the behavior fix to keep old tests green.

Detection checklist: a fix that removes a "state race" / makes an "auto-X now works" path — grep the affected tests for a manual-fallback tap (e.g., a `*-verify` press after typing a full code) that may now be unreachable; confirm (unit or on-device) whether the auto-path fires first.

## Backward Compatibility for the Mobile Client

The app may talk to a backend one deploy ahead (or behind) during rolling deploys. Client code MUST survive both directions.

Rules:
- **Defensively parse server responses.** Treat any new server field as optional: `data.field ?? fallback`, or feature-detect with `'field' in data` / `data.field != null` before using it. Never assume a field the current backend version doesn't yet send is present.
- **Never crash on an absent field.** A missing field from an older backend (or one mid-deploy) must degrade gracefully, not throw.
- **Don't reshape service return types** without auditing every caller (see BP-29).
- **Cache compatibility.** When a cached object's shape changes (e.g., a service now returns a grouped array), add a cache schema version or clear old-shaped entries — never read a stale-shaped cached object as if it were the new shape.
- **Keep old UI paths working** when a new field is absent — render the pre-feature state instead of blocking the screen.
- If a field is REQUIRED by the UI but optional in the API, add a `// TODO(BACKCOMP):` noting the contract change and coordinate both sides.

## BP-58: Bottom-Anchored UI Must Clear the Floating Pill Nav (PersistentTabBar)

Problem: The global bottom nav is a floating pill (`PersistentTabBar`, rendered once at the root authenticated stack) that overlays the bottom of every screen. Bottom-anchored content — fixed CTAs, sticky bars, or a trailing Save/Submit button inside a ScrollView — gets hidden behind the pill. This recurred 5× (2026-08-16…22): Profile logout, Edit Profile Save, the bulk-flow Submit CTA, the Apply-to-All panel, and onboarding Skip/Continue. The overlap blocks the user's key action and looks broken.

Rules:
- The pill top sits ~110pt from the bottom (safe-area inset + `spacing.sm` + pill height), so any bottom-anchored element that must stay visible/tappable needs clearance:
  - Scroll content → `paddingBottom: 100` on the scroll `contentContainerStyle` (app-wide standard — Home, Cart, Trades, Favorites, Profile, Edit Profile).
  - Fixed bottom bar (`position: 'absolute', bottom: 0`) → `bottom: 120` (CartScreen's `stickyBottomContainer` is the canonical example).
  - In-flow bar that must sit ABOVE a fixed bottom bar → `marginBottom: 200` (the ApplyToAllBar, whose bar top is ~192pt once the fixed Submit bar sits at `bottom: 120`).
- Never leave a trailing CTA flush at the very bottom of a pill-nav screen.
- When adding a fixed/sticky bottom element, size its clearance against the pill height, not just the safe-area inset.
- **A `paddingBottom` only works when the content actually OVERFLOWS the viewport.** The clearance values above lift a ScrollView's last child only if the content is taller than the viewport; a screen whose content fits does not scroll AT ALL, so no amount of bottom padding moves the trailing element out from under the pill — and the change will look correct in source and fail on-device. Before claiming (or accepting) a padding-bottom fix, verify the content overflows: compare the ScrollView frame against the last child's `y + height + paddingBottom` in the AX tree, or read the content/viewport sizes via `onContentSizeChange` + `onLayout`. If it does not overflow, the fix must be a **layout** change — move the trailing note/CTA above a mid-content anchor, trim vertical spacing, or allow the content to scroll — not padding.
  - Real miss (FIX-Task-41 item 11, 2026-09-16): `JoinKidsClubScreen` was given `paddingBottom: 100` for a footnote sitting under the pill, but its content was ~2063px against a 2166px viewport, so the screen never scrolled and the footnote did not move at all. The identical change DID fix `ContinueKidsClubScreen`, whose content overflows — same rule, opposite outcome, decided entirely by the overflow check.

Detection checklist: for every new/edited screen, grep for a bottom-anchored element (`position: 'absolute', bottom: 0`, a trailing button in a ScrollView, or a sticky footer) and verify it clears the pill; on-device, scroll each such screen to the bottom and confirm no CTA/button is partially hidden behind the pill. **If scrolling does not move the trailing element at all, the content does not overflow — that is a layout problem, not a padding problem** (see the overflow rule above); do not report a padding fix as verified and do not keep re-scrolling.

## BP-59: Verify Scripted JSX Mass-Edits With More Than Typecheck Alone

Problem: A bulk-edit tool that rewrites JSX without a real AST parser can insert props as invisible JSX **text children** rather than actual element attributes. TypeScript's typecheck does NOT catch this — the inserted text is still syntactically valid JSX children, just semantically wrong (e.g., a bare `accessible` / `accessibilityRole="button"` rendered as visible text inside a `<View>` instead of a prop on the `<TouchableOpacity>`). Observed live 2026-08-23 during the app-wide BP-53 sweep: ~15 files corrupted this way (stray `accessible`/`accessibilityRole` lines inserted as children or into object literals/destructuring); `yarn typecheck` stayed green and only a targeted grep caught it.

Rules:
1. After any scripted/bulk JSX prop-insertion edit (e.g., adding `accessible`/`accessibilityRole`/`accessibilityLabel` across many files at once), before considering the change complete:
   (a) **Run typecheck** (`yarn typecheck`) — necessary but NOT sufficient.
   (b) **Run a targeted grep** for the pattern of a bare prop-like line immediately followed by a JSX child — i.e., confirm the inserted text landed as a JSX attribute INSIDE the opening tag, not as rendered/child content. Example (also repeat for `accessibilityRole="..."`):
       `grep -rn -A1 -E '^[ ]*accessible$' --include="*.tsx" src` — any hit whose next line starts with `<` or `</` is corruption (a real prop is followed by another prop or `>`).
   (c) **Run Prettier/the formatter** and confirm it does NOT rewrite the affected regions unexpectedly — a formatter choking on, or silently reformatting, the inserted lines is itself a signal something is structurally wrong.
2. Do NOT skip steps (b) and (c) just because (a) passes — passing typecheck is necessary but not sufficient evidence the edit is structurally correct.
3. When a scripted pass is used at all, prefer a parser-based transform; if a regex/line-based transform is used, treat every insertion as suspect until verified.

Detection checklist:
- `grep -rn -A1 -E '^[ ]*accessible$' --include="*.tsx" src` → any match whose next line starts with `<` or `</` is a JSX-text-children corruption (should never happen for a real prop).
- `yarn typecheck` passing is NOT proof of correctness for scripted JSX edits.

## BP-61: Accessibility Props Must Be Attributes on the Opening Tag — Never Literal `<Text>` Children

Problem: A recurring copy-paste mistake (confirmed 3 times: `WelcomeScreen`, `ResumeDraftBanner.tsx`, `CartScreen.tsx`) pastes accessibility props (`accessible`, `accessibilityRole="..."`, `accessibilityLabel="..."`) as literal string content inside a `<Text>` component's children instead of applying them as real JSX attributes on the opening tag. Users/QA then see a junk rendered line (e.g. `accessible accessibilityRole="button" You have 1 unfinished listing`) and the element loses its accessibility semantics entirely. Typecheck does NOT catch it — the pasted text is syntactically valid JSX children.

Rules:
1. Whenever writing or touching a `<Text>` component (not just during a dedicated sweep task), do a quick sanity check that any accessibility props are attributes on the opening tag (`<Text accessible accessibilityRole="..." accessibilityLabel="...">`), not part of the rendered children.
2. When reviewing a diff that touches `<Text>` components, grep for the pattern as a matter of course — `rg -n "accessible accessibilityRole=" p2p-kids-marketplace/src` → any hit that appears inside JSX children (not on an opening tag) is this bug class. Also try variants: `accessible accessibilityHint`, `accessibilityRole="..." accessibilityLabel`, or a bare `accessible` line inside a `<Text>`.
3. If a `<Text>`'s children contain prop-like keywords (`accessible`, `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, `onPress`), treat it as a suspected paste-corruption until confirmed otherwise.

Detection checklist:
- `rg -n "accessible accessibilityRole=" p2p-kids-marketplace/src` → on an opening tag = fine (real attribute); inside `<Text>` children = BUG.
- A user-visible line like `accessible accessibilityRole="button" ...` in the rendered UI is the on-device symptom.
- Genuine attribute usage (e.g. `ReviewCard.tsx` / `IssueReportModal.tsx` TouchableOpacity props) is NOT this bug — do not "fix" those.

## BP-82: Account/Subscription Screens Must Use Pass It Up Semantic Tokens — No Material / Tailwind / iOS-System-Blue / Legacy-Design-System Leakage (ManageSubscription / ContinueKidsClub family)

Problem: The account/subscription screen family hardcodes foreign palettes instead of the Pass It Up semantic tokens from `docx/design-system-passitup.md` (primary/success `#5DBB8E`, error `#E85D75`, warning `#FFA726`, info `#5B8FB9`, neutrals `#1A1A1A`/`#6B6B6B`/`#999999`). Confirmed 2026-09-02 (QA Task 21) on the **Manage Kids Club+** screen (`ManageKidsClubScreen.tsx` + `components/subscription/{PaymentMethodSection,AutoRenewToggle,BillingHistoryLink}.tsx`): status badges use the Material palette (`badge_active #4CAF50`, `badge_grace_period #E53935`, `badge_trial #29B6F6`, `badge_cancelled #FFA726`); the primary "Add Payment Method" CTA and the Auto-Renew switch render in iOS system blue (`#0066CC`, track `#93C5FD`); the disabled-warning text is Tailwind amber-600 `#D97706` (≠ warning `#FFA726`); text grays are Tailwind (`#111827`/`#6B7280`/`#D1D5DB`) rather than the canonical neutrals. **Extended 2026-09-05 (QA Task 34):** `ContinueKidsClubScreen.tsx`'s **upsell branch** ("Start Kids Club+", rendered for trial/free/grace/expired users) leaked the **legacy-design-system primary `#4A7C59`** (price card, "Join Kids Club+ on the web" CTA, outline variant) and non-canonical greys `#4D4D4D`/`#808080` — while the SAME file's DT-118 **active** branch was correctly on-brand `#5DBB8E`. BP-56 names `#4A7C59` but is Discover-scoped, and BP-82's grep list did not include the legacy green/greys, so the leak slipped both nets until the owner flagged it visually.

Rules:
1. When writing or editing account/subscription screens (Manage/My Subscription, Payment Method, Auto-Renew, Billing History, **ContinueKidsClub** and its trial/upsell/active branches), use the Pass It Up semantic tokens — the primary-green `#5DBB8E` pill for primary CTAs and the semantic error/warning/info colors for badges/callouts. Never Material (`#4CAF50`, `#E53935`, `#29B6F6`, `#FFA726`-only), Tailwind gray/amber scales (`#111827`, `#6B7280`, `#D1D5DB`, `#D97706`), iOS system blue (`#0066CC`, `#007AFF`, `#93C5FD`), or the **legacy-design-system tokens `#4A7C59`/`#4D4D4D`/`#808080`** (the deprecated `design-system.md` primary + non-canonical greys — BP-56's Discover hexes leaking outside Discover).
2. Status badges should mirror doc semantics: active → success `#5DBB8E`; grace/cancelled/pending → warning `#FFA726`; expired/failed → error `#E85D75` (not Material red `#E53935`).
3. Toggle/switch ON states should use the primary `#5DBB8E` (not system blue); warning copy uses `#FFA726` (not `#D97706`); text tiers use `#1A1A1A`/`#6B6B6B`/`#999999`.
4. Prefer the shared token source/`ui` components so new screens inherit the palette; where a theme file exists, keep it reconciled per BP-56's discoveryTokens discipline.
5. Before merging any subscription/account UI change, grep the touched files for `#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080` — a hit is a token leak to fix.
6. **Every rendered variant/branch of a screen must be on-brand** — when a screen has multiple branches (e.g. ContinueKidsClub's trial/upsell vs active states; per-status subscription surfaces), each branch's styles must use the canonical tokens. A branch you did not render under the current user's state can silently leak (QA Task 34: the ContinueKidsClub active branch was on-brand while its upsell branch used `#4A7C59`). Grep the WHOLE file (and its sibling branch styles) for the forbidden tokens, never just the branch under test.

Detection checklist:
- `rg -n "#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src` — **app-wide** (DT-119 2026-09-05: the class recurs beyond subscription/ — profile + trade screens too; the subscription dirs are only the historical hot spot). The bare 3-hex fast check (R62b) is `rg -n "#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src`. Dead/deprecated screens with no active navigation (e.g. `SellerEarningsScreen`, Dev Task 86) are not live leaks.
- Visual: a primary CTA or toggle rendering blue instead of green `#5DBB8E`, an "Active" badge rendering Material green instead of the brand green, or a price/CTA card rendering the dark legacy green `#4A7C59` (e.g. the ContinueKidsClub upsell branch) instead of the brand `#5DBB8E`.
See also: BP-56 (Discover/design tokens via `@/theme/discoveryTokens` — `#4A7C59`/`#4D4D4D` are its forbidden legacy hexes too), BP-86 (membership/value-prop copy must be canonical on every screen/branch).

## BP-85: Money Values Stored in Cents Must Use a Cents Formatter — Never the Dollars Formatter

Problem (DEV-TASK-118 follow-up, 2026-09-05): ContinueKidsClubScreen's membership recap rendered the member flat fee as “Flat **$149** …” because the value is stored in CENTS (`getActiveMemberFeeCents()` → 149) but was formatted with `formatDollarAmount(149)` — which expects DOLLARS and just prepends `$`. `formatPrice(149)` divides by 100 first → “$1.49”. A “$149 vs $1.49” on a fee/balance surface is a trust/compliance bug (the user reads a 100× inflated charge).

Rules:
1. Know the unit of every money value before formatting: config keys/columns suffixed `_cents` (`buyer_fee_active_member_cents`, `minimum_withdrawal_amount_cents`, every `seller_balance.*_cents`, `sp_wallets.available_balance`) are CENTS; `getSubscriptionPrice()` is normalized to DOLLARS by `normalizeSubscriptionPriceMonthly`.
2. Cents → `formatPrice(cents)` ("$1.49"); dollars → `formatDollarAmount(dollars)` ("$7.99"). Never pass a cents value to the dollars formatter.
3. Detection checklist: before shipping any fee/balance/summary copy, grep for the pairing `formatDollarAmount(` fed by a `*_cents` source — that pairing is the bug class (`rg -n "formatDollarAmount\(.*Cents" p2p-kids-marketplace/src`).

## BP-86: Membership / Value-Prop Copy Must Come From the Canonical In-App Benefit Set — Grep the Whole Class Before Shipping

Problem (DEV-TASK-118 follow-up, 2026-09-05): the ContinueKidsClub “already active” recap (and its sibling trial branch) advertised a made-up benefit list — “Donation option for listings / Advanced trading insights / Exclusive badges & achievements” — which is NOT what Kids Club+ membership provides, and it omitted the headline benefit (the flat Safety & Platform fee). The canonical set already exists in-app (ManageKidsClubScreen “Kids Club+ Benefits” card + JoinKidsClubScreen `STATIC_BENEFITS` + the BRD/SYSTEM_REQUIREMENTS fee + SP + priority features) — the recap simply drifted.

Rules:
1. When authoring or touching membership/value-prop copy on ANY surface, source the benefit list from the canonical in-app set (e.g. ManageKidsClubScreen “Kids Club+ Benefits” card / JoinKidsClubScreen `STATIC_BENEFITS`); do not hand-invent rows.
2. Before shipping, grep the WHOLE class — `rg -n "Advanced trading insights|Exclusive badges|Earn & spend Swap Points" p2p-kids-marketplace/src` — every screen/branch showing a benefits recap must match the canonical list. A fix applied to one branch but not the sibling branch (same screen) is the recurring miss.
3. When a benefit row carries an admin-configurable money value (flat fee), fetch it live (`getActiveMemberFeeCents()`, BP-28) and format with a cents formatter (BP-85) — never a hardcoded figure.

## BP-88: A Defensive/Error-Classification Branch Is Only Correct If Its Trigger Actually Fires on the Real Runtime Path — a Mocked Unit Test Can Green-Light Dead Code

Problem (FIX-Task-2 Item 4, 2026-09-07): a fix added a `ProviderDisabledError` classification inside `oauthService.ts` (L162–174) so `SocialLoginButtons` could show a friendly in-app banner instead of the raw `400 validation_failed "provider is not enabled"` JSON page when a provider (e.g. Apple) is disabled in Supabase Auth. The unit test PASSED by mocking `supabase-js` to throw at initiation. On-device (iOS + Android), tapping Apple with the outage toggle disarmed still opened the in-app Safari sheet / Chrome custom tab to the raw JSON — the classification never fired. Root cause: `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })` (L143–151) returns the authorize URL WITHOUT throwing for a disabled provider; the 400 only renders when the browser opens that URL, which is outside the client's try/catch. The branch was dead code that Tier-0 green never caught.

Rules:
1. When adding a defensive/error-classification branch, confirm the guarded error actually SURFACES at that point in the REAL runtime flow — read the SDK's actual behavior under the exact call config (`skipBrowserRedirect`, timeout, provider), don't assume it throws because a mock made it throw.
2. If the error renders outside the client's control path (e.g. inside the opened browser sheet/custom tab), the classification cannot intercept it — fail fast BEFORE the side-effecting call (e.g. pre-validate the provider against the enabled set) or handle the post-return state.
3. Treat a passing unit test that mocks the trigger into existence as necessary but NOT sufficient: mark the branch "verify on-device trigger" and drive the real flow (QA Test Agent R79-2, §5.76) before closing.
4. **A user-visible value derived from an ASYNC READ must be verified as RENDERED, not as coded (FIX-Task-21 Item 2, 2026-09-12).** A screen can hold a perfectly correct expression (`counterpartyProfile?.name || 'the buyer'`) and still show the role label in production, because the fetch that supplies the name silently returns null on the real path. Typecheck, lint and unit tests were all green while the intended branch never executed once — the fallback was the only thing users ever saw, and it LOOKED intentional. Before closing any copy/label fix whose value comes from a read (a fetched name, a joined row, a config value, a derived flag), assert the exact rendered string in the AX tree or a screenshot for the specific state — and prefer resolving it inside the screen that renders it over trusting the caller to pass it, since a caller's own read can fail the same way and a deep-link entry carries no value at all.
5. **Pick a fixture that actually exercises the branch you changed.** The same screen had two completed trades: the already-reviewed one rendered the new summary line, the unreviewed sibling rendered the review CTA. A single fixture would have "verified" only one branch and hidden a total no-op on the other. Name the state you need (already-reviewed / not-reviewed / empty / error) and choose the fixture for it deliberately, exactly as BP-88 rule 3 demands for error branches.
6. **The mocked error must have the SHAPE the real SDK produces — copy it from the SDK's own contract, not from memory (FIX-Task-26 verification, 2026-09-13).** A login-failure fix fed `normalizeAuthFailure()` a pass-through rule (any `code` not ending in `Error` is returned verbatim) and a unit test that mocked the wrong-password error as `{ name:'AuthApiError', status: 401, message: 'Invalid login credentials' }` — **no `code`, and `status: 401`**. The real response is `new AuthApiError('Invalid credentials', 400, 'invalid_credentials')` (HTTP **400** + snake_case `error_code`, per the SDK's own JSDoc/constructor): the normalized code `'invalid_credentials'` matched no `switch` case and fell to `default:`, so on-device the parent got *"We couldn't sign you in just now. Please try again in a moment."* while the guide-asserted **"Invalid email or password."** never rendered once — a user-fixable mistake reported as a transient outage. The test had been green for weeks because it asserted a shape the SDK never emits. **Rule:** when a classifier switches on a third-party SDK's error, derive the fixture from that SDK's documented constructor / `error_code` vocabulary — read `node_modules/<sdk>/…` at verification time rather than trusting a remembered shape — and make the mock carry **both** the status AND the code field the classifier actually reads. A classification/guard test with an invented fixture shape is Tier-0 noise, not evidence the branch is reachable.

## BP-91: A Mobile Screen-Behaviour Change Needs an In-Session On-Device Attempt — Otherwise the Handoff Must Enumerate Every Owed Device Leg

Problem (FIX-Task-25, 2026-09-13): a round shipped **8 mobile screen/dialog changes** — a refetch-on-success registry, a focus refetch on Review Offer, gated + `testID`-labelled seller buttons, a live countdown sub-line in the timeline status banner, a destructive-section restyle in the Basket, and an in-basket tap-through to the Basket — with Tier 0 fully green (typecheck clean, scoped lint 0 errors, **3789 unit tests passed**) and **zero on-device rendering verification**. A booted emulator, an installed dev-client build and a running Metro were all available; the device pass was simply deferred to the end and never happened. Every claim in that handoff ("both buttons are visibly disabled", "the countdown shows in the status banner", "the in-basket state taps through") rested on code inspection plus unit tests — which BP-53 already rules insufficient on their own for iOS AX exposure, and which BP-88 rule 4 rules insufficient for a RENDERED value. The risk is not hypothetical: BP-53 exists precisely because `accessibilityRole="tab"`/`"adjustable"` never surfaced on iOS RN 0.81 while the unit tests were green, and the one device attempt made in that same session already returned a STALE frame (a `save_screenshot` fired immediately after a tab tap showed the previous screen while the AX tree already reported the new one) — the exact unreliable-driver hazard the On-Device Live-Verification Discipline warns about.

Rules:
1. When a change alters what a mobile screen **renders** or how a control **behaves** (layout, gating/disabled state, copy, a new element, a new tap target), make an on-device attempt in the **same session**. Do not defer all device work to "next session" and then report the change as complete.
2. If the device pass genuinely cannot happen (no booted device/Metro, an environment blocker per `QA-Test-Agent.instructions.md` §5.8, or an explicit budget decision), the Session Handoff MUST enumerate each owed leg as a concrete step — **screen → action → expected observation** — and name the fixture state it needs. "On-device verification pending" is not an enumeration.
3. Never describe a UI change as verified/working on the strength of typecheck + lint + unit tests alone. Say explicitly: "code-level verified; device legs owed" — the same honesty BP-80 requires for provisioning ("written, NOT applied") and mark the tier DEFERRED rather than implying it passed.
4. **Budget the device pass before the code work, not after.** The cheap ordering is Tier 0 → device leg → docs/polish: a device pass that reveals a layout or behaviour problem invalidates any polish built on top of it, so a late device pass maximises rework.
5. When polling a device, do not trust a screenshot captured immediately after a navigation/tab tap — re-read the AX tree or element list to confirm the screen actually changed before asserting anything about it (observed: an instant post-tap `save_screenshot` returned the previous screen).
6. **Sibling of BP-53** (testIDs must be real iOS accessibility elements and confirmed on-device) and **BP-88 rule 4** (assert the rendered string in the AX tree or a screenshot for the specific state): this rule governs the *scheduling/handoff* obligation, not the exposure mechanics.

*Evidence / origin: FIX-Task-25 (2026-09-13) — the handoff for that round carried an explicit "On-device legs still owed (a)–(e)" list precisely because the device pass was deferred to the end of the session; the reviewer's own suggested rule was "a mobile screen-behaviour change must be accompanied by an on-device verification attempt in the same session, or the handoff must say exactly which device legs are owed and why". Applied via `.github/prompts/apply-handoff-rule-suggestion.prompt.md`.*

## BP-24: Partial Reverts Must Leave `DEFERRED-DECISION` Comments

> Cross-cutting rule (applies to any layer); parked here because the canonical real case was a mobile-surface revert. Apply it to SQL/Edge Function reverts too.

**Problem:** When a previous session's approach is partially reverted (e.g., removing Discover badges but keeping `ItemDetailScreen` badges), future sessions have no way to know that the remaining code survived a deliberate revert rather than being accidentally left behind. This leads to either: (A) the code being silently removed in a cleanup pass, reintroducing the original bug, or (B) the code being treated as the canonical pattern and duplicated elsewhere, spreading a pattern that was already partially abandoned.

**Rules:**

1. When reverting PART of a previous multi-file change, add a `// DEFERRED-DECISION:` comment at each remaining site that survived the revert.
2. The comment MUST explain: (1) what was reverted and why, (2) what remains and why it was kept, (3) the date of the revert decision.
3. Format:
```typescript
// DEFERRED-DECISION (2026-07-13): [Component/Feature] survived a partial revert.
// Context: [Feature X] was rolled back from [surface Y] because [reason].
// What remains: [this specific code] is still active on [surface Z] because [justification].
// Do NOT remove without confirming [condition to re-evaluate].
```

**Detection checklist — after any revert PR:**
1. Search for other files touched in the same original implementation session.
2. For each file that was NOT reverted, verify it is still the intended behavior.
3. If yes → add a `DEFERRED-DECISION` comment.
4. If unsure → ask before the session ends.

Common examples: removing a badge from a grid card but keeping it on a detail screen; removing a hook from one screen but keeping it in another; reverting a UI change but keeping the underlying service function.

## BP-60: Shared Test-Render Helpers Must Receive Explicit Clean Params (test isolation)

**Problem:** A `renderScreen()`-style test helper that accepts or defaults to a shared/mutable route/params object can leak state between test cases if that object isn't reset — e.g., a `draftId` set by an earlier test silently carrying into a later test and disabling behavior (like draft-auto-save) that the later test actually intends to exercise fresh. This produces flaky-looking failures whose real cause is test isolation, not the feature under test.

**Real case (J15/J13, 2026-08-24):** The J13 reorder/replace draft-persistence tests in `ItemCreateScreen.test.tsx` passed in isolation (`-t`) but failed in the full-file run. Root cause: `renderScreen()` mutates the shared `mockRoute.params` object, so an earlier draft-resume test left `draftId` set; the J13 tests then rendered with `draftId` inherited → `isDraftHydrated = false` → the draft effect never ran → the draft was never saved. Fix: pass explicit clean params (`renderScreen({ params: { showPhotoSourcePrompt: false } })`).

**Rules:**

1. When writing or reviewing tests that use such a helper, ALWAYS pass an explicit, freshly-constructed params object per test rather than relying on a shared default or a previous test's leftover state.
2. If a test failure looks flaky or inconsistent across runs (passes in isolation, fails in the full file), check for this pattern — a shared mutable fixture/params object — before assuming the failure is in the feature code itself.
3. When introducing a new shared test-render helper, either reset the params object in `beforeEach` or make it require an explicit params argument (never silently reuse a mutated shared default).

**Detection checklist:** a test fails only when run with the rest of its file (not in isolation), and the screen/hook under test has state keyed off `route.params`/`draftId` — the shared route object is leaking; pass explicit clean params.

## BP-92: Paint Only Authoritative Values — One Source of Truth per Displayed Number (no parallel state, no placeholder defaults)

**Problem:** A screen shows a fact in two places, and the two places are fed by different sources — so they can disagree, and the user sees two contradictory numbers in the same render. Its sibling failure: a money/state value is painted from a placeholder default that a fetch will correct, so the first paint shows a wrong number that visibly changes a moment later.

**Real cases (FIX-Task-26, 2026-09-13 — QA Phase 0 findings F8, F9, F4, same defect written three ways):**
- **F8:** the Review Offer banner counted the WHOLE bundle (`bundleSiblings.length + 1`, no status filter) while the CTA counted PENDING-only items, so one render read "Bundle offer · 3 items" directly above "Accept All 2 Items".
- **F9:** My Trades' summary tiles were written at the tail of `fetchTrades` (3 sequential queries) while the offer cards came from `fetchAllOffers` (2 queries) — the faster fetcher painted first, so the card said "2 items" while the tiles still read 3/0 until a manual pull-to-refresh.
- **F4:** Cart Checkout painted a display-only `?? (isSubscriber ? 99 : 299)` fee and a total built from it, then settled to `$1.49` / `$51.73` once the real fee resolved.

**Rules:**

1. Every displayed number MUST be computed from the SAME array/state its visible list or card renders — not from a parallel state written by a different fetcher. Prefer deriving both with one `useMemo` over the rendered array, and DELETE the duplicate state.
2. One predicate, one counter. If two widgets state the same quantity (banner + button + confirm modal), they MUST call one shared helper (`getPendingBundleCount()`); never re-implement the filter per call site.
3. Never paint a placeholder/display-only default for a value a fetch will correct. Either withhold it (render `—`, or a skeleton matching the final geometry) or extend the existing loading gate — and keep any control that SUBMITS that value disabled until it is authoritative (a stale value can otherwise reach the request body, an analytics event, or a receipt).
4. Only genuinely server-owned scalars may live in separate state (e.g. an exact `count: 'exact', head: true` result with no row set), and each such state must have exactly ONE writer.

**Detection checklist:** grep the screen for two `useState`/`setState` pairs feeding adjacent widgets from the same table; grep for `?? <number>` / `?? (isSubscriber ? … : …)` display fallbacks on money or state rows; grep for two `.filter(` expressions that compute the same count. Confirm the whole bundle case at BOTH ends of the range (2-item and 3+/4-item) — a fix that only agrees at one size passes review and still ships the bug.

## BP-93: Jest Mocks Must Return Identity-Stable Objects (unstable mocks loop effects, then present as a silent timeout)

**Problem:** A jest mock that returns a FRESH object literal on every call makes every `useCallback`/`useMemo` that depends on it a new function on each render. When that callback is a `useFocusEffect`/`useEffect` dependency, the effect re-subscribes, re-fetches, sets state, re-renders, and gets another new object — an endless loop in which the screen never leaves its loading state. Because jest output is suppressed in this repo, it presents as a mystery timeout rather than an error.

**Real case (FIX-Task-26, 2026-09-13):** `ReviewOfferScreen.test.tsx` mocked `useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() })`. `fetchOffer` is a `useCallback` with `navigation` in its deps, so the focus effect re-ran on every render: the suite showed `Unable to find an element with text …` after ~1 s per case with the tree still on "Loading offer...", and the mock's `.from()` had been called dozens of times in a single test. Making the navigation/route mocks module-level constants fixed all 10 cases.

**Rules:**

1. A jest mock for `useNavigation`/`useRoute`/any object a screen hook depends on MUST return a module-level constant — never an inline literal.
2. If a screen test times out with the LOADING tree, check this before blaming the screen: count the mocked reads (`(supabase.from as jest.Mock).mock.calls`) — a loop shows dozens of identical calls inside one case.
3. Such constants MUST be named with a `mock` prefix (case-insensitive) so `babel-plugin-jest-hoist` permits them inside a `jest.mock()` factory; a non-prefixed variable fails the whole suite with "The module factory of `jest.mock()` is not allowed to reference any out-of-scope variables".
4. Do NOT debug a failing jest case with `console.log` in this repo — output is suppressed, so the log never appears. Assert on mock call counts or on rendered state instead.

**Detection checklist:** a screen test that fails with "Loading…" still rendered; per-case durations clustered at the `findBy*` timeout (~1 s); a mocked query builder invoked far more often than the screen's real query count.

## BP-94: A `jest.mock()` Factory Must Mirror the Module's FULL Export Surface (an unlisted export is `undefined`, and a swallowed `TypeError` silently exercises the wrong branch)

**Problem:** A `jest.mock('<module>', () => ({ … }))` factory replaces the module **wholesale** — it does not auto-mock the exports you did not list. So when you add a new import to the module under test, every pre-existing factory for that module keeps compiling and keeps passing: the omitted export is simply `undefined`, and calling it throws `TypeError: <name> is not a function`. When the consumer wraps that call in a `try/catch` (or fails soft by design), the `TypeError` is swallowed and execution proceeds down the fallback/error branch — so a test that was written to exercise the **happy path** silently asserts on the **wrong branch**, and stays green. The resulting failure looks like a legitimate domain result (a "failed"/"unverified"/"no rows" outcome) rather than a mock gap, which is what makes it expensive.

**Real case (FIX-Task-28, 2026-09-13):** `getSubscriptionSummary` gained a call to a new dev-only failure-injection hook exported by `devTestingService`, and `subscription.test.ts`'s factory listed only the single export that test had previously needed. The call to the unlisted export threw inside the service's own `try` block; `isTransientNetworkError` did not match it, so the service returned its new "unverified" summary. Assertions elsewhere in the suite still passed, and the symptom presented as a plausible product behaviour rather than a broken mock — adding the export to the factory plus a `beforeEach` default (`mockResolvedValue('none')`) restored the real RPC path.

**Same class, second face — a BARE `jest.mock('<module>')` with NO factory AUTO-mocks the whole module.** With no factory, jest replaces **every** export with a `jest.fn()` that returns `undefined` — so a piece of **pure logic** that an I/O module happens to also export (a status/entitlement predicate, a formatter, a mapper) is `undefined` for every test in that suite, even though every rule below about factories is satisfied. The consumer's guard (`isSubscriber && …`, `if (isGrace)` ) is then simply falsy for **every** input, so the control the test was written to assert silently does not render.

**Real case (FIX-Task-53, 2026-09-17):** `TradeOfferScreen.test.tsx` calls `jest.mock('@/services/subscription')` with no factory. A new set of pure predicates (`isSubscriberStatus`, `isFeeActiveMemberStatus`, `canSpendSpStatus`, …) was added to `subscription.ts` and re-exported, so the auto-mock turned them into `jest.fn()` → `undefined` → `isSubscriber` was **false for every status**, the SP control never rendered, and **9 tests failed** ("Unable to find … `sp-amount-input`") while typecheck and lint stayed clean. Moving the predicates into a dependency-free leaf module (`src/services/subscriptionStatus.ts`) that no suite mocks fixed all 9 — the fix was architectural, not a mock edit.

**Rules:**
2. Never assume `undefined` is inert. A mocked export that gets **called** throws, and that throw travels through the consumer's own `try/catch` — so if the service under test fails soft, an incomplete factory is invisible in the assertions and can be misread as a real domain outcome.
3. Give each factory export an explicit implementation **and** reset it in `beforeEach`. `jest.clearAllMocks()` clears calls/instances but **not** implementations, so a `mockResolvedValue(...)` set in the factory survives it and a test that armed a failure toggle can leak into the next case.
4. Where the real module is cheap to require (its own dependencies are already mocked), prefer `jest.mock('<mod>', () => ({ ...jest.requireActual('<mod>'), <override>: jest.fn() }))` so future exports are covered and only the behaviour under test is stubbed. Never a bare `{}`/single-key factory for a module the code under test imports more than one thing from.
5. A **bare `jest.mock('<mod>')` (no factory) is an auto-mock of the ENTIRE module** — every export becomes a `jest.fn()` returning `undefined`. Never assume a module is "mocked correctly" just because the suite references it: read the call and ask whether it has a factory at all.
6. **Pure, dependency-free logic MUST NOT live in a module that performs I/O** (a Supabase/Stripe/network service). Put status/entitlement predicates, formatters and mappers in their own leaf module (e.g. `src/services/subscriptionStatus.ts`) and have the service re-export them. An I/O module is auto-mockable **by design**, and a consumer's test will mock it — so render-time logic kept there is one `jest.mock()` away from being `undefined` for every caller. This is the structural fix; editing the mock only treats the symptom.

## BP-95: A Client-Side In-Memory Cache of User-Scoped Data Must Be Keyed by User and Cleared on Auth Transitions — Never a Single Process-Global Slot

**Problem:** A module-level cache holding per-user data (`let _xCache: T | undefined`) is shared by every session in the process. The getter returns the cached value **without re-checking who is signed in**, and nothing clears it on sign-out/sign-in — so after an account switch the cache serves the **previous** user's data. It reads as a cross-account data disclosure, and every consumer of that getter inherits it. This is the identity-scoping companion of **BP-15**: BP-15 covers correctness-on-refresh, BP-95 covers correctness-on-identity-change. A cache needs both.

**Real case (QA SUB Android Round 1, 2026-09-16):** `src/services/subscription.ts:845` declares `let _pmCache: PaymentMethodInfo | null | undefined` (plus a promise-dedup sibling `_pmPromise`). `getPaymentMethod()` (L864-866) returns `_pmCache` whenever it is not `undefined` — with **no session/user check** — and `PaymentMethodsScreen` L110-112 calls `getPaymentMethod(false)` on every mount. With ONE app process, switching `test-buyer → qa-wallet` (the `qa-login-as` deep link is a **warm in-process** switch, not a restart) left the Payment Methods screen rendering **test-buyer's `MASTERCARD •••• 4444 / 09/2027`** on an account whose `subscriptions.stripe_payment_method_id` was `NULL` and whose Stripe customer had no attached payment method at all. A fresh process (`terminate` + relaunch) rendered the correct empty state. Blast radius: every `getPaymentMethod()` consumer — Payment Methods, Manage Kids Club+ `PaymentMethodSection`, `CartCheckoutScreen`, `TradeOfferScreen` — i.e. the surfaces where a card is presented or charged.

**Rules:**

1. A module-level cache MUST be keyed by the authenticated principal (`Record<userId, T>`, or a `{ userId, value }` wrapper) — never one process-global slot for data that belongs to a user.
2. Read the current user **inside the getter** and treat a key mismatch as a cache miss (re-fetch). Do not rely on a caller — or a screen's `useEffect` — to have cleared it.
3. Clear (or version-bump) the cache on every auth transition: `SIGNED_OUT`, `SIGNED_IN`, `USER_UPDATED`. Wire it once beside the existing session listener, not ad hoc inside screens.
4. If the cache is not worth keying, DELETE it and keep only the in-flight-promise dedup — a promise dedup is inherently per-call and resolves the session at fetch time, so it cannot leak across users.
5. A cache clear must also cover the cache's **sibling** state: clearing `_pmCache` without resetting `_pmPromise` (or equivalent) leaves a second stale path alive.

**Detection checklist:** grep the service/hook layer for module-scope caches (`^let _`, `CACHE_TTL_MS`) and ask of each: *whose data is this?* If it is per-user, it needs a key plus an auth-transition clear. Prove a suspected leak with a **fresh-process control** — switch accounts in-process and observe the stale value, then terminate + relaunch and observe the correct value; that divergence IS the proof (and is what distinguishes a client-cache leak from a server-side disclosure). Before shipping a fix, grep **every** consumer of the getter — they all inherit the bug until the cache is fixed at the source.

**Detection checklist:** after adding an import to a service/screen, diff each factory's keys against the module's real exports (`grep -n '^export ' <module>`); if a suite still passes but its assertions no longer touch the value you changed, check whether the newly-imported mock export is `undefined`; a `TypeError: … is not a function` that appears only in jest's swallowed console output (which this repo suppresses — see BP-93 rule 4) is the signature. Cross-ref BP-88 (an invented/mocked shape green-lights an unreachable branch) and BP-93 (jest mock mechanics). **Auto-mock tell:** a suite that stays green while a newly-added pure helper has NO effect on the rendered tree (the control it gates is simply absent) — read the `jest.mock()` call for a missing factory, then check whether the helper was exported from an I/O module (rules 5-6).
