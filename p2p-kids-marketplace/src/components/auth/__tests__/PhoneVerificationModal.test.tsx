import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import PhoneVerificationModal from '../PhoneVerificationModal';
import * as phoneService from '@/services/phoneService';
import { OTPExpiredError } from '@/types/auth-v3-errors';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/services/phoneService', () => ({
  sendPhoneVerificationCode: jest.fn(),
  verifyPhoneCode: jest.fn(),
  // The modal's __DEV__ autofill button reads this constant.
  DEV_SMS_BYPASS_CODE: '123456',
}));

const mockPhoneService = phoneService as jest.Mocked<typeof phoneService>;

const TEST_ID = 'phone-verification-modal';
const PHONE_INPUT_ID = `${TEST_ID}-phone-input`;
const SEND_CODE_ID = `${TEST_ID}-send-code`;
const CLOSE_ID = `${TEST_ID}-close`;
const RESEND_ID = `${TEST_ID}-resend`;
// Single auto-formatted OTP field (design-system-passitup.md §4.4) — the gate
// modal renders the canonical OTPInput with a namespaced testID `${testID}-code`.
const OTP_ID = `${TEST_ID}-code`;

async function enterOtp(getByTestId: (id: string) => any, otp: string): Promise<void> {
  fireEvent.changeText(getByTestId(OTP_ID), otp);
}

describe('PhoneVerificationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    mockPhoneService.sendPhoneVerificationCode.mockResolvedValue({ devBypass: false } as never);
    mockPhoneService.verifyPhoneCode.mockResolvedValue(undefined as never);
  });

  it('renders phone step with phone input and send button', () => {
    const { getByTestId, getByText } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    expect(getByTestId(PHONE_INPUT_ID)).toBeTruthy();
    expect(getByTestId(SEND_CODE_ID)).toBeTruthy();
    expect(getByText(/Enter your phone number to receive a verification code/i)).toBeTruthy();
  });

  it('shows close button by default and hides it in required mode', () => {
    const defaultRender = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
    expect(defaultRender.getByTestId(CLOSE_ID)).toBeTruthy();

    const requiredRender = render(
      <PhoneVerificationModal
        visible={true}
        required={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(requiredRender.queryByTestId(CLOSE_ID)).toBeNull();
  });

  it('keeps send disabled for short phone numbers', () => {
    const { getByTestId } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '555123');

    expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(true);

    fireEvent(getByTestId(SEND_CODE_ID), 'onPress');

    expect(mockPhoneService.sendPhoneVerificationCode).not.toHaveBeenCalled();
  });

  it('sends code and transitions to OTP step', async () => {
    const { getByTestId, getByText } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    await waitFor(() => {
      expect(mockPhoneService.sendPhoneVerificationCode).toHaveBeenCalledWith('+15551234567');
      expect(getByTestId(OTP_ID)).toBeTruthy();
      expect(getByText(/We sent a 6-digit code to/i)).toBeTruthy();
    });
  });

  it('verifies after 6 digits and calls onSuccess + onClose', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <PhoneVerificationModal visible={true} onClose={onClose} onSuccess={onSuccess} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    await waitFor(() => {
      expect(getByTestId(OTP_ID)).toBeTruthy();
    });

    await enterOtp(getByTestId, '123456');

    // Entering the 6th digit auto-verifies now (the auto-verify state race is
    // fixed by passing the freshly-typed code through), so no manual VERIFY tap.
    await waitFor(() => {
      expect(mockPhoneService.verifyPhoneCode).toHaveBeenCalledWith('+15551234567', '123456');
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('DEV autofill button fills and verifies the bypass code in one tap', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <PhoneVerificationModal visible={true} onClose={onClose} onSuccess={onSuccess} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    await waitFor(() => {
      expect(getByTestId(OTP_ID)).toBeTruthy();
    });

    // One tap fills the fixed DEV bypass code AND verifies it (no digit-by-digit).
    await act(async () => {
      fireEvent(getByTestId(`${TEST_ID}-dev-autofill`), 'onPress');
    });

    await waitFor(() => {
      expect(mockPhoneService.verifyPhoneCode).toHaveBeenCalledWith('+15551234567', '123456');
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows invalid-code error when verification fails', async () => {
    mockPhoneService.verifyPhoneCode.mockRejectedValueOnce(new Error('Invalid verification code'));

    const { getByTestId, getByText } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    await waitFor(() => {
      expect(getByTestId(OTP_ID)).toBeTruthy();
    });

    await enterOtp(getByTestId, '999999');

    // Auto-verify fires on the 6th digit and surfaces the error immediately.
    await waitFor(() => {
      expect(getByText(/Invalid verification code\. Please try again\./i)).toBeTruthy();
    });
  });

  it('shows expired-code error and returns to phone step', async () => {
    mockPhoneService.verifyPhoneCode.mockRejectedValueOnce(
      new OTPExpiredError(new Date().toISOString())
    );

    const { getByTestId, getByText } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    await waitFor(() => {
      expect(getByTestId(OTP_ID)).toBeTruthy();
    });

    await enterOtp(getByTestId, '123456');

    // Auto-verify fires on the 6th digit; the expired error returns to phone step.
    await waitFor(() => {
      expect(getByText(/Code expired\. Please request a new one\./i)).toBeTruthy();
      expect(getByTestId(PHONE_INPUT_ID)).toBeTruthy();
    });
  });

  it('shows resend countdown after entering OTP step', async () => {
    const { getByTestId, getByText } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.changeText(getByTestId(PHONE_INPUT_ID), '5551234567');

    await waitFor(() => {
      expect(getByTestId(PHONE_INPUT_ID).props.value).toBe('+15551234567');
      expect(getByTestId(SEND_CODE_ID).props.accessibilityState?.disabled).toBe(false);
    });

    await act(async () => {
      fireEvent(getByTestId(SEND_CODE_ID), 'onPress');
    });

    expect(mockPhoneService.sendPhoneVerificationCode).toHaveBeenCalledWith('+15551234567');
    expect(getByText(/Resend code in 60s/i)).toBeTruthy();
    expect(() => getByTestId(RESEND_ID)).toThrow();
  });

  it('has accessibility labels on primary phone-step controls', () => {
    const { getByTestId } = render(
      <PhoneVerificationModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    const phoneInput = getByTestId(PHONE_INPUT_ID);
    const sendButton = getByTestId(SEND_CODE_ID);

    expect(phoneInput.props.accessibilityLabel).toBe('Phone number');
    expect(sendButton.props.accessibilityLabel).toBe('Send verification code');
  });
});
