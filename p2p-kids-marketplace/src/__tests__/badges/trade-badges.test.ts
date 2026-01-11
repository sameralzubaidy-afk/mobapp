// filepath: p2p-kids-marketplace/src/__tests__/badges/trade-badges.test.ts
// Unit tests for TASK BADGES-V2-003: Trade Milestone Badges

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Skip tests if environment variables are missing
const shouldSkip = !supabaseUrl || !supabaseKey;

if (shouldSkip) {
  console.warn('⏭️  Skipping trade badge tests: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const supabase = !shouldSkip ? createClient(supabaseUrl, supabaseKey) : null;

describe('Trade Milestone Badges', () => {
  let testUserId1: string;
  let testUserId2: string;

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⏭️  Skipping test setup');
      return;
    }

    // Create test users
    const { data: user1 } = await supabase!.auth.signUp({
      email: `trade-badge-test-buyer-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    });
    testUserId1 = user1?.user?.id || '';

    const { data: user2 } = await supabase!.auth.signUp({
      email: `trade-badge-test-seller-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    });
    testUserId2 = user2?.user?.id || '';
  });

  afterAll(async () => {
    // Cleanup test users if needed
    // Note: In production, you'd use a service role key for cleanup
  });

  it('should award "First Trade" badge when user completes their first trade', async () => {
    if (shouldSkip) return;

    // This test requires a complete trade flow setup
    // For now, we'll test the RPC function directly

    // Simulate: user has completed 1 trade
    const { data, error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId1,
      p_category: 'trades',
      p_current_value: 1,
    });

    expect(error).toBeNull();

    // Check if badge was awarded
    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId1)
      .eq('badge.name', 'First Trade')
      .single();

    expect(userBadges).toBeDefined();
    expect(userBadges?.badge?.name).toBe('First Trade');
  });

  it('should award "10 Trades" badge when user completes 10 trades', async () => {
    if (shouldSkip) return;

    const { data, error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId1,
      p_category: 'trades',
      p_current_value: 10,
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId1)
      .eq('badge.name', '10 Trades');

    expect(userBadges).toBeDefined();
    expect(userBadges?.length).toBeGreaterThan(0);
  });

  it('should award "50 Trades" badge when user completes 50 trades', async () => {
    if (shouldSkip) return;

    const { data, error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId2,
      p_category: 'trades',
      p_current_value: 50,
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId2)
      .eq('badge.name', '50 Trades');

    expect(userBadges).toBeDefined();
    expect(userBadges?.length).toBeGreaterThan(0);
  });

  it('should not award duplicate badges', async () => {
    if (shouldSkip) return;

    // Award badge twice
    await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId1,
      p_category: 'trades',
      p_current_value: 1,
    });

    await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId1,
      p_category: 'trades',
      p_current_value: 1,
    });

    // Check that only one badge exists
    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*')
      .eq('user_id', testUserId1)
      .eq('badge.name', 'First Trade');

    // Should only have 1 badge (unique constraint)
    expect(userBadges?.length).toBeLessThanOrEqual(1);
  });

  it('should award all eligible badges when threshold is met', async () => {
    if (shouldSkip) return;

    // User with 50 completed trades should get all badges (1, 10, 50)
    const { data, error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId2,
      p_category: 'trades',
      p_current_value: 50,
    });

    expect(error).toBeNull();

    const { data: allBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId2)
      .eq('badge.category', 'trades');

    // Should have at least 3 trade badges (First Trade, 10 Trades, 50 Trades)
    expect(allBadges?.length).toBeGreaterThanOrEqual(3);
  });
});
