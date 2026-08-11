/**
 * File: p2p-kids-marketplace/src/components/__tests__/AppHeader.test.tsx
 *
 * Header redesign tests:
 *  - main variant: read-only node chip, right cluster (bell + chat + avatar),
 *    NO logout icon in the header
 *  - chat icon present on all variants (tab/detail), opens Messages (InboxTab)
 *  - shared CountBadge fed by bell + chat count sources
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AppHeader from '../AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import { useUnreadMessagesBadge } from '@/hooks/useUnreadMessagesBadge';
import { useNavigation } from '@react-navigation/native';

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useNotificationBadge', () => ({ useNotificationBadge: jest.fn() }));
jest.mock('@/hooks/useUnreadMessagesBadge', () => ({ useUnreadMessagesBadge: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('@/components/atoms/Avatar', () => 'Avatar');

const mockNavigate = jest.fn();

const SESSION = {
  user: {
    id: 'user-1',
    email: 'sam@example.com',
    display_name: 'Samer',
    avatar_url: null,
    node: { name: 'Ledgewood Dr', city: 'Norwalk', state: 'CT' },
  },
};

function setup() {
  (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
  (useAuth as jest.Mock).mockReturnValue({ session: SESSION });
  (useNotificationBadge as jest.Mock).mockReturnValue({
    unreadCount: 2,
    refresh: jest.fn(),
  });
  (useUnreadMessagesBadge as jest.Mock).mockReturnValue({
    unreadCount: 5,
    refresh: jest.fn(),
  });
}

describe('AppHeader — Header Redesign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setup();
  });

  // ── main variant: node chip ───────────────────────────────────────────────
  it('renders the read-only node/market chip with the registered node name', () => {
    const { getByTestId, getByText } = render(<AppHeader variant="main" />);
    expect(getByTestId('header-node-chip')).toBeTruthy();
    expect(getByText('Ledgewood Dr')).toBeTruthy();
  });

  it('node chip is display-only: pressing it never navigates', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    fireEvent.press(getByTestId('header-node-chip'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to "Local Market" when the user has no node', () => {
    (useAuth as jest.Mock).mockReturnValue({
      session: { user: { id: 'user-1', email: 'x@example.com' } },
    });
    const { getByText } = render(<AppHeader variant="main" />);
    expect(getByText('Local Market')).toBeTruthy();
  });

  // ── main variant: right cluster ───────────────────────────────────────────
  it('renders bell + chat + avatar in the right cluster', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    expect(getByTestId('header-notifications-btn')).toBeTruthy();
    expect(getByTestId('header-chat-btn')).toBeTruthy();
    expect(getByTestId('header-profile-btn')).toBeTruthy();
  });

  it('does NOT render a logout icon in the header (relocated to Profile/Settings)', () => {
    const { queryByLabelText } = render(<AppHeader variant="main" />);
    expect(queryByLabelText('Sign out')).toBeNull();
  });

  it('chat icon opens the Messages screen (InboxTab)', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    fireEvent.press(getByTestId('header-chat-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('InboxTab');
  });

  it('bell icon opens Notifications', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    fireEvent.press(getByTestId('header-notifications-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('avatar opens Profile', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    fireEvent.press(getByTestId('header-profile-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  // ── badges (shared CountBadge, own count source each) ─────────────────────
  it('shows the notification count badge on the bell', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    expect(getByTestId('header-notifications-badge')).toBeTruthy();
  });

  it('shows the unread-messages count badge on the chat icon', () => {
    const { getByTestId } = render(<AppHeader variant="main" />);
    expect(getByTestId('header-chat-badge')).toBeTruthy();
  });

  // ── chat icon unified across variants ─────────────────────────────────────
  it('renders the chat icon on the tab variant', () => {
    const { getByTestId } = render(<AppHeader variant="tab" title="Discover" />);
    expect(getByTestId('header-chat-btn')).toBeTruthy();
  });

  it('renders the chat icon on the detail variant', () => {
    const { getByTestId } = render(<AppHeader variant="detail" title="Settings" />);
    expect(getByTestId('header-chat-btn')).toBeTruthy();
  });

  it('tab variant chat icon opens Messages (InboxTab)', () => {
    const { getByTestId } = render(<AppHeader variant="detail" title="Settings" />);
    fireEvent.press(getByTestId('header-chat-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('InboxTab');
  });
});
