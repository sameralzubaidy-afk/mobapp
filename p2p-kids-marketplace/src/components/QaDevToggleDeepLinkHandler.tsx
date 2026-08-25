// File: p2p-kids-marketplace/src/components/QaDevToggleDeepLinkHandler.tsx
// QA-ONLY deep link handler — lets the QA agent arm/disarm the session-local
// QA toggles (A03 push simulation, D02 notification-pref save failure, C04 link
// email mismatch) entirely within its own simulator session, with zero
// shared-staging blast radius and no manual SQL step from a human between test
// legs. The toggles live in AsyncStorage (see devTestingService), NOT admin_config,
// so arming/disarming here never touches shared staging config.
//
// Deep link: p2pkidsmarketplace://qa-dev-toggle?key=<short>&value=<value>
//   key   = push_simulation | pref_save_failure | link_email_mismatch
//   value = per-key allowed values (see devTestingService.isValidQaToggleValue)
//
// SECURITY GATE: this handler must NEVER be reachable in a production build.
// The enablement gate mirrors QaLogoutDeepLinkHandler (`__DEV__` or
// EXPO_PUBLIC_ENVIRONMENT in development/staging only) — a production build
// never registers the listener, so the deep link is inert there. The underlying
// write is additionally gated by devTestingService.setQaLocalValue's own
// `isDevEnvironment()` check as a fail-closed backstop.

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import {
  QA_TOGGLE_SHORT_NAMES,
  isValidQaToggleValue,
  setQaLocalValue,
} from '@/services/devTestingService';

/**
 * Enables the QA dev-toggle deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build (release, env=production) never
 *   registers the listener, so the deep link is inert there.
 */
const QA_DEV_TOGGLE_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-dev-toggle). */
const QA_DEV_TOGGLE_PATH = 'qa-dev-toggle';

function isQaDevToggleUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    // expo-linking may surface the first path segment as either `path` or
    // `hostname` depending on the URL shape — accept either.
    const firstSegment = (parsed.path || parsed.hostname || '').replace(/^\/+/, '').split('?')[0];
    return firstSegment === QA_DEV_TOGGLE_PATH;
  } catch {
    return false;
  }
}

/**
 * Applies a validated toggle arming from a qa-dev-toggle URL. Unknown keys or
 * invalid values are rejected (with a console warning) so the deep link can
 * never write garbage into AsyncStorage.
 */
async function applyQaDevToggle(url: string): Promise<void> {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams ?? {}) as Record<string, string | undefined>;
  const key = query.key;
  const value = query.value;

  if (!key || !value) {
    // eslint-disable-next-line no-console
    console.warn('[QaDevToggleDeepLink] Missing key/value params');
    return;
  }

  const storageKey = QA_TOGGLE_SHORT_NAMES[key];
  if (!storageKey) {
    // eslint-disable-next-line no-console
    console.warn(`[QaDevToggleDeepLink] Unknown toggle key: ${key}`);
    return;
  }

  if (!isValidQaToggleValue(storageKey, value)) {
    // eslint-disable-next-line no-console
    console.warn(`[QaDevToggleDeepLink] Invalid value for ${key}: ${value}`);
    return;
  }

  const result = await setQaLocalValue(storageKey, value);
  // eslint-disable-next-line no-console
  console.log(
    `[QaDevToggleDeepLink] ${result.success ? 'Armed' : 'Failed to arm'} ${key}=${value}${
      result.error ? ` (${result.error})` : ''
    }`
  );
}

/**
 * Renders nothing. Listens for the QA dev-toggle deep link and arms/disarms the
 * matching session-local QA toggle via devTestingService.
 *
 * Covers both entry modes:
 * - Foreground: `Linking.addEventListener('url', ...)` fires for every incoming
 *   URL event (including repeated identical URLs).
 * - Cold start: `Linking.getInitialURL()` resolves the URL the app was launched
 *   with.
 */
export default function QaDevToggleDeepLinkHandler() {
  const enabled = QA_DEV_TOGGLE_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaDevToggleUrl(event.url)) {
        void applyQaDevToggle(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaDevToggleUrl(initialUrl)) {
        void applyQaDevToggle(initialUrl);
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
