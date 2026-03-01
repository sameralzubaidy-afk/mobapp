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
});
