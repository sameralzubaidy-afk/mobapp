// File: p2p-kids-marketplace/src/__tests__/screens/ReferralsScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ReferralsScreen } from '@/screens/referrals/ReferralsScreen';
import { ReferralCodeServiceV2, type ReferralStats, type Referral } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';
import { useAuth } from '@/hooks/useAuth';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('@/services/referralCodeV2');
jest.mock('@/services/referralRewards');
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetReferralCode = ReferralCodeServiceV2.getReferralCode as jest.Mock;
const mockGetReferralStats = ReferralCodeServiceV2.getReferralStats as jest.Mock;
const mockGetReferralHistory = ReferralCodeServiceV2.getReferralHistory as jest.Mock;
const mockGetReferralLink = ReferralCodeServiceV2.getReferralLink as jest.Mock;
const mockGetConfiguredRewardAmounts = ReferralRewardsService.getConfiguredRewardAmounts as jest.Mock;
const mockUseNavigation = require('@react-navigation/native').useNavigation as jest.Mock;
const mockUseFocusEffect = require('@react-navigation/native').useFocusEffect as jest.Mock;
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const mockShare = jest.spyOn(Share, 'share');
const mockClipboardSetString = Clipboard.setStringAsync as jest.Mock;
const mockGoBack = jest.fn();
let focusEffectInvoked = false;

