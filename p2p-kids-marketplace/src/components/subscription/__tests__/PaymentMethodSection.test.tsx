// File: p2p-kids-marketplace/src/components/subscription/__tests__/PaymentMethodSection.test.tsx
// DEV-TASK-83 (D2): regression test — "Update Payment Method" in Manage Kids Club+
// must call the attach-payment-method EF so the new card actually persists. This
// test FAILS against the pre-fix code (which never invoked the EF).
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaymentMethodSection } from '../PaymentMethodSection';
import { supabase } from '@/config/supabase';
import { getPaymentMethod } from '@/services/subscription';
import { retryFailedPayment } from '@/services/paymentRetry';

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'buyer-123' }, access_token: 'test-token' } },
        error: null,
      }),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

jest.mock('@/hooks/usePaymentSheet', () => ({
  usePaymentSheet: jest.fn(() => ({
    setupPaymentSheet: jest.fn().mockResolvedValue(undefined),
    presentSheet: mockPresentSheet,
    loading: false,
    error: null,
    resetError: jest.fn(),
  })),
}));
const mockPresentSheet = jest
  .fn()
  .mockResolvedValue({ success: true, paymentMethodId: 'pm_new' });

jest.mock('@/services/subscription', () => ({
  getPaymentMethod: jest.fn(),
}));
jest.mock('@/services/paymentRetry', () => ({
  retryFailedPayment: jest.fn(),
}));
jest.mock('@/services/errorReporter', () => ({
  captureException: jest.fn(),
}));

const mockGetPaymentMethod = getPaymentMethod as jest.Mock;
const mockRetryFailedPayment = retryFailedPayment as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;

describe('PaymentMethodSection — DEV-TASK-83 (D2) payment persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPaymentMethod.mockResolvedValue({
      id: 'pm_1',
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2028,
    });
    mockRetryFailedPayment.mockResolvedValue({
      success: false,
      error: { code: 'NO_OPEN_INVOICE', message: 'No open invoice' },
    });
  });

  it('persists a newly-added card via the attach-payment-method EF before showing success', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const { getByText } = render(<PaymentMethodSection />);

    // Wait for the initial card to load (mount fetch).
    await waitFor(() => expect(getByText('Update Payment Method')).toBeTruthy());

    fireEvent.press(getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'attach-payment-method',
        expect.objectContaining({
          body: { payment_method_id: 'pm_new' },
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    // After a successful attach, the card is force-refreshed (bypasses the cache).
    await waitFor(() => {
      expect(mockGetPaymentMethod).toHaveBeenCalledWith(true);
    });
  });

  it('does NOT show a success state when the attach EF fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Attach EF returns an error (non-2xx wrapped by functions-js).
    mockInvoke.mockResolvedValue({ data: null, error: new Error('attach failed') });

    const { getByText } = render(<PaymentMethodSection />);

    await waitFor(() => expect(getByText('Update Payment Method')).toBeTruthy());

    fireEvent.press(getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'attach-payment-method',
        expect.objectContaining({ body: { payment_method_id: 'pm_new' } })
      );
    });

    // Blocking error alert surfaced (BP-39 surfaces the real EF message), and
    // the card is NOT force-refreshed (persistence failed).
    expect(alertSpy).toHaveBeenCalledWith('Error', expect.any(String));
    expect(mockGetPaymentMethod).not.toHaveBeenCalledWith(true);

    alertSpy.mockRestore();
  });
});
