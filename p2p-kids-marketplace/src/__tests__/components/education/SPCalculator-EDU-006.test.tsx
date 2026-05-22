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
    bonus_badge_icon_url: 'https://example.com/bonus.png',
  },
];

describe('SPCalculator EDU-006', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (categoryService.getCategoriesWithCounts as jest.Mock).mockResolvedValue(mockCategories);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders category/price controls in free mode', async () => {
    const { getByTestId, getByText } = render(<SPCalculator mode="free" testID="test-calc" />);

    await waitFor(() => {
      expect(getByTestId('test-calc-category-picker')).toBeTruthy();
      expect(getByTestId('test-calc-price-input')).toBeTruthy();
      expect(getByText('Calculate Your Swap Points')).toBeTruthy();
    });
  });

  it('shows both sell and buy panels in locked mode', async () => {
    (spCalculatorService.calculateSP as jest.Mock)
      .mockResolvedValueOnce({
        mode: 'sell',
        price: 25,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        earn_sp: 33,
        multiplier: 1.3,
        is_bonus: true,
      })
      .mockResolvedValueOnce({
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
      });

    const { getByTestId, getByText } = render(
      <SPCalculator mode="locked" initialCategoryId="cat-1" initialPrice={25} testID="test-calc" />
    );

    await waitFor(() => {
      expect(getByTestId('test-calc-sell-panel')).toBeTruthy();
      expect(getByTestId('test-calc-buy-panel')).toBeTruthy();
      expect(getByText('If You Sell:')).toBeTruthy();
      expect(getByText('If You Buy:')).toBeTruthy();
      expect(getByTestId('test-calc-sell-bonus-badge')).toBeTruthy();
    });
  });

  it('tracks calculator_use when locked mode auto-calculates', async () => {
    (spCalculatorService.calculateSP as jest.Mock)
      .mockResolvedValueOnce({
        mode: 'sell',
        price: 75,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        earn_sp: 98,
        multiplier: 1.3,
        is_bonus: true,
      })
      .mockResolvedValueOnce({
        mode: 'buy',
        price: 75,
        category_id: 'cat-1',
        category_name: 'LEGO Sets',
        max_sp_usable: 52,
        sp_spending_cap_percent: 70,
        sp_to_use: 0,
        cash_paid: 75,
        fee: 7.5,
        total_cost: 82.5,
        is_bonus: true,
      });

    render(<SPCalculator mode="locked" initialCategoryId="cat-1" initialPrice={75} testID="test-calc" />);

    await waitFor(() => {
      expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith('calculator_use', {
        mode: 'locked',
        category_id: 'cat-1',
        price_bucket: '50-100',
      });
    });
  });

  it('keeps price unchanged when value exceeds max bound', async () => {
    const { getByTestId } = render(<SPCalculator mode="free" testID="test-calc" />);

    await waitFor(() => {
      expect(getByTestId('test-calc-price-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('test-calc-price-input'), '100.00');
    fireEvent.changeText(getByTestId('test-calc-price-input'), '15000');

    expect(getByTestId('test-calc-price-input').props.value).toBe('100.00');
  });
});
