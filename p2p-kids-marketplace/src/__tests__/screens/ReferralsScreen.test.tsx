// File: p2p-kids-marketplace/src/__tests__/screens/ReferralsScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Clipboard, Share } from 'react-native';
import { ReferralsScreen } from '@/screens/referrals/ReferralsScreen';
import { ReferralCodeServiceV2, type ReferralStats, type Referral } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';
import { useAuth } from '@/hooks/useAuth';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('@/services/referralCodeV2');
jest.mock('@/services/referralRewards');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn(),
}));
jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({
  setString: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetReferralCode = ReferralCodeServiceV2.getReferralCode as jest.Mock;
const mockGetReferralStats = ReferralCodeServiceV2.getReferralStats as jest.Mock;
const mockGetReferralHistory = ReferralCodeServiceV2.getReferralHistory as jest.Mock;
const mockGetReferralLink = ReferralCodeServiceV2.getReferralLink as jest.Mock;
const mockGetConfiguredRewardAmounts = ReferralRewardsService.getConfiguredRewardAmounts as jest.Mock;

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
      expect(getByTestId('hero-card')).toBeTruthy();
      expect(getByTestId('hero-title')).toBeTruthy();
      expect(getByText('Refer Friends, Earn SP')).toBeTruthy();
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

      expect(Clipboard.setString).toHaveBeenCalledWith('TEST1234');
      expect(Alert.alert).toHaveBeenCalledWith('Copied!', 'Referral code copied to clipboard');
    });
  });

  it('INTERACTION: Share button - should invoke Share API with correct message', async () => {
    const { getByTestId } = render(<ReferralsScreen />);

    await waitFor(() => {
      const shareBtn = getByTestId('share-btn');
      fireEvent.press(shareBtn);

      expect(mockGetReferralLink).toHaveBeenCalledWith('TEST1234');
      expect(Share.share).toHaveBeenCalledWith({
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

      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining('10 SP for trade'),
        title: 'Join Kids Club+',
      });
    });
  });

  it('INTERACTION: Share button - should handle share error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (Share.share as jest.Mock).mockRejectedValue(new Error('Share failed'));

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
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load referral data');
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
});
