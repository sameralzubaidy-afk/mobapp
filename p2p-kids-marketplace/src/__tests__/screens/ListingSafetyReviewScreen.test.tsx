import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ListingSafetyReviewScreen from '../../screens/listing/ListingSafetyReviewScreen';
import { useAuth } from '../../hooks/useAuth';
import { getListingById } from '../../services/listing';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../../hooks/useAuth');
jest.mock('../../services/listing');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {
      listing_id: 'listing-1',
    },
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetListingById = getListingById as jest.MockedFunction<typeof getListingById>;

describe('ListingSafetyReviewScreen', () => {
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
  });

  it('renders rejection reason and appeal button for rejected listing', async () => {
    mockGetListingById.mockResolvedValue({
      id: 'listing-1',
      seller_id: 'seller-1',
      title: 'Rejected toy',
      description: 'desc',
      price: 55,
      category_id: null,
      condition: 'good',
      status: 'rejected',
      accepts_swap_points: false,
      seller_subscription_status_at_creation: null,
      flagged_at: '2026-03-29T10:00:00Z',
      rejected_at: '2026-03-29T12:00:00Z',
      rejection_reason: 'Safety issue',
      appeal_count: 1,
      created_at: '2026-03-29T09:00:00Z',
      updated_at: '2026-03-29T12:00:00Z',
      sold_at: null,
      images: [],
    } as any);

    const { getByText } = render(<ListingSafetyReviewScreen />);

    await waitFor(() => {
      expect(getByText('Listing Safety Review')).toBeTruthy();
    });

    expect(getByText('Rejection Reason')).toBeTruthy();
    expect(getByText('Safety issue')).toBeTruthy();
    expect(getByText('Appeal Reason for Admin Review')).toBeTruthy();
    expect(getByText('0/500 characters')).toBeTruthy();
    expect(getByText('Appeal Decision')).toBeTruthy();
  });

  it('renders under-review message and no appeal button for flagged listing', async () => {
    mockGetListingById.mockResolvedValue({
      id: 'listing-1',
      seller_id: 'seller-1',
      title: 'Flagged toy',
      description: 'desc',
      price: 55,
      category_id: null,
      condition: 'good',
      status: 'flagged',
      accepts_swap_points: false,
      seller_subscription_status_at_creation: null,
      flagged_at: '2026-03-29T10:00:00Z',
      rejected_at: null,
      rejection_reason: null,
      appeal_count: 1,
      created_at: '2026-03-29T09:00:00Z',
      updated_at: '2026-03-29T12:00:00Z',
      sold_at: null,
      images: [],
    } as any);

    const { getByText, queryByText } = render(<ListingSafetyReviewScreen />);

    await waitFor(() => {
      expect(getByText('Listing Safety Review')).toBeTruthy();
    });

    expect(getByText('Your listing is currently under admin review. You can edit details if needed while waiting.')).toBeTruthy();
    expect(queryByText('Appeal Decision')).toBeNull();
  });
});
