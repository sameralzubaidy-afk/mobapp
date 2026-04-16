// File: p2p-kids-marketplace/src/__tests__/screens/NotificationCenterScreen.test.tsx
// MODULE-14 TASK NOTIF-V2-006: Unit tests for NotificationCenterScreen

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { renderHook, act as hookAct } from '@testing-library/react-native';
import NotificationCenterScreen, {
  mergeNotificationsById,
} from '@/screens/notifications/NotificationCenterScreen';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

const mockSession = { user: { id: 'user-123' } };
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: mockSession }),
}));

const mockGetUserNotifications = jest.fn();
const mockMarkNotificationAsRead = jest.fn();
const mockMarkAllNotificationsAsRead = jest.fn();
const mockSubscribeToNotifications = jest.fn(() => jest.fn());

jest.mock('@/services/referralNotifications', () => ({
  getUserNotifications: (...args: any[]) => mockGetUserNotifications(...args),
  markNotificationAsRead: (...args: any[]) => mockMarkNotificationAsRead(...args),
  markAllNotificationsAsRead: (...args: any[]) => mockMarkAllNotificationsAsRead(...args),
  subscribeToNotifications: (...args: any[]) => mockSubscribeToNotifications(...args),
}));

// react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeNotification = (
  id: string,
  overrides: Partial<Record<string, any>> = {}
) => ({
  id,
  user_id: 'user-123',
  category: 'system',
  type: 'test',
  title: `Notification ${id}`,
  body: `Body for ${id}`,
  channels: ['in_app'],
  data: {},
  is_read: false,
  created_at: new Date().toISOString(),
  read_at: null,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationCenterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeToNotifications.mockReturnValue(jest.fn());
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows loading indicator while fetching', async () => {
    // Never resolve to stay in loading state
    mockGetUserNotifications.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<NotificationCenterScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows empty state when no notifications exist', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('empty-state')).toBeTruthy());
  });

  // ── Renders notifications ──────────────────────────────────────────────────

  it('renders a list of notifications', async () => {
    const notifications = [
      makeNotification('n1'),
      makeNotification('n2', { is_read: true }),
    ];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => {
      expect(getByTestId('notification-item-n1')).toBeTruthy();
      expect(getByTestId('notification-item-n2')).toBeTruthy();
    });
  });

  // ── Unread indicator ──────────────────────────────────────────────────────

  it('shows unread dot only for unread notifications', async () => {
    const notifications = [
      makeNotification('n1', { is_read: false }), // unread
      makeNotification('n2', { is_read: true }),  // read
    ];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });

    const { getByTestId, queryByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => {
      expect(getByTestId('unread-indicator-n1')).toBeTruthy();
      expect(queryByTestId('unread-indicator-n2')).toBeNull();
    });
  });

  // ── Mark individual as read ────────────────────────────────────────────────

  it('marks a notification as read when tapped', async () => {
    const notifications = [makeNotification('n1', { is_read: false })];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });
    mockMarkNotificationAsRead.mockResolvedValue({ success: true });

    const { getByTestId, queryByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('notification-item-n1')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('notification-item-n1'));
    });

    expect(mockMarkNotificationAsRead).toHaveBeenCalledWith('n1', 'user-123');
    await waitFor(() => expect(queryByTestId('unread-indicator-n1')).toBeNull());
  });

  // ── Mark all as read ──────────────────────────────────────────────────────

  it('shows "Mark all read" button only when unread items exist', async () => {
    const notifications = [makeNotification('n1', { is_read: false })];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('mark-all-read-button')).toBeTruthy());
  });

  it('hides "Mark all read" button when all are read', async () => {
    const notifications = [makeNotification('n1', { is_read: true })];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });

    const { queryByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(queryByTestId('mark-all-read-button')).toBeNull());
  });

  it('marks all notifications as read when button pressed', async () => {
    const notifications = [
      makeNotification('n1', { is_read: false }),
      makeNotification('n2', { is_read: false }),
    ];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });
    mockMarkAllNotificationsAsRead.mockResolvedValue({ success: true, updated_count: 2 });

    const { getByTestId, queryByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('mark-all-read-button')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('mark-all-read-button'));
    });

    expect(mockMarkAllNotificationsAsRead).toHaveBeenCalledWith('user-123');
    await waitFor(() => {
      expect(queryByTestId('unread-indicator-n1')).toBeNull();
      expect(queryByTestId('unread-indicator-n2')).toBeNull();
    });
  });

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  it('reloads notifications on pull-to-refresh', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('notification-list')).toBeTruthy());

    await act(async () => {
      // Fire refresh on the FlatList directly (RefreshControl testID is not
      // accessible via RNTL; firing 'refresh' on the host scroll view is correct)
      fireEvent(getByTestId('notification-list'), 'refresh');
    });

    // Initial load + refresh = 2 calls
    expect(mockGetUserNotifications).toHaveBeenCalledTimes(2);
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it('shows error state and retry button on load failure', async () => {
    mockGetUserNotifications.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('error-state')).toBeTruthy());
    expect(getByTestId('retry-button')).toBeTruthy();
  });

  it('retries load when retry button is tapped', async () => {
    mockGetUserNotifications
      .mockResolvedValueOnce({ success: false, error: 'Network error' })
      .mockResolvedValueOnce({ success: true, data: [] });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('retry-button')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('retry-button'));
    });

    expect(mockGetUserNotifications).toHaveBeenCalledTimes(2);
  });

  // ── Back navigation ───────────────────────────────────────────────────────

  it('calls navigation.goBack() when back button tapped', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('screen-title')).toBeTruthy());

    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // ── Deep link navigation ──────────────────────────────────────────────────

  it('navigates to deep link route when tapping a notification with data.deep_link', async () => {
    const notifications = [
      makeNotification('n1', {
        data: { deep_link: '/wallet' },
        is_read: false,
      }),
    ];
    mockGetUserNotifications.mockResolvedValue({ success: true, data: notifications });
    mockMarkNotificationAsRead.mockResolvedValue({ success: true });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('notification-item-n1')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('notification-item-n1'));
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('SpWallet');
  });

  // ── Screen title ──────────────────────────────────────────────────────────

  it('renders "Notifications" as the screen title', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    const { getByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(getByTestId('screen-title')).toBeTruthy());
    expect(getByTestId('screen-title').props.children).toBe('Notifications');
  });

  // ── Realtime subscription ─────────────────────────────────────────────────

  it('subscribes to realtime notifications on mount', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    render(<NotificationCenterScreen />);
    await waitFor(() =>
      expect(mockSubscribeToNotifications).toHaveBeenCalledWith('user-123', expect.any(Function))
    );
  });

  it('prepends realtime notification to list', async () => {
    mockGetUserNotifications.mockResolvedValue({ success: true, data: [] });

    let realtimeCallback: (n: any) => void = () => {};
    mockSubscribeToNotifications.mockImplementation((_userId: string, cb: (n: any) => void) => {
      realtimeCallback = cb;
      return jest.fn();
    });

    const { queryByTestId } = render(<NotificationCenterScreen />);
    await waitFor(() =>
      expect(mockSubscribeToNotifications).toHaveBeenCalled()
    );

    const newNotification = makeNotification('realtime-1');
    act(() => {
      realtimeCallback(newNotification);
    });

    await waitFor(() =>
      expect(queryByTestId('notification-item-realtime-1')).toBeTruthy()
    );
  });

  it('dedupes overlapping notification IDs when loading more items', async () => {
    const page1 = Array.from({ length: 20 }, (_, i) => makeNotification(`n${i + 1}`));
    // Simulate shifted pagination due to realtime insert: n3 appears again on next page
    const page2 = [
      makeNotification('n3'),
      ...Array.from({ length: 19 }, (_, i) => makeNotification(`n${i + 21}`)),
    ];

    mockGetUserNotifications
      .mockResolvedValueOnce({ success: true, data: page1 })
      .mockResolvedValueOnce({ success: true, data: page2 });

    const { getByTestId, queryAllByTestId } = render(<NotificationCenterScreen />);

    await waitFor(() => {
      expect(getByTestId('notification-item-n1')).toBeTruthy();
      expect(getByTestId('notification-item-n3')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(getByTestId('notification-list'), 'onEndReached');
    });

    await waitFor(() => {
      expect(mockGetUserNotifications).toHaveBeenCalledTimes(2);
      expect(queryAllByTestId('notification-item-n3')).toHaveLength(1);
    });
  });
});

