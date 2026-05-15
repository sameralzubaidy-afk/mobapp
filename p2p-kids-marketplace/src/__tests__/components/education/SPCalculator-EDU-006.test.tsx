// FILE: p2p-kids-marketplace/src/__tests__/components/education/SPCalculator-EDU-006.test.tsx
// MODULE-18 EDU-006: SPCalculator component unit tests (updated for dual-panel mode)

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
    bonus_badge_icon_url: 'https://example.com/bonus.png',
  },
  {
    id: 'cat-2',
    name: 'Books',
    icon: '📚',
    is_active: true,
    item_count: 5,
    sp_earning_multiplier: 1.10,
    sp_spending_cap_percent: 70,
    bonus_badge_icon_url: null,
  },
];

const mockSellResult = {
  mode: 'sell' as const,
  price: 25.0,
  category_id: 'cat-1',
  category_name: 'LEGO Sets',
  earn_sp: 33,
  multiplier: 1.30,
  is_bonus: true,
};

const mockBuyResult = {
  mode: 'buy' as const,
  price: 25.0,
  category_id: 'cat-1',
  category_name: 'LEGO Sets',
  max_sp_usable: 18,
  sp_spending_cap_percent: 70,
  sp_to_use: 0,
  cash_paid: 25.0,
  fee: 2.5,
  total_cost: 27.5,
  is_bonus: true,
};

