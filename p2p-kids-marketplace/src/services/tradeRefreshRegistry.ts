// File: p2p-kids-marketplace/src/services/tradeRefreshRegistry.ts
// FIX-Task-25 item 1 (2026-09-13) — production-safe registry that lets a trade
// MUTATION screen push a refetch into the mounted Trade List screen.
//
// Why this exists (QA Task 2026-09-13, finding F1): after the buyer used the
// bundle "Confirm All N" shortcut on the Trade Timeline, every trade was
// `completed` in the DB but My Trades kept rendering the bundle as
// "IN PROGRESS · 3 items" with frozen summary tiles (In Progress 3 /
// Completed 36) until a manual `qa-refresh`. The data was correct — the list
// just never learned that it was stale.
//
// This mirrors the previously-fixed cart-badge staleness (FIX-Task-19 item 1),
// where the mutating screen calls `refreshCartCount()` from a shared context
// after a successful write. Trades have no shared context, so the equivalent
// push is a tiny registry: the Trade List registers its real full-refetch
// closure on mount, and a mutation screen calls `requestTradesRefresh()` on
// success.
//
// UNLIKE qaRefreshRegistry (dev/staging only), this registry is registered and
// invoked in production — it is a product feature, not QA tooling. It performs
// no I/O of its own and holds one callback reference, so it is inert when the
// Trade List is unmounted (the list's own `useFocusEffect` refetch covers that
// case).

export type TradesRefreshFn = () => void | Promise<void>;

let refreshFn: TradesRefreshFn | null = null;

/**
 * Registers (or clears) the mounted Trade List screen's full-refetch callback.
 * Returns an unregister function; the screen calls it on unmount so the slot
 * never points at an unmounted screen.
 */
export function registerTradesRefresh(fn: TradesRefreshFn | null): () => void {
  refreshFn = fn;
  return () => {
    if (refreshFn === fn) {
      refreshFn = null;
    }
  };
}

/**
 * Asks the mounted Trade List screen to refetch (trades + offers + summary +
 * history). Safe to call from anywhere at any time.
 *
 * @returns true if a Trade List was mounted and its refetch was invoked.
 */
export function requestTradesRefresh(): boolean {
  if (!refreshFn) {
    // The Trade List is not mounted (e.g. the timeline was opened from a
    // notification deep link). Nothing to do — the list's own focus refetch
    // will load fresh data when the user opens it.
    return false;
  }
  try {
    void refreshFn();
    return true;
  } catch (e) {
    // Never let a refresh failure break the mutation's success path.
    console.warn('[tradeRefreshRegistry] requestTradesRefresh failed', e);
    return false;
  }
}
