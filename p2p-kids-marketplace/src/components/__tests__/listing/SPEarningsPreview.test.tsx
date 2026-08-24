/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/SPEarningsPreview.test.tsx
 * J15: Buyer Max-SP-Cap Preview — the buyer-cap line must reflect the category's
 * DB-configured `sp_spending_cap_percent` and update when price or category changes.
 *
 * Coverage:
 * - Buyer cap shown as a real SP figure relative to the entered price
 * - Recalculation when the price changes
 * - Recalculation when the category changes (per-category cap, never hardcoded)
 * - Percentage-only line (no $0 figure) before a price is entered
 * - Hidden when no category is selected
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SPEarningsPreview } from '../../listing/SPEarningsPreview';
import { useCategorySPCache } from '../../../hooks/useCategorySPCache';

jest.mock('../../../hooks/useCategorySPCache');
jest.mock('../../modals/SPInfoTooltip', () => ({
  SPInfoTooltip: () => null,
}));

const mockUseCategorySPCache = useCategorySPCache as jest.MockedFunction<typeof useCategorySPCache>;

const CAPS = new Map<string, number>([
  ['cat-books', 80],
  ['cat-toys', 75],
]);
const MULTIPLIERS = new Map<string, number>([
  ['cat-books', 1.3],
  ['cat-toys', 1.2],
]);
const NAMES = new Map<string, string>([
  ['cat-books', 'Books'],
  ['cat-toys', 'Toys'],
]);

const defaultMock = {
  multipliers: MULTIPLIERS,
  categoryNames: NAMES,
  capPercents: CAPS,
  loading: false,
  error: null,
  getMultiplier: (categoryId: string | null) =>
    categoryId ? MULTIPLIERS.get(categoryId) || 1.1 : 1.1,
  getCategoryName: (categoryId: string | null) =>
    categoryId ? NAMES.get(categoryId) || categoryId : 'Unknown',
  getSpendingCapPercent: (categoryId: string | null) =>
    categoryId ? CAPS.get(categoryId) || 70 : 70,
  refresh: jest.fn(),
};

describe('SPEarningsPreview — buyer max-SP cap line (J15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCategorySPCache.mockReturnValue(defaultMock as any);
  });

  it('shows the DB-configured buyer cap as a concrete SP figure for the entered price', () => {
    const { getByTestId, getByText } = render(
      <SPEarningsPreview categoryId="cat-books" price={40} isSubscriber />
    );

    // Books cap = 80% → floor(40 * 0.80) = 32 SP against a $40 price.
    expect(getByTestId('buyer-cap-line')).toBeTruthy();
    expect(
      getByText('Buyers can pay up to ~32 SP toward this $40 price with Swap Points')
    ).toBeTruthy();
  });

  it('recalculates the buyer cap when the price changes', async () => {
    const { getByText, rerender } = render(
      <SPEarningsPreview categoryId="cat-books" price={40} isSubscriber />
    );

    rerender(<SPEarningsPreview categoryId="cat-books" price={20} isSubscriber />);

    // Books cap = 80% → floor(20 * 0.80) = 16 SP against a $20 price. The price
    // is debounced (300ms), so wait for the recalculated value to surface.
    await waitFor(() => {
      expect(
        getByText('Buyers can pay up to ~16 SP toward this $20 price with Swap Points')
      ).toBeTruthy();
    });
  });

  it('recalculates the buyer cap when the category changes (per-category cap)', () => {
    const { getByText, rerender } = render(
      <SPEarningsPreview categoryId="cat-books" price={40} isSubscriber />
    );

    // Switch to Toys: cap 75% → floor(40 * 0.75) = 30 SP (not Books' 32).
    rerender(<SPEarningsPreview categoryId="cat-toys" price={40} isSubscriber />);

    expect(
      getByText('Buyers can pay up to ~30 SP toward this $40 price with Swap Points')
    ).toBeTruthy();
  });

  it('uses the DB-configured cap value, not a hardcoded one', () => {
    // Category with a non-default cap (60%) → 60% of $50 = 30 SP.
    mockUseCategorySPCache.mockReturnValue({
      ...defaultMock,
      capPercents: new Map([['cat-clothes', 60]]),
      getSpendingCapPercent: (categoryId: string | null) => (categoryId ? 60 : 70),
    } as any);

    const { getByText } = render(
      <SPEarningsPreview categoryId="cat-clothes" price={50} isSubscriber />
    );

    expect(
      getByText('Buyers can pay up to ~30 SP toward this $50 price with Swap Points')
    ).toBeTruthy();
  });

  it('shows a percentage-only line (no $0 figure) when no price is entered', () => {
    const { getByText } = render(
      <SPEarningsPreview categoryId="cat-books" price={0} isSubscriber />
    );

    expect(getByText('Buyers can pay up to 80% of the price with Swap Points')).toBeTruthy();
  });

  it('does not render a buyer cap line until a category is selected', () => {
    const { queryByTestId } = render(
      <SPEarningsPreview categoryId={null} price={40} isSubscriber />
    );

    expect(queryByTestId('buyer-cap-line')).toBeNull();
  });

  it('keeps the seller-earn estimate and the buyer-cap line visually separate', () => {
    const { getByTestId } = render(
      <SPEarningsPreview categoryId="cat-books" price={40} isSubscriber />
    );

    // Seller earn: Books 1.3x → round(40 * 1.3) = 52 SP
    expect(getByTestId('sp-estimate-subscriber')).toBeTruthy();
    expect(getByTestId('buyer-cap-line')).toBeTruthy();
  });
});
