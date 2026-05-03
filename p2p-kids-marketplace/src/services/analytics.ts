/**
 * File: src/services/analytics.ts
 *
 * Simple analytics service wrapper for Firebase Analytics.
 * Tracks user events across the app.
 *
 * Currently a stub - will be fully implemented with Firebase Analytics SDK
 */

export type AnalyticsEventParams = Record<string, unknown>;

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
