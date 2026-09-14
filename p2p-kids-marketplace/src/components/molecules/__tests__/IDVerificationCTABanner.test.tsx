/**
 * File: p2p-kids-marketplace/src/components/molecules/__tests__/IDVerificationCTABanner.test.tsx
 *
 * FIX-Task-31 item 5 — the ID-verification Action Item on Home must use the
 * pass-it-up brand tokens. It previously shipped a Tailwind blue-500 rail
 * (#3B82F6) on a blue-50 tile (#EFF6FF), which made this one Action-Item type
 * render off-brand next to the green listing/grace items (BP-82) and showed up
 * as 0.20 % iOS-system-blue-family pixels in a full-frame Home scan.
 *
 * The amber treatment for the `rejected` state is deliberate (warning
 * semantics) and is asserted here so a future "remove the blue" sweep cannot
 * flatten it to green.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { IDVerificationCTABanner } from '../IDVerificationCTABanner';

const BRAND_GREEN = '#5DBB8E'; // Primary 500 — same rail as ResumeDraftBanner
const BRAND_TILE = '#EDF8F2'; // same icon tile as ResumeDraftBanner
const WARNING_AMBER = '#F59E0B'; // established warning token (rejected state)

/** Off-brand blue family — any of these in this component is a regression. */
const OFF_BRAND_BLUES = ['#3B82F6', '#EFF6FF', '#007AFF', '#0066CC', '#EEF6FF', '#5B8FB9'];

describe('IDVerificationCTABanner — brand tokens', () => {
  const onVerify = jest.fn();
  const onDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the brand-green rail and tile for the first-time nudge', () => {
    const r = render(
      <IDVerificationCTABanner status="none" onVerify={onVerify} onDismiss={onDismiss} />
    );

    const container = r.getByTestId('id-verification-cta-banner');
    const flat = StyleSheet.flatten(container.props.style);

    expect(flat.borderLeftColor).toBe(BRAND_GREEN);

    const tree = JSON.stringify(r.toJSON());
    expect(tree).toContain(BRAND_GREEN);
    expect(tree).toContain(BRAND_TILE);
  });

  it('renders no off-brand blue in any state', () => {
    for (const status of ['none', 'rejected'] as const) {
      const r = render(
        <IDVerificationCTABanner status={status} onVerify={onVerify} onDismiss={onDismiss} />
      );
      const tree = JSON.stringify(r.toJSON());
      for (const blue of OFF_BRAND_BLUES) {
        expect(tree).not.toContain(blue);
      }
      r.unmount();
    }
  });

  it('keeps the amber warning rail for the rejected state', () => {
    const r = render(
      <IDVerificationCTABanner status="rejected" onVerify={onVerify} onDismiss={onDismiss} />
    );

    const container = r.getByTestId('id-verification-cta-banner');
    expect(StyleSheet.flatten(container.props.style).borderLeftColor).toBe(WARNING_AMBER);
    expect(r.getByTestId('id-verification-cta-banner-title')).toHaveTextContent(
      'ID Verification Not Approved'
    );
  });

  it('renders the first-time copy and both actions', () => {
    const r = render(
      <IDVerificationCTABanner status="none" onVerify={onVerify} onDismiss={onDismiss} />
    );

    expect(r.getByTestId('id-verification-cta-banner-title')).toHaveTextContent(
      'Verify Your Identity'
    );

    fireEvent.press(r.getByTestId('id-verification-cta-banner-cta-button'));
    expect(onVerify).toHaveBeenCalledTimes(1);

    fireEvent.press(r.getByTestId('id-verification-cta-banner-maybe-later'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
