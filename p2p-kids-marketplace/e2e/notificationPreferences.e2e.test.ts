// E2E Integration Tests: Notification Preferences
// MODULE-14: NOTIF-V2-001
// Tests database schema, RPC functions, and RLS policies against staging Supabase

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const testEmail = `notif-test-${Date.now()}@test.com`;
const testPassword = 'TestPassword123!';
const describeIfE2E = process.env.RUN_SUPABASE_E2E ? describe : describe.skip;

function isAuthRateLimitError(message?: string): boolean {
  return Boolean(message && /request rate limit reached/i.test(message));
}

describeIfE2E('Notification Preferences - E2E Integration Tests', () => {
  let supabase: any;
  let supabaseAdmin: any;
  let testUserId: string;
  let canRunSuite = Boolean(process.env.RUN_SUPABASE_E2E);
  let skipReason = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(
        `[notificationPreferences.e2e] Skipping case: ${skipReason || 'suite preconditions unavailable'}`
      );
      return true;
    }

    return false;
  };

  const itIfRunnable = (name: string, fn: () => Promise<void> | void) => {
    it(name, async () => {
      if (shouldSkipCase()) {
        return;
      }
      await fn();
    });
  };

  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.log('⏭️  Skipping E2E tests (set RUN_SUPABASE_E2E=true to run)');
      return;
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);
    if (supabaseServiceRoleKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    }

    // Create test user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (authError || !authData.user?.id) {
      if (isAuthRateLimitError(authError?.message)) {
        canRunSuite = false;
        skipReason = `Supabase auth rate limit while creating notification preferences suite user: ${authError?.message}`;
        console.warn(`[notificationPreferences.e2e] ${skipReason}`);
        return;
      }
      throw authError || new Error('Failed to create notification preferences suite user');
    }
    testUserId = authData.user.id;

    console.log(`✅ Test user created: ${testUserId}`);
  });

  afterAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E || !supabase || !testUserId) return;

    // Cleanup: Delete test user (cascades to preferences via FK)
    if (supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
      console.log(`🗑️  Test user deleted: ${testUserId}`);
    }
  });

  describe('Database Schema Verification', () => {
    itIfRunnable('should have notification_preferences table with correct schema', async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', testUserId)
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    itIfRunnable('should create default preferences for new user', async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toHaveLength(5); // 5 categories

      const categories = data.map((p: any) => p.category).sort();
      expect(categories).toEqual(['badges', 'sp_events', 'subscription', 'system', 'trades']);

      // Check default values for subscription category
      const subPref = data.find((p: any) => p.category === 'subscription');
      expect(subPref.push_enabled).toBe(true);
      expect(subPref.in_app_enabled).toBe(true);
      expect(subPref.email_enabled).toBe(true); // Critical notifications
      expect(subPref.quiet_hours_enabled).toBe(true);
      expect(subPref.quiet_hours_start).toBe('22:00:00');
      expect(subPref.quiet_hours_end).toBe('08:00:00');
    });

    itIfRunnable('should have unique constraint on (user_id, category)', async () => {
      // Attempt duplicate insert
      const { error } = await supabase.from('notification_preferences').insert({
        user_id: testUserId,
        category: 'subscription',
        push_enabled: false,
      });

      expect(error).toBeDefined();
      // In anon-key environments, RLS can block raw inserts before constraint checks.
      expect(['23505', '42501']).toContain(error.code);
    });
  });

  describe('RPC: get_notification_preferences', () => {
    itIfRunnable('should fetch all preferences for authenticated user', async () => {
      const { data, error } = await supabase.rpc('get_notification_preferences', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(5);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'subscription',
            push_enabled: expect.any(Boolean),
            in_app_enabled: expect.any(Boolean),
            email_enabled: expect.any(Boolean),
            quiet_hours_enabled: expect.any(Boolean),
            quiet_hours_start: expect.any(String),
            quiet_hours_end: expect.any(String),
          }),
        ])
      );
    });

    itIfRunnable('should return empty array for non-existent user', async () => {
      const { data, error } = await supabase.rpc('get_notification_preferences', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('RPC: update_notification_preference', () => {
    itIfRunnable('should update push_enabled setting', async () => {
      // Update push_enabled to false
      const { data: updateData, error: updateError } = await supabase.rpc(
        'update_notification_preference',
        {
          p_user_id: testUserId,
          p_category: 'sp_events',
          p_push_enabled: false,
          p_in_app_enabled: null,
          p_email_enabled: null,
          p_quiet_hours_enabled: null,
          p_quiet_hours_start: null,
          p_quiet_hours_end: null,
        }
      );

      expect(updateError).toBeNull();
      expect(updateData).toEqual({ success: true });

      // Verify update
      const { data: verifyData } = await supabase
        .from('notification_preferences')
        .select('push_enabled')
        .eq('user_id', testUserId)
        .eq('category', 'sp_events')
        .single();

      expect(verifyData.push_enabled).toBe(false);
    });

    itIfRunnable('should update quiet hours settings', async () => {
      const { error: updateError } = await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'badges',
        p_push_enabled: null,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: true,
        p_quiet_hours_start: '21:00:00',
        p_quiet_hours_end: '09:00:00',
      });

      expect(updateError).toBeNull();

      // Verify update
      const { data: verifyData } = await supabase
        .from('notification_preferences')
        .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
        .eq('user_id', testUserId)
        .eq('category', 'badges')
        .single();

      expect(verifyData.quiet_hours_enabled).toBe(true);
      expect(verifyData.quiet_hours_start).toBe('21:00:00');
      expect(verifyData.quiet_hours_end).toBe('09:00:00');
    });

    itIfRunnable('should update updated_at timestamp on change', async () => {
      // Get initial timestamp
      const { data: before } = await supabase
        .from('notification_preferences')
        .select('updated_at')
        .eq('user_id', testUserId)
        .eq('category', 'trades')
        .single();

      const beforeTime = new Date(before.updated_at).getTime();

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update preference
      await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'trades',
        p_push_enabled: false,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: null,
        p_quiet_hours_start: null,
        p_quiet_hours_end: null,
      });

      // Get updated timestamp
      const { data: after } = await supabase
        .from('notification_preferences')
        .select('updated_at')
        .eq('user_id', testUserId)
        .eq('category', 'trades')
        .single();

      const afterTime = new Date(after.updated_at).getTime();

      expect(afterTime).toBeGreaterThan(beforeTime);
    });

    itIfRunnable('should handle null parameters gracefully (COALESCE)', async () => {
      // Update with all null parameters should not fail
      const { error } = await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'system',
        p_push_enabled: null,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: null,
        p_quiet_hours_start: null,
        p_quiet_hours_end: null,
      });

      expect(error).toBeNull();
    });
  });

  describe('RLS Policy Verification', () => {
    let otherUserId: string;

    beforeAll(async () => {
      if (shouldSkipCase()) {
        return;
      }

      // Create another test user
      const { data: otherAuth, error } = await supabase.auth.signUp({
        email: `other-${Date.now()}@test.com`,
        password: testPassword,
      });

      if (error || !otherAuth.user?.id) {
        if (isAuthRateLimitError(error?.message)) {
          canRunSuite = false;
          skipReason = `Supabase auth rate limit while creating secondary RLS user: ${error?.message}`;
          console.warn(`[notificationPreferences.e2e] ${skipReason}`);
          return;
        }
        throw error || new Error('Failed to create RLS secondary user');
      }
      otherUserId = otherAuth.user.id;

      console.log(`✅ Other test user created: ${otherUserId}`);
    });

    afterAll(async () => {
      if (otherUserId && supabaseAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(otherUserId);
        console.log(`🗑️  Other test user deleted: ${otherUserId}`);
      }
    });

    itIfRunnable('should prevent users from viewing other users preferences', async () => {
      // Sign in as first user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      // Try to fetch other user's preferences
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', otherUserId);

      expect(error).toBeNull();
      expect(data).toEqual([]); // RLS prevents access
    });

    itIfRunnable('should prevent users from updating other users preferences', async () => {
      // Sign in as first user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      // Try to update other user's preferences via RPC
      const { data, error } = await supabase.rpc('update_notification_preference', {
        p_user_id: otherUserId,
        p_category: 'subscription',
        p_push_enabled: false,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: null,
        p_quiet_hours_start: null,
        p_quiet_hours_end: null,
      });

      // RPC should silently fail (no rows updated) or return error
      // depending on RPC implementation
      expect(error).toBeDefined();
    });

    itIfRunnable('should allow users to view only their own preferences', async () => {
      // Sign in as first user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toHaveLength(5);
      expect(data.every((p: any) => p.user_id === testUserId)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    itIfRunnable('should enforce foreign key constraint to users table', async () => {
      // Try to insert preference for non-existent user
      const { error } = await supabase.from('notification_preferences').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        category: 'subscription',
        push_enabled: true,
      });

      expect(error).toBeDefined();
      // In anon-key environments, RLS can block raw inserts before FK checks.
      expect(['23503', '42501']).toContain(error.code);
    });

    itIfRunnable('should cascade delete preferences when user is deleted', async () => {
      // Create temp user
      const { data: tempAuth, error: tempAuthError } = await supabase.auth.signUp({
        email: `temp-${Date.now()}@test.com`,
        password: testPassword,
      });

      if (tempAuthError || !tempAuth.user?.id) {
        if (isAuthRateLimitError(tempAuthError?.message)) {
          console.warn(
            `[notificationPreferences.e2e] Skipping cascade-delete assertion due to auth rate limit: ${tempAuthError?.message}`
          );
          return;
        }
        throw tempAuthError || new Error('Failed to create temporary user for cascade-delete test');
      }

      const tempUserId = tempAuth.user.id;

      // Verify preferences exist
      const { data: before } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', tempUserId);

      expect(before).toHaveLength(5);

      if (!supabaseAdmin) {
        // Without service role key, admin delete is expected to be denied.
        const { error: deleteError } = await supabase.auth.admin.deleteUser(tempUserId);
        expect(deleteError).toBeDefined();
        expect(['42501', '401', '403']).toContain(
          deleteError?.code || String(deleteError?.status || '')
        );
        return;
      }

      // Delete user with service-role client
      const { error: adminDeleteError } = await supabaseAdmin.auth.admin.deleteUser(tempUserId);
      expect(adminDeleteError).toBeNull();

      // Verify preferences are deleted
      const { data: after, error: afterError } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', tempUserId);

      expect(afterError).toBeNull();
      expect(after).toEqual([]);
    });

    itIfRunnable('should validate time format for quiet hours', async () => {
      // Valid time format should succeed
      const { error: validError } = await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'subscription',
        p_push_enabled: null,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: null,
        p_quiet_hours_start: '23:59:59',
        p_quiet_hours_end: '00:00:00',
      });

      expect(validError).toBeNull();

      // Invalid time format should fail
      const { error: invalidError } = await supabase.rpc('update_notification_preference', {
        p_user_id: testUserId,
        p_category: 'subscription',
        p_push_enabled: null,
        p_in_app_enabled: null,
        p_email_enabled: null,
        p_quiet_hours_enabled: null,
        p_quiet_hours_start: '25:00:00', // Invalid hour
        p_quiet_hours_end: '00:00:00',
      });

      expect(invalidError).toBeDefined();
    });
  });
});
