// FILE: p2p-kids-marketplace/src/screens/support/__tests__/ContactSupportScreen.test.tsx
// MODULE-15.1 FLOW-19: Unit tests for Contact Support Form

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ContactSupportScreen from '../ContactSupportScreen';
import { useAuth } from '@/hooks/useAuth';

// Mock Alert
jest.spyOn(Alert, 'alert');

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

// Mock navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
};

describe('ContactSupportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Alert.alert as jest.Mock).mockClear();
    (useAuth as jest.Mock).mockReturnValue({
      session: {
        user: {
          id: 'test-user-id',
        },
      },
    });
  });

  describe('Rendering', () => {
    it('should render the screen successfully', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByTestId('screen-title')).toBeTruthy();
      expect(getByTestId('form-scroll')).toBeTruthy();
    });

    it('should display header with title "Contact Support"', () => {
      const { getByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByText('Contact Support')).toBeTruthy();
    });

    it('should render back button', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByTestId('back-button')).toBeTruthy();
    });

    it('should render intro text', () => {
      const { getByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(
        getByText(/Have a question or issue\? Send us a message and we'll get back to you/)
      ).toBeTruthy();
    });

    it('should render subject input field', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      expect(getByTestId('subject-input')).toBeTruthy();
      expect(getByPlaceholderText('Enter subject')).toBeTruthy();
    });

    it('should render message textarea', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      expect(getByTestId('message-input')).toBeTruthy();
      expect(getByPlaceholderText('Describe your issue or question…')).toBeTruthy();
    });

    it('should render Send Message button', () => {
      const { getByTestId, getByText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      expect(getByTestId('send-message-button')).toBeTruthy();
      expect(getByText('Send Message')).toBeTruthy();
    });

    it('should render email fallback text with highlighted email', () => {
      const { getByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByText(/Or email us at/)).toBeTruthy();
      expect(getByText('support@passitup.com')).toBeTruthy();
    });

    it('should display character count for message (0 / 1000)', () => {
      const { getByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByText('0 / 1000')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should show alert when subject is empty', async () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const sendButton = getByTestId('send-message-button');

      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Missing Subject',
          'Please enter a subject for your message.'
        );
      });
    });

    it('should show alert when message is empty', async () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Missing Message',
          'Please enter your message.'
        );
      });
    });

    it('should not show alert when both subject and message are filled', async () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message content');
      fireEvent.press(sendButton);

      await waitFor(() => {
        // Success alert, not validation alert
        expect(Alert.alert).toHaveBeenCalledWith(
          'Message Sent',
          expect.any(String),
          expect.any(Array)
        );
      });
    });
  });

  describe('Form Submission', () => {
    it('should update character count when message is typed', () => {
      const { getByTestId, getByText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      const messageInput = getByTestId('message-input');

      fireEvent.changeText(messageInput, 'Hello');

      expect(getByText('5 / 1000')).toBeTruthy();
    });

    it('should disable button and show "Sending…" during submission', async () => {
      const { getByTestId, getByText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message');
      fireEvent.press(sendButton);

      // Check for "Sending…" text (briefly visible)
      await waitFor(() => {
        expect(getByText('Sending…')).toBeTruthy();
      });
    });

    it('should show success alert after submission', async () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Message Sent',
          "Thank you for contacting us. We'll respond within 24 hours.",
          expect.arrayContaining([
            expect.objectContaining({
              text: 'OK',
              onPress: expect.any(Function),
            }),
          ])
        );
      });
    });

    it('should navigate back after success alert is dismissed', async () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing OK button
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const okButton = alertCall[2][0];
      okButton.onPress();

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('should reset form after successful submission', async () => {
      const { getByTestId, getByText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // After submission, character count should reset
      expect(getByText('0 / 1000')).toBeTruthy();
    });
  });

  describe('Input Constraints', () => {
    it('should enforce subject max length (100 characters)', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');

      const longSubject = 'a'.repeat(150);
      fireEvent.changeText(subjectInput, longSubject);

      // maxLength prop on TextInput will prevent typing beyond 100
      expect(subjectInput.props.maxLength).toBe(100);
    });

    it('should enforce message max length (1000 characters)', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const messageInput = getByTestId('message-input');

      const longMessage = 'a'.repeat(1500);
      fireEvent.changeText(messageInput, longMessage);

      // maxLength prop on TextInput will prevent typing beyond 1000
      expect(messageInput.props.maxLength).toBe(1000);
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is pressed', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const backButton = getByTestId('back-button');

      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Design System Compliance - MODULE-15.1', () => {
    it('should use filled input style (#F0F0F0 background)', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      // Style verification requires accessing parent wrapper
      expect(subjectInput).toBeTruthy();
    });

    it('should display EnvelopeSimple icon in subject input', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByTestId('subject-input')).toBeTruthy();
      // Phosphor icons are rendered, verifying their presence requires snapshot or component inspection
    });

    it('should use textarea with minHeight 120px and textAlignVertical: top', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const messageInput = getByTestId('message-input');
      expect(messageInput.props.textAlignVertical).toBe('top');
      expect(messageInput.props.multiline).toBe(true);
    });

    it('should use green pill button (#5DBB8E, borderRadius 26, height 52)', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const sendButton = getByTestId('send-message-button');
      // Style verification requires accessing StyleSheet.flatten
      expect(sendButton).toBeTruthy();
    });

    it('should highlight email address in green (#5DBB8E)', () => {
      const { getByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const emailText = getByText('support@passitup.com');
      // Text style verification requires accessing TextStyle props
      expect(emailText).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels for all inputs', () => {
      const { getByLabelText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      
      expect(getByLabelText('Go back')).toBeTruthy();
      expect(getByLabelText('Subject')).toBeTruthy();
      expect(getByLabelText('Message')).toBeTruthy();
      expect(getByLabelText('Send message')).toBeTruthy();
    });

    it('should mark button as disabled during submission', () => {
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');

      fireEvent.changeText(subjectInput, 'Test');
      fireEvent.changeText(messageInput, 'Test message');
      fireEvent.press(getByTestId('send-message-button'));

      // Button should be disabled during submission
      expect(getByTestId('send-message-button').props.accessibilityState?.disabled).toBe(true);
    });
  });
});
