// Unit Test: TOS Service
// File: p2p-kids-marketplace/src/__tests__/services/tos.test.ts
// Task: SAFETY-010 - TOS Service unit tests

import { TOSService } from '../../services/tos';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('TOSService', () => {
  let tosService: TOSService;

  beforeEach(() => {
    tosService = new TOSService();
    jest.clearAllMocks();
  });

  describe('getCurrentTOS', () => {
    it('should return current published TOS', async () => {
      const mockTOS = {
        id: 'policy-1',
        policy_type: 'terms_of_service',
        version: '1.0',
        title: 'Terms of Service',
        content: 'TOS content here...',
        effective_date: '2026-01-01',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [mockTOS],
        error: null,
      });

      const result = await tosService.getCurrentTOS();

      expect(result).toEqual(mockTOS);
      expect(supabase.rpc).toHaveBeenCalledWith('get_current_policy', {
        p_policy_type: 'terms_of_service',
      });
    });

    it('should return null if no published TOS exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await tosService.getCurrentTOS();

      expect(result).toBeNull();
    });

    it('should throw error if RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(tosService.getCurrentTOS()).rejects.toThrow();
    });
  });

  describe('hasAcceptedCurrentTOS', () => {
    it('should return true if user accepted current TOS', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await tosService.hasAcceptedCurrentTOS();

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('has_accepted_current_policy', {
        p_user_id: 'user-1',
        p_policy_type: 'terms_of_service',
      });
    });

    it('should return false if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await tosService.hasAcceptedCurrentTOS();

      expect(result).toBe(false);
    });

    it('should return false if user has not accepted TOS', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await tosService.hasAcceptedCurrentTOS();

      expect(result).toBe(false);
    });
  });

  describe('acceptTOS', () => {
    it('should record TOS acceptance for authenticated user', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: 'acceptance-id',
        error: null,
      });

      await tosService.acceptTOS('policy-1');

      expect(supabase.rpc).toHaveBeenCalledWith('record_policy_acceptance', {
        p_user_id: 'user-1',
        p_policy_id: 'policy-1',
        p_ip_address: null,
        p_user_agent: null,
      });
    });

    it('should throw error if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await expect(tosService.acceptTOS('policy-1')).rejects.toThrow('User not authenticated');
    });

    it('should throw error if RPC fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Failed to record acceptance' },
      });

      await expect(tosService.acceptTOS('policy-1')).rejects.toThrow();
    });
  });

  describe('getUserAcceptanceHistory', () => {
    it('should return user acceptance history', async () => {
      const mockHistory = [
        {
          id: 'acceptance-1',
          user_id: 'user-1',
          policy_id: 'policy-1',
          policy_type: 'terms_of_service',
          policy_version: '1.0',
          accepted_at: '2026-01-01',
        },
      ];

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await tosService.getUserAcceptanceHistory();

      expect(result).toEqual(mockHistory);
      expect(supabase.from).toHaveBeenCalledWith('policy_acceptances');
    });

    it('should return empty array if user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await tosService.getUserAcceptanceHistory();

      expect(result).toEqual([]);
    });
  });
});