describe('SPCalculator EDU-006', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (categoryService.getCategoriesWithCounts as jest.Mock).mockResolvedValue(mockCategories);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Free Mode', () => {
    it('renders with empty category selection', async () => {
      const { getByText, getByTestId } = render(
        <SPCalculator mode="free" testID="test-calc" />
      );

      await waitFor(() => {
        expect(getByText('Calculate Your Swap Points')).toBeTruthy();
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
        expect(getByTestId('test-calc-price-input')).toBeTruthy();
        expect(getByTestId('test-calc-empty-state')).toBeTruthy();
        expect(getByText('Select a category to see your SP')).toBeTruthy();
      });
    });

    it('allows category and price editing', async () => {
      const { getByTestId } = render(<SPCalculator mode="free" testID="test-calc" />);

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      const categoryPicker = getByTestId('test-calc-category-picker');
      expect(categoryPicker.props.disabled).toBeFalsy();

      const priceInput = getByTestId('test-calc-price-input');
      expect(priceInput.props.editable).toBeTruthy();
    });

    it('shows BOTH sell and buy panels simultaneously', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce(mockSellResult)
        .mockResolvedValueOnce(mockBuyResult);

      const onCalculate = jest.fn();
      const { getByTestId, getByText } = render(
        <SPCalculator mode="free" testID="test-calc" onCalculate={onCalculate} />
      );

      await waitFor(() => {
        expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      });

      // Open category modal and select
      fireEvent.press(getByTestId('test-calc-category-picker'));
      await waitFor(() => {
        expect(getByTestId('test-calc-category-modal')).toBeTruthy();
      });

      // Enter price (triggers auto-calculate on blur)
      const priceInput = getByTestId('test-calc-price-input');
      fireEvent.changeText(priceInput, '25.00');
      fireEvent(priceInput, 'blur');

      await waitFor(() => {
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25.0, expect.any(String), 'sell');
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25.0, expect.any(String), 'buy');
        expect(getByTestId('test-calc-sell-panel')).toBeTruthy();
        expect(getByTestId('test-calc-buy-panel')).toBeTruthy();
        expect(getByText('If You Sell:')).toBeTruthy();
        expect(getByText('If You Buy:')).toBeTruthy();
      });

      expect(onCalculate).toHaveBeenCalledWith(mockSellResult, mockBuyResult);
    });

    it('enforces price limits (0-10000)', async () => {
      const { getByTestId } = render(<SPCalculator mode="free" testID="test-calc" />);

      const priceInput = getByTestId('test-calc-price-input');

      // Test upper limit
      fireEvent.changeText(priceInput, '15000');
      expect(priceInput.props.value).not.toBe('15000');

      // Test negative
      fireEvent.changeText(priceInput, '-5');
      expect(priceInput.props.value).not.toBe('-5');

      // Test valid range
      fireEvent.changeText(priceInput, '100.00');
      await waitFor(() => {
        expect(priceInput.props.value).toBe('100.00');
      });
    });
  });

  describe('Auto Mode', () => {
    it('pre-fills category but allows editing', async () => {
      const { getByTestId } = render(
        <SPCalculator mode="auto" initialCategoryId="cat-1" testID="test-calc" />
      );

      await waitFor(() => {
        const categoryPicker = getByTestId('test-calc-category-picker');
        expect(categoryPicker.props.disabled).toBeFalsy();
      });
    });

    it('pre-fills price but allows editing', async () => {
      const { getByTestId } = render(
        <SPCalculator mode="auto" initialPrice={50.00} testID="test-calc" />
      );

      await waitFor(() => {
        const priceInput = getByTestId('test-calc-price-input');
        expect(priceInput.props.value).toBe('50.00');
        expect(priceInput.props.editable).toBeTruthy();
      });
    });
  });

  describe('Locked Mode', () => {
    it('disables category and price editing', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce(mockSellResult)
        .mockResolvedValueOnce(mockBuyResult);

      const { getByTestId } = render(
        <SPCalculator
          mode="locked"
          initialCategoryId="cat-1"
          initialPrice={25.00}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        const categoryPicker = getByTestId('test-calc-category-picker');
        expect(categoryPicker.props.disabled).toBeTruthy();

        const priceInput = getByTestId('test-calc-price-input');
        expect(priceInput.props.editable).toBeFalsy();
        expect(priceInput.props.value).toBe('25.00');
      });
    });

    it('auto-calculates on mount when locked', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce(mockSellResult)
        .mockResolvedValueOnce(mockBuyResult);

      const { getByTestId } = render(
        <SPCalculator
          mode="locked"
          initialCategoryId="cat-1"
          initialPrice={25.00}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25.0, 'cat-1', 'sell');
        expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25.0, 'cat-1', 'buy');
        expect(getByTestId('test-calc-sell-panel')).toBeTruthy();
        expect(getByTestId('test-calc-buy-panel')).toBeTruthy();
      });
    });
  });

  describe('Analytics', () => {
    it('tracks calculator_use with correct price bucket', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValue(mockSellResult);

      const { getByTestId } = render(
        <SPCalculator mode="free" testID="test-calc" />
      );

      await waitFor(() => {
        const priceInput = getByTestId('test-calc-price-input');
        fireEvent.changeText(priceInput, '75.00');
        fireEvent(priceInput, 'blur');
      });

      await waitFor(() => {
        expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith(
          'calculator_use',
          {
            mode: 'free',
            category_id: expect.any(String),
            price_bucket: '50-100',
          }
        );
      });
    });

    it('buckets prices correctly', async () => {
      (spCalculatorService.calculateSP as jest.Mock).mockResolvedValue(mockSellResult);

      const testCases = [
        { price: '5.00', bucket: '<10' },
        { price: '25.00', bucket: '10-50' },
        { price: '75.00', bucket: '50-100' },
        { price: '150.00', bucket: '>100' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        const { getByTestId, unmount } = render(<SPCalculator mode="free" testID="test-calc" />);

        await waitFor(() => {
          const priceInput = getByTestId('test-calc-price-input');
          fireEvent.changeText(priceInput, testCase.price);
          fireEvent(priceInput, 'blur');
        });

        await waitFor(() => {
          expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith(
            'calculator_use',
            expect.objectContaining({
              price_bucket: testCase.bucket,
            })
          );
        });

        unmount();
      }
    });
  });

  describe('Bonus Badge', () => {
    it('renders bonus badge when is_bonus is true', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce({ ...mockSellResult, is_bonus: true })
        .mockResolvedValueOnce(mockBuyResult);

      const { getByTestId } = render(
        <SPCalculator
          mode="locked"
          initialCategoryId="cat-1"
          initialPrice={25.00}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        expect(getByTestId('test-calc-sell-bonus-badge')).toBeTruthy();
      });
    });

    it('does not render bonus badge when is_bonus is false', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce({ ...mockSellResult, is_bonus: false })
        .mockResolvedValueOnce(mockBuyResult);

      const { queryByTestId } = render(
        <SPCalculator
          mode="locked"
          initialCategoryId="cat-2"
          initialPrice={25.00}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        expect(queryByTestId('test-calc-sell-bonus-badge')).toBeNull();
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility labels', async () => {
      const { getByTestId } = render(<SPCalculator mode="free" testID="test-calc" />);

      await waitFor(() => {
        const categoryPicker = getByTestId('test-calc-category-picker');
        expect(categoryPicker.props.accessibilityLabel).toBe('Category');
        expect(categoryPicker.props.accessibilityRole).toBe('button');

        const priceInput = getByTestId('test-calc-price-input');
        expect(priceInput.props.accessibilityLabel).toBe('Item price, currency');
      });
    });

    it('has live region on results', async () => {
      (spCalculatorService.calculateSP as jest.Mock)
        .mockResolvedValueOnce(mockSellResult)
        .mockResolvedValueOnce(mockBuyResult);

      const { getByTestId } = render(
        <SPCalculator
          mode="locked"
          initialCategoryId="cat-1"
          initialPrice={25.00}
          testID="test-calc"
        />
      );

      await waitFor(() => {
        const results = getByTestId('test-calc-results');
        expect(results.props.accessibilityLiveRegion).toBe('polite');
      });
    });
  });
});
