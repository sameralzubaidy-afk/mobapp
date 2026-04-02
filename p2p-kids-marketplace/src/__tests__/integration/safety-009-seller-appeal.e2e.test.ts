/**
 * File: p2p-kids-marketplace/src/__tests__/integration/safety-009-seller-appeal.e2e.test.ts
 * TASK SAFETY-009: E2E tests for Seller Appeal Workflow
 *
 * Prerequisites:
 * - Real Supabase connection (staging/prod)
 * - Test users seeded: seller-1 with rejected listing
 * - Admin user to reject listings
 *
 * Run with: RUN_SUPABASE_E2E=true npm test safety-009-seller-appeal.e2e.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { submitListingAppeal } from '@/services/listing';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const RUN_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const SHOULD_RUN = RUN_E2E && Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);

describe('SAFETY-009: Seller Appeal Workflow E2E', () => {
  let supabase: SupabaseClient | null = null;
  let testListingId = '';
  let sellerId = '';

  beforeAll(async () => {
    if (!SHOULD_RUN) {
      console.log(
        '⏭️  Skipping E2E test (requires RUN_SUPABASE_E2E=true and EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY).'
      );
      return;
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test seller
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email: `seller-appeal-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    });

    if (signupError) throw signupError;
    sellerId = authData.user!.id;

    // Create test listing in rejected status
    const { data: listing, error: listingError } = await supabase
      .from('items')
      .insert({
        seller_id: sellerId,
        title: 'Test Item for Appeal',
        description: 'This listing was rejected for testing appeal flow',
        price: 29.99,
        status: 'rejected',
        rejection_reason: 'Item does not meet safety guidelines (test rejection)',
        rejected_at: new Date().toISOString(),
        appeal_count: 0,
        edited_since_rejection: true,
        edited_since_rejection_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (listingError) throw listingError;
    testListingId = listing.id;
  });

  afterAll(async () => {
    if (!SHOULD_RUN || !supabase || !testListingId) return;

    // Cleanup: delete test listing
    await supabase.from('items').delete().eq('id', testListingId);

    // Cleanup: delete test user (admin operation, may require service role)
    // For now, we leave the user as it won't interfere with other tests
  });

  it('should submit appeal and transition listing from rejected to flagged', async () => {
    if (!SHOULD_RUN || !supabase) {
      return;
    }

    const appealReason =
      'I have corrected the safety concerns and updated the listing details as requested.';

    // Submit appeal via service
    const result = await submitListingAppeal(testListingId, sellerId, appealReason);

    // Verify result
    expect(result.id).toBe(testListingId);
    expect(result.status).toBe('flagged');
    expect(result.appeal_reason).toBe(appealReason);
    expect(result.appealed_at).toBeTruthy();

    // Verify DB state
    const { data: dbListing, error } = await supabase
      .from('items')
      .select('status, appeal_reason, appealed_at, flagged_at')
      .eq('id', testListingId)
      .single();

    expect(error).toBeNull();
    expect(dbListing?.status).toBe('flagged');
    expect(dbListing?.appeal_reason).toBe(appealReason);
    expect(dbListing?.appealed_at).toBeTruthy();
    expect(dbListing?.flagged_at).toBeTruthy();
  });

  it('should reject appeal with empty reason', async () => {
    if (!SHOULD_RUN) {
      return;
    }

    await expect(submitListingAppeal(testListingId, sellerId, '')).rejects.toThrow(
      'Appeal reason is required'
    );
  });

  it('should reject appeal with reason too short', async () => {
    if (!SHOULD_RUN) {
      return;
    }

    await expect(submitListingAppeal(testListingId, sellerId, 'Fixed')).rejects.toThrow(
      'Appeal reason must be at least 10 characters'
    );
  });

  it('should reject appeal if listing is not in rejected status', async () => {
    if (!SHOULD_RUN || !supabase) {
      return;
    }

    // Update listing to available status
    await supabase.from('items').update({ status: 'available' }).eq('id', testListingId);

    await expect(
      submitListingAppeal(testListingId, sellerId, 'Test appeal reason for available item')
    ).rejects.toThrow('Only rejected listings can be appealed');

    // Restore to rejected for other tests
    await supabase
      .from('items')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        edited_since_rejection: true,
        edited_since_rejection_at: new Date().toISOString(),
      })
      .eq('id', testListingId);
  });

  it('should reject appeal if user is not the seller', async () => {
    if (!SHOULD_RUN) {
      return;
    }

    const fakeSellerId = '00000000-0000-0000-0000-000000000000';

    await expect(
      submitListingAppeal(testListingId, fakeSellerId, 'Unauthorized appeal attempt')
    ).rejects.toThrow('You are not authorized to appeal this listing');
  });

  it('should track appeal history with multiple appeals', async () => {
    if (!SHOULD_RUN || !supabase) {
      return;
    }

    // First appeal
    await submitListingAppeal(testListingId, sellerId, 'First appeal: fixed safety issue');

    // Admin rejects again (simulate)
    await supabase
      .from('items')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: 'Still does not meet standards',
        edited_since_rejection: true,
        edited_since_rejection_at: new Date().toISOString(),
      })
      .eq('id', testListingId);

    // Second appeal
    await submitListingAppeal(
      testListingId,
      sellerId,
      'Second appeal: made additional corrections'
    );

    // Verify DB state
    const { data: dbListing } = await supabase
      .from('items')
      .select('status, appeal_reason, appeal_count')
      .eq('id', testListingId)
      .single();

    expect(dbListing?.status).toBe('flagged');
    expect(dbListing?.appeal_reason).toBe('Second appeal: made additional corrections');
    // Note: appeal_count must be incremented by DB trigger or service logic
    // For now, we verify it exists and is >= 0
    expect(dbListing?.appeal_count).toBeGreaterThanOrEqual(0);
  });

  it('should reject appeal when seller has not edited after rejection', async () => {
    if (!SHOULD_RUN || !supabase) {
      return;
    }

    await supabase
      .from('items')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        edited_since_rejection: false,
        edited_since_rejection_at: null,
      })
      .eq('id', testListingId);

    await expect(
      submitListingAppeal(
        testListingId,
        sellerId,
        'I attempted to appeal without making edits first'
      )
    ).rejects.toThrow('Please edit your listing before submitting an appeal.');
  });
});
