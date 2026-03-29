import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MyListingsScreen from '../../screens/listing/MyListingsScreen';
import { useAuth } from '../../hooks/useAuth';
import { getMyListings, getListingSummary, deleteListing } from '../../services/listing';

jest.mock('../../hooks/useAuth');
jest.mock('../../services/listing');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    // Trigger once on mount to simulate screen focus without re-render loops.
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, []);
  },
}));

jest.mock('../../components/organisms/BottomNavBar', () => {
  return function MockBottomNavBar() {
    return null;
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetMyListings = getMyListings as jest.MockedFunction<typeof getMyListings>;
const mockGetListingSummary = getListingSummary as jest.MockedFunction<typeof getListingSummary>;

const mockNavigation = {
  navigate: jest.fn(),
};

describe('MyListingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'seller-1' } as any,
      session: {
        user: { id: 'seller-1' },
      } as any,
      loading: false,
      signOut: jest.fn(),
    });

    mockGetListingSummary.mockResolvedValue({
      total_active: 1,
      total_sold: 0,
      total_earnings_dollars: 0,
    });

    (deleteListing as jest.Mock).mockResolvedValue(undefined);
  });

  it('opens ListingSafetyReview when seller taps a rejected listing card', async () => {
    mockGetMyListings.mockResolvedValue([
      {
        id: 'listing-rejected-1',
        seller_id: 'seller-1',
        title: 'Rejected stroller',
        description: 'Flagged and rejected item',
        price: 55,
        category_id: null,
        condition: 'good',
        status: 'rejected',
        accepts_swap_points: false,
        seller_subscription_status_at_creation: null,
        flagged_at: '2026-03-29T10:00:00Z',
        rejected_at: '2026-03-29T11:00:00Z',
        rejection_reason: 'Safety concern',
        appeal_count: 1,
        created_at: '2026-03-29T09:00:00Z',
        updated_at: '2026-03-29T11:00:00Z',
        sold_at: null,
        images: [],
      } as any,
    ]);

    const { getByLabelText } = render(
      <MyListingsScreen navigation={mockNavigation as any} />
    );

    await waitFor(() => {
      expect(mockGetMyListings).toHaveBeenCalledWith('seller-1');
    });

    const cardButton = getByLabelText('Open details for Rejected stroller');
    fireEvent.press(cardButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ListingSafetyReview', {
      listing_id: 'listing-rejected-1',
    });
  });
});
