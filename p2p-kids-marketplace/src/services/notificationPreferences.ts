// File: p2p-kids-marketplace/src/services/notificationPreferences.ts
// MODULE-14: Service for managing user notification preferences via Supabase RPC

import { supabase } from './supabase';

export type NotificationCategory = 'subscription' | 'sp_events' | 'badges' | 'trades' | 'system';

export interface NotificationPreference {
  category: NotificationCategory;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

/**
 * Fetch all notification preferences for the current user
 */
export const getNotificationPreferences = async (): Promise<{
  success: boolean;
  preferences?: NotificationPreference[];
  error?: string;
}> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: initialData, error } = await supabase.rpc('get_notification_preferences', {
      p_user_id: user.id,
    });
    let data = initialData;

    if (error) throw error;

    // Self-healing: If no preferences found, initialize them and try again
    if (!data || data.length === 0) {
      console.log('[NotificationPreferencesService] No preferences found, initializing...');
      const { error: initError } = await supabase.rpc('initialize_user_preferences', {
        p_user_id: user.id,
      });

      if (initError) throw initError;

      // Fetch again after initialization
      const { data: retryData, error: retryError } = await supabase.rpc(
        'get_notification_preferences',
        {
          p_user_id: user.id,
        }
      );

      if (retryError) throw retryError;
      data = retryData;
    }

    return {
      success: true,
      preferences: data as NotificationPreference[],
    };
  } catch (err: any) {
    console.error('[NotificationPreferencesService] get error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Update a specific notification preference
 */
export const updateNotificationPreference = async (
  category: NotificationCategory,
  updates: Partial<Omit<NotificationPreference, 'category'>>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: _data, error } = await supabase.rpc('update_notification_preference', {
      p_user_id: user.id,
      p_category: category,
      p_push_enabled: updates.push_enabled,
      p_in_app_enabled: updates.in_app_enabled,
      p_email_enabled: updates.email_enabled,
      p_quiet_hours_enabled: updates.quiet_hours_enabled,
      p_quiet_hours_start: updates.quiet_hours_start,
      p_quiet_hours_end: updates.quiet_hours_end,
    });

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('[NotificationPreferencesService] update error:', err);
    return { success: false, error: err.message };
  }
};
