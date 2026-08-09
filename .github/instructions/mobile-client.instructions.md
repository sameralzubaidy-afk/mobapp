---
description: "Use when writing or reviewing client-side code in the Kids P2P Marketplace mobile app (screens, services, hooks): result-checking, Realtime subscriptions, caching, UI patterns, and error parsing for Supabase/Stripe calls."
applyTo: "p2p-kids-marketplace/src/**"
---

# Mobile Client Hardening Protocol

Related bug-prevention rules with full detail below: BP-8 (typed service errors), BP-15 (pull-to-refresh cache bypass), BP-23 (Realtime callback mirrors mount-time side effects), BP-29 (downstream reference audit after data-source renames), BP-33 (persistent UI at root level), BP-34 (Alert→Toast success-path audit), BP-35 (check mutating service call results), BP-36 (Realtime subscription table/publication verification), BP-39 (`FunctionsHttpError.context` parsing), BP-42 (trade detail tax preview from joined listing price) — see the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all 43 rules.

### Rule Index (scan this first; open the full rule below only when it's relevant to your current task)

- BP-8 TS service errors — return typed `ServiceResult<T>`, never swallow to null.
- BP-15 Pull-to-refresh — must pass forceRefresh=true to bypass client caches.
- BP-23 Realtime callbacks — must mirror the same side effects the mount-time effect performs.
- BP-29 Data-source renames — audit every downstream reference (empty states, filters, counters) after a restructure.
- BP-33 Persistent UI (tab bars/headers) — render once at the root stack, never per-screen.
- BP-34 Alert→Toast migrations — classify every call site individually (success/toast, error/blocking, choice/blocking).
- BP-35 Mutating service calls — always check the `{success}` result before a dependent step.
- BP-36 Realtime subscriptions — confirm the table is in the `supabase_realtime` publication; watch for RLS-filtered events.
- BP-39 FunctionsHttpError — `.message` is hardcoded; always parse `.context.clone().json()`.
- BP-42 Trade detail tax preview — derive from the joined listing's `price`, never from `cash_amount_cents`.
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

## Backward Compatibility for the Mobile Client

The app may talk to a backend one deploy ahead (or behind) during rolling deploys. Client code MUST survive both directions.

Rules:
- **Defensively parse server responses.** Treat any new server field as optional: `data.field ?? fallback`, or feature-detect with `'field' in data` / `data.field != null` before using it. Never assume a field the current backend version doesn't yet send is present.
- **Never crash on an absent field.** A missing field from an older backend (or one mid-deploy) must degrade gracefully, not throw.
- **Don't reshape service return types** without auditing every caller (see BP-29).
- **Cache compatibility.** When a cached object's shape changes (e.g., a service now returns a grouped array), add a cache schema version or clear old-shaped entries — never read a stale-shaped cached object as if it were the new shape.
- **Keep old UI paths working** when a new field is absent — render the pre-feature state instead of blocking the screen.
- If a field is REQUIRED by the UI but optional in the API, add a `// TODO(BACKCOMP):` noting the contract change and coordinate both sides.
