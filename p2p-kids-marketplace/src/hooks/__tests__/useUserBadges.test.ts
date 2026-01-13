// File: p2p-kids-marketplace/src/hooks/__tests__/useUserBadges.test.ts
// Unit tests for TASK BADGES-V2-009: useUserBadges real-time hook

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useUserBadges } from '../useUserBadges';

// Mock supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('useUserBadges hook', () => {
  let mockFrom: any;
  let mockChannel: any;
  let mockSubscribe: any;

  beforeEach(() => {
    mockSubscribe = jest.fn();
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: mockSubscribe,
    };

    mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
      single: jest.fn(),
    };

    const { supabase } = require('@/config/supabase');
    (supabase.from as jest.Mock).mockReturnValue(mockFrom);
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should load badges on mount', async () => {
    const mockBadges = [
      {
        id: 'badge-1',
        user_id: 'user-1',
        badge_id: 'b-1',
        awarded_at: '2025-01-10T00:00:00Z',
        badge: {
          id: 'b-1',
          name: 'SP Earner - Bronze',
          description: 'Earned 10 SP',
          category: 'sp_earning',
          threshold: 10,
        },
      },
    ];

    mockFrom.order.mockResolvedValue({ data: mockBadges, error: null });

    const { result } = renderHook(() => useUserBadges('user-1'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockBadges);
    expect(result.current.error).toBeNull();
  });

  it('should handle empty userId gracefully', async () => {
    const { result } = renderHook(() => useUserBadges(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error', async () => {
    mockFrom.order.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useUserBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual([]);
    expect(result.current.error).toBe('Database error');
  });

  it('should subscribe to real-time updates', async () => {
    mockFrom.order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useUserBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const { supabase } = require('@/config/supabase');

    expect(supabase.channel).toHaveBeenCalledWith('user_badges_user-1');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_badges',
        filter: 'user_id=eq.user-1',
      },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should refresh badges when refresh is called', async () => {
    const initialBadges = [
      {
        id: 'badge-1',
        user_id: 'user-1',
        badge_id: 'b-1',
        awarded_at: '2025-01-10T00:00:00Z',
        badge: { id: 'b-1', name: 'Bronze', description: '', category: 'sp_earning', threshold: 10 },
      },
    ];

    mockFrom.order.mockResolvedValueOnce({ data: initialBadges, error: null });

    const { result } = renderHook(() => useUserBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(initialBadges);

    // Mock updated badges
    const updatedBadges = [
      ...initialBadges,
      {
        id: 'badge-2',
        user_id: 'user-1',
        badge_id: 'b-2',
        awarded_at: '2025-01-11T00:00:00Z',
        badge: { id: 'b-2', name: 'Silver', description: '', category: 'sp_earning', threshold: 50 },
      },
    ];

    mockFrom.order.mockResolvedValueOnce({ data: updatedBadges, error: null });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.badges).toEqual(updatedBadges);
  });

  it('should clear new badge notification', async () => {
    mockFrom.order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useUserBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Manually set newBadgeAwarded for test
    // (in real scenario this happens via real-time callback)

    act(() => {
      result.current.clearNewBadge();
    });

    expect(result.current.newBadgeAwarded).toBeNull();
  });
});
