// File: p2p-kids-marketplace/src/components/QaScrollToDeepLinkHandler.tsx
// DEV-TASK-84 (2026-09-01) — QA friction-reduction: a dev/staging-only deep
// link that programmatically scrolls a target element into view on the
// currently-open screen and reports its fresh viewport coordinates, in ONE call.
//
//   p2pkidsmarketplace://qa-scroll-to?testID=<id>
//
// Why: QA Task 17 F-2 / F-Z04 — bottom-anchored buttons are unreliable to tap
// from AX-tree coordinates (the floating tab pill occludes them; the timeline
// ScrollView snaps to only ~2 positions), so every occurrence required a
// swipe-then-relist-then-OCR cycle (~5-20 calls). The currently-open screen
// registers a `scrollToTestID` implementation via `registerQaScrollToHandler`
// (see qaScrollRegistry.ts); this handler invokes it and logs a machine-
// readable RESULT line the QA agent can grep:
//
//   [QaScrollToDeepLink] RESULT <testID> <x> <y>        (scrolled + window coords)
//   [QaScrollToDeepLink] RESULT <testID> NOT_FOUND      (no such element on screen)
//   [QaScrollToDeepLink] RESULT <testID> NO_HANDLER     (no screen registered)
//
// SECURITY GATE: identical to QaLoginAsDeepLinkHandler / QaDevToggleDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link is inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { requestQaScrollTo } from '@/services/qaScrollRegistry';

/**
 * Enables the qa-scroll-to deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_SCROLL_TO_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-scroll-to). */
const QA_SCROLL_TO_PATH = 'qa-scroll-to';

function isQaScrollToUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_SCROLL_TO_PATH;
  } catch {
    return false;
  }
}

/** Scrolls the requested testID into view on the current screen and logs the result. */
async function applyQaScrollTo(url: string): Promise<void> {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams ?? {}) as Record<string, string | undefined>;
  const testID = (query.testID || '').trim();

  if (!testID) {
    // eslint-disable-next-line no-console
    console.warn('[QaScrollToDeepLink] Missing testID param (use ?testID=<id>)');
    return;
  }

  const { handled, coords } = await requestQaScrollTo(testID);
  // eslint-disable-next-line no-console
  console.log(
    `[QaScrollToDeepLink] RESULT ${testID} ${
      !handled ? 'NO_HANDLER' : coords ? `${coords.x} ${coords.y}` : 'NOT_FOUND'
    }`
  );
}

/**
 * Renders nothing. Listens for the qa-scroll-to deep link and scrolls the
 * target element into view on the currently-open screen (via its registered
 * handler), logging a machine-readable RESULT line with fresh viewport coords.
 *
 * No auth dependency — safe to mount anywhere at the root.
 * Covers both entry modes (foreground listener + cold-start getInitialURL).
 */
export default function QaScrollToDeepLinkHandler() {
  const enabled = QA_SCROLL_TO_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaScrollToUrl(event.url)) {
        void applyQaScrollTo(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaScrollToUrl(initialUrl)) {
        void applyQaScrollTo(initialUrl);
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
