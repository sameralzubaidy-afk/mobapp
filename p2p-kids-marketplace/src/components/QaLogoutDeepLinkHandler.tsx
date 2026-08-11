// File: p2p-kids-marketplace/src/components/QaLogoutDeepLinkHandler.tsx
// QA-ONLY deep link handler — provides a deterministic, non-scroll-dependent
// logout path for automated QA test teardown. See e2e-test-results/stage2/report.md §10:
// `profile-logout` (My Profile → utility list) is unreliable to reach on long
// profiles because the FlatList virtualizes the accessibility tree to
// header + tab bar during scroll. A deep link removes the scroll dependency.
//
// Deep link: p2pkidsmarketplace://qa-logout
//
// SECURITY GATE: this handler must NEVER be reachable in a production build.
// It calls the canonical AuthContext.logout() — the SAME function every logout
// UI path uses (ProfileScreen, SettingsScreen, DeleteAccountScreen,
// SuspendedAccountScreen all call useAuth().logout / AuthContext.logout) — so it
// never touches a lower-level supabase.signOut() directly. The enablement gate
// mirrors the established dev-env detection used by
// src/services/devTestingService.ts (__DEV__ / EXPO_PUBLIC_ENVIRONMENT).

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useAuth } from '@/hooks/useAuth';

/**
 * Enables the QA logout deep link in dev / staging builds only.
 * - `__DEV__` is true under Metro / dev-client and false in release builds.
 * - `EXPO_PUBLIC_ENVIRONMENT` is set per build profile; only 'development' and
 *   'staging' are allowed — a production build (release, env=production) never
 *   registers the listener, so the deep link is inert there.
 */
const QA_LOGOUT_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-logout). */
const QA_LOGOUT_PATH = 'qa-logout';

function isQaLogoutUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    // expo-linking may surface the first path segment as either `path` or
    // `hostname` depending on the URL shape — accept either.
    const firstSegment = (parsed.path || parsed.hostname || '')
      .replace(/^\/+/, '')
      .split('?')[0];
    return firstSegment === QA_LOGOUT_PATH;
  } catch {
    return false;
  }
}

/**
 * Renders nothing. Listens for the QA logout deep link and calls the canonical
 * AuthContext.logout() when triggered.
 *
 * Covers both entry modes:
 * - Foreground: `Linking.addEventListener('url', ...)` fires for every incoming
 *   URL event (including repeated identical URLs), regardless of which screen
 *   is showing — logout() is called directly, no navigation to Profile first.
 * - Cold start: `Linking.getInitialURL()` resolves the URL the app was launched
 *   with.
 *
 * Must be mounted INSIDE AuthProvider (it consumes useAuth()).
 */
export default function QaLogoutDeepLinkHandler() {
  const { logout } = useAuth();
  const enabled = QA_LOGOUT_DEEP_LINK_ENABLED;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaLogoutUrl(event.url)) {
        // eslint-disable-next-line no-console
        console.log('[QaLogoutDeepLink] Logging out via deep link');
        logout();
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (isQaLogoutUrl(initialUrl)) {
        // eslint-disable-next-line no-console
        console.log('[QaLogoutDeepLink] Logging out via cold-start deep link');
        logout();
      }
    });

    return () => subscription.remove();
  }, [enabled, logout]);

  return null;
}
