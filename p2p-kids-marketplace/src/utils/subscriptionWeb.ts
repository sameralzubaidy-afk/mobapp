/**
 * File: p2p-kids-marketplace/src/utils/subscriptionWeb.ts
 * R7 — Web-First Subscription Purchase (Option A)
 *
 * Opens the subscription checkout on the WEB in the EXTERNAL system browser
 * (never an in-app webview), per App Store Guideline 3.1.3. The app has NO
 * purchase button, price-selection UI, or billing trigger — it only redirects
 * the parent to passitup.com where Stripe Checkout handles the actual purchase.
 *
 * URL source: EXPO_PUBLIC_SUBSCRIPTION_WEB_URL (see .env.example). No hardcoded
 * production URL in code — the fallback is only for local dev convenience.
 */

import { Linking, Alert, Platform } from 'react-native';

const DEFAULT_WEB_BASE = 'https://passitup.com';

/**
 * FIX-Task-41 item 4: the Android emulator cannot resolve the HOST machine's
 * `localhost` — the host loopback is reachable only as `10.0.2.2`. The dev web
 * base (`EXPO_PUBLIC_SUBSCRIPTION_WEB_URL=http://localhost:3002` in `.env`)
 * therefore opened a browser page that could not load from the emulator
 * (SUB Android R3, SUB-TC-N02 variance).
 *
 * Only a LOCAL-dev host is rewritten, so a real base (`https://passitup.com` —
 * staging/production) can never be affected.
 */
export const ANDROID_EMULATOR_HOST_ALIAS = '10.0.2.2';
const LOCAL_HOST_PATTERN = /^([a-z][a-z0-9+.-]*:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i;

/**
 * Rewrite a `localhost` / `127.0.0.1` web base to the Android emulator's host
 * alias. Pure — the OS is injectable, so this is unit-testable without mocking
 * react-native (see subscriptionWeb.test.ts).
 */
export function toEmulatorReachableBase(base: string, platformOS: string = Platform.OS): string {
  if (platformOS !== 'android') return base;
  return base.replace(LOCAL_HOST_PATTERN, `$1${ANDROID_EMULATOR_HOST_ALIAS}`);
}

/**
 * Resolve the web base URL from env, falling back to the production base for
 * local-dev convenience. Add a trailing "/join" path for the membership page.
 */
export function getJoinKidsClubWebUrl(
  email?: string | null,
  platformOS: string = Platform.OS
): string {
  const configured = (
    process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL || DEFAULT_WEB_BASE
  ).replace(/\/$/, '');
  const base = toEmulatorReachableBase(configured, platformOS);
  const url = `${base}/join`;
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return `${url}?email=${encodeURIComponent(email.trim().toLowerCase())}`;
  }
  return url;
}

/**
 * Open the web "Join Kids Club" page in the EXTERNAL browser.
 * Returns true when the browser was opened; false otherwise.
 */
export async function openJoinKidsClubWeb(options?: { email?: string | null }): Promise<boolean> {
  const url = getJoinKidsClubWebUrl(options?.email);

  // FIX-Task-41 item 4: log the resolved URL in dev/staging builds so the
  // emulator host rewrite is verifiable from `adb logcat` — the CTA hands off to
  // the external browser, so no in-app surface shows which URL was opened.
  if (__DEV__) {
    console.log(`[subscriptionWeb] opening ${url}`);
  }

  const canOpen = await Linking.canOpenURL(url).catch(() => false);
  if (!canOpen) {
    Alert.alert(
      'Open your browser',
      `We couldn't open your browser automatically. Please visit ${url} on this device to complete your Kids Club membership.`,
    );
    return false;
  }

  try {
    // Platform-independent external browser open. On iOS this opens Safari
    // (not an in-app webview), satisfying App Store Guideline 3.1.3.
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('[subscriptionWeb] Failed to open web URL:', error);
    Alert.alert(
      'Open your browser',
      `We couldn't open your browser automatically. Please visit ${url} on this device to complete your Kids Club membership.`,
    );
    return false;
  }
}

// Re-export Platform reference so callers can branch on OS if ever needed
// (e.g., showing a Google Pay note on Android).
export const isAndroid = Platform.OS === 'android';
