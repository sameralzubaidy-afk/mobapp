/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/ConditionSelector.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for ConditionSelector
 *
 * Test Coverage:
 * - Rendering all 5 conditions
 * - Radio button selection
 * - Photo guide button functionality
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConditionSelector } from '../../listing/ConditionSelector';

describe('ConditionSelector', () => {
  const mockOnChange = jest.fn();
  const mockOnOpenGuide = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all 5 condition options', () => {
      const { getByText } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByText('New')).toBeTruthy();
      expect(getByText('Like New')).toBeTruthy();
      expect(getByText('Good')).toBeTruthy();
      expect(getByText('Fair')).toBeTruthy();
      expect(getByText('Worn')).toBeTruthy();
    });

    it('displays condition descriptions', () => {
      const { getByText } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByText('Brand new with tags')).toBeTruthy();
      expect(getByText('Excellent condition, barely used')).toBeTruthy();
      expect(getByText('Gently used, minor wear')).toBeTruthy();
      expect(getByText('Noticeable wear, fully functional')).toBeTruthy();
      expect(getByText('Heavy wear, still usable')).toBeTruthy();
    });

    it('renders photo guide buttons for each condition', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByTestId('guide-new')).toBeTruthy();
      expect(getByTestId('guide-like_new')).toBeTruthy();
      expect(getByTestId('guide-good')).toBeTruthy();
      expect(getByTestId('guide-fair')).toBeTruthy();
      expect(getByTestId('guide-worn')).toBeTruthy();
    });
  });

  describe('Selection', () => {
    it('calls onChange when condition is selected', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      fireEvent.press(getByTestId('condition-good'));
      expect(mockOnChange).toHaveBeenCalledWith('good');
    });

    it('shows selected condition visually', () => {
      const { getByTestId } = render(
        <ConditionSelector value="good" onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      const goodRadio = getByTestId('condition-good');
      expect(goodRadio).toBeTruthy();
      // Note: Visual selection is checked via accessibilityState in accessibility tests
    });

    it('can select different conditions', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      fireEvent.press(getByTestId('condition-new'));
      expect(mockOnChange).toHaveBeenCalledWith('new');

      fireEvent.press(getByTestId('condition-like_new'));
      expect(mockOnChange).toHaveBeenCalledWith('like_new');

      fireEvent.press(getByTestId('condition-fair'));
      expect(mockOnChange).toHaveBeenCalledWith('fair');

      fireEvent.press(getByTestId('condition-worn'));
      expect(mockOnChange).toHaveBeenCalledWith('worn');

      expect(mockOnChange).toHaveBeenCalledTimes(4);
    });
  });

  describe('Photo Guide', () => {
    it('calls onOpenGuide with correct condition', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      fireEvent.press(getByTestId('guide-good'));
      expect(mockOnOpenGuide).toHaveBeenCalledWith('good');

      fireEvent.press(getByTestId('guide-new'));
      expect(mockOnOpenGuide).toHaveBeenCalledWith('new');

      fireEvent.press(getByTestId('guide-worn'));
      expect(mockOnOpenGuide).toHaveBeenCalledWith('worn');

      expect(mockOnOpenGuide).toHaveBeenCalledTimes(3);
    });

    it('displays camera guide icons for each condition', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByTestId('guide-icon-new')).toBeTruthy();
      expect(getByTestId('guide-icon-like_new')).toBeTruthy();
      expect(getByTestId('guide-icon-good')).toBeTruthy();
      expect(getByTestId('guide-icon-fair')).toBeTruthy();
      expect(getByTestId('guide-icon-worn')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has button role for condition options (BP-53: radio does not surface on iOS)', () => {
      const { getByTestId } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByTestId('condition-new').props.accessibilityRole).toBe('button');
      expect(getByTestId('condition-like_new').props.accessibilityRole).toBe('button');
      expect(getByTestId('condition-good').props.accessibilityRole).toBe('button');
      expect(getByTestId('condition-fair').props.accessibilityRole).toBe('button');
      expect(getByTestId('condition-worn').props.accessibilityRole).toBe('button');
    });

    it('has accessible labels for conditions', () => {
      const { getByLabelText } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByLabelText('Select condition: New')).toBeTruthy();
      expect(getByLabelText('Select condition: Like New')).toBeTruthy();
      expect(getByLabelText('Select condition: Good')).toBeTruthy();
      expect(getByLabelText('Select condition: Fair')).toBeTruthy();
      expect(getByLabelText('Select condition: Worn')).toBeTruthy();
    });

    it('has accessible state for selected condition', () => {
      const { getByTestId } = render(
        <ConditionSelector value="good" onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      const goodButton = getByTestId('condition-good');
      // accessibilityState should carry checked AND selected for the chosen row.
      expect(goodButton.props.accessibilityState).toEqual({ selected: true, checked: true });
    });

    it('has accessible labels for photo guide buttons', () => {
      const { getByLabelText } = render(
        <ConditionSelector value={null} onChange={mockOnChange} onOpenGuide={mockOnOpenGuide} />
      );

      expect(getByLabelText('View photo guide for New')).toBeTruthy();
      expect(getByLabelText('View photo guide for Good')).toBeTruthy();
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <ConditionSelector
          value={null}
          onChange={mockOnChange}
          onOpenGuide={mockOnOpenGuide}
          testID="custom-condition-selector"
        />
      );

      expect(getByTestId('custom-condition-selector')).toBeTruthy();
    });
  });
});
