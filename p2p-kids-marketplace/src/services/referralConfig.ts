// Referral Config Service - Mobile app
// filepath: p2p-kids-marketplace/src/services/referralConfig.ts

import { supabase } from '@/config/supabase';

export interface ReferralConfigValues {
  referrer_sp: number;
  referee_sp: number;
  max_extensions: number;
  extension_days: number;
  program_enabled: boolean;
}

export class ReferralConfigService {
  private static cache: ReferralConfigValues | null = null;
  private static lastFetch: number = 0;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get referral configuration values from sp_config table
   */
  static async getConfig(): Promise<ReferralConfigValues> {
    // Return cached values if still valid
    const now = Date.now();
    if (this.cache && now - this.lastFetch < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const { data, error } = await supabase
        .from('sp_config')
        .select('config_key, config_value')
        .in('config_key', [
          'referral_reward_referrer_sp',
          'referral_reward_referee_sp',
          'max_referral_extensions',
          'referral_extension_days',
          'referral_program_enabled',
        ]);

      if (error) {
        console.error('[ReferralConfig] Failed to load config:', error);
        // Return defaults on error
        return this.getDefaults();
      }

      // Parse config values
      const configMap: Record<string, string> = {};
      data?.forEach((item) => {
        configMap[item.config_key] = item.config_value;
      });

      const config: ReferralConfigValues = {
        referrer_sp: parseInt(configMap.referral_reward_referrer_sp || '25', 10),
        referee_sp: parseInt(configMap.referral_reward_referee_sp || '10', 10),
        max_extensions: parseInt(configMap.max_referral_extensions || '3', 10),
        extension_days: parseInt(configMap.referral_extension_days || '7', 10),
        program_enabled: configMap.referral_program_enabled !== 'false',
      };

      // Update cache
      this.cache = config;
      this.lastFetch = now;

      return config;
    } catch (err) {
      console.error('[ReferralConfig] Exception loading config:', err);
      return this.getDefaults();
    }
  }

  /**
   * Get default values (used as fallback)
   */
  static getDefaults(): ReferralConfigValues {
    return {
      referrer_sp: 25,
      referee_sp: 10,
      max_extensions: 3,
      extension_days: 7,
      program_enabled: true,
    };
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  static clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }

  /**
   * Check if referral program is enabled
   */
  static async isProgramEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.program_enabled;
  }

  /**
   * Get referral share message with dynamic SP values
   */
  static async getShareMessage(referralCode: string): Promise<string> {
    const config = await this.getConfig();
    const link = `kidsclub://signup?ref=${referralCode}`;

    return `Join Kids Club+ and get ${config.referee_sp} SP when you complete your first trade! Use my referral code: ${referralCode}\n\n${link}`;
  }
}
