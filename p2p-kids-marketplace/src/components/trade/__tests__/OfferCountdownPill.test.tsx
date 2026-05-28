import React from 'react';
import { render } from '@testing-library/react-native';
import OfferCountdownPill from '../OfferCountdownPill';

describe('OfferCountdownPill', () => {
  it('renders countdown for active offer', () => {
    const { getByText, getByTestId } = render(
      <OfferCountdownPill
        offerExpiresAt="2026-01-01T12:00:00.000Z"
        createdAt="2026-01-01T08:00:00.000Z"
        nowMs={Date.parse('2026-01-01T10:00:00.000Z')}
      />
    );

    expect(getByTestId('offer-countdown-pill')).toBeTruthy();
    expect(getByText(/left/)).toBeTruthy();
  });

  it('renders expired state when offer already expired', () => {
    const { getByTestId, getByText } = render(
      <OfferCountdownPill
        offerExpiresAt="2026-01-01T08:00:00.000Z"
        createdAt="2026-01-01T07:00:00.000Z"
        nowMs={Date.parse('2026-01-01T10:00:00.000Z')}
      />
    );

    expect(getByTestId('offer-countdown-pill')).toBeTruthy();
    expect(getByText('Expired')).toBeTruthy();
  });
});
