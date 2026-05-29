/**
 * File: src/services/analytics.ts
 *
 * Simple analytics service wrapper for Firebase Analytics.
 * Tracks user events across the app.
 *
 * Currently a stub - will be fully implemented with Firebase Analytics SDK
 */

export type AnalyticsEventParams = Record<string, unknown>;

/**
 * PROD-011: Initialize analytics with COPPA-compliant settings.
 *
 * Call this once at app startup (in App.tsx), before any other analytics
 * calls. Today this is a stub because the Firebase Analytics SDK is not yet
 * installed; when it is wired in, replace the body with:
 *
 *   await analytics().setAnalyticsCollectionEnabled(true);
 *   await analytics().setUserProperty('allow_personalized_ads', 'false');
 *
 * COPPA / Google Play Families Policy requirements enforced here:
 * - Disable ad personalization (no interest-based ad profiling).
 * - Analytics collection enabled but NO advertising-ID (AAID) association.
 *
 * Additional steps required in Firebase Console (cannot be done in code):
 * - Project Settings → Google Analytics → Disable "Google signals data collection"
 * - Project Settings → Google Analytics → Disable "Enable advertising ID collection"
 * TODO(PROD-011): Document these console steps in docs/FIREBASE-COPPA-SETUP.md
 */
export async function initAnalytics(): Promise<void> {
  try {
    // Stub today (no Firebase SDK installed). When wired:
    //   await analytics().setAnalyticsCollectionEnabled(true);
    //   await analytics().setUserProperty('allow_personalized_ads', 'false');
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug(
        'DEBUG  [Analytics] initAnalytics() called (COPPA-compliant defaults; SDK stub)'
      );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    // Non-fatal: analytics failure must never block app startup.
    console.error('[Analytics] Initialization failed (non-fatal):', message);
  }
}

function safeJson(value: unknown) {
  try {
    if (value === undefined) return '';
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Track an analytics event
 * @param eventName - Name of the event (e.g., 'node_assigned')
 * @param params - Event parameters (e.g., { nodeId: '...', distanceMiles: 5 })
 */
export const trackEvent = (eventName: string, params?: AnalyticsEventParams): void => {
  try {
    // TODO: Connect to Firebase Analytics
    // Currently just logging - will wire to Firebase in next phase
    if (process.env.NODE_ENV !== 'production') {
      const payload = safeJson(params);
      // Match iOS-style readability: "DEBUG  [Analytics] ... {json}"
      // eslint-disable-next-line no-console
      console.debug(
        `DEBUG  [Analytics] Event tracked: ${eventName}${payload ? ` ${payload}` : ''}`
      );
    }
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ [Analytics] Failed to track event: ${eventName}`, error.message);
  }
};

/**
 * Set user properties for analytics
 * @param userId - User ID to associate events with
 * @param properties - User properties (subscription status, tier, etc)
 */
export const setUserProperties = (userId: string, properties: Record<string, unknown>): void => {
  try {
    // TODO: Connect to Firebase Analytics
    if (process.env.NODE_ENV !== 'production') {
      const payload = safeJson(properties);
      // eslint-disable-next-line no-console
      console.debug(
        `DEBUG  [Analytics] User properties set for ${userId}${payload ? ` ${payload}` : ''}`
      );
    }
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ [Analytics] Failed to set user properties`, error.message);
  }
};

/**
 * Reset analytics (typically on logout)
 */
export const resetAnalytics = (): void => {
  try {
    // TODO: Connect to Firebase Analytics
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('DEBUG  [Analytics] Analytics reset');
    }
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ [Analytics] Failed to reset analytics', error.message);
  }
};
