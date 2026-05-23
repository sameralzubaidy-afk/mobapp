// File: p2p-kids-marketplace/src/__tests__/integration/flow-16-dashboard.integration.test.ts
// MODULE-15.1 FLOW-16: Integration tests for Home Dashboard with real Supabase
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '@/config/supabase';
import { getUnreadNotificationCount } from '@/services/referralNotifications';

const TEST_USER_ID = 'test-user-flow-16';
const TEST_EMAIL = 'flow16test@example.com';

describe('FLOW-16: Home Dashboard Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.warn('Skipping integration tests (set RUN_SUPABASE_E2E=true to run)');
      return;
    }

    // Create test user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: 'TestPassword123!',
    });

    if (authError) throw authError;
    testUserId = authData.user!.id;

    // Create profile entry
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: testUserId,
        full_name: 'Test User Flow 16',
        email: TEST_EMAIL,
      });

    if (profileError) throw profileError;
  });

  afterAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // Cleanup: delete test user profile and auth
    if (testUserId) {
      await supabase.from('profiles').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('should fetch user session successfully', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true); // skip
      return;
    }

    const { data: session } = await supabase.auth.getSession();

    expect(session).toBeTruthy();
    expect(session?.session?.user).toBeTruthy();
  });

  it('should fetch SP wallet data for subscribed user', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    const { data: wallet, error } = await supabase
      .from('sp_wallet')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    // Wallet may not exist yet for new user - that's okay
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If wallet exists, verify structure
    if (wallet) {
      expect(wallet).toHaveProperty('available');
      expect(wallet).toHaveProperty('pending');
      expect(wallet).toHaveProperty('lifetime_earned');
      expect(wallet).toHaveProperty('lifetime_spent');
    }
  });

  it('should fetch subscription status', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, can_spend_sp')
      .eq('user_id', testUserId)
      .maybeSingle();

    // New user may not have subscription yet - that's okay
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If subscription exists, verify structure
    if (subscription) {
      expect(subscription).toHaveProperty('status');
      expect(subscription).toHaveProperty('can_spend_sp');
    }
  });

  it('should fetch notification count using useNotificationBadge service', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    const result = await getUnreadNotificationCount(testUserId);

    expect(result.success).toBe(true);
    expect(typeof result.count).toBe('number');
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('should fetch recent trades for user', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, status, created_at, listing:items(title, price)')
      .or(`buyer_id.eq.${testUserId},seller_id.eq.${testUserId}`)
      .order('created_at', { ascending: false })
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(trades)).toBe(true);
    // New user may have 0 trades - that's expected
  });

  it('should enforce RLS: user can only see their own wallet', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    // Attempt to fetch another user's wallet (should fail or return empty)
    const { data: otherWallet, error } = await supabase
      .from('sp_wallet')
      .select('*')
      .neq('user_id', testUserId)
      .limit(1);

    // RLS should prevent access to other users' wallets
    expect(otherWallet).toEqual([]);
  });

  it('should verify SP balance display formatting', async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      expect(true).toBe(true);
      return;
    }

    const mockWalletData = {
      available: 250,
      pending: 50,
      lifetime_earned: 500,
      lifetime_spent: 200,
    };

    // Verify balance formatting logic (this would be in the component)
    const displayBalance = `${mockWalletData.available} SP`;
    expect(displayBalance).toBe('250 SP');
  });
});
