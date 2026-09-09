import { mapStripeErrorToMessage } from '../trade';

describe('mapStripeErrorToMessage', () => {
  it('maps card_declined to friendly message', () => {
    expect(mapStripeErrorToMessage('card_declined: Your card was declined.')).toBe(
      'Payment method declined. Please update your card.'
    );

    expect(mapStripeErrorToMessage('Your card was declined')).toBe(
      'Payment method declined. Please update your card.'
    );
  });

  it('returns fallback message when undefined', () => {
    expect(mapStripeErrorToMessage(undefined)).toBe('Payment failed. Please try again.');
  });

  it('passes through non-stripe errors', () => {
    expect(mapStripeErrorToMessage('Some other error')).toBe('Some other error');
  });

  // FIX-Task-9 item 2 (B06 copy reconcile): pm-invalid / decline codes surface the
  // canonical TRD-TC-B06 friendly copy regardless of the raw server message text.
  it('maps INVALID_PAYMENT_METHOD code to canonical B06 copy', () => {
    expect(
      mapStripeErrorToMessage('Payment method is invalid or expired', 'INVALID_PAYMENT_METHOD')
    ).toBe('Payment method declined. Please update your card.');
  });

  it('maps CARD_DECLINED / STRIPE_HOLD_FAILED codes to canonical B06 copy', () => {
    expect(mapStripeErrorToMessage('Your card was declined.', 'CARD_DECLINED')).toBe(
      'Payment method declined. Please update your card.'
    );
    expect(mapStripeErrorToMessage('Hold failed', 'STRIPE_HOLD_FAILED')).toBe(
      'Payment method declined. Please update your card.'
    );
  });

  it('passes through when the code is unrelated to the decline family', () => {
    expect(mapStripeErrorToMessage('Server unavailable', 'MAX_PENDING_OFFERS')).toBe(
      'Server unavailable'
    );
  });
});
