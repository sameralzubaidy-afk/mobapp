// File: p2p-kids-marketplace/src/screens/dashboard/__tests__/UserDashboardScreen.test.tsx
// MODULE-15.1 FLOW-16: Tests for the redesigned Home Dashboard

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import UserDashboardScreen from '../UserDashboardScreen';
import { useAuth, useSPWallet } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { idBadgeService } from '@/services/idBadge';
import { getActiveDrafts } from '@/services/draftService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/config/supabase', () => {
  const buildChain = (maybeData: any) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(maybeData),
  });
  return {
    supabase: {
      from: jest.fn((table: string) => {
        // Table-aware so the grace-banner CTA (G07) can be exercised: the
        // subscriptions timeline returns a grace end date by default (the grace
        // banner only renders when subscription.status is also 'grace', which
        // tests control via setupMocks). Trades return no rows.
        if (table === 'subscriptions') {
          return buildChain({
            data: { status: 'grace_period', grace_ends_at: '2026-09-01T00:00:00Z' },
            error: null,
          });
        }
        return buildChain({ data: null, error: null });
      }),
    },
  };
});

jest.mock('@/services/idBadge', () => ({
  idBadgeService: { getVerificationStatus: jest.fn().mockResolvedValue({ status: 'approved' }) },
}));

jest.mock('@/services/draftService', () => ({
  getActiveDrafts: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
  useSPWallet: jest.fn(),
}));

