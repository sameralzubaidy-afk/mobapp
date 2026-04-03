// Unit Tests: Notification Preferences Service
// MODULE-14: NOTIF-V2-001
// Tests get/update notification preferences with Supabase mocks

import { supabase } from '@/services/supabase';
import { 
  getNotificationPreferences, 
  updateNotificationPreference 
} from '@/services/notificationPreferences';

// Mock Supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

describe('NotificationPreferences Service - Unit Tests', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  
  const mockPreferences = [
    {
      category: 'subscription',
      push_enabled: true,
      in_app_enabled: true,
      email_enabled: true,
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '08:00:00',
    },
    {
      category: 'sp_events',
      push_enabled: true,
      in_app_enabled: true,
      email_enabled: false,
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '08:00:00',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('getNotificationPreferences', () => {
    it('should fetch preferences successfully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockPreferences,
        error: null,
      });

      const result = await getNotificationPreferences();

      expect(result.success).toBe(true);
      expect(result.preferences).toEqual(mockPreferences);
      expect(result.error).toBeUndefined();
      expect(supabase.rpc).toHaveBeenCalledWith('get_notification_preferences', {
        p_user_id: mockUser.id,
      });
    });

    it('should handle empty preferences and initialize', async () => {
      (supabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: [], error: null }) // First call returns empty
        .mockResolvedValueOnce({ data: null, error: null }) // Init call
        .mockResolvedValueOnce({ data: mockPreferences, error: null }); // Retry call

      const result = await getNotificationPreferences();

      expect(result.success).toBe(true);
      expect(result.preferences).toEqual(mockPreferences);
      expect(supabase.rpc).toHaveBeenCalledTimes(3);
      expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'initialize_user_preferences', {
        p_user_id: mockUser.id,
      });
    });

    it('should return error when RPC fails', async () => {
      const mockError = new Error('Database connection failed');
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await getNotificationPreferences();

      expect(result.success).toBe(false);
      expect(result.preferences).toBeUndefined();
      expect(result.error).toBe('Database connection failed');
    });

    it('should return error when user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getNotificationPreferences();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle null data as empty array', async () => {
      (supabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: null, error: null }) // First call returns null
        .mockResolvedValueOnce({ data: null, error: null }) // Init call
        .mockResolvedValueOnce({ data: mockPreferences, error: null }); // Retry call

      const result = await getNotificationPreferences();

      expect(result.success).toBe(true);
      expect(result.preferences).toEqual(mockPreferences);
      expect(supabase.rpc).toHaveBeenCalledWith('initialize_user_preferences', {
        p_user_id: mockUser.id,
      });
    });
  });

  describe('updateNotificationPreference', () => {
    it('should update push_enabled successfully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await updateNotificationPreference('subscription', {
        push_enabled: false,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(supabase.rpc).toHaveBeenCalledWith('update_notification_preference', {
        p_user_id: mockUser.id,
        p_category: 'subscription',
        p_push_enabled: false,
        p_in_app_enabled: undefined,
        p_email_enabled: undefined,
        p_quiet_hours_enabled: undefined,
        p_quiet_hours_start: undefined,
        p_quiet_hours_end: undefined,
      });
    });

    it('should update multiple fields at once', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await updateNotificationPreference('sp_events', {
        push_enabled: false,
        in_app_enabled: true,
        email_enabled: true,
      });

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('update_notification_preference', {
        p_user_id: mockUser.id,
        p_category: 'sp_events',
        p_push_enabled: false,
        p_in_app_enabled: true,
        p_email_enabled: true,
        p_quiet_hours_enabled: undefined,
        p_quiet_hours_start: undefined,
        p_quiet_hours_end: undefined,
      });
    });

    it('should update quiet hours settings', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await updateNotificationPreference('system', {
        quiet_hours_enabled: true,
        quiet_hours_start: '21:00:00',
        quiet_hours_end: '09:00:00',
      });

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('update_notification_preference', {
        p_user_id: mockUser.id,
        p_category: 'system',
        p_push_enabled: undefined,
        p_in_app_enabled: undefined,
        p_email_enabled: undefined,
        p_quiet_hours_enabled: true,
        p_quiet_hours_start: '21:00:00',
        p_quiet_hours_end: '09:00:00',
      });
    });

    it('should return error when update fails', async () => {
      const mockError = new Error('Update permission denied');
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await updateNotificationPreference('badges', {
        push_enabled: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update permission denied');
    });

    it('should return error when user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await updateNotificationPreference('trades', {
        push_enabled: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle all notification categories', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const categories = ['subscription', 'sp_events', 'badges', 'trades', 'system'];

      for (const category of categories) {
        await updateNotificationPreference(category as any, {
          push_enabled: false,
        });

        expect(supabase.rpc).toHaveBeenCalledWith('update_notification_preference', 
          expect.objectContaining({
            p_category: category,
          })
        );
      }

      expect(supabase.rpc).toHaveBeenCalledTimes(5);
    });
  });
});
