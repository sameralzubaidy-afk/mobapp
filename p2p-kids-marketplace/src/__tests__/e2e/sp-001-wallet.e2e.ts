// File: p2p-kids-marketplace/src/__tests__/e2e/sp-001-wallet.e2e.ts
// MODULE-09 SP-001: E2E tests for SP Wallet
// Tests wallet creation, balance queries, and config retrieval

import { supabase } from '@/config/supabase';
import { getWallet, getBalance, canSpendSP, getWalletSummary, getSPConfig } from '@/services/sp/wallet';
import { createConfirmedTestUser, deleteTestUser, getServiceClient } from '@/test-helpers/authTestUtils';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
const supabaseE2eEnabled = process.env.SUPABASE_E2E_ENABLED === 'true';
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey && supabaseE2eEnabled);

if (!hasSupabaseEnv) {
  const reasons: string[] = [];
  if (!supabaseE2eEnabled) {
    reasons.push('set SUPABASE_E2E_ENABLED=true');
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    reasons.push('provide EXPO_PUBLIC_SUPABASE_URL/ANON_KEY');
  }
  console.warn(
    `[SP-001] Skipping wallet E2E suite: ${reasons.join(', ')}.`
  );
}

const describeWalletSuite = hasSupabaseEnv ? describe : describe.skip;

describeWalletSuite('SP-001 E2E: SP Wallet', () => {
  let testUserId: string;
  let cleanupIds: string[] = [];

  beforeAll(async () => {
    const email = `test-sp-${Date.now()}@test.com`;
    const password = 'testpassword123';

    const created = await createConfirmedTestUser({ email, password });
    if (!created?.userId) {
      throw new Error('Test user creation failed: no userId returned (auth settings?)');
    }

    testUserId = created.userId;
    cleanupIds.push(testUserId);

    // Create subscription for test user
    await supabase.from('subscriptions').insert({
      user_id: testUserId,
      tier: 'kids_club_plus',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.from('sp_wallets').delete().eq('user_id', testUserId);
      await supabase.from('subscriptions').delete().eq('user_id', testUserId);
      const service = getServiceClient();
      if (service) {
        await deleteTestUser(testUserId);
      }
    }
  });

  it('should create wallet on first access', async () => {
    const wallet = await getWallet(testUserId);
    expect(wallet).not.toBeNull();
    expect(wallet?.user_id).toBe(testUserId);
    expect(wallet?.available_balance).toBe(0);
    expect(wallet?.state).toBe('active');
  });

  it('should return balance', async () => {
    const balance = await getBalance(testUserId);
    expect(balance).toBe(0);
  });

  it('should allow spending for active subscriber', async () => {
    const result = await canSpendSP(testUserId);
    expect(result.allowed).toBe(true);
  });

  it('should return wallet summary', async () => {
    const summary = await getWalletSummary(testUserId);
    expect(summary).toHaveProperty('available_points');
    expect(summary).toHaveProperty('lifetime_earned');
    expect(summary.wallet_state).toBe('active');
  });

  it('should retrieve SP config values', async () => {
    const starterPackAmount = await getSPConfig('starter_pack_amount');
    expect(starterPackAmount).toBeTruthy();
    
    const expirationEnabled = await getSPConfig('expiration_enabled');
    expect(expirationEnabled).toBeTruthy();
  });

  it('should verify sp_config table exists and is seeded', async () => {
    const { data, error } = await supabase
      .from('sp_config')
      .select('config_key, category')
      .limit(5);

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThan(0);
  });

  it('should verify sp_batches table exists', async () => {
    const { data, error } = await supabase
      .from('sp_batches')
      .select('id')
      .eq('user_id', testUserId)
      .limit(1);

    expect(error).toBeNull();
    // It's okay if there are no batches yet
  });

  it('should verify sp_ledger table exists', async () => {
    const { data, error } = await supabase
      .from('sp_ledger')
      .select('id')
      .eq('user_id', testUserId)
      .limit(1);

    expect(error).toBeNull();
    // It's okay if there are no entries yet
  });
});
