/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/ConditionGuideOverlay.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for ConditionGuideOverlay
 *
 * Test Coverage:
 * - Modal visibility
 * - Condition-specific content
 * - Photo examples
 * - Tips display
 * - Close functionality
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConditionGuideOverlay } from '../../listing/ConditionGuideOverlay';

describe('ConditionGuideOverlay', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders when visible and condition is provided', () => {
      const { getByTestId } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      expect(getByTestId('condition-guide-overlay')).toBeTruthy();
    });

    it('does not render when visible is false', () => {
      const { queryByTestId } = render(
        <ConditionGuideOverlay visible={false} condition="good" onClose={mockOnClose} />
      );

      expect(queryByTestId('condition-guide-overlay')).toBeNull();
    });

    it('does not render when condition is null', () => {
      const { queryByTestId } = render(
        <ConditionGuideOverlay visible={true} condition={null} onClose={mockOnClose} />
      );

      expect(queryByTestId('condition-guide-overlay')).toBeNull();
    });
  });

  describe('Content for "new" condition', () => {
    it('displays correct title', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="new" onClose={mockOnClose} />
      );

      expect(getByText('New Condition')).toBeTruthy();
    });

    it('displays description', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="new" onClose={mockOnClose} />
      );

      expect(getByText('Brand new with original tags attached')).toBeTruthy();
    });

    it('displays tips', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="new" onClose={mockOnClose} />
      );

      expect(getByText('Has original tags')).toBeTruthy();
      expect(getByText('Never worn or used')).toBeTruthy();
      expect(getByText('In original packaging')).toBeTruthy();
      expect(getByText('No signs of wear')).toBeTruthy();
    });
  });

  describe('Content for "like_new" condition', () => {
    it('displays correct content', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="like_new" onClose={mockOnClose} />
      );

      expect(getByText('Like New Condition')).toBeTruthy();
      expect(getByText('Excellent condition, barely used')).toBeTruthy();
      expect(getByText('Worn/used 1-2 times')).toBeTruthy();
    });
  });

  describe('Content for "good" condition', () => {
    it('displays correct content', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      expect(getByText('Good Condition')).toBeTruthy();
      expect(getByText('Gently used with minor wear')).toBeTruthy();
      expect(getByText('Minor signs of wear')).toBeTruthy();
    });
  });

  describe('Content for "fair" condition', () => {
    it('displays correct content', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="fair" onClose={mockOnClose} />
      );

      expect(getByText('Fair Condition')).toBeTruthy();
      expect(getByText('Noticeable wear but fully functional')).toBeTruthy();
      expect(getByText('Obvious signs of use')).toBeTruthy();
    });
  });

  describe('Content for "worn" condition', () => {
    it('displays correct content', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="worn" onClose={mockOnClose} />
      );

      expect(getByText('Worn Condition')).toBeTruthy();
      expect(getByText('Heavy wear but still usable')).toBeTruthy();
      expect(getByText('Significant wear and tear')).toBeTruthy();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is pressed', () => {
      const { getByTestId } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      fireEvent.press(getByTestId('close-guide'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Photo Example', () => {
    it('displays example photo section', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      expect(getByText('Example photo')).toBeTruthy();
    });
  });

  describe('Tips Section', () => {
    it('displays tips title', () => {
      const { getByText } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      expect(getByText('What to look for:')).toBeTruthy();
    });

    it('displays all tips with bullets', () => {
      const { getAllByText } = render(
        <ConditionGuideOverlay visible={true} condition="new" onClose={mockOnClose} />
      );

      const bullets = getAllByText('•');
      expect(bullets.length).toBe(4); // "new" has 4 tips
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for close button', () => {
      const { getByLabelText } = render(
        <ConditionGuideOverlay visible={true} condition="good" onClose={mockOnClose} />
      );

      expect(getByLabelText('Close condition guide')).toBeTruthy();
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <ConditionGuideOverlay
          visible={true}
          condition="good"
          onClose={mockOnClose}
          testID="custom-guide"
        />
      );

      expect(getByTestId('custom-guide')).toBeTruthy();
    });
  });
});
