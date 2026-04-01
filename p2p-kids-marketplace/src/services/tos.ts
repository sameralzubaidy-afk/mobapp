import { supabase } from '../config/supabase';

interface TOSPolicy {
  id: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
}

interface TOSAcceptance {
  id: string;
  user_id: string;
  policy_id: string;
  policy_type: string;
  policy_version: string;
  accepted_at: string;
}

export class TOSService {
  /**
   * Get current published Terms of Service
   */
  async getCurrentTOS(): Promise<TOSPolicy | null> {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'terms_of_service',
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch current Terms of Service');
      }

      if (!data || data.length === 0) {
        return null;
      }

      return data[0] as TOSPolicy;
    } catch (error) {
      console.error('Error fetching current TOS:', error);
      throw error;
    }
  }

  /**
   * Check if current user has accepted the latest TOS
   */
  async hasAcceptedCurrentTOS(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      const { data, error } = await supabase.rpc('has_accepted_current_policy', {
        p_user_id: user.id,
        p_policy_type: 'terms_of_service',
      });

      if (error) throw error;

      return data === true;
    } catch (error) {
      console.error('Error checking TOS acceptance:', error);
      return false;
    }
  }

  /**
   * Record TOS acceptance for current user
   */
  async acceptTOS(policyId: string): Promise<void> {
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
        throw new Error(error.message || 'Failed to record Terms of Service acceptance');
      }
    } catch (error) {
      console.error('Error accepting TOS:', error);
      throw error;
    }
  }

  /**
   * Get user's TOS acceptance history
   */
  async getUserAcceptanceHistory(): Promise<TOSAcceptance[]> {
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
        .eq('policy_type', 'terms_of_service')
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      return (data || []) as TOSAcceptance[];
    } catch (error) {
      console.error('Error fetching acceptance history:', error);
      return [];
    }
  }

  /**
   * Get all published policies (for admin/settings)
   */
  async getAllPublishedPolicies(): Promise<TOSPolicy[]> {
    try {
      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .eq('status', 'published')
        .order('effective_date', { ascending: false });

      if (error) throw error;

      return (data || []) as TOSPolicy[];
    } catch (error) {
      console.error('Error fetching published policies:', error);
      return [];
    }
  }
}

// Singleton instance
let tosServiceInstance: TOSService | null = null;

export function getTOSService(): TOSService {
  if (!tosServiceInstance) {
    tosServiceInstance = new TOSService();
  }
  return tosServiceInstance;
}
