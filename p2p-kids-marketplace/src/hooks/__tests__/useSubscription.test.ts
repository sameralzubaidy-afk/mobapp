/**
 * Unit tests for useSubscription hook
 * MODULE-11 TASK SUB-010
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useSubscription } from '../useSubscription';
import { getSubscriptionSummary } from '../../services/subscription';
import { useAuth } from '../useAuth';

// Mock dependencies
jest.mock('../../services/subscription');
jest.mock('../useAuth');

const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<
  typeof getSubscriptionSummary
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('useSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null subscription when no user', async () => {
    mockUseAuth.mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetSubscriptionSummary).not.toHaveBeenCalled();
  });

  it('should fetch subscription for authenticated user', async () => {
    const mockUser = { id: 'user-123' };
    const mockSubscription = {
      status: 'active',
      price_cents: 499,
      current_period_end: '2024-12-31T23:59:59Z',
    };

    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockGetSubscriptionSummary.mockResolvedValue(mockSubscription as any);

    const { result } = renderHook(() => useSubscription());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toEqual(mockSubscription);
    expect(result.current.error).toBeNull();
    expect(mockGetSubscriptionSummary).toHaveBeenCalledWith('user-123');
  });

  it('should handle fetch error', async () => {
    const mockUser = { id: 'user-123' };
    const mockError = new Error('Network error');

    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockGetSubscriptionSummary.mockRejectedValue(mockError);

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toBeNull();
    expect(result.current.error).toEqual(mockError);
    expect(mockGetSubscriptionSummary).toHaveBeenCalledWith('user-123');
  });

  it('should refetch subscription when refetch is called', async () => {
    const mockUser = { id: 'user-123' };
    const mockSubscription1 = { status: 'trial' };
    const mockSubscription2 = { status: 'active' };

    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockGetSubscriptionSummary.mockResolvedValueOnce(mockSubscription1 as any);

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toEqual(mockSubscription1);

    // Now refetch with different result
    mockGetSubscriptionSummary.mockResolvedValueOnce(mockSubscription2 as any);
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.subscription).toEqual(mockSubscription2);
    });

    expect(mockGetSubscriptionSummary).toHaveBeenCalledTimes(2);
  });

  it('should update subscription when user changes', async () => {
    const mockUser1 = { id: 'user-123' };
    const mockUser2 = { id: 'user-456' };
    const mockSub1 = { status: 'trial' };
    const mockSub2 = { status: 'active' };

    mockUseAuth.mockReturnValue({ user: mockUser1 } as any);
    mockGetSubscriptionSummary.mockResolvedValueOnce(mockSub1 as any);

    const { result, rerender } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toEqual(mockSub1);

    // Change user
    mockUseAuth.mockReturnValue({ user: mockUser2 } as any);
    mockGetSubscriptionSummary.mockResolvedValueOnce(mockSub2 as any);

    rerender();

    await waitFor(() => {
      expect(result.current.subscription).toEqual(mockSub2);
    });

    expect(mockGetSubscriptionSummary).toHaveBeenCalledWith('user-123');
    expect(mockGetSubscriptionSummary).toHaveBeenCalledWith('user-456');
  });

  // ── FIX-Task-28 item 1 (2026-09-13) ────────────────────────────────────────
  // A transient failure of get_subscription_status used to be indistinguishable
  // from a confirmed free user, so a paying subscriber's Home screen silently
  // downgraded to the "Unlock Swap Points / Upgrade" upsell.
  describe('unverified subscription reads (FIX-Task-28 item 1)', () => {
    const unverifiedSummary = {
      status: 'unknown',
      unverified: true,
      can_spend_sp: false,
      can_earn_sp: false,
      is_subscriber: false,
    };

    it('reports unverified + null (not a free plan) when a plan was never confirmed', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-123' } } as any);
      mockGetSubscriptionSummary.mockResolvedValue(unverifiedSummary as any);

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // `null` is the explicit "we don't know" state — Home renders its
      // couldn't-verify strip with a retry from this pair.
      expect(result.current.subscription).toBeNull();
      expect(result.current.unverified).toBe(true);
      expect(result.current.error).toBeTruthy();
    });

    it('keeps the last CONFIRMED plan when a later read goes unverified', async () => {
      const confirmedActive = { status: 'active', unverified: false, can_spend_sp: true };
      mockUseAuth.mockReturnValue({ user: { id: 'user-123' } } as any);
      mockGetSubscriptionSummary.mockResolvedValueOnce(confirmedActive as any);

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.subscription).toEqual(confirmedActive);
      });

      expect(result.current.unverified).toBe(false);

      // Now the read fails transiently — the subscriber keeps their real plan.
      mockGetSubscriptionSummary.mockResolvedValueOnce(unverifiedSummary as any);
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.unverified).toBe(true);
      });

      expect(result.current.subscription).toEqual(confirmedActive);
      // Never the free-tier fallback.
      expect(result.current.subscription?.status).not.toBe('free');
    });

    it('does not carry one account’s last-known plan over to another account', async () => {
      const confirmedActive = { status: 'active', can_spend_sp: true };

      mockUseAuth.mockReturnValue({ user: { id: 'user-aaa' } } as any);
      mockGetSubscriptionSummary.mockResolvedValueOnce(confirmedActive as any);

      const { result, rerender } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.subscription).toEqual(confirmedActive);
      });

      // Switch account; the new account's very first read fails transiently.
      mockUseAuth.mockReturnValue({ user: { id: 'user-bbb' } } as any);
      mockGetSubscriptionSummary.mockResolvedValueOnce(unverifiedSummary as any);
      rerender();

      await waitFor(() => {
        expect(result.current.unverified).toBe(true);
      });

      // Must NOT show account A's Kids Club+ plan to account B.
      expect(result.current.subscription).toBeNull();
    });

    it('treats a thrown error as unverified rather than free', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-123' } } as any);
      mockGetSubscriptionSummary.mockRejectedValue(new Error('Network request failed'));

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.unverified).toBe(true);
      expect(result.current.subscription).toBeNull();
    });
  });
});