describe('mergeNotificationsById', () => {
  it('keeps first occurrence and removes duplicate IDs', () => {
    const merged = mergeNotificationsById(
      [makeNotification('a'), makeNotification('b')],
      [makeNotification('b'), makeNotification('c')]
    );

    expect(merged.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('prefers realtime item when prepending duplicate ID', () => {
    const oldItem = makeNotification('same-id', { title: 'Old title' });
    const newItem = makeNotification('same-id', { title: 'New title' });

    const merged = mergeNotificationsById([newItem], [oldItem]);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('New title');
  });
});

// ── useNotificationBadge hook tests ──────────────────────────────────────────

const mockGetUnreadNotificationCount = jest.fn();
jest.mock('@/services/referralNotifications', () => ({
  getUserNotifications: (...args: any[]) => mockGetUserNotifications(...args),
  markNotificationAsRead: (...args: any[]) => mockMarkNotificationAsRead(...args),
  markAllNotificationsAsRead: (...args: any[]) => mockMarkAllNotificationsAsRead(...args),
  subscribeToNotifications: (...args: any[]) => mockSubscribeToNotifications(...args),
  getUnreadNotificationCount: (...args: any[]) => mockGetUnreadNotificationCount(...args),
}));

describe('useNotificationBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeToNotifications.mockReturnValue(jest.fn());
    mockGetUnreadNotificationCount.mockResolvedValue({ success: true, count: 0 });
  });

  it('returns 0 when userId is undefined', async () => {
    const { result } = renderHook(() => useNotificationBadge(undefined));
    expect(result.current.unreadCount).toBe(0);
  });

  it('fetches unread count on mount', async () => {
    mockGetUnreadNotificationCount.mockResolvedValue({ success: true, count: 5 });

    const { result } = renderHook(() => useNotificationBadge('user-123'));
    await waitFor(() => expect(result.current.unreadCount).toBe(5));
  });

  it('increments count on realtime notification insert', async () => {
    mockGetUnreadNotificationCount.mockResolvedValue({ success: true, count: 2 });
    let realtimeCallback: (n: any) => void = () => {};
    mockSubscribeToNotifications.mockImplementation(
      (_userId: string, cb: (n: any) => void) => {
        realtimeCallback = cb;
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useNotificationBadge('user-123'));
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    hookAct(() => {
      realtimeCallback(makeNotification('new-1'));
    });

    expect(result.current.unreadCount).toBe(3);
  });

  it('refresh() re-fetches unread count', async () => {
    mockGetUnreadNotificationCount
      .mockResolvedValueOnce({ success: true, count: 1 })
      .mockResolvedValueOnce({ success: true, count: 3 });

    const { result } = renderHook(() => useNotificationBadge('user-123'));
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await hookAct(async () => {
      await result.current.refresh();
    });

    expect(result.current.unreadCount).toBe(3);
  });
});
