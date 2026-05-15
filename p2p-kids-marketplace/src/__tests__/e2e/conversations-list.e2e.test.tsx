// @jest-environment jsdom

/**
 * E2E tests for ConversationsListScreen
 * MODULE-07 MSG-002: Conversation List E2E Tests
 */

// Mock Expo Vector Icons BEFORE importing the screen (prevents ESM parse issues)
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ConversationsListScreen from '../../screens/messaging/ConversationsListScreen';
import { AuthContext } from '@/contexts/AuthContext';
import * as chatService from '@/services/chat';

jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: 'MockIcon',
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    // Defer focus effect until after initial render completes.
    // Calling it synchronously during render can hit TDZ for functions declared later in the component.
    useFocusEffect: (callback: any) => {
      Promise.resolve().then(() => callback());
    },
  };
});

jest.mock('@/services/chat', () => ({
  __esModule: true,
  getConversations: jest.fn(),
  markAsRead: jest.fn(),
}));

jest.mock('@/components/atoms/Avatar', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockAvatar() {
    return React.createElement(Text, null, 'Avatar');
  };
});

jest.mock('@/components/organisms/BottomNavBar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockBottomNavBar() {
    return React.createElement(View, { testID: 'mock-bottom-nav' });
  };
});

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
    (chatService.getConversations as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { getByText } = renderScreen();
    expect(getByText('Loading conversations...')).toBeTruthy();
  });

  it('should display empty state when no conversations exist', async () => {
    (chatService.getConversations as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderScreen();

    expect(await waitFor(() => getByText('No messages yet'))).toBeTruthy();
    expect(getByText('Start a trade and chat with other users!')).toBeTruthy();
    expect(getByText('Browse Items')).toBeTruthy();
  });

  it('should display conversations list with last message preview', async () => {
    const mockConversations = [
      {
        id: 'conv-001',
        trade_id: 'trade-001',
        other_user_id: 'user-456',
        other_user_name: 'John Doe',
        listing_title: 'Toy Car',
        listing_price: 10,
        last_message_content: 'Is this still available?',
        last_message_time: new Date().toISOString(),
        unread_count: 1,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    expect(await waitFor(() => getByText('John Doe'))).toBeTruthy();
    expect(getByText('Is this still available?')).toBeTruthy();
  });

  it('should navigate to chat screen on conversation tap', async () => {
    const mockConversations = [
      {
        id: 'conv-001',
        trade_id: 'trade-001',
        other_user_id: 'user-456',
        other_user_name: 'Jane Smith',
        listing_title: 'Puzzle',
        listing_price: 5,
        last_message_content: 'Hello!',
        last_message_time: new Date().toISOString(),
        unread_count: 0,
      },
    ];

    (chatService.getConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { getByText } = renderScreen();

    await waitFor(() => expect(getByText('Jane Smith')).toBeTruthy());
    fireEvent.press(getByText('Jane Smith'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Chat', { tradeId: 'trade-001' });
    });
  });
});
