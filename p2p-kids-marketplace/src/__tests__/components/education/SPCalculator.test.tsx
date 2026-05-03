// FILE: p2p-kids-marketplace/src/__tests__/components/education/SPCalculator.test.tsx
// MODULE-18 EDU-005: SPCalculator component unit tests

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SPCalculator } from '../../../components/education/SPCalculator';
import * as categoryService from '../../../services/categoryService';
import * as spCalculatorService from '../../../services/spCalculatorService';
import * as educationAnalyticsService from '../../../services/educationAnalyticsService';

// Mock services
jest.mock('../../../services/categoryService');
jest.mock('../../../services/spCalculatorService');
jest.mock('../../../services/educationAnalyticsService');

const mockCategories = [
  {
    id: 'cat-1',
    name: 'LEGO Sets',
    icon: '🧱',
    is_active: true,
    item_count: 10,
    sp_earning_multiplier: 1.30,
    sp_spending_cap_percent: 70,
  },
  {
    id: 'cat-2',
    name: 'Books',
    icon: '📚',
    is_active: true,
    item_count: 5,
    sp_earning_multiplier: 1.10,
    sp_spending_cap_percent: 70,
  },
];

describe('SPCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (categoryService.getCategoriesWithCounts as jest.Mock).mockResolvedValue(mockCategories);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Sell Mode', () => {
    it('renders correctly in sell mode', async () => {
      const { getByText, getByTestId } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByText("Calculate SP You'll Earn")).toBeTruthy();
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
        expect(getByTestId('test-calc-price-input')).toBeTruthy();
      });
    });

    it('calculates SP earned correctly', async () => {
      const mockResult = {
        mode: 'sell' as const,
        price: 25.0,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        earn_sp: 33,
        multiplier: 1.30,
        is_bonus: true,
      };

      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockResult);

      const { getByTestId, getByText } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      // Select category
      const picker = getByTestId('test-calc-category-picker');
      fireEvent(picker, 'onValueChange', 'cat-1');

      // Enter price
      const priceInput = getByTestId('test-calc-price-input');
      fireEvent.changeText(priceInput, '25.00');

      // Tap calculate
      const calculateButton = getByTestId('test-calc-calculate-button');
      fireEvent.press(calculateButton);

      await waitFor(() => {
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25.0, 'cat-1', 'sell');
        expect(getByText("You'll earn:")).toBeTruthy();
        expect(getByText('33 SP ⭐')).toBeTruthy();
      });
    });

    it('tracks analytics on calculate', async () => {
      const mockResult = {
        mode: 'sell' as const,
        price: 25.0,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        earn_sp: 33,
        multiplier: 1.30,
        is_bonus: true,
      };

      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockResult);

      const { getByTestId } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      fireEvent(getByTestId('test-calc-category-picker'), 'onValueChange', 'cat-1');
      fireEvent.changeText(getByTestId('test-calc-price-input'), '25.00');
      fireEvent.press(getByTestId('test-calc-calculate-button'));

      await waitFor(() => {
        expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith(
          'calculator_use',
          {
            mode: 'sell',
            category_id: 'cat-1',
            item_price_bucket: '10-50',
          }
        );
      });
    });

    it('shows bonus badge for bonus categories', async () => {
      const mockResult = {
        mode: 'sell' as const,
        price: 25.0,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        earn_sp: 33,
        multiplier: 1.30,
        is_bonus: true,
      };

      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockResult);

      const { getByTestId, getByText } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      fireEvent(getByTestId('test-calc-category-picker'), 'onValueChange', 'cat-1');
      fireEvent.changeText(getByTestId('test-calc-price-input'), '25.00');
      fireEvent.press(getByTestId('test-calc-calculate-button'));

      await waitFor(() => {
        expect(getByText(/Bonus category!/)).toBeTruthy();
        expect(getByText(/1.3×/)).toBeTruthy();
      });
    });
  });

  describe('Buy Mode', () => {
    it('renders correctly in buy mode', async () => {
      const { getByText, getByTestId } = render(<SPCalculator mode="buy" testID="test-calc" />);

      await waitFor(() => {
        expect(getByText('Calculate SP You Can Use')).toBeTruthy();
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
        expect(getByTestId('test-calc-price-input')).toBeTruthy();
      });
    });

    it('calculates max SP usable and cash breakdown correctly', async () => {
      const mockResult = {
        mode: 'buy' as const,
        price: 50.0,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        max_sp_usable: 35,
        sp_spending_cap_percent: 70,
        sp_to_use: 0,
        cash_paid: 50.0,
        fee: 5.0,
        total_cost: 55.0,
        is_bonus: true,
      };

      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockResult);

      const { getByTestId, getByText } = render(<SPCalculator mode="buy" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      fireEvent(getByTestId('test-calc-category-picker'), 'onValueChange', 'cat-1');
      fireEvent.changeText(getByTestId('test-calc-price-input'), '50.00');
      fireEvent.press(getByTestId('test-calc-calculate-button'));

      await waitFor(() => {
        expect(getByText('Max SP you can use:')).toBeTruthy();
        expect(getByText('35 SP')).toBeTruthy();
        expect(getByText("Cash you'll pay:")).toBeTruthy();
        expect(getByText('$50.00')).toBeTruthy();
        expect(getByText('Platform fee (10%):')).toBeTruthy();
        expect(getByText('$5.00')).toBeTruthy();
        expect(getByText('Total cost:')).toBeTruthy();
        expect(getByText('$55.00')).toBeTruthy();
      });
    });
  });

  describe('Readonly Mode (Checkout)', () => {
    it('auto-fills and calculates with defaults', async () => {
      const mockResult = {
        mode: 'buy' as const,
        price: 30.0,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        max_sp_usable: 21,
        sp_spending_cap_percent: 70,
        sp_to_use: 0,
        cash_paid: 30.0,
        fee: 3.0,
        total_cost: 33.0,
        is_bonus: true,
      };

      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockResult);

      const { getByText } = render(
        <SPCalculator
          mode="buy"
          defaultCategoryId="cat-1"
          defaultPrice={30.0}
          readonly={true}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(30.0, 'cat-1', 'buy');
        expect(getByText('21 SP')).toBeTruthy();
      });
    });

    it('disables editing in readonly mode', async () => {
      const { getByTestId, queryByTestId } = render(
        <SPCalculator
          mode="buy"
          defaultCategoryId="cat-1"
          defaultPrice={30.0}
          readonly={true}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        expect(getByTestId('test-calc-price-input')).toBeTruthy();
      });

      // Calculate button should not exist in readonly mode
      expect(queryByTestId('test-calc-calculate-button')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('handles missing category gracefully', async () => {
      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(null);

      const { getByTestId, queryByTestId } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      fireEvent(getByTestId('test-calc-category-picker'), 'onValueChange', 'invalid-cat');
      fireEvent.changeText(getByTestId('test-calc-price-input'), '25.00');
      fireEvent.press(getByTestId('test-calc-calculate-button'));

      await waitFor(() => {
        expect(queryByTestId('test-calc-result')).toBeNull();
      });
    });

    it('handles invalid price input', async () => {
      const { getByTestId, queryByTestId } = render(<SPCalculator mode="sell" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      fireEvent(getByTestId('test-calc-category-picker'), 'onValueChange', 'cat-1');
      fireEvent.changeText(getByTestId('test-calc-price-input'), 'invalid');
      fireEvent.press(getByTestId('test-calc-calculate-button'));

      await waitFor(() => {
        expect(queryByTestId('test-calc-result')).toBeNull();
      });
    });
  });
});
