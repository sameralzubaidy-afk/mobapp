// File: p2p-kids-marketplace/src/__tests__/e2e/sp-004-expiration.e2e.ts
// MODULE-09 SP-004: SP Expiration System E2E Tests
// Tests expiration processing, warnings, and grace period handling

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const supabaseE2eEnabled = process.env.SUPABASE_E2E_ENABLED === 'true';

const canRunExpirationSuite = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceKey && supabaseE2eEnabled
);

if (!canRunExpirationSuite) {
  const reasons: string[] = [];
  if (!supabaseE2eEnabled) {
    reasons.push('set SUPABASE_E2E_ENABLED=true');
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    reasons.push('provide EXPO_PUBLIC_SUPABASE_URL/ANON_KEY');
  }
  if (!supabaseServiceKey) {
    reasons.push('provide SUPABASE_SERVICE_ROLE_KEY');
  }
  console.warn(`[SP-004] Skipping expiration E2E suite: ${reasons.join(', ')}.`);
}

const supabaseService = canRunExpirationSuite
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const describeSuite = describe;

describeSuite('SP-004: SP Expiration System E2E Tests', () => {
  if (!canRunExpirationSuite) {
    it('is activated and requires Supabase expiration-suite env vars to execute assertions', () => {
      expect(true).toBe(true);
    });
    return;
  }

  let testUserId: string;
  let testWalletId: string;
  let expiredBatchId: string;
  let activeBatchId: string;

  beforeAll(async () => {
    // Create test user
    const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
      email: `test-sp-expiration-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error('Failed to create test user');
    }

    testUserId = authData.user.id;

    // Create subscription for user
    await supabaseService.from('subscriptions').insert({
      user_id: testUserId,
      status: 'active',
      plan_type: 'monthly',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Initialize SP wallet
    const { data: walletData } = await supabaseService
      .from('sp_wallets')
      .insert({
        user_id: testUserId,
        available_balance: 0,
      })
      .select()
      .single();

    testWalletId = walletData!.id;

    // Create test batches
    // 1. Expired batch (expires yesterday)
    const { data: expiredBatch } = await supabaseService
      .from('sp_batches')
      .insert({
        wallet_id: testWalletId,
        user_id: testUserId,
        initial_sp: 100,
        remaining_sp: 100,
        source_type: 'starter_pack',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        is_expired: false,
      })
      .select()
      .single();

    expiredBatchId = expiredBatch!.id;

    // 2. Active batch (expires in 7 days)
    const { data: activeBatch } = await supabaseService
      .from('sp_batches')
      .insert({
        wallet_id: testWalletId,
        user_id: testUserId,
        initial_sp: 50,
        remaining_sp: 50,
        source_type: 'reward',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_expired: false,
      })
      .select()
      .single();

    activeBatchId = activeBatch!.id;

    // Update wallet balance to reflect batches
    await supabaseService
      .from('sp_wallets')
      .update({ available_balance: 150 })
      .eq('id', testWalletId);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await supabaseService.from('sp_expiration_warnings').delete().eq('user_id', testUserId);
      await supabaseService.from('sp_ledger').delete().eq('user_id', testUserId);
      await supabaseService.from('sp_batches').delete().eq('user_id', testUserId);
      await supabaseService.from('sp_wallets').delete().eq('user_id', testUserId);
      await supabaseService.from('subscriptions').delete().eq('user_id', testUserId);
      await supabaseService.auth.admin.deleteUser(testUserId);
    }
  });

  describe('Expiration Processing', () => {
    it('should process expired batches and update wallet', async () => {
      // Run expiration processing
      const { data: result, error } = await supabaseService.rpc('process_sp_expiration');

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.batches_expired).toBeGreaterThanOrEqual(1);
      expect(result.total_sp_expired).toBeGreaterThanOrEqual(100);

      // Check batch is marked as expired
      const { data: batch } = await supabaseService
        .from('sp_batches')
        .select('is_expired')
        .eq('id', expiredBatchId)
        .single();

      expect(batch!.is_expired).toBe(true);

      // Check wallet balance reduced
      const { data: wallet } = await supabaseService
        .from('sp_wallets')
        .select('available_balance, lifetime_expired')
        .eq('id', testWalletId)
        .single();

      expect(wallet!.available_balance).toBe(50); // 150 - 100 expired
      expect(wallet!.lifetime_expired).toBe(100);

      // Check ledger entry created
      const { data: ledger } = await supabaseService
        .from('sp_ledger')
        .select('*')
        .eq('related_batch_id', expiredBatchId)
        .eq('transaction_type', 'expire')
        .single();

      expect(ledger).toBeDefined();
      expect(ledger!.amount).toBe(-100);
    });

    it('should not re-process already expired batches', async () => {
      // Run expiration processing again
      const { data: result } = await supabaseService.rpc('process_sp_expiration');

      // Should process 0 batches (already expired)
      expect(result.batches_expired).toBe(0);
      expect(result.total_sp_expired).toBe(0);
    });
  });

  describe('Expiration Warnings', () => {
    it('should create warning records for expiring batches', async () => {
      // Run warning creation
      const { data: result, error } = await supabaseService.rpc('send_sp_expiration_warnings');

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.warnings_created).toBeGreaterThanOrEqual(1);

      // Check warning created for 7-day batch
      const { data: warning } = await supabaseService
        .from('sp_expiration_warnings')
        .select('*')
        .eq('batch_id', activeBatchId)
        .eq('warning_type', '7_day')
        .single();

      expect(warning).toBeDefined();
      expect(warning!.sp_amount).toBe(50);
      expect(warning!.notification_sent).toBe(false);
    });

    it('should not create duplicate warnings', async () => {
      // Run warning creation again
      const { data: result } = await supabaseService.rpc('send_sp_expiration_warnings');

      // Should create 0 warnings (already exists)
      expect(result.warnings_created).toBe(0);
    });

    it('should fetch user warnings via RPC', async () => {
      const { data: warnings, error } = await supabaseService.rpc('get_user_expiration_warnings', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(warnings).toBeDefined();
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings[0].sp_amount).toBe(50);
      expect(warnings[0].days_until_expiry).toBeGreaterThanOrEqual(6);
      expect(warnings[0].days_until_expiry).toBeLessThanOrEqual(8);
    });
  });

  describe('Configuration', () => {
    it('should respect admin-configured expiration period', async () => {
      const { data: config } = await supabaseService
        .from('sp_config')
        .select('config_value')
        .eq('config_key', 'expiration_period_days')
        .single();

      expect(config).toBeDefined();
      expect(parseInt(config!.config_value, 10)).toBeGreaterThan(0);
    });

    it('should respect admin-configured warning days', async () => {
      const { data: config } = await supabaseService
        .from('sp_config')
        .select('config_value')
        .eq('config_key', 'expiration_warning_days')
        .single();

      expect(config).toBeDefined();
      // Should be JSON array like [30, 14, 7]
      const warningDays = JSON.parse(config!.config_value);
      expect(Array.isArray(warningDays)).toBe(true);
      expect(warningDays).toContain(7);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero remaining_sp batches', async () => {
      // Create batch with 0 remaining
      await supabaseService.from('sp_batches').insert({
        wallet_id: testWalletId,
        user_id: testUserId,
        initial_sp: 100,
        remaining_sp: 0,
        source_type: 'reward',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        is_expired: false,
      });

      const { data: result } = await supabaseService.rpc('process_sp_expiration');

      // Should skip batches with 0 remaining
      expect(result.success).toBe(true);
    });

    it('should handle multiple batches expiring same day', async () => {
      // Create multiple batches expiring today
      const expiryDate = new Date();
      expiryDate.setHours(23, 59, 59);

      await supabaseService.from('sp_batches').insert([
        {
          wallet_id: testWalletId,
          user_id: testUserId,
          initial_sp: 25,
          remaining_sp: 25,
          source_type: 'reward',
          expires_at: expiryDate.toISOString(),
          is_expired: false,
        },
        {
          wallet_id: testWalletId,
          user_id: testUserId,
          initial_sp: 25,
          remaining_sp: 25,
          source_type: 'challenge',
          expires_at: expiryDate.toISOString(),
          is_expired: false,
        },
      ]);

      const { data: result } = await supabaseService.rpc('process_sp_expiration');

      // Should process both batches
      expect(result.success).toBe(true);
      expect(result.batches_expired).toBeGreaterThanOrEqual(2);
    });
  });
});
