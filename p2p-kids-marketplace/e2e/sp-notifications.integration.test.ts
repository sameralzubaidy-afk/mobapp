// File: p2p-kids-marketplace/e2e/sp-notifications.integration.test.ts
// E2E Integration Tests for SP Event Notifications (NOTIF-V2-003)
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Only run E2E tests when explicitly enabled
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const shouldRunE2E =
  process.env.RUN_SUPABASE_E2E === 'true' && !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY;
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('SP Notifications E2E Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testWalletId: string;
  let cleanupIds: { user_ids: string[]; wallet_ids: string[]; notification_ids: string[] };

  async function createTestAuthUser(): Promise<string> {
    const testEmail = `sp-notif-${Date.now()}-${uuidv4().slice(0, 8)}@example.com`;
    const testPassword = 'TestPassword123!';

    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (error || !data.user?.id) {
      throw new Error(`Failed to create SP test user: ${error?.message || 'Unknown error'}`);
    }

    return data.user.id;
  }

  async function ensureWalletForUser(
    userId: string,
    availableBalance: number,
    state: 'active' | 'frozen' = 'active',
    pendingBalance = 0
  ): Promise<string> {
    const { data: existingWallet, error: selectError } = await supabase
      .from('sp_wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingWallet?.id) {
      const { error: updateError } = await supabase
        .from('sp_wallets')
        .update({
          available_balance: availableBalance,
          pending_balance: pendingBalance,
          state,
        })
        .eq('id', existingWallet.id);

      if (updateError) {
        throw updateError;
      }

      return existingWallet.id;
    }

    const walletId = uuidv4();
    const { error: insertError } = await supabase.from('sp_wallets').insert({
      id: walletId,
      user_id: userId,
      available_balance: availableBalance,
      pending_balance: pendingBalance,
      state,
    });

    if (insertError) {
      throw insertError;
    }

    return walletId;
  }

  async function ensureActiveSubscriptionForUser(userId: string): Promise<void> {
    const periodStart = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existingSubscription, error: selectError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingSubscription?.id) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: periodStart,
          current_period_end: periodEnd,
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    if (insertError) {
      throw insertError;
    }
  }

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    cleanupIds = { user_ids: [], wallet_ids: [], notification_ids: [] };
  });

  afterAll(async () => {
    // Cleanup test data
    if (cleanupIds.notification_ids.length > 0) {
      await supabase.from('user_notifications').delete().in('id', cleanupIds.notification_ids);
    }
    if (cleanupIds.user_ids.length > 0) {
      await supabase.from('subscriptions').delete().in('user_id', cleanupIds.user_ids);
    }
    if (cleanupIds.wallet_ids.length > 0) {
      await supabase.from('sp_ledger').delete().in('wallet_id', cleanupIds.wallet_ids);
      await supabase.from('sp_wallets').delete().in('id', cleanupIds.wallet_ids);
    }
    if (cleanupIds.user_ids.length > 0) {
      for (const userId of cleanupIds.user_ids) {
        await supabase.auth.admin.deleteUser(userId);
      }
    }
  });

  describe('SP Earned Notifications', () => {
    beforeEach(async () => {
      // Create test user with active subscription + SP wallet
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 100, 'active', 0);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // Create subscription for test user
      await ensureActiveSubscriptionForUser(testUserId);
    });

    it('should create SP earned notification on ledger insert', async () => {
      // Insert SP earned transaction
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('sp_ledger')
        .insert({
          wallet_id: testWalletId,
          user_id: testUserId,
          transaction_type: 'earn_starter_pack',
          amount: 50,
          balance_before: 100,
          balance_after: 150,
          description: 'Welcome bonus',
        })
        .select()
        .single();

      expect(ledgerError).toBeNull();
      expect(ledgerData).toBeTruthy();

      // Wait for trigger to fire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check notification was created
      const { data: notifications, error: notifError } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_earned')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(notifError).toBeNull();
      expect(notifications).toBeTruthy();
      expect(notifications?.length).toBeGreaterThan(0);

      const notification = notifications![0];
      expect(notification.title).toContain('SP Earned');
      expect(notification.body).toContain('50 SP');
      expect(notification.category).toBe('sp_events');
      expect(notification.data).toHaveProperty('amount');
      expect(notification.data.amount).toBe(50);
      expect(notification.channels).toContain('push');
      expect(notification.channels).toContain('in_app');

      cleanupIds.notification_ids.push(notification.id);
    });

    it('should include correct transaction details in notification data', async () => {
      const { data: ledgerData } = await supabase
        .from('sp_ledger')
        .insert({
          wallet_id: testWalletId,
          user_id: testUserId,
          transaction_type: 'earn_referral',
          amount: 25,
          balance_before: 150,
          balance_after: 175,
          description: 'Referral bonus',
        })
        .select()
        .single();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_earned')
        .order('created_at', { ascending: false })
        .limit(1);

      const notification = notifications![0];
      expect(notification.data).toMatchObject({
        amount: 25,
        transaction_type: 'earn_referral',
        balance_after: 175,
        deep_link: '/wallet',
      });

      cleanupIds.notification_ids.push(notification.id);
    });
  });

  describe('SP Spent Notifications', () => {
    it('should create SP spent notification on ledger insert', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 50, 'active', 0);

      await ensureActiveSubscriptionForUser(testUserId);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      const { data: ledgerData } = await supabase
        .from('sp_ledger')
        .insert({
          wallet_id: testWalletId,
          user_id: testUserId,
          transaction_type: 'spend_purchase',
          amount: -20,
          balance_before: 50,
          balance_after: 30,
          description: 'Used SP on purchase',
        })
        .select()
        .single();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_spent')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(notifications).toBeTruthy();
      expect(notifications?.length).toBeGreaterThan(0);

      const notification = notifications![0];
      expect(notification.title).toContain('SP Spent');
      expect(notification.body).toContain('20 SP');
      expect(notification.data.amount).toBe(-20);

      cleanupIds.notification_ids.push(notification.id);
    });
  });

  describe('Wallet Frozen Notifications', () => {
    it('should create wallet frozen notification when status changes', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 30, 'active', 0);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // Update wallet status to frozen
      const { error: updateError } = await supabase
        .from('sp_wallets')
        .update({ state: 'frozen', available_balance: 0 })
        .eq('id', testWalletId);

      expect(updateError).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_wallet_frozen')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(notifications).toBeTruthy();
      expect(notifications?.length).toBeGreaterThan(0);

      const notification = notifications![0];
      expect(notification.title).toContain('Frozen');
      expect(notification.body).toContain('frozen');
      expect(notification.data.deep_link).toBe('/subscription');

      cleanupIds.notification_ids.push(notification.id);
    });

    it('should send wallet frozen notification even to non-subscribers', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 15, 'active', 0);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // Freeze wallet
      const { error: freezeError } = await supabase
        .from('sp_wallets')
        .update({ state: 'frozen', available_balance: 0 })
        .eq('id', testWalletId);

      expect(freezeError).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_wallet_frozen');

      // Should still create notification for non-subscriber
      expect(notifications).toBeTruthy();
      expect(notifications?.length).toBeGreaterThan(0);

      cleanupIds.notification_ids.push(notifications![0].id);
    });
  });

  describe('Low Balance Warning', () => {
    it('should create low balance notification when balance drops below 10 SP', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 15, 'active', 0);

      await ensureActiveSubscriptionForUser(testUserId);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // Update balance to below 10
      const { error: updateError } = await supabase
        .from('sp_wallets')
        .update({ available_balance: 8 })
        .eq('id', testWalletId);

      expect(updateError).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_balance_low');

      expect(notifications).toBeTruthy();
      expect(notifications?.length).toBeGreaterThan(0);

      const notification = notifications![0];
      expect(notification.title).toContain('Low');
      expect(notification.body).toContain('8 SP');
      expect(notification.data.balance).toBe(8);
      expect(notification.data.deep_link).toBe('/discover');

      cleanupIds.notification_ids.push(notification.id);
    });

    it('should NOT send duplicate low balance notification within 24 hours', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 8, 'active', 0);

      await ensureActiveSubscriptionForUser(testUserId);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // First trigger
      const { error: firstUpdateError } = await supabase
        .from('sp_wallets')
        .update({ available_balance: 7 })
        .eq('id', testWalletId);
      expect(firstUpdateError).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: firstNotifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_balance_low');

      const initialCount = firstNotifications?.length || 0;
      if (firstNotifications && firstNotifications.length > 0) {
        firstNotifications.forEach((n) => cleanupIds.notification_ids.push(n.id));
      }

      // Second trigger within 24 hours
      const { error: secondUpdateError } = await supabase
        .from('sp_wallets')
        .update({ available_balance: 6 })
        .eq('id', testWalletId);
      expect(secondUpdateError).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: secondNotifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_balance_low');

      // Should not create duplicate
      expect(secondNotifications?.length).toBe(initialCount);
    });
  });

  describe('Subscription Gating', () => {
    it('should NOT send SP earned notification to non-subscriber', async () => {
      testUserId = await createTestAuthUser();
      testWalletId = await ensureWalletForUser(testUserId, 0, 'active', 0);

      cleanupIds.wallet_ids.push(testWalletId);
      cleanupIds.user_ids.push(testUserId);

      // NO subscription record for this user

      const { error: ledgerError } = await supabase.from('sp_ledger').insert({
        wallet_id: testWalletId,
        user_id: testUserId,
        transaction_type: 'earn_starter_pack',
        amount: 50,
        balance_before: 0,
        balance_after: 50,
        description: 'Welcome bonus',
      });

      expect(ledgerError).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'sp_earned');

      // Should NOT create notification for non-subscriber
      expect(notifications?.length || 0).toBe(0);
    });
  });
});
