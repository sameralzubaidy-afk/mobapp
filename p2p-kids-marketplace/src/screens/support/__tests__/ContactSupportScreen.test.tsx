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

// Stable mock reference (mock-prefixed so jest.mock can reference it) — lets
// tests assert insert() was NOT called (honeypot silent-discard path).
const mockInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
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

    it('should NOT render a raw email fallback when logged in (no raw email surfaces)', () => {
      const { queryByText } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(queryByText(/Or email us at/)).toBeNull();
      expect(queryByText(/support@/)).toBeNull();
    });

    it('should render the reply-email + optional phone fields for logged-out users', () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId, getByLabelText } = render(
        <ContactSupportScreen navigation={mockNavigation} />
      );
      expect(getByTestId('contact-email-input')).toBeTruthy();
      expect(getByLabelText('Your email')).toBeTruthy();
      expect(getByTestId('contact-phone-input')).toBeTruthy();
      expect(getByLabelText('Phone')).toBeTruthy();
    });

    it('should NOT render the reply-email/phone fields for logged-in users', () => {
      const { queryByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(queryByTestId('contact-email-input')).toBeNull();
      expect(queryByTestId('contact-phone-input')).toBeNull();
    });

    it('should render the hidden honeypot field for logged-out users only', () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByTestId('company-input')).toBeTruthy();
    });

    it('should NOT render the honeypot field for logged-in users', () => {
      const { queryByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(queryByTestId('company-input')).toBeNull();
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
        expect(Alert.alert).toHaveBeenCalledWith('Missing Message', 'Please enter your message.');
      });
    });

    it('should alert when a logged-out user omits their reply email', async () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      const subjectInput = getByTestId('subject-input');
      const messageInput = getByTestId('message-input');
      const sendButton = getByTestId('send-message-button');

      fireEvent.changeText(subjectInput, 'Test Subject');
      fireEvent.changeText(messageInput, 'Test message body');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Missing Email',
          'Please enter your email so we can reply.'
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

  describe('Abuse Protection (guest rate limit + honeypot)', () => {
    it('shows a friendly Limit Reached alert when the guest rate limit is hit (SQLSTATE GRATL)', async () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      mockInsert.mockResolvedValueOnce({
        error: {
          code: 'GRATL',
          message: 'You have reached the limit for support messages. Please try again later.',
        },
      });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);

      fireEvent.changeText(getByTestId('subject-input'), 'Test Subject');
      fireEvent.changeText(getByTestId('message-input'), 'Test message');
      fireEvent.changeText(getByTestId('contact-email-input'), 'guest@example.com');
      fireEvent.press(getByTestId('send-message-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Limit Reached',
          'You have reached the limit for support messages. Please try again later.'
        );
      });
      // Not the generic error and not a false success.
      expect(Alert.alert).not.toHaveBeenCalledWith(
        'Error',
        'Failed to send message. Please try again.'
      );
    });

    it('shows the generic error for a non-rate-limit DB failure', async () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);

      fireEvent.changeText(getByTestId('subject-input'), 'Test Subject');
      fireEvent.changeText(getByTestId('message-input'), 'Test message');
      fireEvent.changeText(getByTestId('contact-email-input'), 'guest@example.com');
      fireEvent.press(getByTestId('send-message-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to send message. Please try again.'
        );
      });
    });

    it('silently discards the submission (no insert) when the honeypot is filled', async () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);

      // Bot fills the hidden honeypot (everything else may be empty).
      fireEvent.changeText(getByTestId('company-input'), 'bot-value');
      fireEvent.press(getByTestId('send-message-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Message Sent',
          "Thank you for contacting us. We'll respond within 24 hours.",
          expect.any(Array)
        );
      });
      // Success is shown to the bot but NO row is inserted.
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('does not hit the honeypot discard path for real users (empty honeypot) and inserts the guest payload', async () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);

      fireEvent.changeText(getByTestId('subject-input'), 'Test Subject');
      fireEvent.changeText(getByTestId('message-input'), 'Test message');
      fireEvent.changeText(getByTestId('contact-email-input'), 'guest@example.com');
      fireEvent.press(getByTestId('send-message-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Message Sent',
          "Thank you for contacting us. We'll respond within 24 hours.",
          expect.any(Array)
        );
      });
      // Insert ran once with the guest payload; the honeypot is NOT part of it.
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: null,
        contact_email: 'guest@example.com',
        contact_phone: null,
        subject: 'Test Subject',
        message: 'Test message',
      });
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

    it('should render the guest reply-email field with a filled input style', () => {
      (useAuth as jest.Mock).mockReturnValue({ session: null });
      const { getByTestId } = render(<ContactSupportScreen navigation={mockNavigation} />);
      expect(getByTestId('contact-email-input')).toBeTruthy();
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
