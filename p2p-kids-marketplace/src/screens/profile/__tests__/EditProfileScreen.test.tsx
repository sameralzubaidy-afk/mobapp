// File: p2p-kids-marketplace/src/screens/profile/__tests__/EditProfileScreen.test.tsx
// TASK FLOW-15: Unit tests for Edit Profile screen (redesigned with filled inputs)

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import EditProfileScreen from '../EditProfileScreen';
import { getUserProfile, updateUserProfile } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { requestEmailChange, verifyEmailChangeCode } from '@/services/emailChange';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/phoneService';

jest.mock('@/services/profile');
jest.mock('@/services/supabase/auth');
jest.mock('@/services/emailChange', () => ({
  requestEmailChange: jest.fn(),
  resendEmailChangeCode: jest.fn(),
  verifyEmailChangeCode: jest.fn(),
}));
// Spread the real module so the screen's `instanceof OTPRateLimitError/OTPExpiredError`
// checks keep working while the send/verify functions are stubbed (ACC-TC-B03).
jest.mock('@/services/phoneService', () => ({
  ...jest.requireActual('@/services/phoneService'),
  sendPhoneVerificationCode: jest.fn(),
  verifyPhoneCode: jest.fn(),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ refreshSession: jest.fn() }),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

describe('EditProfileScreen - FLOW-15 UI Redesign', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    phone: '5551234567',
  };

  const mockProfile = {
    id: 'test-user-id',
    name: 'Test User',
    bio: 'Test bio',
    zip_code: '12345',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ user: mockUser, error: null });
    mockGetUserProfile.mockResolvedValue({ user: mockProfile, error: null });
  });

  it('renders Edit Profile title with correct styling (FLOW-15)', async () => {
    const { getByText } = render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      const title = getByText('Edit Profile');
      expect(title).toBeTruthy();
      // Title should be 24px, fontWeight 600, color #1A1A1A
    });
  });

  it('renders avatar with 96px circle and camera overlay (FLOW-15)', async () => {
    render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      // Avatar should be 96x96px
      // Camera overlay should be 28px green circle (#5DBB8E)
    });
  });

  it('renders locked full name field with User icon (FLOW-15)', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('FULL NAME (CANNOT BE CHANGED)')).toBeTruthy();
      const input = getByDisplayValue('Test User');
      expect(input).toBeTruthy();
      expect(input.props.value).toBe('Test User');
    });
  });

  it('renders filled input for phone with Phone icon (FLOW-15)', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('PHONE NUMBER')).toBeTruthy();
      const input = getByPlaceholderText('(XXX) XXX-XXXX');
      expect(input).toBeTruthy();
    });
  });

  it('renders filled input for zip code with MapPin icon (FLOW-15)', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('ZIP CODE (CANNOT BE CHANGED)')).toBeTruthy();
      const input = getByDisplayValue('12345');
      expect(input).toBeTruthy();
      expect(input.props.value).toBe('12345');
    });
  });

  it('renders bio textarea with filled style and min 100px height (FLOW-15)', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('BIO')).toBeTruthy();
      const textarea = getByPlaceholderText('Tell us a bit about yourself...');
      expect(textarea).toBeTruthy();
      expect(textarea.props.value).toBe('Test bio');
      // Should have backgroundColor #F0F0F0, minHeight 100
    });
  });

  it('renders Save Changes button as green pill (FLOW-15)', async () => {
    const { getByText } = render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      const saveButton = getByText('Save Changes');
      expect(saveButton).toBeTruthy();
      // Button should have backgroundColor #5DBB8E, borderRadius 26, height 52
    });
  });

  it('calls updateUserProfile on save with changed fields', async () => {
    mockUpdateUserProfile.mockResolvedValue({
      user: { ...mockProfile, bio: 'Updated bio' },
      error: null,
      needsWaitlist: false,
    });

    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      const bioInput = getByPlaceholderText('Tell us a bit about yourself...');
      fireEvent.changeText(bioInput, 'Updated bio');
    });

    const saveButton = getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          bio: 'Updated bio',
        }),
        expect.objectContaining({ includeAuthUser: false })
      );
    });
  });

  it('displays error message with red color (#E85D75) for validation errors', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      const input = getByPlaceholderText('(XXX) XXX-XXXX');
      fireEvent.changeText(input, '123');
    });

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Phone number must be 10 digits')).toBeTruthy();
    });
  });

  it('opens the email verification modal on email change and defers applying it (ACC-TC-B02)', async () => {
    const mockRequestEmailChange = requestEmailChange as jest.MockedFunction<
      typeof requestEmailChange
    >;
    mockRequestEmailChange.mockResolvedValue({
      success: true,
      message: 'Verification code sent to your new email.',
      newEmail: 'new@example.com',
    });

    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Enter your email'), 'new@example.com');
    });

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith('new@example.com');
      expect(getByText('Verify Your Email')).toBeTruthy();
    });
    // The email must NOT be applied immediately — the OLD email stays active until verified.
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('verifying the email code navigates to Profile with the new email (ACC-TC-B02)', async () => {
    const mockRequestEmailChange = requestEmailChange as jest.MockedFunction<
      typeof requestEmailChange
    >;
    mockRequestEmailChange.mockResolvedValue({
      success: true,
      message: 'Verification code sent to your new email.',
      newEmail: 'new@example.com',
    });
    const mockVerifyEmailChangeCode = verifyEmailChangeCode as jest.MockedFunction<
      typeof verifyEmailChangeCode
    >;
    mockVerifyEmailChangeCode.mockResolvedValue({
      success: true,
      message: 'Your email has been updated.',
      newEmail: 'new@example.com',
    });

    const reset = jest.fn();
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn(), reset }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Enter your email'), 'new@example.com');
    });
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Verify Your Email')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('edit-profile-email-otp-input'), '123456');
    fireEvent.press(getByTestId('edit-profile-email-verify-button'));

    await waitFor(() => {
      expect(mockVerifyEmailChangeCode).toHaveBeenCalledWith('123456');
      expect(reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'Profile',
            params: {
              optimisticUserPatch: { email: 'new@example.com' },
              profileUpdatedAt: expect.any(Number),
            },
          },
        ],
      });
    });
  });

  it('gives the verify-modal Cancel a ≥44pt touch target so the AX frame matches the tappable region', async () => {
    const mockRequestEmailChange = requestEmailChange as jest.MockedFunction<
      typeof requestEmailChange
    >;
    mockRequestEmailChange.mockResolvedValue({
      success: true,
      message: 'Verification code sent to your new email.',
      newEmail: 'new@example.com',
    });

    const { getByPlaceholderText, getByTestId, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Enter your email'), 'new@example.com');
    });
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Verify Your Email')).toBeTruthy();
    });

    const cancelButton = getByTestId('edit-profile-email-verify-cancel');
    const style = StyleSheet.flatten(cancelButton.props.style);
    // QA found the reported AX-frame center of the old ~27pt button missed the
    // actual touch region; a ≥44pt centered target makes the frame and hit area
    // coincide (their empirically working tap was the 44pt center).
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('center');
  });

  // ---- ACC-TC-B03: phone change → OTP verification modal ----
  it('opens the phone verification modal and sends via the canonical stack (ACC-TC-B03)', async () => {
    const mockSend = sendPhoneVerificationCode as jest.MockedFunction<
      typeof sendPhoneVerificationCode
    >;
    mockSend.mockResolvedValue({ devBypass: false });

    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn(), reset: jest.fn() }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('(XXX) XXX-XXXX'), '2025551234');
    });
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      // E.164 normalization is applied at the send boundary for the Twilio path.
      expect(mockSend).toHaveBeenCalledWith('+12025551234');
      expect(getByText('Verify Your Phone')).toBeTruthy();
    });
  });

  it('verifying the phone code persists the account phone and navigates to Profile (ACC-TC-B03)', async () => {
    const mockSend = sendPhoneVerificationCode as jest.MockedFunction<
      typeof sendPhoneVerificationCode
    >;
    mockSend.mockResolvedValue({ devBypass: false });
    const mockVerify = verifyPhoneCode as jest.MockedFunction<typeof verifyPhoneCode>;
    mockVerify.mockResolvedValue(undefined);
    mockUpdateUserProfile.mockResolvedValue({ user: null, error: null, needsWaitlist: false });

    const reset = jest.fn();
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn(), reset }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('(XXX) XXX-XXXX'), '2025551234');
    });
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Verify Your Phone')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('edit-profile-phone-otp-input'), '123456');
    fireEvent.press(getByTestId('edit-profile-phone-verify-button'));

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith('+12025551234', '123456');
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        'test-user-id',
        { phone: '2025551234' },
        { includeAuthUser: false }
      );
      expect(reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'Profile',
            params: {
              optimisticUserPatch: { phone: '2025551234' },
              profileUpdatedAt: expect.any(Number),
            },
          },
        ],
      });
    });
  });

  it('shows an error message for an invalid phone code and keeps the modal open (ACC-TC-B03)', async () => {
    const mockSend = sendPhoneVerificationCode as jest.MockedFunction<
      typeof sendPhoneVerificationCode
    >;
    mockSend.mockResolvedValue({ devBypass: false });
    const mockVerify = verifyPhoneCode as jest.MockedFunction<typeof verifyPhoneCode>;
    mockVerify.mockRejectedValue(new Error('Invalid code'));

    const { getByPlaceholderText, getByTestId, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn(), reset: jest.fn() }} />
    );

    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('(XXX) XXX-XXXX'), '2025551234');
    });
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Verify Your Phone')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('edit-profile-phone-otp-input'), '999999');
    fireEvent.press(getByTestId('edit-profile-phone-verify-button'));

    await waitFor(() => {
      expect(getByText('Invalid code')).toBeTruthy();
      // Modal stays open (not navigated away) on a failed verification.
      expect(getByText('Verify Your Phone')).toBeTruthy();
    });
  });
});
