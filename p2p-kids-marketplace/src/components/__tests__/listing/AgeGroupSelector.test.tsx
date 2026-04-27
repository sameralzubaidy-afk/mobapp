/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/AgeGroupSelector.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for AgeGroupSelector
 *
 * Test Coverage:
 * - Rendering all 5 age groups
 * - Selection functionality
 * - Values match MODULE-05 V3 enum
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AgeGroupSelector } from '../../listing/AgeGroupSelector';

describe('AgeGroupSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all 5 age group options', () => {
      const { getByText } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      expect(getByText('0-2 years')).toBeTruthy();
      expect(getByText('3-5 years')).toBeTruthy();
      expect(getByText('6-8 years')).toBeTruthy();
      expect(getByText('9-12 years')).toBeTruthy();
      expect(getByText('13+ years')).toBeTruthy();
    });

    it('displays title', () => {
      const { getByText } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      expect(getByText('Age Group')).toBeTruthy();
    });
  });

  describe('Selection', () => {
    it('calls onChange with correct value when age group is selected', () => {
      const { getByTestId } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('age-group-0-2'));
      expect(mockOnChange).toHaveBeenCalledWith('0-2');

      fireEvent.press(getByTestId('age-group-3-5'));
      expect(mockOnChange).toHaveBeenCalledWith('3-5');

      fireEvent.press(getByTestId('age-group-6-8'));
      expect(mockOnChange).toHaveBeenCalledWith('6-8');

      fireEvent.press(getByTestId('age-group-9-12'));
      expect(mockOnChange).toHaveBeenCalledWith('9-12');

      fireEvent.press(getByTestId('age-group-13+'));
      expect(mockOnChange).toHaveBeenCalledWith('13+');
    });

    it('shows selected state visually', () => {
      const { getByTestId } = render(<AgeGroupSelector value="6-8" onChange={mockOnChange} />);

      const selectedPill = getByTestId('age-group-6-8');
      expect(selectedPill.props.accessibilityState).toEqual({ selected: true });
    });

    it('allows changing selection', () => {
      const { getByTestId } = render(<AgeGroupSelector value="0-2" onChange={mockOnChange} />);

      fireEvent.press(getByTestId('age-group-9-12'));
      expect(mockOnChange).toHaveBeenCalledWith('9-12');
    });
  });

  describe('MODULE-05 V3 Enum Compliance', () => {
    it('uses exact enum values from MODULE-05 V3', () => {
      const { getByTestId } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      // Verify testIDs match expected enum values
      expect(getByTestId('age-group-0-2')).toBeTruthy();
      expect(getByTestId('age-group-3-5')).toBeTruthy();
      expect(getByTestId('age-group-6-8')).toBeTruthy();
      expect(getByTestId('age-group-9-12')).toBeTruthy();
      expect(getByTestId('age-group-13+')).toBeTruthy();
    });

    it('onChange receives string values matching enum', () => {
      const { getByTestId } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      const validValues = ['0-2', '3-5', '6-8', '9-12', '13+'];

      fireEvent.press(getByTestId('age-group-0-2'));
      fireEvent.press(getByTestId('age-group-3-5'));
      fireEvent.press(getByTestId('age-group-6-8'));
      fireEvent.press(getByTestId('age-group-9-12'));
      fireEvent.press(getByTestId('age-group-13+'));

      const calls = mockOnChange.mock.calls;
      calls.forEach((call, index) => {
        expect(validValues).toContain(call[0]);
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for age groups', () => {
      const { getByLabelText } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      expect(getByLabelText('Age group: 0-2 years')).toBeTruthy();
      expect(getByLabelText('Age group: 3-5 years')).toBeTruthy();
      expect(getByLabelText('Age group: 6-8 years')).toBeTruthy();
      expect(getByLabelText('Age group: 9-12 years')).toBeTruthy();
      expect(getByLabelText('Age group: 13+ years')).toBeTruthy();
    });

    it('has button role for age group pills', () => {
      const { getByTestId } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      expect(getByTestId('age-group-0-2').props.accessibilityRole).toBe('button');
      expect(getByTestId('age-group-3-5').props.accessibilityRole).toBe('button');
      expect(getByTestId('age-group-6-8').props.accessibilityRole).toBe('button');
      expect(getByTestId('age-group-9-12').props.accessibilityRole).toBe('button');
      expect(getByTestId('age-group-13+').props.accessibilityRole).toBe('button');
    });

    it('has accessible state for selected age group', () => {
      const { getByTestId } = render(<AgeGroupSelector value="6-8" onChange={mockOnChange} />);

      const selectedPill = getByTestId('age-group-6-8');
      expect(selectedPill.props.accessibilityState).toEqual({ selected: true });

      const unselectedPill = getByTestId('age-group-0-2');
      expect(unselectedPill.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe('Edge Cases', () => {
    it('handles null value correctly', () => {
      const { getAllByTestId } = render(<AgeGroupSelector value={null} onChange={mockOnChange} />);

      // All pills should be unselected
      const pills = [
        getAllByTestId('age-group-0-2')[0],
        getAllByTestId('age-group-3-5')[0],
        getAllByTestId('age-group-6-8')[0],
        getAllByTestId('age-group-9-12')[0],
        getAllByTestId('age-group-13+')[0],
      ];

      pills.forEach((pill) => {
        expect(pill.props.accessibilityState).toEqual({ selected: false });
      });
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <AgeGroupSelector value={null} onChange={mockOnChange} testID="custom-age-selector" />
      );

      expect(getByTestId('custom-age-selector')).toBeTruthy();
    });
  });
});
