// File: p2p-kids-marketplace/src/components/QaClearOverlaysDeepLinkHandler.tsx
// Dev Task 77 item 1 — QA friction-reduction: a dev/staging-only deep link that
// force-dismisses a stuck overlay/modal in ONE call, without a full app relaunch.
//
//   p2pkidsmarketplace://dev-clear-overlays
//
// Why: QA Task 15 (2026-08-31) logged a stuck native "Offer Declined" GlobalAlert
// that survived a persona switch, blinded the accessibility tree (only the status
// bar clock was visible), and cost ~20 tool calls of coordinate-guessing before a
// 2-call app relaunch fixed it. This handler gives QA a single deep link that:
//   1. Force-dismisses every queued branded GlobalAlert (via the module-scoped
//      escape hatch registered by GlobalAlertProvider — no button onPress fires),
//   2. Resets navigation to Home so any screen-local modal (DisclaimerModal,
//      TradeConfirmationModal, bundle Accept/Decline sheet, etc.) is unmounted
//      with the stack — leaving the app on a known-clean screen.
//
// SECURITY GATE: identical to QaLogoutDeepLinkHandler / QaDevToggleDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link is inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { forceDismissAllGlobalAlerts } from '@/providers/GlobalAlertProvider';
import { navigationRef } from '@/navigation/navigationRef';

/**
 * Enables the dev-clear-overlays deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_CLEAR_OVERLAYS_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://dev-clear-overlays). */
const QA_CLEAR_OVERLAYS_PATH = 'dev-clear-overlays';

function isQaClearOverlaysUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    // expo-linking may surface the first path segment as either `path` or
    // `hostname` depending on the URL shape — accept either.
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_CLEAR_OVERLAYS_PATH;
  } catch {
    return false;
  }
}

/**
 * Clears every queued GlobalAlert, then resets navigation to a known-clean Home
 * screen so any screen-local modal unmounts with the stack. Navigation reset is
 * best-effort (wrapped in try/catch, only runs when the navigator is ready).
 */
function applyQaClearOverlays(): void {
  const dismissedAlert = forceDismissAllGlobalAlerts();
  // eslint-disable-next-line no-console
  console.log(
    `[QaClearOverlaysDeepLink] force-dismissed GlobalAlerts: ${dismissedAlert ? 'yes' : 'none'}`
  );

  try {
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Home' }] as never,
      });
      // eslint-disable-next-line no-console
      console.log('[QaClearOverlaysDeepLink] reset navigation to Home (clean slate)');
    } else {
      // eslint-disable-next-line no-console
      console.warn('[QaClearOverlaysDeepLink] navigator not ready — skipping reset');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[QaClearOverlaysDeepLink] navigation reset failed: ${(err as Error)?.message ?? err}`
    );
  }
}

/**
 * Renders nothing. Listens for the dev-clear-overlays deep link and force-
 * dismisses any stuck overlay, then resets to Home.
 *
 * No auth dependency — safe to mount anywhere at the root.
 * Covers both entry modes (foreground listener + cold-start getInitialURL).
 */
export default function QaClearOverlaysDeepLinkHandler() {
  const enabled = QA_CLEAR_OVERLAYS_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaClearOverlaysUrl(event.url)) {
        applyQaClearOverlays();
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaClearOverlaysUrl(initialUrl)) {
        applyQaClearOverlays();
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
