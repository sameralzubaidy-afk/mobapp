import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BrowseItemsScreen from '../BrowseItemsScreen';
import { supabase } from '@/config/supabase';
import { searchListings } from '@/services/discovery';
import { getItems, getItemsWithinRadius } from '@/services/items';
import { useUserStore } from '@/stores/userStore';

// Mock the dependencies using the same aliases as the component
jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockImplementation((callback) => callback({ data: [], error: null })),
    }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock('@/services/discovery', () => ({
  searchListings: jest.fn().mockResolvedValue([]),
  searchListingsByCategoryAndQuery: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/items', () => ({
  getItems: jest.fn().mockResolvedValue([]),
  getItemsWithinRadius: jest.fn().mockResolvedValue([]),
  getCategories: jest.fn().mockResolvedValue([{ id: '1', name: 'Toys', icon: 'toy' }]),
}));

jest.mock('@/stores/userStore', () => ({
  useUserStore: jest.fn().mockReturnValue({
    user: { id: 'test-user', node_id: 'test-node' },
    userProfile: { id: 'test-user', node_id: 'test-node' },
  }),
}));

jest.mock('@/services/location', () => ({
  calculateDistanceBetweenNodes: jest.fn().mockResolvedValue(0),
  getUserPreferredRadius: jest.fn().mockResolvedValue(10),
  saveUserPreferredRadius: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
}));

// Mock navigation hooks directly
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

const mockItems = [
  {
    id: '1',
    title: 'Toy Car',
    description: 'A small red toy car',
    price: 10,
    image_url: 'https://example.com/image.jpg',
    category_id: 'Toys',
    condition: 'Good',
    status: 'active',
    accepts_swap_points: true,
    created_at: new Date().toISOString(),
    seller_id: 'seller1',
    node_id: 'node1',
  },
];

describe('BrowseItemsScreen Search & Filter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (getItems as jest.Mock).mockResolvedValue(mockItems);
    (getItemsWithinRadius as jest.Mock).mockResolvedValue(mockItems);
    (searchListings as jest.Mock).mockResolvedValue(mockItems);
    (global as any).__DEV__ = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly and loads initial items', async () => {
    const { getByPlaceholderText, queryByTestId, queryByText } = render(
      <BrowseItemsScreen />
    );

    // Run pending timers to allow initial load effects to complete
    await act(async () => {
      jest.runAllTimers();
    });

    // Item should be in the DOM after async operations complete
    expect(queryByText('Toy Car')).toBeTruthy();
    expect(queryByTestId('loading-indicator')).toBeNull();
    expect(getByPlaceholderText('Search items...')).toBeTruthy();
  });

  it('performs search when query is entered (debounced)', async () => {
    jest.useFakeTimers();
    const { getByPlaceholderText, queryByTestId } = render(
      <BrowseItemsScreen />
    );

    // Wait for initial load
    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    const input = getByPlaceholderText('Search items...');
    
    fireEvent.changeText(input, 'toy');

    // Fast-forward time for debounce (1000ms in BrowseItemsScreen)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(searchListings).toHaveBeenCalledWith('toy', expect.objectContaining({
        spEligibleOnly: false,
      }));
    });
    jest.useRealTimers();
  });

  it('toggles SP-eligible filter and re-runs search', async () => {
    jest.useFakeTimers();
    const { getByPlaceholderText, getByTestId, queryByTestId } = render(
      <BrowseItemsScreen />
    );

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    const input = getByPlaceholderText('Search items...');
    
    // 1. Enter search query
    fireEvent.changeText(input, 'toy');
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(searchListings).toHaveBeenCalled();
    });

    // 2. Toggle SP filter (Switch)
    const spSwitch = getByTestId('sp-eligible-switch');
    
    fireEvent(spSwitch, 'onValueChange', true);

    // Re-run search happens in useEffect when spEligibleOnly changes
    await waitFor(() => {
      expect(searchListings).toHaveBeenCalledWith('toy', expect.objectContaining({
        spEligibleOnly: true,
      }));
    });
    jest.useRealTimers();
  });
});
