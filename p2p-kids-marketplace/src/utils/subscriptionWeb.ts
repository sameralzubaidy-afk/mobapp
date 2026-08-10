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
 * Resolve the web base URL from env, falling back to the production base for
 * local-dev convenience. Add a trailing "/join" path for the membership page.
 */
export function getJoinKidsClubWebUrl(email?: string | null): string {
  const base = (process.env.EXPO_PUBLIC_SUBSCRIPTION_WEB_URL || DEFAULT_WEB_BASE).replace(/\/$/, '');
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
