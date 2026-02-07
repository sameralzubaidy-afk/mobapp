// Unit Tests: Referral Config Service (Mobile)
// filepath: p2p-kids-marketplace/src/services/__tests__/referralConfig.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReferralConfigService } from '../referralConfig';
import { supabase } from '@/config/supabase';

// Mock supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('ReferralConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ReferralConfigService.clearCache();
  });

  describe('getConfig', () => {
    it('should fetch config from Supabase', async () => {
      const mockData = [
        { config_key: 'referral_reward_referrer_sp', config_value: '30' },
        { config_key: 'referral_reward_referee_sp', config_value: '15' },
        { config_key: 'max_referral_extensions', config_value: '5' },
        { config_key: 'referral_extension_days', config_value: '10' },
        { config_key: 'referral_program_enabled', config_value: 'true' },
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      const result = await ReferralConfigService.getConfig();

      expect(result).toEqual({
        referrer_sp: 30,
        referee_sp: 15,
        max_extensions: 5,
        extension_days: 10,
        program_enabled: true,
      });
    });

    it('should cache results', async () => {
      const mockData = [
        { config_key: 'referral_reward_referrer_sp', config_value: '25' },
        { config_key: 'referral_reward_referee_sp', config_value: '10' },
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      // First call
      await ReferralConfigService.getConfig();

      // Second call (should use cache)
      const result = await ReferralConfigService.getConfig();

      // Supabase should only be called once
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(result.referrer_sp).toBe(25);
    });

    it('should return defaults on error', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Network error' },
          }),
        }),
      });

      const result = await ReferralConfigService.getConfig();

      expect(result).toEqual({
        referrer_sp: 25,
        referee_sp: 10,
        max_extensions: 3,
        extension_days: 7,
        program_enabled: true,
      });
    });
  });

  describe('getDefaults', () => {
    it('should return default values', () => {
      const defaults = ReferralConfigService.getDefaults();

      expect(defaults).toEqual({
        referrer_sp: 25,
        referee_sp: 10,
        max_extensions: 3,
        extension_days: 7,
        program_enabled: true,
      });
    });
  });

  describe('isProgramEnabled', () => {
    it('should return program enabled status', async () => {
      const mockData = [
        { config_key: 'referral_program_enabled', config_value: 'true' },
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      const result = await ReferralConfigService.isProgramEnabled();

      expect(result).toBe(true);
    });
  });

  describe('getShareMessage', () => {
    it('should generate share message with dynamic SP values', async () => {
      const mockData = [
        { config_key: 'referral_reward_referee_sp', config_value: '20' },
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      const message = await ReferralConfigService.getShareMessage('ABC123XY');

      expect(message).toContain('get 20 SP');
      expect(message).toContain('ABC123XY');
      expect(message).toContain('kidsclub://signup?ref=ABC123XY');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      const mockData = [
        { config_key: 'referral_reward_referrer_sp', config_value: '25' },
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      // First call (fetch from API)
      await ReferralConfigService.getConfig();

      // Clear cache
      ReferralConfigService.clearCache();

      // Second call (should fetch again)
      await ReferralConfigService.getConfig();

      // Supabase should be called twice
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });
  });
});
