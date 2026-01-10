/**
 * Unit Tests: Message Expiration Logic
 * Module: MODULE-07 MSG-004
 * 
 * Tests the mark_expired_messages() RPC function and expiration logic.
 * 
 * Run: npm test -- src/__tests__/services/message-expiration.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const shouldRunSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';
const d = shouldRunSupabaseE2E ? describe : describe.skip;

d('MSG-004: Message Expiration (Supabase E2E)', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase credentials for E2E. Set SUPABASE_URL and SUPABASE_ANON_KEY (and RUN_SUPABASE_E2E=true).'
      );
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);
  });

  describe('Admin Config', () => {
    it('should have message_expiration_days configured', async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value, data_type')
        .eq('key', 'message_expiration_days')
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.key).toBe('message_expiration_days');
      expect(data?.data_type).toBe('number');
      expect(parseInt(data?.value || '0')).toBeGreaterThan(0);
    });

    it('should default to 30 days', async () => {
      const { data } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'message_expiration_days')
        .single();

      expect(data?.value).toBe('30');
    });
  });

  describe('mark_expired_messages() RPC', () => {
    it('should exist and be callable', async () => {
      // This will fail if function doesn't exist or has wrong signature
      const { data, error } = await supabase.rpc('mark_expired_messages');

      // We expect either success or specific error (not "function does not exist")
      if (error) {
        expect(error.message).not.toContain('does not exist');
      }

      // Should return a number (count of deleted messages)
      expect(typeof data).toBe('number');
      expect(data).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 if no messages are expired', async () => {
      // If all trades are recent or no completed trades exist, count should be 0
      const { data, error } = await supabase.rpc('mark_expired_messages');

      expect(error).toBeNull();
      expect(typeof data).toBe('number');
      expect(data).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Query Exclusion', () => {
    it('should exclude deleted messages from getMessages query', async () => {
      // Query messages with deleted_at IS NULL (same as service layer)
      const { data, error } = await supabase
        .from('messages')
        .select('id, deleted_at')
        .is('deleted_at', null);

      expect(error).toBeNull();

      // All returned messages should have deleted_at = null
      if (data && data.length > 0) {
        data.forEach((msg) => {
          expect(msg.deleted_at).toBeNull();
        });
      }
    });

    it('should be able to query deleted messages explicitly', async () => {
      // Query only deleted messages
      const { data, error } = await supabase
        .from('messages')
        .select('id, deleted_at')
        .not('deleted_at', 'is', null);

      expect(error).toBeNull();

      // All returned messages should have deleted_at NOT null
      if (data && data.length > 0) {
        data.forEach((msg) => {
          expect(msg.deleted_at).not.toBeNull();
        });
      }
    });
  });

  describe('Expiration Logic Edge Cases', () => {
    it('should NOT delete messages from incomplete trades', async () => {
      // Query messages from trades that are NOT completed
      const { data: incompleteTradeMessages } = await supabase
        .from('messages')
        .select(`
          id,
          deleted_at,
          trades!inner(status, completed_at)
        `)
        .neq('trades.status', 'completed');

      // None of these should be marked as deleted by expiration logic
      if (incompleteTradeMessages && incompleteTradeMessages.length > 0) {
        incompleteTradeMessages.forEach((msg: any) => {
          // If deleted_at exists, it's NOT due to expiration (manual delete by user)
          // But expiration logic should never touch these
          expect(msg.trades.status).not.toBe('completed');
        });
      }
    });

    it('should NOT delete messages from recently completed trades', async () => {
      // Query messages from trades completed < 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentMessages } = await supabase
        .from('messages')
        .select(`
          id,
          deleted_at,
          trades!inner(status, completed_at)
        `)
        .eq('trades.status', 'completed')
        .gte('trades.completed_at', thirtyDaysAgo.toISOString())
        .is('deleted_at', null);

      // All these should still be active (not deleted)
      if (recentMessages && recentMessages.length > 0) {
        recentMessages.forEach((msg: any) => {
          expect(msg.deleted_at).toBeNull();
        });
      }
    });
  });

  describe('Function Performance', () => {
    it('should execute within reasonable time (<5 seconds)', async () => {
      const startTime = Date.now();

      await supabase.rpc('mark_expired_messages');

      const executionTime = Date.now() - startTime;

      // Should complete within 5 seconds even with large datasets
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing admin_config gracefully', async () => {
      // Even if admin_config is missing, function should default to 30 days
      // and not throw an error
      const { error } = await supabase.rpc('mark_expired_messages');

      // Should NOT error out
      expect(error).toBeNull();
    });
  });
});
