/**
 * File: p2p-kids-marketplace/src/components/ui/__tests__/Modal.test.tsx
 *
 * FIX-Task-12 item 5 (BP-53 class) — the shared alert Modal's close (×) button
 * must be a real accessibility element so QA automation can drive it.
 *
 * Before the fix it rendered as a bare TouchableOpacity wrapping a "×" Text with
 * NO testID / accessible / accessibilityRole / accessibilityLabel, so it never
 * surfaced in the iOS AX tree (QA Task A1/Item-6 Part 1: the Active-Offer guard
 * modal's ✕ was not drivable while its three sibling actions were).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Modal } from '../Modal';

describe('Modal — close (×) button accessibility', () => {
  it('exposes the close button as a labelled accessibility element by default', () => {
    const { getByLabelText } = render(
      <Modal visible title="Active Offer" message="You already have an active offer." />
    );

    const closeButton = getByLabelText('Close');
    expect(closeButton).toBeTruthy();
    expect(closeButton.props.accessible).toBe(true);
    expect(closeButton.props.accessibilityRole).toBe('button');
  });

  it('exposes the caller-provided closeButtonTestID', () => {
    const { getByTestId } = render(
      <Modal
        visible
        title="Active Offer"
        message="You already have an active offer."
        primaryButtonText="Go to Trade History"
        secondaryButtonText="Dismiss"
        closeButtonTestID="duplicate-offer-modal-close-button"
      />
    );

    expect(getByTestId('duplicate-offer-modal-close-button')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <Modal
        visible
        title="Active Offer"
        message="You already have an active offer."
        closeButtonTestID="duplicate-offer-modal-close-button"
        onClose={onClose}
      />
    );

    fireEvent.press(getByTestId('duplicate-offer-modal-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render a close button for a bottom sheet', () => {
    const { queryByLabelText } = render(
      <Modal visible type="bottomSheet" title="Sheet" message="Body" />
    );

    expect(queryByLabelText('Close')).toBeNull();
  });
});
