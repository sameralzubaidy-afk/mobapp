/**
 * Unit tests for useGracePeriodStatus hook
 * MODULE-11 TASK SUB-010
 */

import { renderHook } from '@testing-library/react-native';
import { useGracePeriodStatus } from '../useGracePeriodStatus';

describe('useGracePeriodStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return not in grace for non-grace_period status', () => {
    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'active',
        grace_period_ends_at: null,
      })
    );

    expect(result.current.isInGrace).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
    expect(result.current.message).toBeNull();
  });

  it('should return not in grace when status is grace_period but no end date', () => {
    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: null,
      })
    );

    expect(result.current.isInGrace).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
    expect(result.current.message).toBeNull();
  });

  it('should calculate days remaining correctly for grace period', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-15T12:00:00Z').toISOString();

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(14);
    expect(result.current.message).toContain('14 days');
  });

  it('should show critical message when 0 days remaining', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-01T14:00:00Z').toISOString(); // Same day

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(1);
    expect(result.current.message).toContain('grace period ends today');
  });

  it('should show urgent message when 1 day remaining', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-02T12:00:00Z').toISOString();

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(1);
    expect(result.current.message).toContain('1 day left');
  });

  it('should show urgent message when 7 days remaining', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-08T12:00:00Z').toISOString();

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(7);
    expect(result.current.message).toContain('7 days left');
  });

  it('should show standard message when more than 7 days remaining', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-20T12:00:00Z').toISOString();

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(19);
    expect(result.current.message).toContain('19 days to re-subscribe');
  });

  it('should handle past grace period end date', () => {
    const now = new Date('2024-01-10T12:00:00Z');
    jest.setSystemTime(now);

    const endDate = new Date('2024-01-05T12:00:00Z').toISOString();

    const { result } = renderHook(() =>
      useGracePeriodStatus({
        status: 'grace_period',
        grace_period_ends_at: endDate,
      })
    );

    expect(result.current.isInGrace).toBe(true);
    expect(result.current.daysRemaining).toBe(0);
  });
});
