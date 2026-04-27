/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/PriceSuggestionCard.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for PriceSuggestionCard
 *
 * Test Coverage:
 * - Rendering with 4 price tiers
 * - Rendering manual-only mode (no suggestions)
 * - Tier selection
 * - Manual price input
 * - FAQ button
 * - Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PriceSuggestionCard } from '../../listing/PriceSuggestionCard';
import { PriceSuggestion } from '../../../types/listing';

const mockTiers: PriceSuggestion[] = [
  {
    tier: 'great_deal',
    label: 'Great Deal',
    price: 9.99,
    description: 'Quick sale price',
  },
  {
    tier: 'fair_price',
    label: 'Fair Price',
    price: 13.99,
    description: 'Balanced pricing',
  },
  {
    tier: 'asking_price',
    label: 'Asking Price',
    price: 17.99,
    description: 'Standard market rate',
  },
  {
    tier: 'almost_new',
    label: 'Almost New',
    price: 21.99,
    description: 'Premium pricing',
  },
];

describe('PriceSuggestionCard', () => {
  const mockOnSelectTier = jest.fn();
  const mockOnChangeManual = jest.fn();
  const mockOnShowFaq = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with Suggestions', () => {
    it('renders with price tier suggestions', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByTestId('price-suggestion-card')).toBeTruthy();
    });

    it('displays all 4 tier cards', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByTestId('tier-great_deal')).toBeTruthy();
      expect(getByTestId('tier-fair_price')).toBeTruthy();
      expect(getByTestId('tier-asking_price')).toBeTruthy();
      expect(getByTestId('tier-almost_new')).toBeTruthy();
    });

    it('displays tier labels and prices', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('Great Deal')).toBeTruthy();
      expect(getByText('$9.99')).toBeTruthy();
      expect(getByText('Fair Price')).toBeTruthy();
      expect(getByText('$13.99')).toBeTruthy();
    });

    it('displays tier descriptions', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('Quick sale price')).toBeTruthy();
      expect(getByText('Balanced pricing')).toBeTruthy();
    });

    it('displays subtitle when suggestions are available', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('Suggested pricing based on similar items:')).toBeTruthy();
    });

    it('displays OR divider when suggestions exist', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('OR')).toBeTruthy();
    });
  });

  describe('Manual-Only Mode (No Suggestions)', () => {
    it('renders manual input when tiers array is empty', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={[]}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByTestId('manual-price-input')).toBeTruthy();
    });

    it('displays "no suggestions" message when no tiers', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={[]}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('Not enough data to suggest pricing. Set your price below.')).toBeTruthy();
    });

    it('does not display tier cards when empty', () => {
      const { queryByTestId } = render(
        <PriceSuggestionCard
          tiers={[]}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(queryByTestId('tier-great_deal')).toBeNull();
      expect(queryByTestId('tier-fair_price')).toBeNull();
    });

    it('does not display OR divider when no tiers', () => {
      const { queryByText } = render(
        <PriceSuggestionCard
          tiers={[]}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(queryByText('OR')).toBeNull();
    });
  });

  describe('Tier Selection', () => {
    it('calls onSelectTier when tier card is pressed', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      fireEvent.press(getByTestId('tier-great_deal'));
      expect(mockOnSelectTier).toHaveBeenCalledWith('great_deal');

      fireEvent.press(getByTestId('tier-fair_price'));
      expect(mockOnSelectTier).toHaveBeenCalledWith('fair_price');
    });

    it('shows selected tier visually', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier="fair_price"
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      const selectedTier = getByTestId('tier-fair_price');
      expect(selectedTier.props.accessibilityState).toEqual({ selected: true });
    });
  });

  describe('Manual Price Input', () => {
    it('renders manual input field', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByTestId('manual-price-input')).toBeTruthy();
    });

    it('displays currency symbol', () => {
      const { getByText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByText('$')).toBeTruthy();
    });

    it('displays manual value when provided', () => {
      const { getByDisplayValue } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue="25.99"
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByDisplayValue('25.99')).toBeTruthy();
    });

    it('calls onChangeManual when text changes', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      fireEvent.changeText(getByTestId('manual-price-input'), '15.50');
      expect(mockOnChangeManual).toHaveBeenCalledWith('15.50');
    });

    it('has decimal keyboard type', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      const input = getByTestId('manual-price-input');
      expect(input.props.keyboardType).toBe('decimal-pad');
    });
  });

  describe('FAQ Button', () => {
    it('renders FAQ button when onShowFaq is provided', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
          onShowFaq={mockOnShowFaq}
        />
      );

      expect(getByTestId('pricing-faq')).toBeTruthy();
    });

    it('does not render FAQ button when onShowFaq is not provided', () => {
      const { queryByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(queryByTestId('pricing-faq')).toBeNull();
    });

    it('calls onShowFaq when FAQ button is pressed', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
          onShowFaq={mockOnShowFaq}
        />
      );

      fireEvent.press(getByTestId('pricing-faq'));
      expect(mockOnShowFaq).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for tier buttons', () => {
      const { getByLabelText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByLabelText('Great Deal: $9.99')).toBeTruthy();
      expect(getByLabelText('Fair Price: $13.99')).toBeTruthy();
    });

    it('has accessible hints for tier descriptions', () => {
      const { getByA11yHint } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByA11yHint('Quick sale price')).toBeTruthy();
    });

    it('has accessible label for manual input', () => {
      const { getByLabelText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
        />
      );

      expect(getByLabelText('Manual price input')).toBeTruthy();
    });

    it('has accessible label for FAQ button', () => {
      const { getByLabelText } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
          onShowFaq={mockOnShowFaq}
        />
      );

      expect(getByLabelText('Show pricing FAQ')).toBeTruthy();
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <PriceSuggestionCard
          tiers={mockTiers}
          selectedTier={null}
          manualValue=""
          onSelectTier={mockOnSelectTier}
          onChangeManual={mockOnChangeManual}
          testID="custom-price-card"
        />
      );

      expect(getByTestId('custom-price-card')).toBeTruthy();
    });
  });
});
