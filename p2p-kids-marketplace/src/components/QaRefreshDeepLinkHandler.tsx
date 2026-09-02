// File: p2p-kids-marketplace/src/components/QaRefreshDeepLinkHandler.tsx
// DEV-TASK-84 (2026-09-01) — QA friction-reduction: a dev/staging-only deep
// link that force-refetches whatever screen is currently open in ONE call,
// eliminating the "list → stale → navigate away → navigate back → list"
// remount dance.
//
//   p2pkidsmarketplace://qa-refresh
//
// Why: QA Task 17 F-3 — after creating pending offers server-side via
// `qa:ef-repro`, the seller's Needs Action list did not refresh (the AX tree
// stayed stale), costing ~6-10 calls per occurrence of navigate-away-and-back.
// The list refetches on focus + pull-to-refresh, but neither is drivable in one
// call from the QA tooling. The currently-focused screen registers its real
// refetch via `registerQaScreenRefresh` (see qaRefreshRegistry.ts); this
// handler invokes it. If no screen has registered, the call no-ops with a
// console warning.
//
// SECURITY GATE: identical to QaLoginAsDeepLinkHandler / QaDevToggleDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link is inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { requestQaScreenRefresh } from '@/services/qaRefreshRegistry';

/**
 * Enables the qa-refresh deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_REFRESH_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-refresh). */
const QA_REFRESH_PATH = 'qa-refresh';

function isQaRefreshUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_REFRESH_PATH;
  } catch {
    return false;
  }
}

/** Triggers the currently-registered screen refresh (if any). */
function applyQaRefresh(): void {
  const handled = requestQaScreenRefresh();
  // eslint-disable-next-line no-console
  console.log(
    handled
      ? '[QaRefreshDeepLink] force-refresh triggered on the current screen'
      : '[QaRefreshDeepLink] no screen registered a refresh handler (is a list screen open?)'
  );
}

/**
 * Renders nothing. Listens for the qa-refresh deep link and triggers the
 * currently-open screen's full refetch.
 *
 * No auth dependency — safe to mount anywhere at the root.
 * Covers both entry modes (foreground listener + cold-start getInitialURL).
 */
export default function QaRefreshDeepLinkHandler() {
  const enabled = QA_REFRESH_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaRefreshUrl(event.url)) {
        applyQaRefresh();
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaRefreshUrl(initialUrl)) {
        applyQaRefresh();
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
