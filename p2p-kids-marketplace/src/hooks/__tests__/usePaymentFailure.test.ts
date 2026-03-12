/**
 * FILE: p2p-kids-marketplace/src/hooks/__tests__/usePaymentFailure.test.ts
 * MODULE-11 TASK SUB-018: Payment Failure Hook Unit Tests
 */

import { act, renderHook } from '@testing-library/react-native';
import { usePaymentFailure } from '../usePaymentFailure';
import { useSubscription } from '../useSubscription';

// Mock useSubscription hook
jest.mock('../useSubscription');
const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;

describe('usePaymentFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return no failure when subscription has no payment issues', () => {
    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 0,
        payment_failed_at: null,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(false);
    expect(result.current.failureInfo.retryCount).toBe(0);
    expect(result.current.failureInfo.message).toBe('');
  });

  it('should detect first payment failure (retry_count = 1)', () => {
    const failedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 1,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.retryCount).toBe(1);
    expect(result.current.failureInfo.isRecentFailure).toBe(true);
    expect(result.current.failureInfo.urgencyLevel).toBe('medium');
    expect(result.current.failureInfo.message).toContain('Your payment was declined');
  });

  it('should still show failure when retry_count exists but payment_failed_at is missing', () => {
    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 1,
        payment_failed_at: null,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.retryCount).toBe(1);
    expect(result.current.failureInfo.isRecentFailure).toBe(true);
    expect(result.current.failureInfo.message).toContain('Your payment was declined');
  });

  it('should detect second payment failure with high urgency (retry_count = 2)', () => {
    const failedAt = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 minutes ago

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 2,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.retryCount).toBe(2);
    expect(result.current.failureInfo.urgencyLevel).toBe('high');
    expect(result.current.failureInfo.message).toContain('Payment declined again');
  });

  it('should detect max retries reached (retry_count = 3)', () => {
    const failedAt = new Date(Date.now() - 1000 * 60 * 10).toISOString(); // 10 minutes ago

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'grace_period',
        payment_retry_count: 3,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.retryCount).toBe(3);
    expect(result.current.failureInfo.isMaxRetriesReached).toBe(true);
    expect(result.current.failureInfo.urgencyLevel).toBe('high');
    expect(result.current.failureInfo.message).toContain('access has been paused');
  });

  it('should avoid paused message when max retries reached but status is still active', () => {
    const failedAt = new Date(Date.now() - 1000 * 60 * 10).toISOString();

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 3,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.retryCount).toBe(3);
    expect(result.current.failureInfo.isMaxRetriesReached).toBe(true);
    expect(result.current.failureInfo.message).toContain('subscription is at risk');
    expect(result.current.failureInfo.message).not.toContain('access has been paused');
  });

  it('should not show banner for old failures (>24 hours)', () => {
    const failedAt = new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(); // 26 hours ago

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 1,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.failureInfo.hasFailure).toBe(true);
    expect(result.current.failureInfo.isRecentFailure).toBe(false);
  });

  it('should allow dismissing banner', () => {
    const failedAt = new Date().toISOString();

    mockUseSubscription.mockReturnValue({
      subscription: {
        status: 'active',
        payment_retry_count: 1,
        payment_failed_at: failedAt,
      } as any,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.bannerDismissed).toBe(false);

    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.bannerDismissed).toBe(true);
  });

  it('should handle loading state', () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => usePaymentFailure());

    expect(result.current.loading).toBe(true);
  });
});

