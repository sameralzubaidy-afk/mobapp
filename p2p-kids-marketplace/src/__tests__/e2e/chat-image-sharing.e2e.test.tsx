// @jest-environment jsdom

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChatScreen from '../../screens/messaging/ChatScreen';
import * as ImagePicker from 'expo-image-picker';
import { sendImageMessage } from '@/services/chat';
import { AuthContext } from '../../contexts/AuthContext';

// Mock dependencies
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('@/services/chat', () => ({
  getMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn(),
  sendImageMessage: jest.fn(),
  subscribeToMessages: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
  unsubscribeFromMessages: jest.fn(),
  markAsRead: jest.fn().mockResolvedValue({ success: true }),
  markTradeMessagesAsDelivered: jest.fn().mockResolvedValue({ success: true }),
  markTradeMessagesAsRead: jest.fn().mockResolvedValue({ success: true }),
  broadcastTypingStatus: jest.fn().mockResolvedValue({ success: true }),
  subscribeToTypingStatus: jest.fn().mockReturnValue(jest.fn()),
}));

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockImplementation((cb) => {
    if (cb) cb('SUBSCRIBED');
    return mockChannel;
  }),
  unsubscribe: jest.fn(),
  presenceState: jest.fn().mockReturnValue({}),
  track: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: jest.fn(() => mockChannel),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { tradeId: 'test-trade-123' },
  }),
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock(
  'react-native-image-viewing',
  () => ({
    __esModule: true,
    default: 'ImageViewing',
  }),
  { virtual: true }
);

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'MockIcon',
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockAuthContext = {
  session: {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
  },
  signOut: jest.fn(),
};

const renderChatScreen = () => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      <ChatScreen />
    </AuthContext.Provider>
  );
};

describe('ChatScreen Image Sharing E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle image picker permission denied', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission denied
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    await waitFor(() => {
      const imageButton = getByTestId('image-picker-button');
      fireEvent.press(imageButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission Required',
        'Please allow access to your photo library to share images.'
      );
    });
  });

  it('should handle successful image selection and sending', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission granted
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    // Mock image picker result
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://test-image.jpg',
          width: 800,
          height: 600,
        },
      ],
    });

    // Mock successful sendImageMessage
    (sendImageMessage as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: {
        id: 'message-123',
        trade_id: 'test-trade-123',
        sender_id: 'test-user-123',
        content: 'Image',
        message_type: 'image',
        image_url: 'https://example.com/image.jpg',
        created_at: new Date().toISOString(),
      },
    });

    await waitFor(() => {
      const imageButton = getByTestId('image-picker-button');
      fireEvent.press(imageButton);
    });

    await waitFor(() => {
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      expect(sendImageMessage).toHaveBeenCalledWith({
        tradeId: 'test-trade-123',
        senderId: 'test-user-123',
        imageUri: 'file://test-image.jpg',
      });
    });
  });

  it('should handle image picker cancellation', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission granted
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    // Mock image picker cancellation
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
    });

    await waitFor(() => {
      const imageButton = getByTestId('image-picker-button');
      fireEvent.press(imageButton);
    });

    await waitFor(() => {
      expect(sendImageMessage).not.toHaveBeenCalled();
    });
  });

  it('should handle image sending failure', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission granted
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    // Mock image picker result
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://test-image.jpg',
          width: 800,
          height: 600,
        },
      ],
    });

    // Mock sendImageMessage failure
    (sendImageMessage as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Failed to upload image',
    });

    await waitFor(() => {
      const imageButton = getByTestId('image-picker-button');
      fireEvent.press(imageButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to upload image'
      );
    });
  });

  it('should disable image button while sending', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission granted
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    // Mock image picker result
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://test-image.jpg',
        },
      ],
    });

    // Mock sendImageMessage with a deferred promise (no timers needed)
    let resolveSend: ((value: any) => void) | null = null;
    const sendPromise = new Promise((resolve) => {
      resolveSend = resolve;
    });
    (sendImageMessage as jest.Mock).mockReturnValueOnce(sendPromise);

    await waitFor(() => {
      expect(getByTestId('image-picker-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('image-picker-button'));

    await waitFor(() => {
      const node = getByTestId('image-picker-button');
      const disabled = node.props.accessibilityState?.disabled ?? node.props.disabled;
      expect(disabled).toBe(true);
    });

    resolveSend?.({
      success: true,
      message: {
        id: 'message-123',
        message_type: 'image',
        image_url: 'https://example.com/image.jpg',
      },
    });

    await waitFor(() => {
      const node = getByTestId('image-picker-button');
      const disabled = node.props.accessibilityState?.disabled ?? node.props.disabled;
      expect(disabled).toBe(false);
    });
  });

  it('should handle image picker error', async () => {
    const { getByTestId } = renderChatScreen();

    // Mock permission granted
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    // Mock image picker error
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Image picker failed')
    );

    await waitFor(() => {
      const imageButton = getByTestId('image-picker-button');
      fireEvent.press(imageButton);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to select image');
    });
  });
});
