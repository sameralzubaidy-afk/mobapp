/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/GenderSelector.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for GenderSelector
 *
 * Test Coverage:
 * - Rendering all 4 options (boy, girl, unisex, Any)
 * - "Any" maps to undefined (not string)
 * - Selection functionality
 * - Values match MODULE-05 V3 enum
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GenderSelector } from '../../listing/GenderSelector';

describe('GenderSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all 4 gender options', () => {
      const { getByText } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      expect(getByText('Boy')).toBeTruthy();
      expect(getByText('Girl')).toBeTruthy();
      expect(getByText('Unisex')).toBeTruthy();
      expect(getByText('Any')).toBeTruthy();
    });

    it('displays title', () => {
      const { getByText } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      expect(getByText('Gender')).toBeTruthy();
    });
  });

  describe('Selection', () => {
    it('calls onChange with correct value for boy', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-boy'));
      expect(mockOnChange).toHaveBeenCalledWith('boy');
    });

    it('calls onChange with correct value for girl', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-girl'));
      expect(mockOnChange).toHaveBeenCalledWith('girl');
    });

    it('calls onChange with correct value for unisex', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-unisex'));
      expect(mockOnChange).toHaveBeenCalledWith('unisex');
    });

    it('CRITICAL: "Any" calls onChange with null (not string)', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-any'));
      expect(mockOnChange).toHaveBeenCalledWith(null);
      expect(mockOnChange).not.toHaveBeenCalledWith('any');
      expect(mockOnChange).not.toHaveBeenCalledWith('Any');
    });

    it('shows selected state visually', () => {
      const { getByTestId } = render(<GenderSelector value="boy" onChange={mockOnChange} />);

      const selectedPill = getByTestId('gender-boy');
      expect(selectedPill.props.accessibilityState).toEqual({ selected: true });
    });
  });

  describe('MODULE-05 V3 Enum Compliance', () => {
    it('uses exact enum values (boy, girl, unisex)', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      // Enum values from MODULE-05 V3
      expect(getByTestId('gender-boy')).toBeTruthy();
      expect(getByTestId('gender-girl')).toBeTruthy();
      expect(getByTestId('gender-unisex')).toBeTruthy();
    });

    it('onChange receives valid enum values only', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      const validValues = ['boy', 'girl', 'unisex', null];

      fireEvent.press(getByTestId('gender-boy'));
      fireEvent.press(getByTestId('gender-girl'));
      fireEvent.press(getByTestId('gender-unisex'));
      fireEvent.press(getByTestId('gender-any'));

      const calls = mockOnChange.mock.calls;
      calls.forEach((call) => {
        expect(validValues).toContain(call[0]);
      });
    });
  });

  describe('Null Value Behavior', () => {
    it('handles null value correctly (no selection)', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      const anyPill = getByTestId('gender-any');
      expect(anyPill.props.accessibilityState).toEqual({ selected: true });
    });

    it('selecting "Any" after another selection sets value to null', () => {
      const { getByTestId } = render(<GenderSelector value="boy" onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-any'));
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it('can switch from null (Any) to specific gender', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('gender-girl'));
      expect(mockOnChange).toHaveBeenCalledWith('girl');
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for all genders', () => {
      const { getByLabelText } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      expect(getByLabelText('Gender: Boy')).toBeTruthy();
      expect(getByLabelText('Gender: Girl')).toBeTruthy();
      expect(getByLabelText('Gender: Unisex')).toBeTruthy();
      expect(getByLabelText('Gender: Any')).toBeTruthy();
    });

    it('has button role for gender pills', () => {
      const { getByTestId } = render(<GenderSelector value={null} onChange={mockOnChange} />);

      expect(getByTestId('gender-boy').props.accessibilityRole).toBe('button');
      expect(getByTestId('gender-girl').props.accessibilityRole).toBe('button');
      expect(getByTestId('gender-unisex').props.accessibilityRole).toBe('button');
      expect(getByTestId('gender-any').props.accessibilityRole).toBe('button');
    });

    it('has accessible state for selected gender', () => {
      const { getByTestId } = render(<GenderSelector value="unisex" onChange={mockOnChange} />);

      const selectedPill = getByTestId('gender-unisex');
      expect(selectedPill.props.accessibilityState).toEqual({ selected: true });

      const unselectedPill = getByTestId('gender-boy');
      expect(unselectedPill.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <GenderSelector value={null} onChange={mockOnChange} testID="custom-gender-selector" />
      );

      expect(getByTestId('custom-gender-selector')).toBeTruthy();
    });
  });
});
