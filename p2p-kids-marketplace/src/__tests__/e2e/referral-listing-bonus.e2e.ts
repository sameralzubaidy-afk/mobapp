/**
 * E2E Tests for Referral Listing Bonus (REF-V2-008)
 * Tests end-to-end flow: referral -> first listing -> SP rewards
 */

import { supabase } from '@/config/supabase';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';

describe('REF-V2-008: Referral Listing Bonus E2E', () => {
  let referrerId: string;
  let refereeId: string;
  let referralCode: string;
  let referralId: string;
  let listingId: string;
  let categoryId: string;

  beforeAll(async () => {
    // Setup: Create test users (referrer + referee)
    // Using valid UUIDs to satisfy database constraints
    referrerId = '11111111-1111-1111-1111-111111111111';
    refereeId = '22222222-2222-2222-2222-222222222222';

    // Ensure users exist (Upsert)
    await supabase.from('profiles').upsert([
      { user_id: referrerId, display_name: 'Test Referrer', referral_code: 'REFERRER1' },
      { user_id: refereeId, id: refereeId, name: 'Test Referee' }
    ]);

    // Ensure subscriptions exist
    await supabase.from('subscriptions').upsert([
      { user_id: referrerId, status: 'active' },
      { user_id: refereeId, status: 'active' }
    ]);

    // Fetch a real category ID
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Toys')
      .single();
    
    categoryId = catData?.id || '00000000-0000-0000-0000-000000000000';
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    await cleanupTestData();
  });

  describe('Complete Listing Bonus Flow', () => {
    it('should complete full referral listing bonus flow', async () => {
      // Step 1: Referrer gets referral code
      const referrerCode = await ReferralCodeServiceV2.getReferralCode(referrerId);
      expect(referrerCode).toBeTruthy();
      expect(referrerCode.length).toBe(8);

      // Step 2: Referee signs up with referral code
      const applyResult = await ReferralCodeServiceV2.applyReferralCode(
        refereeId,
        referralCode
      );
      expect(applyResult.success).toBe(true);

      // Step 3: Verify referral relationship created
      const { data: referralData, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', referrerId)
        .eq('referred_user_id', refereeId)
        .single();

      expect(referralError).toBeNull();
      expect(referralData).toBeTruthy();
      referralId = referralData.id;

      // Step 4: Verify both users have active subscriptions
      const { data: referrerSub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', referrerId)
        .single();

      const { data: refereeSub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', refereeId)
        .single();

      expect(['trial', 'active']).toContain(referrerSub?.status);
      expect(['trial', 'active']).toContain(refereeSub?.status);

      // Step 5: Referee creates first listing
      const { data: listing, error: listingError } = await supabase
        .from('items')
        .insert({
          seller_id: refereeId,
          title: 'Test Listing for Referral Bonus',
          description: 'E2E test listing',
          price: 1000,
          category_id: categoryId,
          status: 'pending',
        })
        .select()
        .single();

      expect(listingError).toBeNull();
      expect(listing).toBeTruthy();
      listingId = listing.id;

      // Step 6: Admin approves listing (status -> 'available')
      const { error: approveError } = await supabase
        .from('items')
        .update({ status: 'available', approved_at: new Date().toISOString() })
        .eq('id', listingId);

      expect(approveError).toBeNull();

      // Step 7: Wait for trigger to process (small delay)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 8: Verify SP rewards granted to referrer
      const { data: referrerLedger, error: referrerLedgerError } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('user_id', referrerId)
        .eq('transaction_type', 'earn_referral')
        .eq('related_listing_id', listingId)
        .single();

      expect(referrerLedgerError).toBeNull();
      expect(referrerLedger).toBeTruthy();
      expect(referrerLedger.amount).toBeGreaterThan(0);
      expect(referrerLedger.description).toContain('first listing');

      // Step 9: Verify SP rewards granted to referee
      const { data: refereeLedger, error: refereeLedgerError } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('user_id', refereeId)
        .eq('transaction_type', 'earn_referral')
        .eq('related_listing_id', listingId)
        .single();

      expect(refereeLedgerError).toBeNull();
      expect(refereeLedger).toBeTruthy();
      expect(refereeLedger.amount).toBeGreaterThan(0);

      // Step 10: Verify wallet balances updated
      const { data: referrerWallet } = await supabase
        .from('sp_wallets')
        .select('available_balance, lifetime_earned')
        .eq('user_id', referrerId)
        .single();

      const { data: refereeWallet } = await supabase
        .from('sp_wallets')
        .select('available_balance, lifetime_earned')
        .eq('user_id', refereeId)
        .single();

      expect(referrerWallet?.available_balance).toBeGreaterThan(0);
      expect(refereeWallet?.available_balance).toBeGreaterThan(0);

      // Step 11: Verify referral marked as completed (optional, if your logic does this)
      // Note: May remain "pending" if you only mark completed after trade
    });

    it('should NOT grant duplicate rewards on second listing approval', async () => {
      // Create second listing
      const { data: listing2, error: listing2Error } = await supabase
        .from('items')
        .insert({
          seller_id: refereeId,
          title: 'Second Test Listing',
          description: 'Should not trigger bonus',
          price: 1500,
          category_id: categoryId,
          status: 'pending',
        })
        .select()
        .single();

      expect(listing2Error).toBeNull();

      const listingId2 = listing2.id;

      // Approve second listing
      await supabase
        .from('items')
        .update({ status: 'available', approved_at: new Date().toISOString() })
        .eq('id', listingId2);

      // Wait for trigger
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify NO new SP rewards granted
      const { data: newLedgerEntries, error } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('user_id', referrerId)
        .eq('transaction_type', 'earn_referral')
        .eq('related_listing_id', listingId2);

      expect(error).toBeNull();
      expect(newLedgerEntries).toHaveLength(0); // No new rewards
    });

    it('should respect feature toggle disable', async () => {
      // Disable feature toggle
      await supabase.rpc('update_admin_config_setting', {
        p_key: 'referral_first_listing_enabled',
        p_value: 'false'
      });

      // Create new test users
      const newReferrerId = '33333333-3333-3333-3333-333333333333';
      const newRefereeId = '44444444-4444-4444-4444-444444444444';

      // Ensure users exist
      await supabase.from('profiles').upsert([
        { user_id: newReferrerId, display_name: 'Test Referrer 2', referral_code: 'REFERRER2' },
        { user_id: newRefereeId, id: newRefereeId, name: 'Test Referee 2' }
      ]);
      
      await supabase.from('subscriptions').upsert([
        { user_id: newReferrerId, status: 'active' },
        { user_id: newRefereeId, status: 'active' }
      ]);

      // Setup referral
      const newReferralCode = await ReferralCodeServiceV2.getReferralCode(newReferrerId);
      await ReferralCodeServiceV2.applyReferralCode(newRefereeId, newReferralCode);

      // Create and approve listing
      const { data: listing, error: listingError } = await supabase
        .from('items')
        .insert({
          seller_id: newRefereeId,
          title: 'Test Listing with Feature Disabled',
          price: 1000,
          category_id: categoryId,
          status: 'pending',
        })
        .select()
        .single();

      expect(listingError).toBeNull();

      await supabase
        .from('items')
        .update({ status: 'available', approved_at: new Date().toISOString() })
        .eq('id', listing.id);

      // Wait for trigger
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify NO SP rewards granted (feature disabled)
      const { data: ledgerEntries } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('user_id', newReferrerId)
        .eq('transaction_type', 'earn_referral')
        .eq('related_listing_id', listing.id);

      expect(ledgerEntries).toHaveLength(0);

      // Re-enable feature for other tests
      await supabase.rpc('update_admin_config_setting', {
        p_key: 'referral_first_listing_enabled',
        p_value: 'true'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing referral relationship gracefully', async () => {
      const noReferralUserId = '55555555-5555-5555-5555-555555555555';
      
      await supabase.from('profiles').upsert([
        { user_id: noReferralUserId, id: noReferralUserId, name: 'No Referral User' }
      ]);

      const { data: listing, error } = await supabase
        .from('items')
        .insert({
          seller_id: noReferralUserId,
          title: 'Listing without referral',
          price: 1000,
          category_id: categoryId,
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();

      await supabase
        .from('items')
        .update({ status: 'available', approved_at: new Date().toISOString() })
        .eq('id', listing.id);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify NO rewards granted
      const { data: ledgerEntries } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('related_listing_id', listing.id);

      expect(ledgerEntries).toHaveLength(0);
    });

    it('should handle non-subscriber referee gracefully', async () => {
      const expiredReferrerId = '66666666-6666-6666-6666-666666666666';
      const expiredRefereeId = '77777777-7777-7777-7777-777777777777';

      await supabase.from('profiles').upsert([
        { user_id: expiredReferrerId, display_name: 'Expired Referrer', referral_code: 'EXPIREDREF' },
        { user_id: expiredRefereeId, id: expiredRefereeId, name: 'Expired Referee' }
      ]);

      await supabase.from('subscriptions').upsert([
        { user_id: expiredReferrerId, status: 'expired' },
        { user_id: expiredRefereeId, status: 'expired' }
      ]);

      // Create referral with expired subscription users
      const code = await ReferralCodeServiceV2.getReferralCode(expiredReferrerId);
      await ReferralCodeServiceV2.applyReferralCode(expiredRefereeId, code);

      const { data: listing } = await supabase
        .from('items')
        .insert({
          seller_id: expiredRefereeId,
          title: 'Listing by expired subscriber',
          price: 1000,
          category_id: categoryId,
          status: 'pending',
        })
        .select()
        .single();

      await supabase
        .from('items')
        .update({ status: 'available', approved_at: new Date().toISOString() })
        .eq('id', listing.id);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify NO rewards granted (subscription gate)
      const { data: ledgerEntries } = await supabase
        .from('sp_ledger')
        .select('*')
        .eq('user_id', expiredReferrerId)
        .eq('related_listing_id', listing.id);

      expect(ledgerEntries).toHaveLength(0);
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    if (listingId) {
      await supabase.from('items').delete().eq('id', listingId);
    }
    if (referralId) {
      await supabase.from('referrals').delete().eq('id', referralId);
    }
    // Clean up SP ledger entries
    await supabase
      .from('sp_ledger')
      .delete()
      .in('user_id', [referrerId, refereeId]);
  }
});
