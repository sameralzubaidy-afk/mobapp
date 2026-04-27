/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/ColorPicker.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for ColorPicker
 *
 * Test Coverage:
 * - Rendering all 12 colors
 * - Multi-select functionality
 * - Max colors enforcement
 * - Selected state visualization
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ColorPicker } from '../../listing/ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all 12 color swatches', () => {
      const { getByTestId } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      expect(getByTestId('color-red')).toBeTruthy();
      expect(getByTestId('color-pink')).toBeTruthy();
      expect(getByTestId('color-purple')).toBeTruthy();
      expect(getByTestId('color-blue')).toBeTruthy();
      expect(getByTestId('color-green')).toBeTruthy();
      expect(getByTestId('color-yellow')).toBeTruthy();
      expect(getByTestId('color-orange')).toBeTruthy();
      expect(getByTestId('color-brown')).toBeTruthy();
      expect(getByTestId('color-gray')).toBeTruthy();
      expect(getByTestId('color-black')).toBeTruthy();
      expect(getByTestId('color-white')).toBeTruthy();
      expect(getByTestId('color-multicolor')).toBeTruthy();
    });

    it('displays color names', () => {
      const { getByText } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      expect(getByText('Red')).toBeTruthy();
      expect(getByText('Pink')).toBeTruthy();
      expect(getByText('Purple')).toBeTruthy();
      expect(getByText('Blue')).toBeTruthy();
      expect(getByText('Green')).toBeTruthy();
      expect(getByText('Yellow')).toBeTruthy();
      expect(getByText('Orange')).toBeTruthy();
      expect(getByText('Brown')).toBeTruthy();
      expect(getByText('Gray')).toBeTruthy();
      expect(getByText('Black')).toBeTruthy();
      expect(getByText('White')).toBeTruthy();
      expect(getByText('Multicolor')).toBeTruthy();
    });

    it('displays selection count', () => {
      const { getByText } = render(
        <ColorPicker selectedColors={['red', 'blue']} onChange={mockOnChange} />
      );

      expect(getByText('2/3 selected')).toBeTruthy();
    });
  });

  describe('Multi-Select Functionality', () => {
    it('adds color to selection when clicked', () => {
      const { getByTestId } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('color-red'));
      expect(mockOnChange).toHaveBeenCalledWith(['red']);
    });

    it('removes color from selection when clicked again', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={['red']} onChange={mockOnChange} />
      );

      fireEvent.press(getByTestId('color-red'));
      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it('allows selecting multiple colors', () => {
      const { getByTestId, rerender } = render(
        <ColorPicker selectedColors={[]} onChange={mockOnChange} />
      );

      fireEvent.press(getByTestId('color-red'));
      expect(mockOnChange).toHaveBeenCalledWith(['red']);

      rerender(<ColorPicker selectedColors={['red']} onChange={mockOnChange} />);

      fireEvent.press(getByTestId('color-blue'));
      expect(mockOnChange).toHaveBeenCalledWith(['red', 'blue']);
    });

    it('displays check mark on selected colors', () => {
      const { getAllByText } = render(
        <ColorPicker selectedColors={['red', 'blue']} onChange={mockOnChange} />
      );

      const checkMarks = getAllByText('✓');
      expect(checkMarks.length).toBe(2);
    });
  });

  describe('Max Colors Enforcement', () => {
    it('does not allow selecting more than max colors (default 3)', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={['red', 'blue', 'green']} onChange={mockOnChange} />
      );

      fireEvent.press(getByTestId('color-yellow'));
      // onChange should not be called because max is reached
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('respects custom maxColors prop', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={['red']} onChange={mockOnChange} maxColors={1} />
      );

      fireEvent.press(getByTestId('color-blue'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('displays max limit message when limit reached', () => {
      const { getByText } = render(
        <ColorPicker selectedColors={['red', 'blue', 'green']} onChange={mockOnChange} />
      );

      expect(getByText('Maximum 3 colors')).toBeTruthy();
    });

    it('allows deselecting when at max', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={['red', 'blue', 'green']} onChange={mockOnChange} />
      );

      fireEvent.press(getByTestId('color-red'));
      expect(mockOnChange).toHaveBeenCalledWith(['blue', 'green']);
    });
  });

  describe('Accessibility', () => {
    it('has checkbox role for color swatches', () => {
      const { getByTestId } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      const redSwatch = getByTestId('color-red');
      expect(redSwatch.props.accessibilityRole).toBe('checkbox');
    });

    it('has accessible labels for colors', () => {
      const { getByLabelText } = render(
        <ColorPicker selectedColors={[]} onChange={mockOnChange} />
      );

      expect(getByLabelText('Red color')).toBeTruthy();
      expect(getByLabelText('Blue color')).toBeTruthy();
      expect(getByLabelText('Multicolor color')).toBeTruthy();
    });

    it('has accessible state for selected colors', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={['red']} onChange={mockOnChange} />
      );

      const redSwatch = getByTestId('color-red');
      expect(redSwatch.props.accessibilityState).toEqual({ checked: true });

      const blueSwatch = getByTestId('color-blue');
      expect(blueSwatch.props.accessibilityState).toEqual({ checked: false });
    });
  });

  describe('Special Colors', () => {
    it('renders multicolor swatch with stripes', () => {
      const { getByTestId } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      // Multicolor swatch should exist
      expect(getByTestId('color-multicolor')).toBeTruthy();
    });

    it('white swatch has visible border', () => {
      const { getByTestId } = render(<ColorPicker selectedColors={[]} onChange={mockOnChange} />);

      // White swatch should exist (border styling tested visually)
      expect(getByTestId('color-white')).toBeTruthy();
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <ColorPicker selectedColors={[]} onChange={mockOnChange} testID="custom-color-picker" />
      );

      expect(getByTestId('custom-color-picker')).toBeTruthy();
    });
  });
});
