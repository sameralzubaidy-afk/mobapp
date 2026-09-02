// File: p2p-kids-marketplace/src/services/qaRefreshRegistry.ts
// DEV-TASK-84 (2026-09-01) — __DEV__/staging-only registry that lets the QA
// deep link `p2pkidsmarketplace://qa-refresh` force-refetch whatever screen is
// currently open in ONE call.
//
// QA Task 17 F-3: after creating pending offers server-side via `qa:ef-repro`,
// the seller's Needs Action list did not refresh — the AX tree was stale and the
// agent had to navigate away and back to force a remount (~6-10 calls per
// occurrence, repeated ~4x). The list refetches on focus + pull-to-refresh, but
// neither is one-call-drivable from the QA tooling. This registry lets the
// currently-focused screen (e.g. TradeListScreen) register its real refetch
// function so the deep link can trigger it in one call.
//
// SECURITY: nothing here is reachable in production. Callers (screens) only
// register in dev/staging builds, and the only consumer
// (QaRefreshDeepLinkHandler) is gated to dev/staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers the listener, so the deep link is inert there.

export type QaRefreshFn = () => void | Promise<void>;

let refreshFn: QaRefreshFn | null = null;

/**
 * Registers (or clears) the active screen force-refresh callback. Returns an
 * unregister function. Exactly one screen should hold the registration at a
 * time — screens register on mount and unregister on unmount, so the slot
 * always points at the most recently mounted/focused consumer.
 */
export function registerQaScreenRefresh(fn: QaRefreshFn | null): () => void {
  refreshFn = fn;
  return () => {
    if (refreshFn === fn) {
      refreshFn = null;
    }
  };
}

/**
 * Triggers the registered screen's full refetch.
 * @returns true if a refresh callback was registered (and invoked).
 */
export function requestQaScreenRefresh(): boolean {
  if (!refreshFn) {
    return false;
  }
  try {
    void refreshFn();
    return true;
  } catch {
    return false;
  }
}
