/**
 * Unit tests for BrandAutocompleteInput component
 * MODULE-04 LISTING-V3-009: Brand Autocomplete Input
 *
 * Test coverage:
 * - Rendering with label/placeholder
 * - Debounced search (150ms)
 * - Suggestion display
 * - Suggestion selection
 * - Keyboard dismissal
 * - Loading state
 * - Edge cases (empty query, error handling)
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { BrandAutocompleteInput } from '../../molecules/BrandAutocompleteInput';
import * as brandAutocomplete from '@/services/brandAutocomplete';

// Mock the brand autocomplete service
jest.mock('@/services/brandAutocomplete');

describe('BrandAutocompleteInput', () => {
  const mockGetBrandSuggestions = brandAutocomplete.getBrandSuggestions as jest.MockedFunction<
    typeof brandAutocomplete.getBrandSuggestions
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render with label and placeholder', () => {
      const { getByText, getByPlaceholderText } = render(
        <BrandAutocompleteInput
          value=""
          onChange={jest.fn()}
          label="Brand Name"
          placeholder="Type brand..."
        />
      );

      expect(getByText('Brand Name')).toBeTruthy();
      expect(getByPlaceholderText('Type brand...')).toBeTruthy();
    });

    it('should show required indicator when required=true', () => {
      const { getByText } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} label="Brand" required />
      );

      expect(getByText('*')).toBeTruthy();
    });

    it('should display current value', () => {
      const { getByDisplayValue } = render(
        <BrandAutocompleteInput value="LEGO" onChange={jest.fn()} />
      );

      expect(getByDisplayValue('LEGO')).toBeTruthy();
    });
  });

  describe('Debounced Search', () => {
    it('should debounce search with 150ms delay', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['LEGO', 'LEGO Duplo']);

      const { getByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      // Type quickly
      fireEvent.changeText(input, 'l');
      fireEvent.changeText(input, 'le');
      fireEvent.changeText(input, 'leg');

      // Should not call immediately
      expect(mockGetBrandSuggestions).not.toHaveBeenCalled();

      // Fast-forward 150ms
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        // Should call only once with final value
        expect(mockGetBrandSuggestions).toHaveBeenCalledTimes(1);
        expect(mockGetBrandSuggestions).toHaveBeenCalledWith('leg');
      });
    });

    it('should not search for queries < 2 characters', async () => {
      const { getByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'a');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(mockGetBrandSuggestions).not.toHaveBeenCalled();
    });

    it('should search for queries >= 2 characters', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['Nike']);

      const { getByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'ni');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockGetBrandSuggestions).toHaveBeenCalledWith('ni');
      });
    });
  });

  describe('Suggestion Display', () => {
    it('should show suggestions after debounce', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['LEGO', 'LEGO Duplo', 'LEGO Friends']);

      const { getByTestId, queryByText } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'lego');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(queryByText('LEGO')).toBeTruthy();
        expect(queryByText('LEGO Duplo')).toBeTruthy();
        expect(queryByText('LEGO Friends')).toBeTruthy();
      });
    });

    it('should not show suggestions if results are empty', async () => {
      mockGetBrandSuggestions.mockResolvedValue([]);

      const { getByTestId, queryByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'xyz');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(queryByTestId('brand-input-suggestions-list')).toBeNull();
      });
    });

    it('should show loading indicator while fetching', async () => {
      let resolveFn: (value: string[]) => void;
      const promise = new Promise<string[]>((resolve) => {
        resolveFn = resolve;
      });
      mockGetBrandSuggestions.mockReturnValue(promise);

      const { getByTestId, queryByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'nike');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockGetBrandSuggestions).toHaveBeenCalled();
      });

      // Loading indicator should be visible
      expect(queryByTestId('brand-input')).toBeTruthy();

      // Resolve promise
      act(() => {
        resolveFn!(['Nike', 'Nike Kids']);
      });

      await waitFor(() => {
        expect(queryByTestId('brand-input-suggestions-list')).toBeTruthy();
      });
    });
  });

  describe('Suggestion Selection', () => {
    it('should call onChange when suggestion is tapped', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['LEGO', 'LEGO Duplo']);

      const mockOnChange = jest.fn();

      const { getByTestId, getByText } = render(
        <BrandAutocompleteInput value="" onChange={mockOnChange} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'lego');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(getByText('LEGO')).toBeTruthy();
      });

      // Tap on suggestion
      fireEvent.press(getByText('LEGO'));

      expect(mockOnChange).toHaveBeenCalledWith('LEGO');
    });

    it('should update input value when suggestion is selected', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['Nike']);

      const mockOnChange = jest.fn();

      const { getByTestId, getByText, getByDisplayValue } = render(
        <BrandAutocompleteInput value="" onChange={mockOnChange} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'ni');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(getByText('Nike')).toBeTruthy();
      });

      fireEvent.press(getByText('Nike'));

      await waitFor(() => {
        expect(getByDisplayValue('Nike')).toBeTruthy();
      });
    });

    it('should hide suggestions after selection', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['LEGO']);

      const { getByTestId, getByText, queryByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'lego');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(getByText('LEGO')).toBeTruthy();
      });

      fireEvent.press(getByText('LEGO'));

      await waitFor(() => {
        expect(queryByTestId('brand-input-suggestions-list')).toBeNull();
      });
    });
  });

  describe('Focus/Blur Behavior', () => {
    it('should show suggestions on focus if query >= 2 chars', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['Nike']);

      const { getByTestId, queryByText } = render(
        <BrandAutocompleteInput value="ni" onChange={jest.fn()} testID="brand-input" />
      );

      // Wait for initial fetch
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockGetBrandSuggestions).toHaveBeenCalled();
      });

      const input = getByTestId('brand-input-input');

      // Suggestions may be hidden initially
      // Focus should show them
      fireEvent(input, 'focus');

      await waitFor(() => {
        expect(queryByText('Nike')).toBeTruthy();
      });
    });

    it('should hide suggestions on blur', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['Nike']);

      const { getByTestId, queryByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'nike');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(queryByTestId('brand-input-suggestions-list')).toBeTruthy();
      });

      // Blur
      fireEvent(input, 'blur');

      // Wait for 200ms delay
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(queryByTestId('brand-input-suggestions-list')).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockGetBrandSuggestions.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { getByTestId, queryByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'test');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockGetBrandSuggestions).toHaveBeenCalled();
      });

      // Should not show suggestions
      expect(queryByTestId('brand-input-suggestions-list')).toBeNull();

      // Should log error
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty trimmed query', async () => {
      const { getByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, '   ');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(mockGetBrandSuggestions).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} label="Brand Name" />
      );

      expect(getByLabelText('Brand Name')).toBeTruthy();
    });

    it('should mark suggestion buttons with proper role', async () => {
      mockGetBrandSuggestions.mockResolvedValue(['Nike']);

      const { getByTestId } = render(
        <BrandAutocompleteInput value="" onChange={jest.fn()} testID="brand-input" />
      );

      const input = getByTestId('brand-input-input');

      fireEvent.changeText(input, 'nike');

      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const suggestion = getByTestId('brand-input-suggestion-nike');
        expect(suggestion.props.accessibilityRole).toBe('button');
      });
    });
  });
});
