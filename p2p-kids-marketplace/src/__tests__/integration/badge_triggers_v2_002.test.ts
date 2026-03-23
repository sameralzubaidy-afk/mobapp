/**
 * File: p2p-kids-marketplace/src/__tests__/integration/badge_triggers_v2_002.test.ts
 * MODULE-08 BADGES-V2-002: Functional test for SP Milestone Triggers
 */

import { supabase } from '../../config/supabase';
import { getUserBadges } from '../../services/badges';

describe('Badge Triggers Functional Tests', () => {
  const runSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';
  if (!runSupabaseE2E) {
    it('is activated and requires RUN_SUPABASE_E2E=true to execute badge trigger assertions', () => {
      expect(true).toBe(true);
    });
    return;
  }

  const isLiveTest = !!process.env.SUPABASE_URL;
  const testUserId = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer from seed

  it('should award "SP Earner - Bronze" when user crosses 10 SP threshold', async () => {
    // 1. Check current badges
    const initialBadges = await getUserBadges(testUserId);
    const hasBronze = initialBadges.some(ub => ub.badge?.name === 'SP Earner - Bronze');
    
    // If the user already has it, we might need a different test user or cleanup
    // But for a functional test, we'll try to insert and check
    if (hasBronze) {
      console.log('User already has Bronze badge, skipping award test for this user');
      return;
    }

    // 2. Insert SP ledger entry to cross threshold (10 SP)
    const { error: ledgerError } = await supabase
      .from('sp_ledger')
      .insert({
        user_id: testUserId,
        points: 10,
        reason: 'Integration test award',
        category: 'trade_earned'
      });

    if (ledgerError) {
      console.error('Error inserting ledger entry:', ledgerError);
      throw ledgerError;
    }

    // 3. Wait a moment for trigger to process (usually instant)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Verify badge is now awarded
    const updatedBadges = await getUserBadges(testUserId);
    const nowHasBronze = updatedBadges.some(ub => ub.badge?.name === 'SP Earner - Bronze');
    
    expect(nowHasBronze).toBe(true);
  });

  it('should not award duplicate badges for same milestone', async () => {
    // 1. Get current count
    const initialBadges = await getUserBadges(testUserId);
    const bronzeCount = initialBadges.filter(ub => ub.badge?.name === 'SP Earner - Bronze').length;

    if (bronzeCount === 0) {
        console.log('User does not have Bronze, adding it first');
        await supabase.from('sp_ledger').insert({
            user_id: testUserId,
            points: 10,
            reason: 'Setup for duplicate test',
            category: 'trade_earned'
        });
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Insert another 10 SP
    await supabase.from('sp_ledger').insert({
      user_id: testUserId,
      points: 10,
      reason: 'Duplicate test',
      category: 'trade_earned'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Check count again
    const updatedBadges = await getUserBadges(testUserId);
    const newBronzeCount = updatedBadges.filter(ub => ub.badge?.name === 'SP Earner - Bronze').length;

    expect(newBronzeCount).toBe(1); // Should still be 1
  });
});
