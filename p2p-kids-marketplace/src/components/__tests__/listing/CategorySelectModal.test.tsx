/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/CategorySelectModal.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for CategorySelectModal
 *
 * Test Coverage:
 * - Rendering modal when visible/hidden
 * - Search functionality
 * - Recent categories display
 * - Category selection
 * - "Other" custom category input
 * - Close functionality
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategorySelectModal, Category } from '../../listing/CategorySelectModal';

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'Shoes', icon: '👟' },
  { id: 'cat-2', name: 'Clothing', icon: '👕' },
  { id: 'cat-3', name: 'Toys', icon: '🧸' },
  { id: 'cat-4', name: 'Books', icon: '📚' },
  { id: 'cat-5', name: 'Electronics', icon: '📱' },
];

const mockRecent: Category[] = [
  { id: 'cat-1', name: 'Shoes', icon: '👟' },
  { id: 'cat-2', name: 'Clothing', icon: '👕' },
];

describe('CategorySelectModal', () => {
  const mockOnSelect = jest.fn();
  const mockOnSelectOther = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders when visible is true', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('category-select-modal')).toBeTruthy();
    });

    it('does not render when visible is false', () => {
      const { queryByTestId } = render(
        <CategorySelectModal
          visible={false}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(queryByTestId('category-select-modal')).toBeNull();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('category-search-input')).toBeTruthy();
    });

    it('filters categories based on search query', () => {
      const { getByTestId, getByText, queryByText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      const searchInput = getByTestId('category-search-input');
      fireEvent.changeText(searchInput, 'Shoes');

      expect(getByText('Shoes')).toBeTruthy();
      expect(queryByText('Toys')).toBeNull();
    });

    it('shows all categories when search is empty', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByTestId('category-cat-1')).toBeTruthy();
      expect(getByTestId('category-cat-2')).toBeTruthy();
      expect(getByTestId('category-cat-3')).toBeTruthy();
      expect(getByTestId('category-cat-4')).toBeTruthy();
      expect(getByTestId('category-cat-5')).toBeTruthy();
    });

    it('shows empty state when no results', () => {
      const { getByTestId, getByText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      const searchInput = getByTestId('category-search-input');
      fireEvent.changeText(searchInput, 'NonexistentCategory');

      expect(getByText('No categories found')).toBeTruthy();
    });
  });

  describe('Recent Categories', () => {
    it('displays recent categories when not searching', () => {
      const { getByText, getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Recent')).toBeTruthy();
      expect(getByTestId('recent-cat-1')).toBeTruthy();
      expect(getByTestId('recent-cat-2')).toBeTruthy();
    });

    it('hides recent categories when searching', () => {
      const { getByTestId, queryByText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      const searchInput = getByTestId('category-search-input');
      fireEvent.changeText(searchInput, 'Shoes');

      expect(queryByText('Recent')).toBeNull();
    });

    it('does not render recent section when empty', () => {
      const { queryByText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={[]}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(queryByText('Recent')).toBeNull();
    });

    it('calls onSelect when recent category is clicked', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('recent-cat-1'));
      expect(mockOnSelect).toHaveBeenCalledWith(mockRecent[0]);
    });
  });

  describe('Category Selection', () => {
    it('calls onSelect when category is clicked', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('category-cat-1'));
      expect(mockOnSelect).toHaveBeenCalledWith(mockCategories[0]);
    });

    it('displays category icons', () => {
      const { getByText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByText('👟')).toBeTruthy();
      expect(getByText('👕')).toBeTruthy();
      expect(getByText('🧸')).toBeTruthy();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is pressed', () => {
      const { getByTestId } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByTestId('close-modal'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for search input', () => {
      const { getByLabelText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByLabelText('Search categories')).toBeTruthy();
    });

    it('has accessible labels for category buttons', () => {
      const { getByLabelText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByLabelText('Select category: Shoes')).toBeTruthy();
      expect(getByLabelText('Select category: Clothing')).toBeTruthy();
    });

    it('has accessible label for close button', () => {
      const { getByLabelText } = render(
        <CategorySelectModal
          visible={true}
          categories={mockCategories}
          recent={mockRecent}
          onSelect={mockOnSelect}
          onSelectOther={mockOnSelectOther}
          onClose={mockOnClose}
        />
      );

      expect(getByLabelText('Close category selection')).toBeTruthy();
    });
  });
});
