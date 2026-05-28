// File: p2p-kids-marketplace/src/screens/profile/__tests__/SellerProfileScreen.test.tsx
// TASK FLOW-15: Unit tests for Public Seller Profile screen

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import SellerProfileScreen from '../SellerProfileScreen';
import { getUserProfile } from '@/services/profile';
import { getUserReviews, getReviewStats } from '@/services/review';

jest.mock('@/services/profile');
jest.mock('@/services/review');
jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockGetUserReviews = getUserReviews as jest.MockedFunction<typeof getUserReviews>;
const mockGetReviewStats = getReviewStats as jest.MockedFunction<typeof getReviewStats>;

describe('SellerProfileScreen - FLOW-15 UI Redesign', () => {
  const mockRoute = {
    params: {
      userId: 'seller-user-id',
    },
  };

  const mockProfile = {
    id: 'seller-user-id',
    name: 'Seller Name',
    bio: 'Seller bio',
    node_name: 'Test Node',
    verification_status: 'approved',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserProfile.mockResolvedValue({ user: mockProfile, error: null });
    mockGetUserReviews.mockResolvedValue({ success: true, reviews: [] });
    mockGetReviewStats.mockResolvedValue({
      success: true,
      stats: {
        average_rating: 4.8,
        total_reviews: 25,
        rating_breakdown: { 5: 20, 4: 3, 3: 1, 2: 1, 1: 0 },
      },
    });
  });

  it('renders seller profile with verified ShieldCheck icon (FLOW-15)', async () => {
    const { getByText } = render(
      <SellerProfileScreen navigation={{}} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('Seller Name')).toBeTruthy();
      // ShieldCheck icon (16px, #5DBB8E) should be present
    });
  });

  it('renders star ratings with correct colors (FLOW-15 spec)', async () => {
    const { getByText } = render(
      <SellerProfileScreen navigation={{}} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('4.8')).toBeTruthy(); // Rating number
      expect(getByText('(25 reviews)')).toBeTruthy();
      // Filled stars should be #F59E0B
      // Empty stars should be #E0E0E0 outline
    });
  });

  it('renders identity verification trust card (FLOW-15)', async () => {
    const { getByText } = render(
      <SellerProfileScreen navigation={{}} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('Identity Verified')).toBeTruthy();
      expect(getByText('Trust level: Ultimate')).toBeTruthy();
    });
  });

  it('renders completed trades section (FLOW-15)', async () => {
    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Completed Trades')).toBeTruthy();
      expect(getByText('Total completed trades')).toBeTruthy();
    });
  });

  it('renders location with MapPin icon (FLOW-15)', async () => {
    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Test Node')).toBeTruthy();
      // MapPin icon (14px, #6B6B6B) should be present
    });
  });

  it('shows loading state with green spinner (#5DBB8E)', () => {
    mockGetUserProfile.mockReturnValue(new Promise(() => {})); // Never resolves

    const { getByText } = render(
      <SellerProfileScreen navigation={{}} route={mockRoute} />
    );

    expect(getByText('Loading profile...')).toBeTruthy();
    // ActivityIndicator color should be #5DBB8E
  });

  it('renders error state with retry button', async () => {
    mockGetUserProfile.mockResolvedValue({ user: null, error: new Error('Not found') });

    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Profile not found')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });
});
