// File: p2p-kids-marketplace/src/services/__tests__/auth.test.ts
// MODULE-03 AUTH-V2: Authentication Service Tests (REVISED)

import { enrollInTrialSubscription, loginWithContext, signupWithTrial } from '../auth';
import { supabase } from '../../config/supabase';

// Mock Supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      getSession: jest.fn(),
      admin: {
        deleteUser: jest.fn(),
      },
    },
    rpc: jest.fn(),
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

describe('AUTH-V2-002: enrollInTrialSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check if trial is enabled from admin config', async () => {
    const mockUserId = 'user-123';

    // Mock admin config check
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: true, // Trial is enabled
        error: null,
      }) // is_trial_enabled()
      .mockResolvedValueOnce({
        data: { id: 'sub-123' },
        error: null,
      }) // create_trial_subscription()
      .mockResolvedValueOnce({
        data: { id: 'wallet-123' },
        error: null,
      }); // initialize_sp_wallet()

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    });

    const result = await enrollInTrialSubscription(mockUserId);

    // Verify admin config check was called
    expect(supabase.rpc).toHaveBeenCalledWith('is_trial_enabled', {});
    expect(result.subscription).toBeDefined();
    expect(result.wallet).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return error when trial is disabled by admin', async () => {
    const mockUserId = 'user-disabled';

    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: false, // Trial is disabled
      error: null,
    });

    const result = await enrollInTrialSubscription(mockUserId);

    expect(result.subscription).toBeNull();
    expect(result.wallet).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('TRIAL_DISABLED');
  });

  it('should use admin-configured trial duration', async () => {
    const mockUserId = 'user-duration';

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: true,
        error: null,
      }) // is_trial_enabled()
      .mockResolvedValueOnce({
        data: { id: 'sub-duration', trial_end_date: '2025-12-30' },
        error: null,
      }) // create_trial_subscription() - uses get_trial_duration_days()
      .mockResolvedValueOnce({
        data: { id: 'wallet-duration' },
        error: null,
      });

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    });

    const result = await enrollInTrialSubscription(mockUserId);

    // Verify create_trial_subscription was called (which uses get_trial_duration_days)
    expect(supabase.rpc).toHaveBeenCalledWith('create_trial_subscription', {
      p_user_id: mockUserId,
    });

    expect(result.subscription).toBeDefined();
    expect(result.subscription.id).toBe('sub-duration');
  });

  it('should link subscription and wallet to profile', async () => {
    const mockUserId = 'user-link';
    const mockSubId = 'sub-link';
    const mockWalletId = 'wallet-link';

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { id: mockSubId }, error: null })
      .mockResolvedValueOnce({ data: { id: mockWalletId }, error: null });

    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn(() => ({
      eq: mockEq,
    }));

    (supabase.from as jest.Mock).mockReturnValue({
      update: mockUpdate,
    });

    await enrollInTrialSubscription(mockUserId);

    // Verify profile was updated with links
    expect(mockUpdate).toHaveBeenCalledWith({
      subscription_id: mockSubId,
      sp_wallet_id: mockWalletId,
      updated_at: expect.any(String),
    });

    expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
  });

  it('should handle subscription creation failure', async () => {
    const mockUserId = 'user-sub-error';

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Subscription creation failed' },
      });

    const result = await enrollInTrialSubscription(mockUserId);

    expect(result.subscription).toBeNull();
    expect(result.wallet).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('SUBSCRIPTION_CREATION_FAILED');
  });

  it('should handle wallet initialization failure', async () => {
    const mockUserId = 'user-wallet-error';

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { id: 'sub-error' }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Wallet creation failed' },
      });

    const result = await enrollInTrialSubscription(mockUserId);

    expect(result.subscription).toBeNull();
    expect(result.wallet).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('WALLET_CREATION_FAILED');
  });
});

describe('AUTH-V2-001B: signupWithTrial policy acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records terms and privacy acceptance when signup succeeds', async () => {
    const mockUserId = '11111111-1111-1111-1111-111111111111';

    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: {
        user: { id: mockUserId },
      },
      error: null,
    });

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'tos-policy-id' }], error: null })
      .mockResolvedValueOnce({ data: 'acc-tos-id', error: null })
      .mockResolvedValueOnce({ data: [{ id: 'privacy-policy-id' }], error: null })
      .mockResolvedValueOnce({ data: 'acc-privacy-id', error: null })
      .mockResolvedValueOnce({ data: { id: 'free-subscription-id' }, error: null });

    const result = await signupWithTrial({
      email: 'newuser@example.com',
      password: 'StrongPass123',
      name: 'New User',
    });

    expect(result.error).toBeNull();
    expect(result.user?.id).toBe(mockUserId);

    expect(supabase.rpc).toHaveBeenCalledWith('get_current_policy', {
      p_policy_type: 'terms_of_service',
    });
    expect(supabase.rpc).toHaveBeenCalledWith('get_current_policy', {
      p_policy_type: 'privacy_policy',
    });
    expect(supabase.rpc).toHaveBeenCalledWith('record_policy_acceptance', {
      p_user_id: mockUserId,
      p_policy_id: 'tos-policy-id',
      p_ip_address: null,
      p_user_agent: null,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('record_policy_acceptance', {
      p_user_id: mockUserId,
      p_policy_id: 'privacy-policy-id',
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it('returns POLICY_ACCEPTANCE_FAILED when acceptance recording fails', async () => {
    const mockUserId = '22222222-2222-2222-2222-222222222222';

    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: {
        user: { id: mockUserId },
      },
      error: null,
    });

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'tos-policy-id' }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'acceptance insert failed' },
      });

    const result = await signupWithTrial({
      email: 'failuser@example.com',
      password: 'StrongPass123',
      name: 'Fail User',
    });

    expect(result.user).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('POLICY_ACCEPTANCE_FAILED');
  });
});

describe('AUTH-V2-003: loginWithContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return enriched session with subscription and SP context', async () => {
    const mockUserId = 'user-login-123';

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: { id: mockUserId },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
      },
      error: null,
    });

    const mockProfile = {
      user_id: mockUserId,
      name: 'Existing User',
      subscription_id: 'sub-active',
      sp_wallet_id: 'wallet-active',
    };

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        })),
      })),
    });

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ status: 'active', can_spend_sp: true }],
        error: null,
      }) // get_subscription_summary
      .mockResolvedValueOnce({
        data: [
          {
            available_points: 500,
            pending_points: 50,
            lifetime_earned: 1000,
            lifetime_spent: 500,
          },
        ],
        error: null,
      }); // get_user_sp_wallet_summary

    const session = await loginWithContext({
      email: 'existing@example.com',
      password: 'Password123',
    });

    expect(session).toMatchObject({
      user: mockProfile,
      subscription_status: 'active',
      can_spend_sp: true,
      available_points: 500,
      pending_points: 50,
    });
  });

  it('should handle missing profile gracefully', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: { id: 'user-no-profile' },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Profile not found' },
          }),
        })),
      })),
    });

    await expect(
      loginWithContext({
        email: 'nouser@example.com',
        password: 'Password123',
      })
    ).rejects.toThrow('User profile not found');
  });
});
