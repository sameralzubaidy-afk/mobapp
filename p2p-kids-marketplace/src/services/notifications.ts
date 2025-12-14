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

  // Get push token for Expo
  // TODO: Ensure EXPO_PUBLIC_EAS_PROJECT_ID is set in .env.local
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

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

  return tokenData.data;
};

/**
 * Save push token to database for later use by backend
 * 
 * @param userId - Authenticated user ID
 * @param token - Push notification token from Expo
 * @returns Success/failure result
 */
export const savePushToken = async (userId: string, token: string) => {
  try {
    const deviceId = Constants.deviceId || 'unknown';

    // TODO: Update type when push_tokens table schema is added to database.types.ts
    // Using 'any' cast because push_tokens table is not yet in generated database types
    const result: any = await (supabase.from('push_tokens' as any) as any).upsert({
      user_id: userId,
      token,
      device_id: deviceId,
      platform: Platform.OS as 'ios' | 'android',
      updated_at: new Date().toISOString(),
    });

    const { error } = result;

    if (error) {
      console.error('Failed to save push token:', error);
      return { success: false, error: error.message };
    }

    console.log('Push token saved successfully');
    return { success: true };
  } catch (err) {
    console.error('Error saving push token:', err);
    return { success: false, error: String(err) };
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
) => {
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
    console.log('Local notification sent:', title);
  } catch (err) {
    console.error('Failed to send local notification:', err);
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
) => {
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
    console.log(`Notification scheduled for ${seconds}s from now:`, title);
  } catch (err) {
    console.error('Failed to schedule notification:', err);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All scheduled notifications cancelled');
  } catch (err) {
    console.error('Failed to cancel notifications:', err);
  }
};

/**
 * Hook to set up notification listeners for received and tapped notifications
 * Call this once in the app root (e.g., in App.tsx or a useEffect hook)
 * 
 * @returns Cleanup function to remove listeners
 */
export const useNotificationObserver = () => {
  // Listen for notifications received while app is open
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received while app open:', notification);
      // Perform any app-specific logic here
    }
  );

  // Listen for user tapping on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('User tapped notification:', response);

      // TODO: Implement navigation based on notification type
      // Extract data from: response.notification.request.content.data
      // Example patterns:
      // if (data.type === 'message') navigation.navigate('Messages', { chatId: data.chatId });
      // if (data.type === 'trade') navigation.navigate('Trade', { tradeId: data.tradeId });
      // if (data.type === 'item_update') navigation.navigate('Item', { itemId: data.itemId });
    }
  );

  // Return cleanup function to remove listeners
  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
};

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
export const removePushToken = async (userId: string, deviceId?: string) => {
  try {
    let query = supabase.from('push_tokens').delete().eq('user_id', userId);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    // TODO: Update type when push_tokens table schema is added to database.types.ts
    const { error } = await (query as any);

    if (error) {
      console.error('Failed to remove push token:', error);
      return { success: false, error: error.message };
    }

    console.log('Push token removed');
    return { success: true };
  } catch (err) {
    console.error('Error removing push token:', err);
    return { success: false, error: String(err) };
  }
};
