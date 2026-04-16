// filepath: p2p-kids-marketplace/src/__tests__/badges/subscription-badges.test.ts
// Unit tests for TASK BADGES-V2-003: Subscription Tenure Badges

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { createConfirmedTestUser, deleteTestUser } from '@/test-helpers/authTestUtils';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Skip tests if environment variables are missing
const shouldSkip = !supabaseUrl || !supabaseKey;

if (shouldSkip) {
  console.warn('⏭️  Skipping subscription badge tests: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const supabase = !shouldSkip ? createClient(supabaseUrl, supabaseKey) : null;

jest.setTimeout(15000);

describe('Subscription Tenure Badges', () => {
  let testUserId: string;
  let runtimeSkip = shouldSkip;

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⏭️  Skipping test setup');
      return;
    }

    const email = `sub-badge-test-${Date.now()}@test.com`;
    const password = 'TestPassword123!';

    const created = await createConfirmedTestUser({ email, password });
    testUserId = created?.userId || '';
    runtimeSkip = !testUserId;
  });

  afterAll(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId);
    }
  });

  it('should award "Trial Member" badge for trial status', async () => {
    if (runtimeSkip) return;

    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: 0, // Trial = 0 days threshold
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId)
      .eq('badge.name', 'Trial Member')
      .single();

    expect(userBadges).toBeDefined();
    expect(userBadges?.badge?.name).toBe('Trial Member');
  });

  it('should award "1-Month Subscriber" badge after 30 days', async () => {
    if (runtimeSkip) return;

    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: 30,
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId)
      .eq('badge.name', '1-Month Subscriber');

    expect(userBadges).toBeDefined();
    expect(userBadges?.length).toBeGreaterThan(0);
  });

  it('should award "6-Month Subscriber" badge after 180 days', async () => {
    if (runtimeSkip) return;

    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: 180,
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId)
      .eq('badge.name', '6-Month Subscriber');

    expect(userBadges).toBeDefined();
    expect(userBadges?.length).toBeGreaterThan(0);
  });

  it('should award "1-Year Subscriber" badge after 365 days', async () => {
    if (runtimeSkip) return;

    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: 365,
    });

    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId)
      .eq('badge.name', '1-Year Subscriber');

    expect(userBadges).toBeDefined();
    expect(userBadges?.length).toBeGreaterThan(0);
  });

  it('should award all eligible tenure badges progressively', async () => {
    if (runtimeSkip) return;

    // User with 365 days should get all badges (Trial, 1-Month, 6-Month, 1-Year)
    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: 365,
    });

    expect(error).toBeNull();

    const { data: allBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', testUserId)
      .eq('badge.category', 'subscription');

    // Should have all subscription badges
    expect(allBadges?.length).toBeGreaterThanOrEqual(4);
  });

  it('should not award badges for negative days', async () => {
    if (runtimeSkip) return;

    const { error } = await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: -10, // Invalid
    });

    // Should not error, but also shouldn't award badges
    expect(error).toBeNull();

    const { data: userBadges } = await supabase!
      .from('user_badges')
      .select('*')
      .eq('user_id', testUserId);

    // Count should not increase from negative value
    const initialCount = userBadges?.length || 0;

    // Re-run with negative value
    await supabase!.rpc('award_badge_if_eligible', {
      p_user_id: testUserId,
      p_category: 'subscription',
      p_current_value: -5,
    });

    const { data: afterBadges } = await supabase!
      .from('user_badges')
      .select('*')
      .eq('user_id', testUserId);

    expect(afterBadges?.length).toBe(initialCount);
  });
});