describe('ReferralsScreen', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockReferralCode = 'TEST1234';
  const mockStats: ReferralStats = {
    total_referrals: 5,
    pending_referrals: 2,
    completed_referrals: 3,
    total_sp_earned: 75,
    trial_extensions_used: 1,
  };
  const mockHistory: Referral[] = [
    {
      id: 'ref-1',
      referrer_id: 'test-user-id',
      referred_user_id: 'user-1',
      referred_user_name: 'John Doe',
      status: 'completed',
      created_at: '2026-05-01T10:00:00Z',
      completed_at: '2026-05-02T10:00:00Z',
      code: 'TEST1234',
    },
    {
      id: 'ref-2',
      referrer_id: 'test-user-id',
      referred_user_id: 'user-2',
      referred_user_name: 'Jane Smith',
      status: 'pending',
      created_at: '2026-05-10T10:00:00Z',
      completed_at: null,
      code: 'TEST1234',
    },
  ];
  const mockRewardsConfig = {
    referrer_sp: 25,
    referee_sp: 10,
    referrer_listing_sp: 25,
    referee_listing_sp: 10,
    program_enabled: true,
    first_trade_enabled: true,
    first_listing_enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    focusEffectInvoked = false;
    mockUseNavigation.mockReturnValue({ goBack: mockGoBack });
    mockUseFocusEffect.mockImplementation((effect: () => void | (() => void)) => {
      if (!focusEffectInvoked) {
        focusEffectInvoked = true;
        effect();
      }
    });
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      logout: jest.fn(),
      updateUserContext: jest.fn(),
    } as any);
    mockGetReferralCode.mockResolvedValue(mockReferralCode);
    mockGetReferralStats.mockResolvedValue(mockStats);
    mockGetReferralHistory.mockResolvedValue(mockHistory);
    mockGetConfiguredRewardAmounts.mockResolvedValue(mockRewardsConfig);
    mockGetReferralLink.mockReturnValue('https://app.kidsclub.com/signup?ref=TEST1234');
    mockShare.mockResolvedValue({ action: 'sharedAction' } as any);
  });

  // STATE MATRIX RENDER TESTS

  it('STATE: Loading - should show loading indicator', () => {
    mockGetReferralCode.mockImplementation(() => new Promise(() => {})); // Never resolves
    const { getByTestId } = render(<ReferralsScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('STATE: Data loaded with referrals - should display all components correctly', async () => {
    const { getByTestId, getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('back-btn')).toBeTruthy();
      expect(getByText('Refer & Earn')).toBeTruthy();
      expect(getByTestId('hero-card')).toBeTruthy();
      expect(getByTestId('hero-title')).toBeTruthy();
      expect(getByText('Refer Friends, Earn SP')).toBeTruthy();
      expect(getByTestId('active-programs-card')).toBeTruthy();
      expect(getByTestId('trade-bonus-row')).toBeTruthy();
      expect(getByTestId('listing-bonus-row')).toBeTruthy();
      expect(getByText('First Trade Bonus')).toBeTruthy();
      expect(getByText('First Listing Bonus')).toBeTruthy();
      expect(getByTestId('sp-earned-strip')).toBeTruthy();
      expect(getByTestId('sp-earned-text')).toBeTruthy();
      expect(getByText(/You've earned/)).toBeTruthy();
      expect(getByText('75')).toBeTruthy(); // Total SP earned
      expect(getByTestId('code-container')).toBeTruthy();
      expect(getByTestId('referral-code-text')).toBeTruthy();
      expect(getByText('TEST1234')).toBeTruthy();
      expect(getByTestId('copy-btn')).toBeTruthy();
      expect(getByTestId('share-btn')).toBeTruthy();
      expect(getByTestId('history-title')).toBeTruthy();
      expect(getByTestId('history-item-ref-1')).toBeTruthy();
      expect(getByTestId('history-item-ref-2')).toBeTruthy();
    });
  });

  it('STATE: Empty referral history - should show empty state', async () => {
    mockGetReferralHistory.mockResolvedValue([]);

    const { getByTestId, getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('empty-state')).toBeTruthy();
      expect(getByText('No referrals yet — share your code!')).toBeTruthy();
    });
  });

  it('STATE: No user - should not load data', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: jest.fn(),
      updateUserContext: jest.fn(),
    } as any);

    render(<ReferralsScreen />);

    expect(mockGetReferralCode).not.toHaveBeenCalled();
    expect(mockGetReferralStats).not.toHaveBeenCalled();
    expect(mockGetReferralHistory).not.toHaveBeenCalled();
  });

  // VISUAL DESIGN TESTS

  it('DESIGN: Hero card - should have correct styling', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const heroCard = getByTestId('hero-card');
      expect(heroCard.props.style).toMatchObject({
        backgroundColor: '#5DBB8E',
        borderRadius: 16,
      });
    });
  });

  it('DESIGN: Code container - should have 8px border width', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const codeContainer = getByTestId('code-container');
      expect(codeContainer.props.style).toMatchObject({
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 8,
        borderColor: '#E0E0E0',
      });
    });
  });

  it('DESIGN: SP earned strip - should have correct background and text', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const spStrip = getByTestId('sp-earned-strip');
      expect(spStrip.props.style).toMatchObject({
        backgroundColor: '#FEF3C7',
      });
    });
  });

  it('DESIGN: Referral history - completed item should show CheckCircle icon', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('check-icon-ref-1')).toBeTruthy();
      expect(getByTestId('history-reward-ref-1')).toBeTruthy();
    });
  });

  it('DESIGN: Referral history - pending item should NOT show CheckCircle icon', async () => {
    const { queryByTestId, getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(queryByTestId('check-icon-ref-2')).toBeNull();
      expect(getByTestId('history-reward-ref-2')).toBeTruthy();
    });
  });

  // INTERACTION TESTS

  it('INTERACTION: Copy button - should copy code to clipboard and show alert', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const copyBtn = getByTestId('copy-btn');
      fireEvent.press(copyBtn);

      expect(mockClipboardSetString).toHaveBeenCalledWith('TEST1234');
      expect(mockAlert).toHaveBeenCalledWith('Copied!', 'Referral code copied to clipboard');
    });
  });

  it('INTERACTION: Share button - should invoke Share API with correct message', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const shareBtn = getByTestId('share-btn');
      fireEvent.press(shareBtn);

      expect(mockGetReferralLink).toHaveBeenCalledWith('TEST1234');
      expect(mockShare).toHaveBeenCalledWith({
        message: expect.stringContaining('Join Kids Club+'),
        title: 'Join Kids Club+',
      });
    });
  });

  it('INTERACTION: Share button - should include reward details if program enabled', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const shareBtn = getByTestId('share-btn');
      fireEvent.press(shareBtn);

      expect(mockShare).toHaveBeenCalledWith({
        message: expect.stringContaining('10 SP for trade'),
        title: 'Join Kids Club+',
      });
    });
  });

  it('INTERACTION: Share button - should handle share error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockShare.mockRejectedValue(new Error('Share failed'));

    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const shareBtn = getByTestId('share-btn');
      fireEvent.press(shareBtn);
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to share:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  // ERROR HANDLING TESTS

  it('ERROR: Failed to load referral data - should show error alert', async () => {
    mockGetReferralCode.mockRejectedValue(new Error('Network error'));

    render(<ReferralsScreen />);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to load referral data');
    });
  });

  it('DATA: History item - should format referral ID if no name provided', async () => {
    const historyNoName: Referral[] = [
      {
        id: 'ref-3',
        referrer_id: 'test-user-id',
        referred_user_id: '12345678-1234-1234-1234-123456789012',
        referred_user_name: null,
        status: 'completed',
        created_at: '2026-05-01T10:00:00Z',
        completed_at: '2026-05-02T10:00:00Z',
        code: 'TEST1234',
      },
    ];
    mockGetReferralHistory.mockResolvedValue(historyNoName);

    const { getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByText('User #12345678')).toBeTruthy();
    });
  });

  it('DATA: History item - should format identifier-like name as User #', async () => {
    const historyWithIdLikeName: Referral[] = [
      {
        id: 'ref-4',
        referrer_id: 'test-user-id',
        referred_user_id: '7717c60b-1234-1234-1234-123456789012',
        referred_user_name: '7717c60b',
        status: 'pending',
        created_at: '2026-05-01T10:00:00Z',
        completed_at: null,
        code: 'TEST1234',
      },
    ];
    mockGetReferralHistory.mockResolvedValue(historyWithIdLikeName);

    const { getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByText('User #7717c60b')).toBeTruthy();
    });
  });

  it('DATA: SP earned - should display correct total from stats', async () => {
    const customStats: ReferralStats = {
      ...mockStats,
      total_sp_earned: 150,
    };
    mockGetReferralStats.mockResolvedValue(customStats);

    const { getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByText('150')).toBeTruthy();
    });
  });

  // ACTIVE PROGRAMS TESTS

  it('PROGRAMS: Both programs active - should show both bonus rows', async () => {
    const { getByTestId, getByText } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('active-programs-card')).toBeTruthy();
      expect(getByTestId('trade-bonus-row')).toBeTruthy();
      expect(getByTestId('listing-bonus-row')).toBeTruthy();
      expect(getByText('First Trade Bonus')).toBeTruthy();
      expect(getByText('First Listing Bonus')).toBeTruthy();
      expect(getByText('+10 SP when they complete their first trade')).toBeTruthy();
      expect(getByText('+10 SP when their first listing is approved')).toBeTruthy();
    });
  });

  it('PROGRAMS: Only trade bonus active - should show only trade row', async () => {
    const configWithOnlyTrade = {
      ...mockRewardsConfig,
      first_listing_enabled: false,
    };
    mockGetConfiguredRewardAmounts.mockResolvedValue(configWithOnlyTrade);

    const { getByTestId, getByText, queryByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('active-programs-card')).toBeTruthy();
      expect(getByTestId('trade-bonus-row')).toBeTruthy();
      expect(queryByTestId('listing-bonus-row')).toBeNull();
      expect(getByText('First Trade Bonus')).toBeTruthy();
    });
  });

  it('PROGRAMS: Only listing bonus active - should show only listing row', async () => {
    const configWithOnlyListing = {
      ...mockRewardsConfig,
      first_trade_enabled: false,
    };
    mockGetConfiguredRewardAmounts.mockResolvedValue(configWithOnlyListing);

    const { getByTestId, getByText, queryByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('active-programs-card')).toBeTruthy();
      expect(queryByTestId('trade-bonus-row')).toBeNull();
      expect(getByTestId('listing-bonus-row')).toBeTruthy();
      expect(getByText('First Listing Bonus')).toBeTruthy();
    });
  });

  it('PROGRAMS: Global program paused - should show configured bonus rows with paused banner', async () => {
    const configDisabled = {
      ...mockRewardsConfig,
      program_enabled: false,
    };
    mockGetConfiguredRewardAmounts.mockResolvedValue(configDisabled);

    const { getByTestId, getByText, queryByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(queryByTestId('no-programs-card')).toBeNull();
      expect(getByTestId('active-programs-card')).toBeTruthy();
      expect(getByTestId('trade-bonus-row')).toBeTruthy();
      expect(getByTestId('listing-bonus-row')).toBeTruthy();
      expect(getByTestId('program-paused-banner')).toBeTruthy();
      expect(getByText('Referral program is paused globally right now. Rewards shown below are configured but currently not being awarded.')).toBeTruthy();
    });
  });

  it('PROGRAMS: All toggles off - should show warning message', async () => {
    const configAllOff = {
      ...mockRewardsConfig,
      first_trade_enabled: false,
      first_listing_enabled: false,
    };
    mockGetConfiguredRewardAmounts.mockResolvedValue(configAllOff);

    const { getByTestId, queryByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      expect(getByTestId('no-programs-card')).toBeTruthy();
      expect(queryByTestId('active-programs-card')).toBeNull();
    });
  });

  it('PROGRAMS: Share button disabled when global program is paused', async () => {
    const configDisabled = {
      ...mockRewardsConfig,
      program_enabled: false,
    };
    mockGetConfiguredRewardAmounts.mockResolvedValue(configDisabled);

    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const shareBtn = getByTestId('share-btn');
      expect(shareBtn.props.accessibilityState?.disabled).toBe(true);
    });
  });

  // NAVIGATION TESTS

  it('NAVIGATION: Back button - should navigate back', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const backBtn = getByTestId('back-btn');
      fireEvent.press(backBtn);
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
