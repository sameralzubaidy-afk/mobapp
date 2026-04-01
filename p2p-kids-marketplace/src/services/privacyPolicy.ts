// File: p2p-kids-marketplace/src/services/privacyPolicy.ts
// MODULE-13 SAFETY-011: Privacy Policy Service
// Reuses platform_policies infrastructure from SAFETY-010

import { supabase } from '../config/supabase';

interface PrivacyPolicy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
}

interface PolicyAcceptance {
  id: string;
  user_id: string;
  policy_id: string;
  policy_type: string;
  policy_version: string;
  accepted_at: string;
}

export class PrivacyPolicyService {
  /**
   * Get current published Privacy Policy
   */
  async getCurrentPrivacyPolicy(): Promise<PrivacyPolicy | null> {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'privacy_policy',
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch current Privacy Policy');
      }

      if (!data || data.length === 0) {
        return null;
      }

      return data[0] as PrivacyPolicy;
    } catch (error) {
      console.error('Error fetching current Privacy Policy:', error);
      throw error;
    }
  }

  /**
   * Check if current user has accepted the latest Privacy Policy
   */
  async hasAcceptedCurrentPrivacyPolicy(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      const { data, error } = await supabase.rpc('has_accepted_current_policy', {
        p_user_id: user.id,
        p_policy_type: 'privacy_policy',
      });

      if (error) throw error;

      return data === true;
    } catch (error) {
      console.error('Error checking Privacy Policy acceptance:', error);
      return false;
    }
  }

  /**
   * Record Privacy Policy acceptance for current user
   */
  async acceptPrivacyPolicy(policyId: string): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase.rpc('record_policy_acceptance', {
        p_user_id: user.id,
        p_policy_id: policyId,
        p_ip_address: null, // IP tracking can be added via backend if needed
        p_user_agent: null,
      });

      if (error) {
        throw new Error(error.message || 'Failed to record Privacy Policy acceptance');
      }
    } catch (error) {
      console.error('Error accepting Privacy Policy:', error);
      throw error;
    }
  }

  /**
   * Get user's Privacy Policy acceptance history
   */
  async getUserAcceptanceHistory(): Promise<PolicyAcceptance[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('policy_acceptances')
        .select('*')
        .eq('user_id', user.id)
        .eq('policy_type', 'privacy_policy')
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      return (data || []) as PolicyAcceptance[];
    } catch (error) {
      console.error('Error fetching Privacy Policy acceptance history:', error);
      return [];
    }
  }
}

// Singleton instance
let privacyPolicyServiceInstance: PrivacyPolicyService | null = null;

export function getPrivacyPolicyService(): PrivacyPolicyService {
  if (!privacyPolicyServiceInstance) {
    privacyPolicyServiceInstance = new PrivacyPolicyService();
  }
  return privacyPolicyServiceInstance;
}
