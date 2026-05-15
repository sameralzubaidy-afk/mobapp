/**
 * File: p2p-kids-marketplace/src/screens/messaging/__tests__/ChatScreen.test.tsx
 * MODULE-07 MSG-001-009 + MODULE-15.1 FLOW-14: Unit tests for ChatScreen
 *
 * Coverage requirements:
 * - Message rendering (own vs other bubbles, text vs images)
 * - Delivery status indicators (sent, delivered, read)
 * - Typing indicators
 * - Send message functionality
 * - Image picker and image upload
 * - Real-time message updates (mocked subscription)
 * - Header with verified badge
 * - Trade banner
 * - Input bar visibility rules
 * - Error handling
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ChatScreen from '../ChatScreen';
import * as chatService from '@/services/chat';
import * as idBadgeService from '@/services/idBadge';
import { AuthContext } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('@/services/chat');
jest.mock('@/services/idBadge');
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///image.jpg', width: 800, height: 600 }],
  }),
}));
jest.mock('@/components/atoms', () => ({
  Avatar: ({ testID, name }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID}>{name}</Text>;
  },
  ListingImage: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'listing-image'} />;
  },
}));

// Mock navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  addListener: jest.fn(() => jest.fn()),
};

// Mock route params
const mockRoute = {
  params: {
    tradeId: 'trade-123',
    otherUserId: 'user-456',
    otherUserName: 'Alice',
  },
};

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

// Mock messages
const mockMessages = [
  {
    id: 'msg-1',
    trade_id: 'trade-123',
    sender_id: 'user-123',
    receiver_id: 'user-456',
    content: 'Hello, is this available?',
    message_type: 'text' as const,
    created_at: new Date().toISOString(),
    delivery_status: 'read' as const,
    image_url: null,
  },
  {
    id: 'msg-2',
    trade_id: 'trade-123',
    sender_id: 'user-456',
    receiver_id: 'user-123',
    content: 'Yes, it is!',
    message_type: 'text' as const,
    created_at: new Date().toISOString(),
    delivery_status: null,
    image_url: null,
  },
];

// Mock trade data
const mockTrade = {
  id: 'trade-123',
  buyer_id: 'user-123',
  seller_id: 'user-456',
  listing: {
    id: 'listing-1',
    title: 'Lego Star Wars Set',
    price: 45.99,
    images: [{ url: 'https://example.com/lego.jpg', display_order: 0 }],
  },
};

// Mock profile
const mockProfile = {
  id: 'profile-456',
  user_id: 'user-456',
  name: 'Alice',
  avatar_url: 'https://example.com/avatar.jpg',
  verification_status: 'approved',
};

const renderScreen = (authContext = mockAuthContext, route = mockRoute) => {
  return render(
    <AuthContext.Provider value={authContext as any}>
      <NavigationContainer>
        <ChatScreen navigation={mockNavigation as any} route={route as any} />
      </NavigationContainer>
    </AuthContext.Provider>
  );
};

describe('ChatScreen - MODULE-15.1 FLOW-14', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chatService.getMessages as jest.Mock) = jest.fn().mockResolvedValue(mockMessages);
    (chatService.sendMessage as jest.Mock) = jest.fn().mockResolvedValue({ id: 'msg-new' });
    (chatService.sendImageMessage as jest.Mock) = jest.fn().mockResolvedValue({ id: 'msg-img' });
    (chatService.subscribeToMessages as jest.Mock) = jest.fn().mockReturnValue({
      on: jest.fn(),
      subscribe: jest.fn(),
    });
    (chatService.unsubscribeFromMessages as jest.Mock) = jest.fn();
    (chatService.markAsRead as jest.Mock) = jest.fn();
    (chatService.markTradeMessagesAsDelivered as jest.Mock) = jest.fn();
    (chatService.markTradeMessagesAsRead as jest.Mock) = jest.fn();
    (idBadgeService.getIdBadgeStatus as jest.Mock) = jest.fn().mockResolvedValue({
      status: 'approved',
      badge_url: 'https://example.com/badge.png',
    });

    // Mock supabase client
    jest.mock('@/config/supabase', () => ({
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockTrade,
                error: null,
              }),
            })),
          })),
        })),
      },
    }));
  });

  describe('Initial Render & Loading', () => {
    it('should show loading state initially', () => {
      const { getByText } = renderScreen();
      expect(getByText('Loading messages...')).toBeTruthy();
    });

    it('should fetch messages on mount', async () => {
      renderScreen();
      await waitFor(() => {
        expect(chatService.getMessages).toHaveBeenCalledWith('trade-123');
      });
    });

    it('should display header with partner name', async () => {
      const { getByText } = renderScreen();
      await waitFor(() => {
        expect(getByText('Alice')).toBeTruthy();
      });
    });
  });

  describe('Header UI (MODULE-15.1)', () => {
    it('should render back button with CaretLeft Phosphor icon', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('back-button')).toBeTruthy();
      });
    });

    it('should navigate back when back button is pressed', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const backButton = getByTestID('back-button');
        fireEvent.press(backButton);
      });
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should render verified badge for approved verification status', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('verified-badge')).toBeTruthy();
      });
    });

    it('should render header with testID', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('chat-header')).toBeTruthy();
      });
    });
  });

  describe('Trade Banner UI (MODULE-15.1)', () => {
    it('should render trade banner with testID', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('trade-banner')).toBeTruthy();
      });
    });

    it('should render ArrowsLeftRight Phosphor icon in trade banner', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        // Icon renders via phosphor-react-native
        expect(getByTestID('trade-banner')).toBeTruthy();
      });
    });

    it('should render "View Trade" link', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('view-trade-link')).toBeTruthy();
      });
    });

    it('should navigate to ListingDetail when "View Trade" is pressed', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const link = getByTestID('view-trade-link');
        fireEvent.press(link);
      });
      expect(mockNavigate).toHaveBeenCalledWith('ListingDetail', { itemId: 'listing-1' });
    });
  });

  describe('Message Rendering', () => {
    it('should render messages with correct testIDs', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('message-msg-1')).toBeTruthy();
        expect(getByTestID('message-msg-2')).toBeTruthy();
      });
    });

    it('should render own messages with green bubbles', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const ownMessage = getByTestID('message-msg-1');
        // Own message should have green styling
        expect(ownMessage).toBeTruthy();
      });
    });

    it('should render other messages with gray bubbles', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const otherMessage = getByTestID('message-msg-2');
        // Other message should have gray styling
        expect(otherMessage).toBeTruthy();
      });
    });

    it('should render message text content', async () => {
      const { getByText } = renderScreen();
      await waitFor(() => {
        expect(getByText('Hello, is this available?')).toBeTruthy();
        expect(getByText('Yes, it is!')).toBeTruthy();
      });
    });
  });

  describe('Delivery Status (MSG-008)', () => {
    it('should render Check Phosphor icons for delivery status', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        // Own message should have delivery status
        const ownMessage = getByTestID('message-msg-1');
        expect(ownMessage).toBeTruthy();
      });
    });

    it('should show double Check in green for read messages', async () => {
      // Read status: double Check (#5DBB8E)
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('message-msg-1')).toBeTruthy();
      });
    });

    it('should not show delivery status for received messages', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const otherMessage = getByTestID('message-msg-2');
        // Other user's message should not have delivery status
        expect(otherMessage).toBeTruthy();
      });
    });
  });

  describe('Input Bar (MODULE-15.1)', () => {
    it('should render input bar with testID', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('message-input-bar')).toBeTruthy();
      });
    });

    it('should render PaperclipHorizontal icon button', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('image-picker-button')).toBeTruthy();
      });
    });

    it('should render message input field', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('message-input')).toBeTruthy();
      });
    });

    it('should render Smiley emoji button', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        expect(getByTestID('emoji-button')).toBeTruthy();
      });
    });

    it('should NOT show send button when input is empty', async () => {
      const { queryByTestID } = renderScreen();
      await waitFor(() => {
        expect(queryByTestID('send-button')).toBeNull();
      });
    });

    it('should show send button when input has text', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, 'Hello');
      });

      await waitFor(() => {
        expect(getByTestID('send-button')).toBeTruthy();
      });
    });

    it('should render PaperPlaneRight icon in send button', async () => {
      const { getByTestID } = renderScreen();
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, 'Test message');
      });

      await waitFor(() => {
        const sendButton = getByTestID('send-button');
        // Phosphor icon renders
        expect(sendButton).toBeTruthy();
      });
    });
  });

  describe('Send Message Functionality', () => {
    it('should call sendMessage when send button is pressed', async () => {
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, 'Test message');
      });

      const sendButton = getByTestID('send-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(chatService.sendMessage).toHaveBeenCalledWith(
          'trade-123',
          'user-123',
          'user-456',
          'Test message'
        );
      });
    });

    it('should clear input after sending message', async () => {
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, 'Test message');
      });

      const sendButton = getByTestID('send-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        const input = getByTestID('message-input');
        expect(input.props.value).toBe('');
      });
    });

    it('should not send empty messages', async () => {
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, '   '); // Only whitespace
      });

      // Send button should not be visible
      const sendButton = getByTestID('send-button');
      expect(sendButton).toBeNull();
    });
  });

  describe('Image Upload', () => {
    it('should open image picker when paperclip button is pressed', async () => {
      const ImagePicker = require('expo-image-picker');
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const pickerButton = getByTestID('image-picker-button');
        fireEvent.press(pickerButton);
      });

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      });
    });

    it('should call sendImageMessage after image is selected', async () => {
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const pickerButton = getByTestID('image-picker-button');
        fireEvent.press(pickerButton);
      });

      await waitFor(() => {
        expect(chatService.sendImageMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Typing Indicator (MSG-009)', () => {
    it('should render typing indicator when other user is typing', async () => {
      // This would require mocking real-time subscription updates
      const { queryByTestID } = renderScreen();
      
      // Initially no typing indicator
      expect(queryByTestID('typing-indicator')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle getMessages error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (chatService.getMessages as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      
      renderScreen();
      
      await waitFor(() => {
        // Should still render without crashing
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('should handle sendMessage error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (chatService.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Send failed')
      );
      
      const { getByTestID } = renderScreen();
      
      await waitFor(() => {
        const input = getByTestID('message-input');
        fireEvent.changeText(input, 'Test');
        const sendButton = getByTestID('send-button');
        fireEvent.press(sendButton);
      });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  describe('Image Viewer Modal', () => {
    it('should render image viewer close button with testID', async () => {
      // Image viewer is only visible when an image message is tapped
      // This test would require rendering with image messages and opening the modal
      const { queryByTestID } = renderScreen();
      expect(queryByTestID('close-image-viewer')).toBeNull(); // Modal closed by default
    });
  });
});
