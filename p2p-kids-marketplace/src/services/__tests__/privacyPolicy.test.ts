// File: p2p-kids-marketplace/src/services/__tests__/privacyPolicy.test.ts
// MODULE-13 SAFETY-011: Privacy Policy Service Unit Tests

import { PrivacyPolicyService } from '../privacyPolicy';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
  },
}));

describe('PrivacyPolicyService', () => {
  let service: PrivacyPolicyService;

  beforeEach(() => {
    service = new PrivacyPolicyService();
    jest.clearAllMocks();
  });

  describe('getCurrentPrivacyPolicy', () => {
    it('should return current published privacy policy', async () => {
      const mockPolicy = {
        id: 'policy-123',
        policy_type: 'privacy_policy',
        version: '1.0',
        title: 'Privacy Policy',
        content: '# Privacy Policy\n\nYour privacy matters...',
        effective_date: '2024-01-01',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockPolicy],
        error: null,
      });

      const result = await service.getCurrentPrivacyPolicy();

      expect(supabase.rpc).toHaveBeenCalledWith('get_current_policy', {
        p_policy_type: 'privacy_policy',
      });
      expect(result).toEqual(mockPolicy);
    });

    it('should return null when no policy exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getCurrentPrivacyPolicy();

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getCurrentPrivacyPolicy()).rejects.toThrow();
    });
  });

  describe('hasAcceptedCurrentPrivacyPolicy', () => {
    it('should return true if user has accepted current policy', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.hasAcceptedCurrentPrivacyPolicy();

      expect(supabase.rpc).toHaveBeenCalledWith('has_accepted_current_policy', {
        p_user_id: 'user-123',
        p_policy_type: 'privacy_policy',
      });
      expect(result).toBe(true);
    });

    it('should return false if user has not accepted', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await service.hasAcceptedCurrentPrivacyPolicy();

      expect(result).toBe(false);
    });

    it('should return false if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await service.hasAcceptedCurrentPrivacyPolicy();

      expect(result).toBe(false);
    });
  });

  describe('acceptPrivacyPolicy', () => {
    it('should record privacy policy acceptance', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      await service.acceptPrivacyPolicy('policy-123');

      expect(supabase.rpc).toHaveBeenCalledWith('record_policy_acceptance', {
        p_user_id: 'user-123',
        p_policy_id: 'policy-123',
        p_ip_address: null,
        p_user_agent: null,
      });
    });

    it('should throw error if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await expect(service.acceptPrivacyPolicy('policy-123')).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('should throw error on database failure', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.acceptPrivacyPolicy('policy-123')).rejects.toThrow();
    });
  });

  describe('getUserAcceptanceHistory', () => {
    it('should return user acceptance history', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockHistory = [
        {
          id: 'acceptance-1',
          user_id: 'user-123',
          policy_id: 'policy-123',
          policy_type: 'privacy_policy',
          policy_version: '1.0',
          accepted_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      const result = await service.getUserAcceptanceHistory();

      expect(result).toEqual(mockHistory);
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockChain.eq).toHaveBeenCalledWith('policy_type', 'privacy_policy');
      expect(mockChain.order).toHaveBeenCalledWith('accepted_at', { ascending: false });
    });

    it('should return empty array if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await service.getUserAcceptanceHistory();

      expect(result).toEqual([]);
    });
  });
});
