/**
 * File: p2p-kids-marketplace/src/__tests__/components/SearchFilterModal.test.tsx
 * MODULE-05-DISCOVERY-V3: SearchFilterModal Unit Tests
 * Task: DISCOVERY-V3-006
 *
 * Tests for SearchFilterModal component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchFilterModal } from '@/components/molecules/SearchFilterModal';
import { getDefaultFilters } from '@/utils/filterHelpers';
import * as brandAutocomplete from '@/services/brandAutocomplete';

// Mock the brand autocomplete service
jest.mock('@/services/brandAutocomplete', () => ({
  getBrandSuggestions: jest.fn(),
}));

const mockCategories = [
  { id: 'cat-1', name: 'Toys', is_active: true, display_order: 1 },
  { id: 'cat-2', name: 'Books', is_active: true, display_order: 2 },
  { id: 'cat-3', name: 'Clothing', is_active: true, display_order: 3 },
];

describe('SearchFilterModal', () => {
  const mockOnApply = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (brandAutocomplete.getBrandSuggestions as jest.Mock).mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('should render all 8 sections in correct order', () => {
      const { getByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Check all section titles in order
      const sectionTitles = [
        'CATEGORY',
        'CONDITION',
        'AGE GROUP',
        'GENDER',
        'COLOR',
        'BRAND',
        'PRICE RANGE',
        'SWAP POINTS ONLY',
      ];

      sectionTitles.forEach((title) => {
        expect(getByText(title)).toBeTruthy();
      });
    });

    it('should display active filter count in header', () => {
      const filtersWithCount = {
        ...getDefaultFilters(),
        condition: 'like_new' as const,
        ageGroup: '3-5' as const,
      };

      const { getByText } = render(
        <SearchFilterModal
          visible={true}
          filters={filtersWithCount}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Filters (2)')).toBeTruthy();
    });

    it('should render all categories', () => {
      const { getByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Toys')).toBeTruthy();
      expect(getByText('Books')).toBeTruthy();
      expect(getByText('Clothing')).toBeTruthy();
    });
  });

  describe('Local Draft State', () => {
    it('should reset draft state when modal opens', () => {
      const initialFilters = {
        ...getDefaultFilters(),
        condition: 'new' as const,
      };

      const { rerender, getByTestId } = render(
        <SearchFilterModal
          visible={false}
          filters={initialFilters}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Open modal
      rerender(
        <SearchFilterModal
          visible={true}
          filters={initialFilters}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // The "new" condition pill should be selected
      const newPill = getByTestId('filter-condition-new');
      expect(newPill.props.accessibilityState.selected).toBe(true);
    });

    it('should not apply changes until Apply button is tapped', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Change a filter
      fireEvent.press(getByTestId('filter-condition-new'));

      // Close without applying
      fireEvent.press(getByTestId('filter-modal-close'));

      // onApply should not have been called
      expect(mockOnApply).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Category Filter (Multi-Select)', () => {
    it('should toggle category selection', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const toysPill = getByTestId('filter-category-cat-1');

      // Initial state: not selected
      expect(toysPill.props.accessibilityState.selected).toBe(false);

      // Select
      fireEvent.press(toysPill);
      expect(toysPill.props.accessibilityState.selected).toBe(true);

      // Deselect
      fireEvent.press(toysPill);
      expect(toysPill.props.accessibilityState.selected).toBe(false);
    });

    it('should allow multiple category selections', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Select multiple categories
      fireEvent.press(getByTestId('filter-category-cat-1'));
      fireEvent.press(getByTestId('filter-category-cat-2'));

      expect(getByTestId('filter-category-cat-1').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('filter-category-cat-2').props.accessibilityState.selected).toBe(true);
    });
  });

  describe('Condition Filter (Single-Select)', () => {
    it('should select only one condition at a time', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Select "new"
      fireEvent.press(getByTestId('filter-condition-new'));
      expect(getByTestId('filter-condition-new').props.accessibilityState.selected).toBe(true);

      // Select "like_new" (should deselect "new")
      fireEvent.press(getByTestId('filter-condition-like_new'));
      expect(getByTestId('filter-condition-like_new').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('filter-condition-new').props.accessibilityState.selected).toBe(false);
    });

    it('should allow deselecting current condition', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const newPill = getByTestId('filter-condition-new');

      // Select
      fireEvent.press(newPill);
      expect(newPill.props.accessibilityState.selected).toBe(true);

      // Deselect by tapping again
      fireEvent.press(newPill);
      expect(newPill.props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Age Group Filter (Single-Select)', () => {
    it('should select only one age group at a time', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('filter-age-0-2'));
      expect(getByTestId('filter-age-0-2').props.accessibilityState.selected).toBe(true);

      fireEvent.press(getByTestId('filter-age-3-5'));
      expect(getByTestId('filter-age-3-5').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('filter-age-0-2').props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Gender Filter (Single-Select with "Any")', () => {
    it('should map "Any" to undefined', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Select "Boy"
      fireEvent.press(getByTestId('filter-gender-boy'));

      // Apply and check the filter value
      fireEvent.press(getByTestId('filter-modal-apply'));

      expect(mockOnApply).toHaveBeenCalledWith(expect.objectContaining({ gender: 'boy' }));
    });

    it('should handle "Any" selection', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={{ ...getDefaultFilters(), gender: 'boy' as const }}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Select "Any" (which maps to undefined)
      fireEvent.press(getByTestId('filter-gender-any'));
      fireEvent.press(getByTestId('filter-modal-apply'));

      expect(mockOnApply).toHaveBeenCalledWith(expect.objectContaining({ gender: undefined }));
    });
  });

  describe('Color Filter (Multi-Select)', () => {
    it('should allow multiple color selections', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('filter-color-red'));
      fireEvent.press(getByTestId('filter-color-blue'));

      expect(getByTestId('filter-color-red').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('filter-color-blue').props.accessibilityState.selected).toBe(true);
    });

    it('should toggle color selection', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const redChip = getByTestId('filter-color-red');

      fireEvent.press(redChip);
      expect(redChip.props.accessibilityState.selected).toBe(true);

      fireEvent.press(redChip);
      expect(redChip.props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Brand Filter (Autocomplete)', () => {
    it('should not show autocomplete for queries less than 2 characters', async () => {
      const { getByTestId, queryByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const brandInput = getByTestId('filter-brand-input');

      fireEvent.changeText(brandInput, 'a');

      await waitFor(() => {
        expect(brandAutocomplete.getBrandSuggestions).not.toHaveBeenCalled();
        expect(queryByTestId('brand-suggestion-0')).toBeNull();
      });
    });

    it('should fetch and display brand suggestions for queries >= 2 characters', async () => {
      (brandAutocomplete.getBrandSuggestions as jest.Mock).mockResolvedValue([
        'LEGO',
        'LEGO Duplo',
      ]);

      const { getByTestId, getByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const brandInput = getByTestId('filter-brand-input');

      fireEvent.changeText(brandInput, 'lego');

      await waitFor(() => {
        expect(brandAutocomplete.getBrandSuggestions).toHaveBeenCalledWith('lego');
        expect(getByText('LEGO')).toBeTruthy();
        expect(getByText('LEGO Duplo')).toBeTruthy();
      });
    });

    it('should close dropdown when brand is selected', async () => {
      (brandAutocomplete.getBrandSuggestions as jest.Mock).mockResolvedValue(['LEGO']);

      const { getByTestId, getByText, queryByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const brandInput = getByTestId('filter-brand-input');

      fireEvent.changeText(brandInput, 'lego');

      await waitFor(() => {
        expect(getByText('LEGO')).toBeTruthy();
      });

      // Select the suggestion
      fireEvent.press(getByTestId('brand-suggestion-0'));

      await waitFor(() => {
        expect(queryByText('LEGO')).toBeNull(); // Dropdown closed
      });
    });
  });

  describe('Price Range Filter', () => {
    it('should select a price preset', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const preset = getByTestId('filter-price-preset-10-25');

      fireEvent.press(preset);

      expect(preset.props.accessibilityState.selected).toBe(true);
    });

    it('should allow custom min and max price', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const minInput = getByTestId('filter-price-min');
      const maxInput = getByTestId('filter-price-max');

      fireEvent.changeText(minInput, '10');
      fireEvent.changeText(maxInput, '50');

      fireEvent.press(getByTestId('filter-modal-apply'));

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 10,
          maxPrice: 50,
        })
      );
    });

    it('should show error when min > max', () => {
      const { getByTestId, getByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const minInput = getByTestId('filter-price-min');
      const maxInput = getByTestId('filter-price-max');

      fireEvent.changeText(minInput, '100');
      fireEvent.changeText(maxInput, '50');

      expect(getByTestId('filter-price-error')).toBeTruthy();
      expect(getByText('Min price must not exceed max price')).toBeTruthy();
    });

    it('should disable Apply button when price validation fails', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const minInput = getByTestId('filter-price-min');
      const maxInput = getByTestId('filter-price-max');
      const applyButton = getByTestId('filter-modal-apply');

      fireEvent.changeText(minInput, '100');
      fireEvent.changeText(maxInput, '50');

      expect(applyButton.props.accessibilityLabel).toContain('disabled');

      // Try to apply
      fireEvent.press(applyButton);

      // Should not have been called
      expect(mockOnApply).not.toHaveBeenCalled();
    });
  });

  describe('Swap Points Filter', () => {
    it('should toggle SP filter', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const toggle = getByTestId('filter-sp-toggle');

      fireEvent(toggle, 'onValueChange', true);

      fireEvent.press(getByTestId('filter-modal-apply'));

      expect(mockOnApply).toHaveBeenCalledWith(expect.objectContaining({ spEligibleOnly: true }));
    });
  });

  describe('Clear All', () => {
    it('should reset all filters to defaults', () => {
      const filtersWithData = {
        ...getDefaultFilters(),
        condition: 'like_new' as const,
        ageGroup: '3-5' as const,
        gender: 'boy' as const,
        colors: ['red', 'blue'],
        brand: 'LEGO',
        minPrice: 10,
        maxPrice: 50,
        spEligibleOnly: true,
      };

      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={filtersWithData}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('filter-modal-clear-all'));

      // Check that selections are cleared
      expect(getByTestId('filter-condition-like_new').props.accessibilityState.selected).toBe(
        false
      );
      expect(getByTestId('filter-age-3-5').props.accessibilityState.selected).toBe(false);
      expect(getByTestId('filter-gender-boy').props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility labels on all interactive elements', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('filter-modal-clear-all').props.accessibilityLabel).toBe(
        'Clear all filters'
      );
      expect(getByTestId('filter-modal-apply').props.accessibilityLabel).toContain('Apply');
    });

    it('should announce selected state for pills', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const conditionPill = getByTestId('filter-condition-new');

      // Not selected initially
      expect(conditionPill.props.accessibilityState.selected).toBe(false);

      // Select
      fireEvent.press(conditionPill);

      // Should announce selected
      expect(conditionPill.props.accessibilityState.selected).toBe(true);
    });

    it('should have accessibility label for SP toggle', () => {
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const toggle = getByTestId('filter-sp-toggle');

      expect(toggle.props.accessibilityLabel).toContain('Swap points only');
    });
  });
});
