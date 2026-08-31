// File: p2p-kids-marketplace/src/components/QaSetSpDeepLinkHandler.tsx
// Dev Task 77 item 3 — QA friction-reduction: a dev/staging-only deep link that
// sets the SP value on a specific cart-checkout item in ONE call, avoiding the
// type-and-clear keyboard cycle entirely.
//
//   p2pkidsmarketplace://qa-set-sp?listing=<listingId>&amount=<N>
//
// The listing must be on the currently-open CartCheckout screen (the screen
// registers its real `handleSpChange` setter via qaSpFixture). The value goes
// through the SAME clamping logic the UI uses, so it can never exceed the item's
// maxAllowed or the wallet-remaining. If no checkout screen is open (or the
// listing isn't on it), the call no-ops with a console warning.
//
// SECURITY GATE: identical to QaLoginAsDeepLinkHandler / QaDevToggleDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link is inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { setQaSpForListing } from '@/services/qaSpFixture';

/**
 * Enables the qa-set-sp deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_SET_SP_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-set-sp). */
const QA_SET_SP_PATH = 'qa-set-sp';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isQaSetSpUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_SET_SP_PATH;
  } catch {
    return false;
  }
}

/** Applies a validated SP value from a qa-set-sp URL. Unknown/absent listings no-op. */
function applyQaSetSp(url: string): void {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams ?? {}) as Record<string, string | undefined>;
  const listingId = query.listing;
  const amountRaw = query.amount;

  if (!listingId || amountRaw === undefined) {
    // eslint-disable-next-line no-console
    console.warn('[QaSetSpDeepLink] Missing listing/amount params');
    return;
  }

  if (!UUID_RE.test(listingId)) {
    // eslint-disable-next-line no-console
    console.warn(`[QaSetSpDeepLink] Invalid listing id (not a UUID): ${listingId}`);
    return;
  }

  const amount = Number.parseInt(amountRaw.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(amount) || amount < 0) {
    // eslint-disable-next-line no-console
    console.warn(`[QaSetSpDeepLink] Invalid amount: ${amountRaw}`);
    return;
  }

  const handled = setQaSpForListing(listingId, amount);
  // eslint-disable-next-line no-console
  console.log(
    handled
      ? `[QaSetSpDeepLink] Set ${amount} SP on listing ${listingId}`
      : `[QaSetSpDeepLink] No checkout setter for listing ${listingId} (is CartCheckout open with this item?)`
  );
}

/**
 * Renders nothing. Listens for the qa-set-sp deep link and applies an SP value
 * to the matching cart-checkout item through the registered setter.
 *
 * No auth dependency — safe to mount anywhere at the root.
 * Covers both entry modes (foreground listener + cold-start getInitialURL).
 */
export default function QaSetSpDeepLinkHandler() {
  const enabled = QA_SET_SP_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaSetSpUrl(event.url)) {
        applyQaSetSp(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaSetSpUrl(initialUrl)) {
        applyQaSetSp(initialUrl);
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
