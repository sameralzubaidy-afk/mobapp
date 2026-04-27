/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/PublishButton.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for PublishButton
 *
 * Test Coverage:
 * - Rendering in normal, loading, and disabled states
 * - Button press functionality
 * - Loading indicator
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PublishButton } from '../../listing/PublishButton';

describe('PublishButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal State', () => {
    it('renders button with default label', () => {
      const { getByText } = render(<PublishButton onPress={mockOnPress} />);

      expect(getByText('Publish Item')).toBeTruthy();
    });

    it('renders button with custom label', () => {
      const { getByText } = render(<PublishButton onPress={mockOnPress} label="Save Draft" />);

      expect(getByText('Save Draft')).toBeTruthy();
    });

    it('calls onPress when button is pressed', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} />);

      fireEvent.press(getByTestId('publish-button'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('can be pressed multiple times', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} />);

      fireEvent.press(getByTestId('publish-button'));
      fireEvent.press(getByTestId('publish-button'));
      fireEvent.press(getByTestId('publish-button'));

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Loading State', () => {
    it('displays loading indicator when loading is true', () => {
      const { UNSAFE_getByType } = render(<PublishButton onPress={mockOnPress} loading={true} />);

      const ActivityIndicator = require('react-native').ActivityIndicator;
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('does not display label text when loading', () => {
      const { queryByText } = render(
        <PublishButton onPress={mockOnPress} loading={true} label="Publish Item" />
      );

      expect(queryByText('Publish Item')).toBeNull();
    });

    it('does not call onPress when loading', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} loading={true} />);

      fireEvent.press(getByTestId('publish-button'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('has disabled prop when loading', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} loading={true} />);

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Disabled State', () => {
    it('does not call onPress when disabled', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} disabled={true} />);

      fireEvent.press(getByTestId('publish-button'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('has disabled prop when disabled is true', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} disabled={true} />);

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('still displays label text when disabled', () => {
      const { getByText } = render(<PublishButton onPress={mockOnPress} disabled={true} />);

      expect(getByText('Publish Item')).toBeTruthy();
    });
  });

  describe('Combined States', () => {
    it('is disabled when both loading and disabled are true', () => {
      const { getByTestId } = render(
        <PublishButton onPress={mockOnPress} loading={true} disabled={true} />
      );

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);

      fireEvent.press(button);
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible label matching button text', () => {
      const { getByLabelText } = render(
        <PublishButton onPress={mockOnPress} label="Publish Item" />
      );

      expect(getByLabelText('Publish Item')).toBeTruthy();
    });

    it('has button role', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} />);

      expect(getByTestId('publish-button').props.accessibilityRole).toBe('button');
    });

    it('has accessible state when disabled', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} disabled={true} />);

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState).toEqual({ disabled: true, busy: false });
    });

    it('has accessible state when loading', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} loading={true} />);

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    });

    it('has accessible state when normal', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} />);

      const button = getByTestId('publish-button');
      expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <PublishButton onPress={mockOnPress} testID="custom-publish-btn" />
      );

      expect(getByTestId('custom-publish-btn')).toBeTruthy();
    });

    it('uses default testID when not provided', () => {
      const { getByTestId } = render(<PublishButton onPress={mockOnPress} />);

      expect(getByTestId('publish-button')).toBeTruthy();
    });
  });
});
