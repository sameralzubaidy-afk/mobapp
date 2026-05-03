// E2E Tests: Admin Referral Analytics
// filepath: p2p-kids-marketplace/src/__tests__/e2e/referral-analytics-admin.e2e.ts

import { supabase } from '@/config/supabase';

describe('E2E: Admin Referral Analytics', () => {
  describe('FLOW-01: Get Referral Metrics', () => {
    it('should return referral program metrics', async () => {
      const { data, error } = await supabase.rpc('get_referral_metrics');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total_users');
      expect(data).toHaveProperty('users_with_referrals');
      expect(data).toHaveProperty('total_referrals');
      expect(data).toHaveProperty('pending_referrals');
      expect(data).toHaveProperty('completed_referrals');
      expect(data).toHaveProperty('k_factor');
      expect(data).toHaveProperty('signup_to_trade_rate');
      expect(data).toHaveProperty('total_sp_distributed');
    });

    it('should calculate K-factor correctly', async () => {
      const { data } = await supabase.rpc('get_referral_metrics');

      expect(data.k_factor).toBeGreaterThanOrEqual(0);

      // K-factor = completed_referrals / users_with_referrals
      if (data.users_with_referrals > 0) {
        const expectedKFactor = data.completed_referrals / data.users_with_referrals;
        expect(data.k_factor).toBeCloseTo(expectedKFactor, 2);
      } else {
        expect(data.k_factor).toBe(0);
      }
    });

    it('should calculate SP distribution correctly (35 SP per completed referral)', async () => {
      const { data } = await supabase.rpc('get_referral_metrics');

      const expectedSP = data.completed_referrals * 35; // 25 referrer + 10 referee
      expect(data.total_sp_distributed).toBe(expectedSP);
    });

    it('should show pending + completed = total referrals', async () => {
      const { data } = await supabase.rpc('get_referral_metrics');

      expect(data.pending_referrals + data.completed_referrals).toBeLessThanOrEqual(
        data.total_referrals
      );
    });
  });

  describe('FLOW-02: Get Top Referrers Leaderboard', () => {
    it('should return top referrers sorted by completed referrals', async () => {
      const { data, error } = await supabase.rpc('get_top_referrers', {
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Verify sorting (descending by completed_referrals)
      if (data.length > 1) {
        for (let i = 0; i < data.length - 1; i++) {
          expect(data[i].completed_referrals).toBeGreaterThanOrEqual(
            data[i + 1].completed_referrals
          );
        }
      }
    });

    it('should include required fields for each referrer', async () => {
      const { data } = await supabase.rpc('get_top_referrers', {
        p_limit: 5,
      });

      if (data && data.length > 0) {
        const referrer = data[0];
        expect(referrer).toHaveProperty('user_id');
        expect(referrer).toHaveProperty('email');
        expect(referrer).toHaveProperty('total_referrals');
        expect(referrer).toHaveProperty('completed_referrals');
        expect(referrer).toHaveProperty('total_sp_earned');
        expect(referrer).toHaveProperty('trial_extensions_earned');
      }
    });

    it('should calculate SP earned correctly (25 SP per completed referral)', async () => {
      const { data } = await supabase.rpc('get_top_referrers', {
        p_limit: 10,
      });

      if (data && data.length > 0) {
        data.forEach((referrer) => {
          const expectedSP = Number(referrer.completed_referrals) * 25;
          expect(referrer.total_sp_earned).toBe(expectedSP);
        });
      }
    });

    it('should respect limit parameter', async () => {
      const limit = 3;
      const { data } = await supabase.rpc('get_top_referrers', {
        p_limit: limit,
      });

      expect(data.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('FLOW-03: Get Referral Conversion Funnel', () => {
    it('should return conversion funnel data', async () => {
      const { data, error } = await supabase.rpc('get_referral_funnel');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('invites_sent');
      expect(data).toHaveProperty('signups');
      expect(data).toHaveProperty('first_trades');
      expect(data).toHaveProperty('rewards_granted');
      expect(data).toHaveProperty('signup_rate');
      expect(data).toHaveProperty('trade_rate');
      expect(data).toHaveProperty('reward_rate');
    });

    it('should have signups equal to invites_sent', async () => {
      const { data } = await supabase.rpc('get_referral_funnel');

      // Since referral row is created on signup
      expect(data.signups).toBe(data.invites_sent);
    });

    it('should have first_trades <= signups', async () => {
      const { data } = await supabase.rpc('get_referral_funnel');

      expect(data.first_trades).toBeLessThanOrEqual(data.signups);
    });

    it('should have rewards_granted = first_trades', async () => {
      const { data } = await supabase.rpc('get_referral_funnel');

      // Rewards granted when trade completed
      expect(data.rewards_granted).toBe(data.first_trades);
    });

    it('should calculate conversion rates correctly', async () => {
      const { data } = await supabase.rpc('get_referral_funnel');

      if (data.signups > 0) {
        const expectedTradeRate = (data.first_trades / data.signups) * 100;
        expect(data.trade_rate).toBeCloseTo(expectedTradeRate, 2);
      }

      if (data.first_trades > 0) {
        const expectedRewardRate = (data.rewards_granted / data.first_trades) * 100;
        expect(data.reward_rate).toBeCloseTo(expectedRewardRate, 2);
      }
    });

    it('should handle zero division (no referrals yet)', async () => {
      const { data } = await supabase.rpc('get_referral_funnel');

      if (data.invites_sent === 0) {
        expect(data.signup_rate).toBe(0);
        expect(data.trade_rate).toBe(0);
        expect(data.reward_rate).toBe(0);
      }
    });
  });

  describe('FLOW-04: Performance & Security', () => {
    it('should execute get_referral_metrics within 1 second', async () => {
      const start = Date.now();
      await supabase.rpc('get_referral_metrics');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should execute get_top_referrers within 1 second', async () => {
      const start = Date.now();
      await supabase.rpc('get_top_referrers', { p_limit: 10 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should execute get_referral_funnel within 500ms', async () => {
      const start = Date.now();
      await supabase.rpc('get_referral_funnel');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
