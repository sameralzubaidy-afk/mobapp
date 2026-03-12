// File: p2p-kids-marketplace/src/components/subscription/__tests__/SubscribeButton.test.tsx
// MODULE-11 SUB-015: Unit tests for SubscribeButton component

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SubscribeButton } from '../SubscribeButton';
import { usePaymentSheet } from '../../../hooks/usePaymentSheet';
import { supabase } from '../../../config/supabase';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock usePaymentSheet
jest.mock('../../../hooks/usePaymentSheet', () => ({
  usePaymentSheet: jest.fn(),
}));

// Mock supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock fetch
global.fetch = jest.fn();

describe('SubscribeButton', () => {
  const mockSession = {
    access_token: 'test_token',
    user: { id: 'test_user_id' },
  };

  const mockPaymentSheet = {
    setupPaymentSheet: jest.fn(),
    presentSheet: jest.fn(),
    loading: false,
    error: null,
    resetError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (usePaymentSheet as jest.Mock).mockReturnValue(mockPaymentSheet);

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
  });

  describe('Initial render', () => {
    it('should render subscribe button with default label', () => {
      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      const label = getByTestId('subscribe-button-label');

      expect(button).toBeTruthy();
      expect(label.props.children).toBe('Subscribe to Kids Club+');
    });

    it('should render re-subscribe label when isRenewal=true', () => {
      const { getByTestId } = render(<SubscribeButton isRenewal priceCents={499} />);

      const label = getByTestId('subscribe-button-label');
      expect(label.props.children).toBe('Re-subscribe Now');
    });

    it('should render custom label', () => {
      const { getByTestId } = render(<SubscribeButton label="Custom Label" priceCents={499} />);

      const label = getByTestId('subscribe-button-label');
      expect(label.props.children).toBe('Custom Label');
    });

    it('should display trial disclaimer for new subscription', () => {
      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const disclaimer = getByTestId('subscribe-button-disclaimer');
      expect(disclaimer.props.children).toContain('30-day free trial');
    });

    it('should display renewal disclaimer for re-subscription', () => {
      const { getByTestId } = render(<SubscribeButton isRenewal priceCents={499} />);

      const disclaimer = getByTestId('subscribe-button-disclaimer');
      expect(disclaimer.props.children).toContain('Your card will be charged');
    });
  });

  describe('Subscribe flow', () => {
    it('should handle successful subscription', async () => {
      mockPaymentSheet.presentSheet.mockResolvedValueOnce({
        success: true,
        paymentMethodId: 'pm_test_123',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subscription_id: 'sub_test_123',
          status: 'active',
          current_period_end: '2024-04-01T00:00:00Z',
        }),
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPaymentSheet.setupPaymentSheet).toHaveBeenCalledWith({
          amount: 499,
          isRenewal: false,
        });
      });

      await waitFor(() => {
        expect(mockPaymentSheet.presentSheet).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/create-subscription-from-payment-method'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success!',
          expect.stringContaining('30-day free trial'),
          expect.any(Array)
        );
      });
    });

    it('should handle user cancellation gracefully', async () => {
      mockPaymentSheet.presentSheet.mockResolvedValueOnce({
        success: false,
        error: 'Payment cancelled',
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPaymentSheet.presentSheet).toHaveBeenCalled();
      });

      // Should not show error for cancellation
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should handle payment error', async () => {
      mockPaymentSheet.presentSheet.mockResolvedValueOnce({
        success: false,
        error: 'Card declined',
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Error',
          expect.stringContaining('Card declined'),
          expect.any(Array)
        );
      });
    });

    it('should handle subscription creation error', async () => {
      mockPaymentSheet.presentSheet.mockResolvedValueOnce({
        success: true,
        paymentMethodId: 'pm_test_123',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Subscription creation failed' }),
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Error',
          expect.stringContaining('Subscription creation failed'),
          expect.any(Array)
        );
      });
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = jest.fn();

      mockPaymentSheet.presentSheet.mockResolvedValueOnce({
        success: true,
        paymentMethodId: 'pm_test_123',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subscription_id: 'sub_test_123',
          status: 'active',
        }),
      });

      const { getByTestId } = render(<SubscribeButton onSuccess={onSuccess} priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing OK on alert
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const okButton = alertCalls[0][2][0]; // First alert, third arg (buttons), first button
      okButton.onPress();

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator when processing', () => {
      (usePaymentSheet as jest.Mock).mockReturnValue({
        ...mockPaymentSheet,
        loading: true,
      });

      const { getByTestId, queryByTestId } = render(<SubscribeButton priceCents={499} />);

      const loadingIndicator = getByTestId('subscribe-button-loading');
      const label = queryByTestId('subscribe-button-label');

      expect(loadingIndicator).toBeTruthy();
      expect(label).toBeNull();
    });

    it('should disable button when loading', () => {
      (usePaymentSheet as jest.Mock).mockReturnValue({
        ...mockPaymentSheet,
        loading: true,
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');

      // Button should be disabled
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Error display', () => {
    it('should show error message when error exists', () => {
      (usePaymentSheet as jest.Mock).mockReturnValue({
        ...mockPaymentSheet,
        error: 'Test error message',
      });

      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const error = getByTestId('subscribe-button-error');
      expect(error.props.children).toBe('Test error message');
    });

    it('should reset error when button pressed', async () => {
      const { getByTestId } = render(<SubscribeButton priceCents={499} />);

      const button = getByTestId('subscribe-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPaymentSheet.resetError).toHaveBeenCalled();
      });
    });
  });
});