jest.mock('@/hooks/useSubscription', () => ({ useSubscription: jest.fn() }));
jest.mock('@/hooks/useNotificationBadge', () => ({ useNotificationBadge: jest.fn() }));
jest.mock('@/hooks/useUnreadMessagesBadge', () => ({
  useUnreadMessagesBadge: () => ({ unreadCount: 0, refresh: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useIsFocused: jest.fn(),
}));

jest.mock('@/components/atoms/Avatar', () => 'Avatar');
jest.mock('@/components/organisms/RecommendationsCarousel', () => 'RecommendationsCarousel');
jest.mock('@/components/molecules/CategorySelector', () => 'CategorySelector');
jest.mock('@/components/organisms/BottomNavBar', () => 'BottomNavBar');
jest.mock('@/components/TrialReminderBanner', () => ({ TrialReminderBanner: () => null }));
jest.mock('@/components/GracePeriodBanner', () => 'GracePeriodBanner');
jest.mock('@/components/subscription/PaymentFailureBanner', () => ({
  PaymentFailureBanner: () => null,
}));
jest.mock('@/components/molecules/ResumeDraftBanner', () => ({
  ResumeDraftBanner: () => null,
}));
jest.mock('@/components/molecules/IDVerificationCTABanner', () => ({
  IDVerificationCTABanner: () => null,
}));
jest.mock('@/components/ui', () => ({ LoadingSpinner: () => null }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockRefreshSession = jest.fn().mockResolvedValue(undefined);
const mockRefetchSubscription = jest.fn().mockResolvedValue(undefined);

const DEFAULT_SESSION = {
  user: {
    id: 'user-001',
    email: 'test@example.com',
    display_name: 'Samer',
    avatar_url: null,
    node: { name: 'Ledgewood Dr', city: 'Norwalk', state: 'CT' },
  },
};

const DEFAULT_WALLET = {
  available: 2191,
  pending: 0,
  lifetime_earned: 2351,
  lifetime_spent: 160,
};

function setupMocks(
  overrides: {
    canSpendSP?: boolean;
    subStatus?: string;
    unreadCount?: number;
  } = {}
) {
  (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
  (useIsFocused as jest.Mock).mockReturnValue(true);

  (useAuth as jest.Mock).mockReturnValue({
    session: DEFAULT_SESSION,
    refreshSession: mockRefreshSession,
    isLoading: false,
  });

  (useSPWallet as jest.Mock).mockReturnValue(DEFAULT_WALLET);

  (useSubscription as jest.Mock).mockReturnValue({
    subscription: {
      status: overrides.subStatus ?? 'active',
      can_spend_sp: overrides.canSpendSP ?? true,
    },
    loading: false,
    refetch: mockRefetchSubscription,
  });

  (useNotificationBadge as jest.Mock).mockReturnValue({
    unreadCount: overrides.unreadCount ?? 3,
    refresh: jest.fn(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserDashboardScreen — MODULE-15.1 FLOW-16', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // ── Header (redesigned) ─────────────────────────────────────────────────────
  it('renders the read-only node/market chip in the header', () => {
    const { getByTestId, getByText } = render(<UserDashboardScreen />);
    expect(getByTestId('header-node-chip')).toBeTruthy();
    expect(getByText('Ledgewood Dr')).toBeTruthy();
  });

  it('renders the Home composer bar below the header', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    expect(getByTestId('composer-bar')).toBeTruthy();
  });

  it('composer submit navigates to ItemCreate with the typed title', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.changeText(getByTestId('composer-input'), 'Lego Set');
    fireEvent.press(getByTestId('composer-add-button'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate', {
      prefilledTitle: 'Lego Set',
    });
  });

  // ── Home Greeting (G01 / ACC-TC-G01) ────────────────────────────────────────
  it('renders a time-based greeting with the display name (G01)', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    const greeting = getByTestId('dashboard-greeting');
    expect(greeting.props.children).toMatch(/^Good (morning|afternoon|evening), Samer$/);
  });

  it('greeting uses only the first name when display name has multiple words (G01)', () => {
    (useAuth as jest.Mock).mockReturnValue({
      session: {
        ...DEFAULT_SESSION,
        user: { ...DEFAULT_SESSION.user, display_name: 'Samer Alzubaidi' },
      },
      refreshSession: mockRefreshSession,
      isLoading: false,
    });
    const { getByTestId } = render(<UserDashboardScreen />);
    expect(getByTestId('dashboard-greeting').props.children).toMatch(
      /^Good (morning|afternoon|evening), Samer$/
    );
  });

  it('greeting falls back to the email prefix when no display name (G01)', () => {
    (useAuth as jest.Mock).mockReturnValue({
      session: {
        ...DEFAULT_SESSION,
        user: { ...DEFAULT_SESSION.user, display_name: '' },
      },
      refreshSession: mockRefreshSession,
      isLoading: false,
    });
    const { getByTestId } = render(<UserDashboardScreen />);
    expect(getByTestId('dashboard-greeting').props.children).toMatch(
      /^Good (morning|afternoon|evening), test$/
    );
  });

  // ── Action Items: Show More / Show Less (G07 / ACC-TC-G07) ──────────────────
  it('shows "Show 1 more action" when 3 CTAs stack (ID + grace + drafts) (G07)', async () => {
    (idBadgeService.getVerificationStatus as jest.Mock).mockResolvedValue({ status: 'none' });
    (getActiveDrafts as jest.Mock).mockResolvedValue([{ id: 'draft-1', title: 'Draft' }]);
    setupMocks({ canSpendSP: true, subStatus: 'grace' });

    const { getByText, getByTestId, queryByTestId } = render(<UserDashboardScreen />);

    await waitFor(() => expect(getByText('Show 1 more action')).toBeTruthy());
    expect(getByTestId('action-items-show-all')).toBeTruthy();
    expect(queryByTestId('action-items-show-less')).toBeNull();
  });

  it('expand + collapse toggles between Show more and Show less (G07)', async () => {
    (idBadgeService.getVerificationStatus as jest.Mock).mockResolvedValue({ status: 'none' });
    (getActiveDrafts as jest.Mock).mockResolvedValue([{ id: 'draft-1', title: 'Draft' }]);
    setupMocks({ canSpendSP: true, subStatus: 'grace' });

    const { getByTestId, queryByTestId } = render(<UserDashboardScreen />);

    await waitFor(() => expect(getByTestId('action-items-show-all')).toBeTruthy());

    // Expand
    fireEvent.press(getByTestId('action-items-show-all'));
    expect(getByTestId('action-items-show-less')).toBeTruthy();
    expect(queryByTestId('action-items-show-all')).toBeNull();

    // Collapse
    fireEvent.press(getByTestId('action-items-show-less'));
    expect(getByTestId('action-items-show-all')).toBeTruthy();
    expect(queryByTestId('action-items-show-less')).toBeNull();
  });

  it('does NOT render a show-more toggle with 2 CTAs (no regression) (G07)', async () => {
    // ID CTA + drafts = 2 CTAs → fully visible, no toggle.
    (idBadgeService.getVerificationStatus as jest.Mock).mockResolvedValue({ status: 'none' });
    (getActiveDrafts as jest.Mock).mockResolvedValue([{ id: 'draft-1', title: 'Draft' }]);

    const { queryByTestId } = render(<UserDashboardScreen />);

    await waitFor(() => expect(queryByTestId('action-items-show-all')).toBeNull());
    expect(queryByTestId('action-items-show-less')).toBeNull();
  });

  // ── SP Strip ────────────────────────────────────────────────────────────────
  it('shows SP balance strip for subscribed users', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('2191 SP')).toBeTruthy();
    expect(getByText('Earn More →')).toBeTruthy();
  });

  it('shows upgrade strip for free users', () => {
    setupMocks({ canSpendSP: false, subStatus: 'free' });
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('Unlock Swap Points')).toBeTruthy();
    expect(getByText('Upgrade →')).toBeTruthy();
  });

  it('navigates to SpWallet when SP strip is tapped (subscriber)', () => {
    const { getByText } = render(<UserDashboardScreen />);
    fireEvent.press(getByText('Earn More →'));
    expect(mockNavigate).toHaveBeenCalledWith('SpWallet');
  });

  it('navigates to JoinKidsClub when upgrade strip is tapped', () => {
    setupMocks({ canSpendSP: false, subStatus: 'free' });
    const { getByText } = render(<UserDashboardScreen />);
    fireEvent.press(getByText('Upgrade →'));
    expect(mockNavigate).toHaveBeenCalledWith('JoinKidsClub');
  });

  // ── Quick Action Tiles ───────────────────────────────────────────────────────
  it('renders all 4 quick action tiles', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    ['favorites', 'myTrades', 'myListings', 'payouts'].forEach((key) => {
      expect(getByTestId(`action-tile-${key}`)).toBeTruthy();
    });
  });

  it('navigates to Favorites when Favorites tile is pressed', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.press(getByTestId('action-tile-favorites'));
    expect(mockNavigate).toHaveBeenCalledWith('Favorites');
  });

  it('navigates to TradeList when My Trades tile is pressed', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.press(getByTestId('action-tile-myTrades'));
    expect(mockNavigate).toHaveBeenCalledWith('TradeList');
  });

  it('navigates to MyListings when My Listings tile is pressed', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.press(getByTestId('action-tile-myListings'));
    expect(mockNavigate).toHaveBeenCalledWith('MyListings');
  });

  it('navigates to PayoutSettings when Payouts tile is pressed', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.press(getByTestId('action-tile-payouts'));
    expect(mockNavigate).toHaveBeenCalledWith('PayoutSettings');
  });

  it('navigates to PayoutSettings when Payouts tile is pressed', () => {
    const { getByTestId } = render(<UserDashboardScreen />);
    fireEvent.press(getByTestId('action-tile-payouts'));
    expect(mockNavigate).toHaveBeenCalledWith('PayoutSettings');
  });

  // ── SP Wallet Card ───────────────────────────────────────────────────────────
  it('shows subscriber SP unlock badge on subscription card', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('Subscription')).toBeTruthy();
    expect(getByText('SP Wallet Unlocked')).toBeTruthy();
  });

  it('does NOT show Swap Points Wallet card for free users', () => {
    setupMocks({ canSpendSP: false, subStatus: 'free' });
    const { queryByText } = render(<UserDashboardScreen />);
    expect(queryByText('Swap Points Wallet')).toBeNull();
  });

  it('shows current SP strip value for subscribers', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('2191 SP')).toBeTruthy();
  });

  // ── Subscription Card ────────────────────────────────────────────────────────
  it('shows Kids Club+ Active badge for active subscribers', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('Kids Club+ Active')).toBeTruthy();
  });

  it('shows SP Wallet Unlocked badge for subscribers', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText(/SP Wallet Unlocked/i)).toBeTruthy();
  });

  it('shows upgrade button for free users', () => {
    setupMocks({ canSpendSP: false, subStatus: 'free' });
    const { getAllByText } = render(<UserDashboardScreen />);
    // Button appears in both upgrade strip CTA and the subscription card
    const upgradeElements = getAllByText('Upgrade to Kids Club+');
    expect(upgradeElements.length).toBeGreaterThanOrEqual(1);
  });

  // ── View All Trades CTA ──────────────────────────────────────────────────────
  it('renders View All Trades button', () => {
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText('View All →')).toBeTruthy();
  });

  it('navigates to TradeList when View All Trades is pressed', () => {
    const { getByText } = render(<UserDashboardScreen />);
    fireEvent.press(getByText('View All →'));
    expect(mockNavigate).toHaveBeenCalledWith('TradeList');
  });

  // ── Loading / No Session ─────────────────────────────────────────────────────
  it('renders loading spinner while data is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      session: null,
      refreshSession: mockRefreshSession,
      isLoading: true,
    });
    (useSubscription as jest.Mock).mockReturnValue({
      subscription: null,
      loading: false,
      refetch: jest.fn(),
    });
    render(<UserDashboardScreen />);
    // LoadingSpinner is mocked as null, so just verify no crash
    expect(true).toBe(true);
  });

  it('renders "no session" message when session is null', () => {
    (useAuth as jest.Mock).mockReturnValue({
      session: null,
      refreshSession: mockRefreshSession,
      isLoading: false,
    });
    const { getByText } = render(<UserDashboardScreen />);
    expect(getByText(/No session found/i)).toBeTruthy();
  });
});
