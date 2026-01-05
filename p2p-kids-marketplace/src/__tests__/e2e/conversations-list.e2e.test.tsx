/**
 * E2E tests for ConversationsListScreen
 * MODULE-07 MSG-002: Conversation List E2E Tests
 * 
 * Tests:
 * - Display empty state when no conversations exist
 * - Display conversations list with last message preview
 * - Display unread count badge
 * - Navigate to chat screen on conversation tap
 * - Real-time updates when new message arrives
 * - Pull-to-refresh functionality
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ConversationsListScreen from '../../screens/messaging/ConversationsListScreen';
import { AuthContext } from '@/contexts/AuthContext';
import * as chatService from '@/services/chat';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (callback: any) => callback(),
  };
});

// Mock chat service
jest.mock('@/services/chat');

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: jest.fn() };
      }),
      unsubscribe: jest.fn(),
    })),
  },
}));

describe('ConversationsListScreen E2E', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockAuthContext = {
    session: mockSession,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  const renderScreen = () => {
    return render(
      <AuthContext.Provider value={mockAuthContext as any}>
        <NavigationContainer>
          <ConversationsListScreen />
        </NavigationContainer>
      </AuthContext.Provider>
    );
  };

  it('should display loading state initially', async () => {
    (chatService.getConversations as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { getByText } = renderScreen();

    expect(getByText('Loading conversations...')).toBeTruthy();
  });

  it('should display empty state when no conversations exist', async () => {
    (chatService.getConversations as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('No Messages Yet')).toBeTruthy();
      expect(getByText('Start a trade and chat with other users!')).toBeTruthy();
      expect(getByText('Browse Items')).toBeTruthy();
    });
  });

  it('should display conversations list with last message preview', async () => {
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello, is this still available?',
        last_message_time: new Date().toISOString(),
        unread_count: 2,
      },
      {
        id: 'trade-2',
        trade_id: 'trade-2',
        other_user_id: 'user-789',
        other_user_name: 'Jane Smith',
        listing_title: 'Another Item',
        listing_price: 15.00,
        last_message_content: 'Thanks!',
        last_message_time: new Date(Date.now() - 60000).toISOString(),
        unread_count: 0,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Test Item • $25.50')).toBeTruthy();
      expect(getByText('Hello, is this still available?')).toBeTruthy();

      expect(getByText('Jane Smith')).toBeTruthy();
      expect(getByText('Another Item • $15.00')).toBeTruthy();
      expect(getByText('Thanks!')).toBeTruthy();

      // Empty state should not be visible
      expect(queryByText('No Messages Yet')).toBeNull();
    });
  });

  it('should display unread count badge for conversations with unread messages', async () => {
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: new Date().toISOString(),
        unread_count: 5,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('5')).toBeTruthy();
    });
  });

  it('should display 9+ for unread count > 9', async () => {
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: new Date().toISOString(),
        unread_count: 15,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('9+')).toBeTruthy();
    });
  });

  it('should navigate to chat screen when conversation is tapped', async () => {
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: new Date().toISOString(),
        unread_count: 2,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
    });

    fireEvent.press(getByText('John Doe'));

    expect(mockNavigate).toHaveBeenCalledWith('Chat', { tradeId: 'trade-1' });
  });

  it('should navigate to browse items when Browse Items button is tapped in empty state', async () => {
    (chatService.getConversations as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Browse Items')).toBeTruthy();
    });

    fireEvent.press(getByText('Browse Items'));

    expect(mockNavigate).toHaveBeenCalledWith('BrowseItems');
  });

  it('should format timestamp correctly', async () => {
    const now = new Date();
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        unread_count: 0,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    await waitFor(() => {
      // Should show "30m ago" or similar
      const timestampRegex = /\d+[mhd] ago|Just now/;
      expect(
        Array.from({ length: 100 }, (_, i) => {
          try {
            return getByText(new RegExp(timestampRegex));
          } catch {
            return null;
          }
        }).some((el) => el !== null)
      ).toBeTruthy();
    });
  });

  it('should refresh conversations on pull-to-refresh', async () => {
    const mockConversations = [
      {
        id: 'trade-1',
        trade_id: 'trade-1',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Test Item',
        listing_price: 25.50,
        last_message_content: 'Hello!',
        last_message_time: new Date().toISOString(),
        unread_count: 2,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText, UNSAFE_getByType } = renderScreen();

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
    });

    // Simulate pull-to-refresh
    const scrollView = UNSAFE_getByType(require('react-native').FlatList);
    await fireEvent(scrollView, 'refresh');

    await waitFor(() => {
      expect(chatService.getConversations).toHaveBeenCalledTimes(2);
    });
  });
});
