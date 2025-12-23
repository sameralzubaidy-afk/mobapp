import { mapStripeErrorToMessage } from '../trade';

describe('mapStripeErrorToMessage', () => {
  it('maps card_declined to friendly message', () => {
    expect(mapStripeErrorToMessage('card_declined: Your card was declined.')).toBe(
      'Payment failed: the card was declined. Try a different card or payment method.'
    );

    expect(mapStripeErrorToMessage('Your card was declined')).toBe(
      'Payment failed: the card was declined. Try a different card or payment method.'
    );
  });

  it('returns fallback message when undefined', () => {
    expect(mapStripeErrorToMessage(undefined)).toBe('Payment failed. Please try again.');
  });

  it('passes through non-stripe errors', () => {
    expect(mapStripeErrorToMessage('Some other error')).toBe('Some other error');
  });
});
