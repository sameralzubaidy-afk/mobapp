// File: p2p-kids-marketplace/src/services/notifications.ts
// Handles Expo Push Notifications registration, token management, and local/remote notification sending

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Configure notification behavior when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  deviceId: string;
  platform: 'ios' | 'android';
}

export interface NotificationData {
  [key: string]: string | number | boolean;
}

/**
 * Register for push notifications
 * Requests user permissions and returns the push token
 *
 * @returns Push token string or null if registration failed
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push notification permissions');
    return null;
  }

  // Configure Android notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
      sound: 'default',
    });
  }

  try {
    // Get push token for Expo
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    return tokenData.data;
  } catch (err) {
    const error = err as Error;
    const message = error.message || '';

    if (
      Platform.OS === 'android' &&
      message.toLowerCase().includes('default firebaseapp is not initialized')
    ) {
      console.error(
        '[notifications] Android Firebase is not initialized. Add google-services.json and rebuild a development client.'
      );
    } else {
      console.error('[notifications] Failed to get Expo push token:', message);
    }

    return null;
  }
};

/**
 * Save push token to database for later use by backend
 *
 * @param userId - Authenticated user ID
 * @param token - Push notification token from Expo
 * @returns Success/failure result
 */
export const savePushToken = async (
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const deviceId = Constants.deviceId || 'unknown';

    // Using any cast if push_tokens is not yet in generated database types
    const { error } = await supabase.from('push_tokens' as never).upsert(
      {
        user_id: userId,
        token,
        device_id: deviceId,
        platform: Platform.OS as 'ios' | 'android',
        updated_at: new Date().toISOString(),
      } as never,
      {
        onConflict: 'user_id,device_id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      console.warn('⚠️ Failed to save push token:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ Error saving push token:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a local notification immediately
 * Useful for testing or in-app alerts
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Additional data to pass to notification handler
 */
export const sendLocalNotification = async (
  title: string,
  body: string,
  data?: NotificationData
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      },
      trigger: null, // Immediate notification
    });
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ Failed to send local notification:', error.message);
  }
};

/**
 * Schedule a notification for later
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param seconds - Delay in seconds before showing notification
 * @param data - Additional data to pass to notification handler
 */
export const scheduleNotification = async (
  title: string,
  body: string,
  seconds: number,
  data?: NotificationData
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      },
      trigger: {
        seconds,
      },
    });
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ Failed to schedule notification:', error.message);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ Failed to cancel notifications:', error.message);
  }
};

/**
 * Hook to set up notification listeners for received and tapped notifications
 * Call this once in the app root (e.g., in App.tsx or a useEffect hook)
 *
 * @returns Cleanup function to remove listeners
 */
export const createNotificationObserver = () => {
  // Listen for notifications received while app is open
  const notificationListener = Notifications.addNotificationReceivedListener((_notification) => {
    // Notification received logic
  });

  // Listen for user tapping on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((_response) => {
    // User tapped logic
    // TODO: Implement navigation based on notification type
    // Example: if (data.type === 'item_update') navigation.navigate('Item', { itemId: data.itemId });
  });

  // Return cleanup function to remove listeners
  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
};

// Backward-compatible alias for existing imports.
export const useNotificationObserver = createNotificationObserver;

/**
 * Get the current push notification token
 * (without saving to database - for UI display or debugging)
 */
export const getCurrentPushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    return tokenData.data;
  } catch (err) {
    console.error('Failed to get push token:', err);
    return null;
  }
};

/**
 * Remove a push token from database (e.g., when user logs out)
 */
export const removePushToken = async (
  userId: string,
  deviceId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    let query = supabase
      .from('push_tokens' as never)
      .delete()
      .eq('user_id', userId);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { error } = await query;

    if (error) {
      console.warn('⚠️ Failed to remove push token:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ Error removing push token:', error.message);
    return { success: false, error: error.message };
  }
};
