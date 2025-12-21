/**
 * File: src/services/analytics.ts
 * 
 * Simple analytics service wrapper for Firebase Analytics.
 * Tracks user events across the app.
 * 
 * Currently a stub - will be fully implemented with Firebase Analytics SDK
 */

export type AnalyticsEventParams = Record<string, any>;

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
      console.debug(`[Analytics] Event tracked: ${eventName}`, params);
    }
  } catch (error) {
    console.error(`[Analytics] Failed to track event: ${eventName}`, error);
  }
};

/**
 * Set user properties for analytics
 * @param userId - User ID to associate events with
 * @param properties - User properties (subscription status, tier, etc)
 */
export const setUserProperties = (userId: string, properties: Record<string, any>): void => {
  try {
    // TODO: Connect to Firebase Analytics
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[Analytics] User properties set for ${userId}`, properties);
    }
  } catch (error) {
    console.error(`[Analytics] Failed to set user properties`, error);
  }
};

/**
 * Reset analytics (typically on logout)
 */
export const resetAnalytics = (): void => {
  try {
    // TODO: Connect to Firebase Analytics
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Analytics] Analytics reset');
    }
  } catch (error) {
    console.error('[Analytics] Failed to reset analytics', error);
  }
};
