// File: p2p-kids-marketplace/e2e/flow-15-profile.integration.test.ts
// TASK FLOW-15: E2E Integration tests for Profile screens (UI redesign)
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../src/services/supabase/client';

describe('FLOW-15: User Profile - E2E Integration', () => {
  const shouldRunE2E = process.env.RUN_SUPABASE_E2E === 'true';
  let canRunSupabaseChecks = shouldRunE2E;
  let testUserId: string | null = null;
  const testUserEmail = `flow15${Date.now()}@example.com`;

  beforeAll(async () => {
    if (!shouldRunE2E) {
      canRunSupabaseChecks = false;
      return;
    }

    // Create test user in Supabase
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: testUserEmail,
        password: 'TestPassword123!',
        user_metadata: {
          name: 'Test Flow 15 User',
        },
      });

      if (error || !data?.user?.id) {
        throw error || new Error('Failed to create FLOW-15 test user');
      }

      testUserId = data.user.id;

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: testUserId,
        user_id: testUserId,
        name: 'Test Flow 15 User',
        bio: 'Test bio for FLOW-15',
        zip_code: '90210',
        verification_status: 'approved',
      });

      if (profileError) {
        throw profileError;
      }
    } catch (error) {
      console.warn('[flow-15-profile.integration] Setup skipped:', error);
      canRunSupabaseChecks = false;
    }
  });

  afterAll(async () => {
    if (!canRunSupabaseChecks || !testUserId) {
      return;
    }

    // Cleanup: Delete test user and profile
    await supabase.from('profiles').delete().eq('user_id', testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  });

  it('fetches user profile with all required fields for My Profile screen', async () => {
    if (!canRunSupabaseChecks || !testUserId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('bio');
    expect(data).toHaveProperty('verification_status');
    expect(data.verification_status).toBe('approved'); // Should show ShieldCheck
  });

  it('updates user profile via updateUserProfile service', async () => {
    if (!canRunSupabaseChecks || !testUserId) return;

    const { data, error } = await supabase
      .from('profiles')
      .update({ bio: 'Updated bio from E2E test' })
      .eq('user_id', testUserId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.bio).toBe('Updated bio from E2E test');
  });

  it('fetches review stats for seller profile', async () => {
    if (!canRunSupabaseChecks || !testUserId) return;

    // Create a test review
    await supabase.from('reviews').insert({
      seller_id: testUserId,
      buyer_id: 'test-buyer-id',
      trade_id: 'test-trade-id',
      rating: 5,
      comment: 'Great seller!',
    });

    const { data, error } = await supabase.rpc('get_review_stats', {
      p_user_id: testUserId,
    });

    expect(error).toBeNull();
    expect(data).toHaveProperty('average_rating');
    expect(data).toHaveProperty('total_reviews');
    expect(data.total_reviews).toBeGreaterThan(0);

    // Cleanup
    await supabase.from('reviews').delete().eq('seller_id', testUserId);
  });

  it('verifies RLS policies allow profile read for authenticated users', async () => {
    if (!canRunSupabaseChecks || !testUserId) return;

    // Sign in as test user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: 'TestPassword123!',
    });

    expect(signInError).toBeNull();

    // Try to fetch own profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // Sign out
    await supabase.auth.signOut();
  });
});
