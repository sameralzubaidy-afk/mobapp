// filepath: p2p-kids-marketplace/src/__tests__/e2e/badges-v2-003.e2e.ts
// E2E tests for TASK BADGES-V2-003: Trade & Subscription Badges

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Skip tests if environment variables are missing
const shouldSkip = !supabaseUrl || !supabaseServiceKey;

if (shouldSkip) {
  console.warn('⏭️  Skipping badge E2E tests: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY');
}

const supabase = !shouldSkip ? createClient(supabaseUrl, supabaseServiceKey) : null;

describe('E2E: Trade & Subscription Badges (BADGES-V2-003)', () => {
  let buyerId: string;
  let sellerId: string;
  let itemId: string;
  let tradeId: string;

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⏭️  Skipping E2E test setup');
      return;
    }

    // Create buyer
    const { data: buyer } = await supabase!.auth.admin.createUser({
      email: `e2e-buyer-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    buyerId = buyer?.user?.id || '';

    // Create seller
    const { data: seller } = await supabase!.auth.admin.createUser({
      email: `e2e-seller-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    sellerId = seller?.user?.id || '';

    // Create a test item
    const { data: item } = await supabase!
      .from('items')
      .insert({
        user_id: sellerId,
        title: 'E2E Test Item for Badge',
        description: 'Test item',
        price_cents: 1000,
        status: 'active',
      })
      .select()
      .single();
    itemId = item?.id || '';
  });

  afterAll(async () => {
    if (shouldSkip) return;

    // Cleanup
    if (tradeId) {
      await supabase!.from('trades').delete().eq('id', tradeId);
    }
    if (itemId) {
      await supabase!.from('items').delete().eq('id', itemId);
    }
  });

  it('E2E: Should award "First Trade" badge when trade is completed', async () => {
    if (shouldSkip) return;

    // Step 1: Create a trade
    const { data: trade, error: tradeError } = await supabase!
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        item_id: itemId,
        cash_amount_cents: 1000,
        points_amount: 0,
        status: 'pending',
      })
      .select()
      .single();

    expect(tradeError).toBeNull();
    expect(trade).toBeDefined();
    tradeId = trade?.id || '';

    // Step 2: Update trade to completed (this should trigger badge)
    const { error: updateError } = await supabase!
      .from('trades')
      .update({ status: 'completed' })
      .eq('id', tradeId);

    expect(updateError).toBeNull();

    // Step 3: Wait a moment for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Check if buyer got "First Trade" badge
    const { data: buyerBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', buyerId)
      .eq('badge.name', 'First Trade');

    expect(buyerBadges).toBeDefined();
    expect(buyerBadges?.length).toBeGreaterThan(0);
    expect(buyerBadges?.[0]?.badge?.name).toBe('First Trade');

    // Step 5: Check if seller got "First Trade" badge
    const { data: sellerBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', sellerId)
      .eq('badge.name', 'First Trade');

    expect(sellerBadges).toBeDefined();
    expect(sellerBadges?.length).toBeGreaterThan(0);
    expect(sellerBadges?.[0]?.badge?.name).toBe('First Trade');
  });

  it('E2E: Should call award-tenure-badges function successfully', async () => {
    if (shouldSkip) return;

    // Create subscription for test user
    const { data: subscription } = await supabase!
      .from('subscriptions')
      .insert({
        user_id: buyerId,
        tier: 'kids_club_plus',
        status: 'trial',
        created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
      })
      .select()
      .single();

    expect(subscription).toBeDefined();

    // Call the Edge Function (simulating cron job)
    const functionUrl = `${supabaseUrl}/functions/v1/award-tenure-badges`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.processed).toBeGreaterThan(0);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if buyer got subscription badges
    const { data: subBadges } = await supabase!
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', buyerId)
      .eq('badge.category', 'subscription');

    expect(subBadges).toBeDefined();
    expect(subBadges?.length).toBeGreaterThan(0);

    // Should have Trial Member and 1-Month Subscriber (35 days > 30 days)
    const badgeNames = subBadges?.map(b => b.badge?.name) || [];
    expect(badgeNames).toContain('Trial Member');
    expect(badgeNames).toContain('1-Month Subscriber');
  });

  it('E2E: Should not award duplicate badges on multiple completions', async () => {
    if (shouldSkip) return;

    // Complete another trade with same buyer
    const { data: item2 } = await supabase!
      .from('items')
      .insert({
        user_id: sellerId,
        title: 'Second Test Item',
        description: 'Test item 2',
        price_cents: 500,
        status: 'active',
      })
      .select()
      .single();

    const { data: trade2 } = await supabase!
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        item_id: item2?.id,
        cash_amount_cents: 500,
        points_amount: 0,
        status: 'completed',
      })
      .select()
      .single();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check buyer still only has ONE "First Trade" badge
    const { data: buyerBadges } = await supabase!
      .from('user_badges')
      .select('*')
      .eq('user_id', buyerId)
      .eq('badge.name', 'First Trade');

    // Should only have 1 badge due to UNIQUE constraint
    expect(buyerBadges?.length).toBe(1);

    // Cleanup
    await supabase!.from('trades').delete().eq('id', trade2?.id);
    await supabase!.from('items').delete().eq('id', item2?.id);
  });
});
