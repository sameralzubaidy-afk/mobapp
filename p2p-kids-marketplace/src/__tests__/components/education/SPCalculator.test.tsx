import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SPCalculator } from '../../../components/education/SPCalculator';
import * as categoryService from '../../../services/categoryService';
import * as spCalculatorService from '../../../services/spCalculatorService';
import * as educationAnalyticsService from '../../../services/educationAnalyticsService';

jest.mock('../../../services/categoryService');
jest.mock('../../../services/spCalculatorService');
jest.mock('../../../services/educationAnalyticsService');

jest.mock('../../../components/listing/CategorySelectModal', () => ({
  CategorySelectModal: () => null,
}));

const mockCategories = [
  {
    id: 'cat-1',
    name: 'LEGO Sets',
    icon: '🧱',
    is_active: true,
    item_count: 10,
    sp_earning_multiplier: 1.3,
    sp_spending_cap_percent: 70,
  },
];

describe('SPCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (categoryService.getCategoriesWithCounts as jest.Mock).mockResolvedValue(mockCategories);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders free mode with empty-state prompt', async () => {
    const { getByTestId, getByText } = render(<SPCalculator mode="free" testID="test-calc" />);

    await waitFor(() => {
      expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      expect(getByTestId('test-calc-price-input')).toBeTruthy();
      expect(getByTestId('test-calc-empty-state')).toBeTruthy();
      expect(getByText('Select a category to see your SP')).toBeTruthy();
    });
  });

  it('shows price hint when category is preset but price is empty', async () => {
    const { getByTestId } = render(
      <SPCalculator mode="auto" initialCategoryId="cat-1" testID="test-calc" />
    );

    await waitFor(() => {
      expect(getByTestId('test-calc-price-hint')).toBeTruthy();
    });
  });

  it('auto-calculates in locked mode and renders both result panels', async () => {
    const mockSell = {
      mode: 'sell',
      price: 25,
      category_id: 'cat-1',
      category_name: 'LEGO Sets',
      earn_sp: 33,
      multiplier: 1.3,
      is_bonus: true,
    };

    const mockBuy = {
      mode: 'buy',
      price: 25,
      category_id: 'cat-1',
      category_name: 'LEGO Sets',
      max_sp_usable: 18,
      sp_spending_cap_percent: 70,
      sp_to_use: 0,
      cash_paid: 25,
      fee: 2.5,
      total_cost: 27.5,
      is_bonus: true,
    };

    (spCalculatorService.calculateSP as jest.Mock)
      .mockResolvedValueOnce(mockSell)
      .mockResolvedValueOnce(mockBuy);

    const onCalculate = jest.fn();
    const { getByTestId, getByText } = render(
      <SPCalculator
        mode="locked"
        initialCategoryId="cat-1"
        initialPrice={25}
        onCalculate={onCalculate}
        testID="test-calc"
      />
    );

    await waitFor(() => {
      expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25, 'cat-1', 'sell');
      expect(spCalculatorService.calculateSP).toHaveBeenCalledWith(25, 'cat-1', 'buy');
      expect(getByTestId('test-calc-sell-panel')).toBeTruthy();
      expect(getByTestId('test-calc-buy-panel')).toBeTruthy();
      expect(getByText('If You Sell:')).toBeTruthy();
      expect(getByText('If You Buy:')).toBeTruthy();
    });

    expect(onCalculate).toHaveBeenCalledWith(mockSell, mockBuy);
  });

  it('rejects out-of-range values in price input', async () => {
    const { getByTestId } = render(<SPCalculator mode="free" testID="test-calc" />);

    await waitFor(() => {
      expect(getByTestId('test-calc-price-input')).toBeTruthy();
    });

    const input = getByTestId('test-calc-price-input');
    fireEvent.changeText(input, '15000');

    expect(getByTestId('test-calc-price-input').props.value).toBe('');
  });

  it('refetches categories when refreshKey changes without remounting', async () => {
    (categoryService.getCategoriesWithCounts as jest.Mock)
      .mockResolvedValueOnce(mockCategories) // 1.3 on first load
      .mockResolvedValueOnce([{ ...mockCategories[0], sp_earning_multiplier: 1.4 }]); // 1.4 on focus

    const { getByTestId, rerender } = render(
      <SPCalculator mode="free" testID="test-calc" refreshKey={0} />
    );

    await waitFor(() => {
      // Initial mount load fires once.
      expect(categoryService.getCategoriesWithCounts).toHaveBeenCalledTimes(1);
      expect(getByTestId('test-calc-category-picker')).toBeTruthy();
    });

    // Simulate a screen-focus event: parent bumps refreshKey while this
    // component stays mounted (no remount). Categories must re-fetch.
    rerender(<SPCalculator mode="free" testID="test-calc" refreshKey={1} />);

    await waitFor(() => {
      expect(categoryService.getCategoriesWithCounts).toHaveBeenCalledTimes(2);
    });
  });
});
