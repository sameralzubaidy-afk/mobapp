// File: p2p-kids-marketplace/src/services/__tests__/auth.test.ts
// MODULE-03 AUTH-V2: Authentication Service Tests (REVISED)

import { enrollInTrialSubscription, loginWithContext, signupWithTrial } from '../auth';
import { supabase } from '../../config/supabase';
// FIX-Task-26 round 2 (2026-09-13): build the wrong-password fixture with the
// SDK's OWN constructor. The previous fixture (`{status: 401, message: 'Invalid
// login credentials'}` with no `code`) was a shape GoTrue never emits, so this
// test passed while the friendly INVALID_CREDENTIALS copy was unreachable on a
// real device (QA F1-b).
import { AuthApiError } from '@supabase/supabase-js';

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

  /**
   * FIX-Task-26 item 1 (2026-09-13) — QA Phase 0 F1.
   *
   * These pin the PRODUCER end of the leak (the service boundary), not just the
   * classifier: the fixtures are the real `@supabase/auth-js` shapes — a 504 coming
   * back through `signInWithPassword` gives `name: 'AuthRetryableFetchError'` and a
   * `message` of the serialized fetch Response. Before this fix the service copied
   * both verbatim into `AuthError`, so the screen's `switch` matched nothing and the
   * `default` arm rendered the dump.
   */
  describe('auth failure normalization at the service boundary', () => {
    const leakedDump =
      '{"status":504,"ok":false,"headers":{"map":{"cf-ray":"a3a7a27abc4e9aaa-BOS",' +
      '"sb-project-ref":"drntwgporzabmxdqykrp","set-cookie":"__cf_bm=secret"}}}';

    it('maps a 504 Response dump to friendly copy and never leaks it', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: {
          name: 'AuthRetryableFetchError',
          status: 504,
          message: leakedDump,
        },
      });

      const thrown = await loginWithContext({ email: 'a@b.com', password: 'x' }).catch(
        (e) => e as { code?: string; message?: string }
      );

      expect(thrown.code).toBe('SERVICE_UNAVAILABLE');
      expect(thrown.message).toBe(
        "We couldn't sign you in right now. Please check your connection and try again."
      );
      expect(thrown.message).not.toContain('cf-ray');
      expect(thrown.message).not.toContain('__cf_bm');
      expect(thrown.message).not.toContain('drntwgporzabmxdqykrp');
    });

    it('maps a wrong password to INVALID_CREDENTIALS (the branch that used to be dead)', async () => {
      // The REAL GoTrue rejection: HTTP 400 + error_code `invalid_credentials`.
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      });

      const thrown = await loginWithContext({ email: 'a@b.com', password: 'x' }).catch(
        (e) => e as { code?: string; message?: string }
      );

      expect(thrown.code).toBe('INVALID_CREDENTIALS');
      expect(thrown.message).toBe('Invalid email or password.');
    });
  });
});

/**
 * FIX-Task-27 item 1 (2026-09-13) — the login-time profile read is retried.
 *
 * QA saw `qa-login-as?persona=test-seller` fail with "User profile not found"
 * while the profile was intact in the DB. The read was a single attempt, so ANY
 * transient failure (a briefly-degraded gateway leg, RLS hiccup, 5xx) was
 * indistinguishable from a genuinely missing profile — and because
 * `signInWithPassword` had already replaced the client session while React never
 * received `setSession`, the app wedged on "Loading trade…".
 *
 * These pin the retry contract: transient → recovered, persistent → the SAME
 * message/code as before (the canonical guide asserts that copy) with the real
 * underlying cause attached for the caller's logs.
 */
describe('FIX-Task-27 item 1 — login profile-read retry', () => {
  const profileChain = (single: jest.Mock) => ({
    select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })),
  });

  const signInAs = (userId: string) => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: { id: userId },
        session: { access_token: 'token', refresh_token: 'refresh' },
      },
      error: null,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Enrichment RPCs are not the subject here — keep them inert.
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
  });

  it('recovers from ONE transient profile-read failure instead of failing the login', async () => {
    signInAs('user-retry');
    const single = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'Gateway Timeout' } })
      .mockResolvedValue({
        data: { id: 'profile-1', user_id: 'user-retry', name: 'Retry' },
        error: null,
      });
    (supabase.from as jest.Mock).mockReturnValue(profileChain(single));

    await expect(
      loginWithContext({ email: 'retry@example.com', password: 'Password123' })
    ).resolves.toBeTruthy();

    // Two reads: the failed attempt and the successful retry.
    expect(single).toHaveBeenCalledTimes(2);
  });

  it('still fails after the bounded number of attempts, keeping the canonical copy', async () => {
    signInAs('user-gone');
    const underlying = { message: 'Gateway Timeout', code: 'PGRST000' };
    const single = jest.fn().mockResolvedValue({ data: null, error: underlying });
    (supabase.from as jest.Mock).mockReturnValue(profileChain(single));

    const thrown = await loginWithContext({
      email: 'gone@example.com',
      password: 'Password123',
    }).catch((e) => e as { code?: string; message?: string; details?: unknown });

    expect(thrown.message).toBe('User profile not found');
    expect(thrown.code).toBe('PROFILE_NOT_FOUND');
    // The bound is real: it does not retry forever.
    expect(single).toHaveBeenCalledTimes(3);
    // …and the underlying cause travels with the error so the caller can log it.
    expect(thrown.details).toEqual(underlying);
  });

  it('does not retry when the profile loads on the first attempt', async () => {
    signInAs('user-fast');
    const single = jest.fn().mockResolvedValue({
      data: { id: 'profile-2', user_id: 'user-fast', name: 'Fast' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue(profileChain(single));

    await expect(
      loginWithContext({ email: 'fast@example.com', password: 'Password123' })
    ).resolves.toBeTruthy();

    expect(single).toHaveBeenCalledTimes(1);
  });
});
