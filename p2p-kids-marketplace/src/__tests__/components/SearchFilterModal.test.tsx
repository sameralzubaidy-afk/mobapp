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

// DISCOVER-REDESIGN: mock the live-count RPC wrapper (debounced inside the sheet).
jest.mock('@/services/discovery', () => ({
  countListings: jest.fn().mockResolvedValue(7),
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
    // DISCOVER-REDESIGN: the sheet is now progressively disclosed — SP toggle on
    // top, Location/Category/Age Group always expanded, the rest collapsed under
    // "More Filters".
    it('should render the redesigned layout with progressive disclosure', () => {
      const { getByText, getByTestId, queryByText } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Always visible: SP toggle card, Location, Category, Age Group, More Filters
      expect(getByText('💰 Accepts Swap Points')).toBeTruthy();
      expect(getByText('LOCATION')).toBeTruthy();
      expect(getByText('CATEGORY')).toBeTruthy();
      expect(getByText('AGE GROUP')).toBeTruthy();
      expect(
        getByText('More Filters (Condition, Gender, Color, Brand, Price Range)')
      ).toBeTruthy();

      // Collapsed by default: secondary filters are hidden
      expect(queryByText('CONDITION')).toBeNull();
      expect(queryByText('BRAND')).toBeNull();
      expect(queryByText('PRICE RANGE')).toBeNull();

      // Expand -> secondary filters appear
      fireEvent.press(getByTestId('filter-more-filters-toggle'));
      expect(getByText('CONDITION')).toBeTruthy();
      expect(getByText('GENDER')).toBeTruthy();
      expect(getByText('COLOR')).toBeTruthy();
      expect(getByText('BRAND')).toBeTruthy();
      expect(getByText('PRICE RANGE')).toBeTruthy();
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

      // Expand "More Filters" (Condition is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Change a filter (Condition lives in the collapsed "More Filters" section)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));
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

      // Expand "More Filters" (Condition is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Condition is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Gender is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Gender is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Color is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Color is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Brand is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Brand is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Brand is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Price Range is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Price Range is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Price Range is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // Expand "More Filters" (Price Range is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

  describe('Swap Points Filter (live, shared with the Discover header chip)', () => {
    it('should toggle the shared SP filter immediately via onSpToggle', () => {
      const mockOnSpToggle = jest.fn();
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={getDefaultFilters()}
          categories={mockCategories}
          spEligibleOnly={false}
          onSpToggle={mockOnSpToggle}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      const toggle = getByTestId('filter-sp-toggle');

      // DISCOVER-REDESIGN: the SP toggle is a LIVE filter — flipping it calls the
      // shared onSpToggle (not the Apply-gated draft).
      fireEvent(toggle, 'onValueChange', true);
      expect(mockOnSpToggle).toHaveBeenCalledWith(true);

      // Applying the draft does NOT reflect the live SP toggle (SP is shared
      // separately via onSpToggle) — the draft keeps its default spEligibleOnly:false.
      fireEvent.press(getByTestId('filter-modal-apply'));
      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({ spEligibleOnly: false })
      );
    });
  });

  describe('Clear All', () => {
    it('should reset all filters to defaults', async () => {
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

      const mockOnSpToggle = jest.fn();
      const { getByTestId } = render(
        <SearchFilterModal
          visible={true}
          filters={filtersWithData}
          categories={mockCategories}
          zipCodeInput="12345"
          appliedZipCode="12345"
          radiusMiles={15}
          minRadiusMiles={5}
          maxRadiusMiles={100}
          locationLoading={false}
          inactiveZipMessage={null}
          waitlistMessage={null}
          userProfileZip="12345"
          spEligibleOnly={true}
          onSpToggle={mockOnSpToggle}
          onZipCodeInputChange={jest.fn()}
          onRadiusChange={jest.fn()}
          onRadiusComplete={jest.fn(async () => undefined)}
          onApply={mockOnApply}
          onClose={mockOnClose}
        />
      );

      // Expand "More Filters" so Condition/Gender pills are in the tree
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

      fireEvent.press(getByTestId('filter-modal-reset'));

      // Check that selections are cleared (and the LIVE shared SP toggle is reset)
      await waitFor(() => {
        expect(getByTestId('filter-condition-like_new').props.accessibilityState.selected).toBe(
          false
        );
        expect(getByTestId('filter-age-3-5').props.accessibilityState.selected).toBe(false);
        expect(getByTestId('filter-gender-boy').props.accessibilityState.selected).toBe(false);
        expect(mockOnSpToggle).toHaveBeenCalledWith(false);
      });
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

      expect(getByTestId('filter-modal-reset').props.accessibilityLabel).toBe(
        'Reset all filters'
      );
      // DISCOVER-REDESIGN: the Apply button now reads "Show {n} Results".
      expect(getByTestId('filter-modal-apply').props.accessibilityLabel).toContain('Show');
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

      // Expand "More Filters" (Condition is collapsed by default)
      fireEvent.press(getByTestId('filter-more-filters-toggle'));

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

      // DISCOVER-REDESIGN: label is now "Accepts Swap Points enabled/disabled".
      expect(toggle.props.accessibilityLabel).toContain('Accepts Swap Points');
    });
  });
});
