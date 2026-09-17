// File: p2p-kids-marketplace/src/components/QaSubscriptionStatusDeepLinkHandler.tsx
// FIX-Task-52 item 7d (2026-09-17) — enablement: a dev/staging-only deep link that
// opens the Subscription Status diagnostics screen.
//
//   p2pkidsmarketplace://qa-subscription-status
//
// Why: SUB-TC-E04 (Subscription Status screen — Stripe IDs + period + retries) has
// been marked ⏸ FIXTURE-GATED since 2026-09-02 and is one of the last named SUB
// gaps. `SubscriptionStatusScreen` is a QA/manual verification screen with **no
// in-app navigation entry** — it is reachable only by tapping a push notification
// whose payload maps the deep link `/subscription/status` (services/deepLink.ts
// DEEP_LINK_ROUTES), which itself requires a notification-insert fixture. So the
// case needed TWO fixtures (a notification row AND a device-push tap) to reach a
// screen that takes **no parameters** and simply reads the signed-in user's own
// subscription row.
//
// This handler removes both: one `xcrun simctl openurl` / `adb am start` lands on
// the screen for whichever persona is signed in.
//
// The screen is a READ-ONLY diagnostic (it renders the subscription state it
// fetches), so exposing it to QA adds no mutation surface.
//
// SECURITY GATE: identical to QaClearOverlaysDeepLinkHandler / QaSetSpDeepLinkHandler —
// the listener is registered only in dev / staging builds (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging). A production build never
// registers it, so the deep link is inert in release builds.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { navigationRef } from '@/navigation/navigationRef';

/**
 * Enables the qa-subscription-status deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build never registers the listener.
 */
const QA_SUBSCRIPTION_STATUS_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to. */
const QA_SUBSCRIPTION_STATUS_PATH = 'qa-subscription-status';

/** The registered screen this handler opens (route takes no params). */
const TARGET_ROUTE = 'SubscriptionStatus';

function isQaSubscriptionStatusUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    // expo-linking may surface the first path segment as either `path` or
    // `hostname` depending on the URL shape — accept either.
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_SUBSCRIPTION_STATUS_PATH;
  } catch {
    return false;
  }
}

/**
 * Navigates to the Subscription Status diagnostics screen. Best-effort: the
 * navigator may not be ready on a cold start, in which case the call is skipped
 * with a warning rather than throwing (mirrors QaClearOverlaysDeepLinkHandler).
 */
function applyQaSubscriptionStatus(): void {
  try {
    if (!navigationRef.isReady()) {
      // eslint-disable-next-line no-console
      console.warn('[QaSubscriptionStatusDeepLink] navigator not ready — skipping navigate');
      return;
    }
    navigationRef.navigate(TARGET_ROUTE as never);
    // eslint-disable-next-line no-console
    console.log(`[QaSubscriptionStatusDeepLink] navigated to ${TARGET_ROUTE}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[QaSubscriptionStatusDeepLink] navigate failed: ${(err as Error)?.message ?? err}`
    );
  }
}

/**
 * Renders nothing. Listens for the qa-subscription-status deep link and opens the
 * Subscription Status screen.
 *
 * No auth dependency of its own (the target screen reads the session) — safe to
 * mount anywhere at the root. Covers both entry modes (foreground listener +
 * cold-start getInitialURL).
 */
export default function QaSubscriptionStatusDeepLinkHandler() {
  const enabled = QA_SUBSCRIPTION_STATUS_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaSubscriptionStatusUrl(event.url)) {
        applyQaSubscriptionStatus();
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaSubscriptionStatusUrl(initialUrl)) {
        applyQaSubscriptionStatus();
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
