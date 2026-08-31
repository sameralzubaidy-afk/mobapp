// File: p2p-kids-marketplace/src/services/qaSpFixture.ts
// Dev Task 77 item 3 — __DEV__/staging-only registry that lets the QA deep link
// `p2pkidsmarketplace://qa-set-sp?listing=<id>&amount=<N>` set the SP value on a
// specific cart-checkout item WITHOUT the type-and-clear keyboard cycle.
//
// QA Task 15 friction log: the per-item SP TextInput is not exposed in the iOS
// AX tree, and clearing a field requires select-all+delete via osascript — each
// SP value entry cost ~4–5 tool calls. This registry lets the CartCheckoutScreen
// register its real `handleSpChange` setter (dev/staging builds only) so the
// deep link can apply a value in one call. The setter runs the SAME clamping
// logic the UI uses (maxAllowed + wallet-remaining), so a fixture value can never
// exceed what the UI would accept.
//
// SECURITY: nothing here is reachable in production. Callers (CartCheckoutScreen)
// only register in dev/staging builds, and the only consumer
// (QaSetSpDeepLinkHandler) is gated to dev/staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers the listener, so the deep link is inert there.

export type QaSpSetter = (listingId: string, amount: number) => boolean;

let spSetter: QaSpSetter | null = null;

/**
 * Registers (or clears) the active cart-checkout SP setter. Returns an unregister
 * function. Exactly one screen should hold the registration at a time — the
 * checkout screen registers on mount and unregisters on unmount.
 */
export function registerQaSpSetter(fn: QaSpSetter | null): () => void {
  spSetter = fn;
  return () => {
    if (spSetter === fn) {
      spSetter = null;
    }
  };
}

/**
 * Applies an SP value for a listing through the registered setter.
 * @returns true if a setter was registered AND reported it handled the listing
 *          (i.e. the listing is on the currently-open checkout screen).
 */
export function setQaSpForListing(listingId: string, amount: number): boolean {
  if (!spSetter) {
    return false;
  }
  try {
    return spSetter(listingId, amount);
  } catch {
    return false;
  }
}
