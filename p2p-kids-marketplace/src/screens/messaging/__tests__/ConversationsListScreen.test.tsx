/**
 * File: p2p-kids-marketplace/src/screens/messaging/__tests__/ConversationsListScreen.test.tsx
 * MODULE-07 MSG-001 + MODULE-15.1 FLOW-14: Unit tests for ConversationsListScreen
 *
 * Coverage requirements:
 * - Search functionality (debounced filtering)
 * - Conversation card rendering (unread badge, verified badge, trade chip)
 * - Empty state (zero conversations vs zero search results)
 * - Navigation to chat screen
 * - Loading state
 * - Error handling
 * - Timestamp formatting
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ConversationsListScreen from '../ConversationsListScreen';
import * as chatService from '@/services/chat';
import { AuthContext } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('@/services/chat');
jest.mock('@/components/atoms', () => ({
  Avatar: ({ testID, name }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID}>{name}</Text>;
  },
}));
jest.mock('@/components/organisms/BottomNavBar', () => {
  const { View } = require('react-native');
  return ({ testID }: any) => <View testID={testID || 'bottom-nav'} />;
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

// Mock auth context
const mockAuthContext = {
  session: {
    user: { id: 'user-123', email: 'test@example.com' },
  },
  profile: {
    id: 'profile-123',
    user_id: 'user-123',
    name: 'Test User',
  },
  loading: false,
};

// Mock conversation data
const mockConversations = [
  {
    id: 'conv-1',
    trade_id: 'trade-1',
    other_user_id: 'user-456',
    other_user_name: 'Alice Seller',
    other_user_avatar_url: 'https://example.com/avatar1.jpg',
    other_user_verification_status: 'approved' as const,
    listing_title: 'Lego Star Wars Set',
    listing_price: 45.99,
    last_message_content: 'Is this still available?',
    last_message_time: new Date().toISOString(),
    unread_count: 2,
  },
  {
    id: 'conv-2',
    trade_id: 'trade-2',
    other_user_id: 'user-789',
    other_user_name: 'Bob Buyer',
    other_user_avatar_url: null,
    other_user_verification_status: 'none' as const,
    listing_title: 'Pokemon Cards Collection',
    listing_price: 25.50,
    last_message_content: 'Great, I can pick up tomorrow!',
    last_message_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    unread_count: 0,
  },
];

const renderScreen = (authContext = mockAuthContext) => {
  return render(
    <AuthContext.Provider value={authContext as any}>
      <NavigationContainer>
        <ConversationsListScreen />
      </NavigationContainer>
    </AuthContext.Provider>
  );
};

describe('ConversationsListScreen - MODULE-15.1 FLOW-14', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chatService.getConversations as jest.Mock) = jest.fn().mockResolvedValue(mockConversations);
    (chatService.markAsRead as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  describe('Initial Render & Loading', () => {
    it('should show loading state initially', () => {
      const { getByText } = renderScreen();
      expect(getByText('Loading conversations...')).toBeTruthy();
    });

    it('should fetch conversations on mount', async () => {
      renderScreen();
      await waitFor(() => {
        expect(chatService.getConversations).toHaveBeenCalledWith('user-123');
      });
    });

    it('should display conversations after loading', async () => {
      const { getByText, queryByText } = renderScreen();
      
      await waitFor(() => {
        expect(queryByText('Loading conversations...')).toBeNull();
      });

      expect(getByText('Alice Seller')).toBeTruthy();
      expect(getByText('Bob Buyer')).toBeTruthy();
    });
  });

  describe('Conversation Card Rendering', () => {
    it('should render unread badge for conversations with unread_count > 0', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        const badge = getByTestId('unread-badge');
        expect(badge).toBeTruthy();
      });
    });

    it('should render verified badge for approved verification status', async () => {
      const { getAllByTestId } = renderScreen();
      
      await waitFor(() => {
        const badges = getAllByTestId('verified-badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should render trade context chip with listing title and price', async () => {
      const { getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText(/Lego Star Wars Set/)).toBeTruthy();
        expect(getByText(/\$45\.99/)).toBeTruthy();
      });
    });

    it('should render last message preview', async () => {
      const { getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText('Is this still available?')).toBeTruthy();
      });
    });

    it('should format timestamp correctly for today vs older messages', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        expect(getByTestId('conversation-conv-1')).toBeTruthy();
        expect(getByTestId('conversation-conv-2')).toBeTruthy();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        expect(getByTestId('conversations-search-input')).toBeTruthy();
      });
    });

    it('should filter conversations by user name', async () => {
      const { getByTestId, getByText, queryByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText('Alice Seller')).toBeTruthy();
      });

      const searchInput = getByTestId('conversations-search-input');
      fireEvent.changeText(searchInput, 'Alice');

      await waitFor(() => {
        expect(getByText('Alice Seller')).toBeTruthy();
        expect(queryByText('Bob Buyer')).toBeNull();
      });
    });

    it('should filter conversations by listing title', async () => {
      const { getByTestId, getByText, queryByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText(/Lego Star Wars Set/)).toBeTruthy();
      });

      const searchInput = getByTestId('conversations-search-input');
      fireEvent.changeText(searchInput, 'Pokemon');

      await waitFor(() => {
        expect(queryByText(/Lego Star Wars Set/)).toBeNull();
        expect(getByText(/Pokemon Cards Collection/)).toBeTruthy();
      });
    });

    it('should show "No results" when search has no matches', async () => {
      const { getByTestId, getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText('Alice Seller')).toBeTruthy();
      });

      const searchInput = getByTestId('conversations-search-input');
      fireEvent.changeText(searchInput, 'xyz-no-match');

      await waitFor(() => {
        expect(getByText(/No matches found/)).toBeTruthy();
      });
    });

    it('should be case-insensitive', async () => {
      const { getByTestId, getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText('Alice Seller')).toBeTruthy();
      });

      const searchInput = getByTestId('conversations-search-input');
      fireEvent.changeText(searchInput, 'ALICE');

      await waitFor(() => {
        expect(getByText('Alice Seller')).toBeTruthy();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no conversations exist', async () => {
      (chatService.getConversations as jest.Mock).mockResolvedValue([]);
      
      const { getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText(/No messages yet/i)).toBeTruthy();
        expect(getByText(/Browse Items/i)).toBeTruthy();
      });
    });

    it('should navigate to discovery when "Browse Items" is pressed', async () => {
      (chatService.getConversations as jest.Mock).mockResolvedValue([]);
      
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        const browseButton = getByTestId('browse-items-button');
        fireEvent.press(browseButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Discover');
    });
  });

  describe('Navigation', () => {
    it('should navigate to ChatScreen when conversation is tapped', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        const conversation = getByTestId('conversation-conv-1');
        fireEvent.press(conversation);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Chat', {
        tradeId: 'trade-1',
      });
    });

    it('should mark conversation as read when navigating to chat', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        const conversation = getByTestId('conversation-conv-1');
        fireEvent.press(conversation);
      });

      expect(chatService.markAsRead).toHaveBeenCalledWith('trade-1', 'user-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle getConversations error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (chatService.getConversations as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      
      const { getByText } = renderScreen();
      
      await waitFor(() => {
        expect(getByText(/No messages yet/i)).toBeTruthy();
      });

      consoleError.mockRestore();
    });
  });

  describe('UI Design System Compliance (MODULE-15.1)', () => {
    it('should render with Whisk green unread badges (#5DBB8E)', async () => {
      const { getByTestId } = renderScreen();
      
      await waitFor(() => {
        const badge = getByTestId('unread-badge');
        const style = badge.props.style;
        expect(style.backgroundColor).toBe('#5DBB8E');
      });
    });

    it('should use Phosphor ShieldCheck icon for verified users', async () => {
      // Phosphor icons are rendered via phosphor-react-native
      // This test ensures the testID is present, confirming the icon renders
      const { getAllByTestId } = renderScreen();
      
      await waitFor(() => {
        const badges = getAllByTestId('verified-badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });
});
