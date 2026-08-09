import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ProfileScreen from '../ProfileScreen';
import { getUserProfile } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { getReviewStats, getUserReviews } from '@/services/review';
import { getTrialStatus } from '@/services/subscriptions/trialConversion';
import { idBadgeService } from '@/services/idBadge';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import { AuthContext } from '@/contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

jest.mock('@/services/profile', () => ({
  getUserProfile: jest.fn(),
  resolveAvatarUrl: jest.fn(async () => null),
}));
jest.mock('@/services/supabase/auth', () => ({
  getCurrentUser: jest.fn(),
}));
jest.mock('@/services/review', () => ({
  getReviewStats: jest.fn(),
  getUserReviews: jest.fn(),
}));
jest.mock('@/services/subscriptions/trialConversion', () => ({
  getTrialStatus: jest.fn(),
}));
jest.mock('@/services/idBadge', () => ({
  idBadgeService: {
    getVerificationStatus: jest.fn(),
  },
}));
jest.mock('@/services/referralCodeV2', () => ({
  ReferralCodeServiceV2: {
    getReferralCode: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(),
    useFocusEffect: (cb: () => void | (() => void)) => {
      cb();
    },
  };
});

jest.mock('@/components/BadgeShowcase', () => ({
  BadgeShowcase: () => {
    const { View: MockView } = require('react-native');
    return <MockView testID="badge-showcase" />;
  },
}));
jest.mock('@/components/ReviewCard', () => ({
  ReviewCard: () => {
    const { View: MockView } = require('react-native');
    return <MockView testID="review-card" />;
  },
}));
jest.mock('@/components/StarRating', () => ({
  StarRating: () => {
    const { View: MockView } = require('react-native');
    return <MockView testID="star-rating" />;
  },
}));
jest.mock('@/components/badges/BadgeCelebrationModal', () => () => null);
jest.mock('@/components/organisms/BottomNavBar', () => () => {
  const { View: MockView } = require('react-native');
  return <MockView testID="bottom-nav" />;
});
jest.mock('@/hooks/useUserBadges', () => ({
  useUserBadges: () => ({
    newBadgeAwarded: null,
    clearNewBadge: jest.fn(),
    showCelebration: false,
    setShowCelebration: jest.fn(),
  }),
}));
jest.mock('@/components/ui', () => ({
  LoadingSpinner: ({ text }: { text?: string }) => {
    const { Text: MockText } = require('react-native');
    return <MockText>{text ?? 'Loading'}</MockText>;
  },
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockGetReviewStats = getReviewStats as jest.MockedFunction<typeof getReviewStats>;
const mockGetUserReviews = getUserReviews as jest.MockedFunction<typeof getUserReviews>;
const mockGetTrialStatus = getTrialStatus as jest.MockedFunction<typeof getTrialStatus>;
const mockGetVerificationStatus = idBadgeService.getVerificationStatus as jest.MockedFunction<
  typeof idBadgeService.getVerificationStatus
>;
const mockGetReferralCode = ReferralCodeServiceV2.getReferralCode as jest.MockedFunction<
  typeof ReferralCodeServiceV2.getReferralCode
>;
const mockUseNavigation = useNavigation as jest.Mock;

describe('ProfileScreen', () => {
  const logoutMock = jest.fn(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetCurrentUser.mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
      error: null,
    } as any);

    mockGetUserProfile.mockResolvedValue({
      user: {
        id: 'test-user-id',
        name: 'Test User',
        bio: 'Test bio',
        avatar_url: null,
        node_name: 'Test Node',
        swap_points_balance: 150,
      },
      error: null,
    } as any);

    mockGetReviewStats.mockResolvedValue({
      success: true,
      stats: {
        average_rating: 4.5,
        total_reviews: 0,
        rating_breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    } as any);

    mockGetUserReviews.mockResolvedValue({ success: true, reviews: [] } as any);
    mockGetTrialStatus.mockResolvedValue({ status: 'inactive' } as any);
    mockGetVerificationStatus.mockResolvedValue({ status: 'approved' } as any);
    mockGetReferralCode.mockResolvedValue('abc12345' as any);
  });

  const renderScreen = (navigation: any = { navigate: jest.fn(), goBack: jest.fn() }) => {
    // ProfileScreen uses useNavigation() (not the prop), so point the hook at the
    // navigation object each test asserts against.
    mockUseNavigation.mockReturnValue(navigation);
    return render(
      <AuthContext.Provider value={{ logout: logoutMock } as any}>
        <ProfileScreen navigation={navigation} />
      </AuthContext.Provider>
    );
  };

  it('shows loading state initially', () => {
    const { getByText } = renderScreen();
    expect(getByText('Loading profile...')).toBeTruthy();
  });

  it('renders profile basics after load', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Test User')).toBeTruthy();
      expect(getByText('Test Node')).toBeTruthy();
      expect(getByText('SP Balance')).toBeTruthy();
      expect(getByText('150')).toBeTruthy();
    });
  });

  it('navigates to EditProfile when edit action is pressed', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const { getByText } = renderScreen(navigation);

    await waitFor(() => {
      expect(getByText('Edit basic info')).toBeTruthy();
    });

    fireEvent.press(getByText('Edit basic info'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'EditProfile',
      expect.objectContaining({
        preloadedUser: expect.any(Object),
        preloadedProfile: expect.any(Object),
      })
    );
  });

  it('calls AuthContext logout after confirming logout prompt', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      const confirm = buttons?.find((b) => b.text === 'Logout');
      confirm?.onPress?.();
    });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Logout')).toBeTruthy();
    });

    fireEvent.press(getByText('Logout'));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });

    alertSpy.mockRestore();
  });
});
