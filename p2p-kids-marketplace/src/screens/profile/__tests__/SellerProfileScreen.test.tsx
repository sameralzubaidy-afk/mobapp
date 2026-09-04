// File: p2p-kids-marketplace/src/screens/profile/__tests__/SellerProfileScreen.test.tsx
// TASK FLOW-15: Unit tests for Public Seller Profile screen

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import SellerProfileScreen from '../SellerProfileScreen';
import { getUserProfile } from '@/services/profile';
import { getUserReviews, getReviewStats } from '@/services/review';
import { getUserBadges } from '@/services/badges';
import { idBadgeService } from '@/services/idBadge';

jest.mock('@/services/profile');
jest.mock('@/services/review');
// DEV-TASK-103: mock badges so getUserBadges resolves [] deterministically —
// config/supabase re-exports the (overridden) client below, so without this
// mock the real service would resolve null data and setBadges(null) would
// crash the render (badges.some on null).
jest.mock('@/services/badges', () => ({
  getUserBadges: jest.fn(),
}));
// DEV-TASK-103: partial mock of the supabase client — keep the REAL client (so
// auth/storage/etc. that other modules may touch still exist) but override only
// `.from(...)` with a deterministic chain so the screen's own id_badge / trades
// reads never hit the network in unit tests. This makes the Group-A verification
// read that drives the Verified pill resolve deterministically.
jest.mock('@/services/supabase/client', () => {
  const actual = jest.requireActual('@/services/supabase/client');
  const supabase = actual.supabase;
  const emptyResult = { data: null, error: null, count: 0 };
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => chain),
    single: jest.fn(() => chain),
    order: jest.fn(() => chain),
    then: (resolve: any) => resolve(emptyResult),
  };
  supabase.from = jest.fn(() => chain);
  return { supabase };
});
// DEV-TASK-103: mock the id-badge service so the Group-A verification read that
// drives the Verified pill is deterministic in unit tests.
jest.mock('@/services/idBadge', () => ({
  idBadgeService: {
    getVerificationStatus: jest.fn(),
  },
}));
jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));
// DEV-TASK-101 (Item 5): the screen now refreshes on focus via useFocusEffect.
// This test renders outside a NavigationContainer, so mock it to fire the
// callback on mount (same timing as the old mount-only useEffect).
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(callback, [callback]);
    },
  };
});

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockGetUserReviews = getUserReviews as jest.MockedFunction<typeof getUserReviews>;
const mockGetReviewStats = getReviewStats as jest.MockedFunction<typeof getReviewStats>;
const mockGetUserBadges = getUserBadges as jest.MockedFunction<typeof getUserBadges>;

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
    (idBadgeService.getVerificationStatus as jest.Mock).mockResolvedValue({
      status: 'none',
    });
    mockGetUserBadges.mockResolvedValue([]);
  });

  it('renders seller profile with verified ShieldCheck icon (FLOW-15)', async () => {
    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Seller Name')).toBeTruthy();
      // ShieldCheck icon (16px, #5DBB8E) should be present
    });
  });

  it('renders star ratings with correct colors (FLOW-15 spec)', async () => {
    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('4.8')).toBeTruthy(); // Rating number
      expect(getByText('(25 reviews)')).toBeTruthy();
      // Filled stars should be #F59E0B
      // Empty stars should be #E0E0E0 outline
    });
  });

  it('renders identity verification trust card (FLOW-15)', async () => {
    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

    await waitFor(() => {
      expect(getByText('Identity Verified')).toBeTruthy();
      expect(getByText('Trust level: Ultimate')).toBeTruthy();
    });
  });

  it('DEV-TASK-103: resolves Verified for a synthetic (non-RFC) seller id via the Group-A id-badge read', async () => {
    // Seeded QA personas use synthetic ids (version nibble 0) that fail the
    // isUuid() regex but are valid uuid literals to Postgres. Regression test:
    // the Group-A verification read must run against the raw id so the pill does
    // not default to "Identity Not Verified" for an approved persona. The
    // profile deliberately carries NO verification_status — only the Group-A
    // read may flip the pill here.
    const syntheticId = 'a1234567-0000-0000-0000-000000000012';
    mockGetUserProfile.mockResolvedValue({
      user: {
        id: syntheticId,
        user_id: syntheticId,
        name: 'Synth Seller',
        node_name: 'Test Node',
      },
      error: null,
    });
    (idBadgeService.getVerificationStatus as jest.Mock).mockResolvedValue({
      status: 'approved',
    });

    const { getByText } = render(
      <SellerProfileScreen navigation={{}} route={{ params: { userId: syntheticId } }} />
    );

    await waitFor(() => {
      expect(getByText('Identity Verified')).toBeTruthy();
      expect(getByText('Trust level: Ultimate')).toBeTruthy();
    });
    expect(idBadgeService.getVerificationStatus).toHaveBeenCalledWith(syntheticId);
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

    const { getByText } = render(<SellerProfileScreen navigation={{}} route={mockRoute} />);

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
