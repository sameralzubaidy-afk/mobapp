import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BulkSPSummaryCard } from '../../components/bulk/BulkSPSummaryCard';
import { useCategorySPCache } from '../../hooks/useCategorySPCache';

jest.mock('../../hooks/useCategorySPCache');

const mockUseCategorySPCache = useCategorySPCache as jest.MockedFunction<typeof useCategorySPCache>;

describe('BulkSPSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const multiplierMap = new Map<string, number>([
      ['cat-sports', 1.1],
      ['cat-toys', 1.2],
      ['cat-books', 1.3],
    ]);

    const categoryNameMap = new Map<string, string>([
      ['cat-sports', 'Sports'],
      ['cat-toys', 'Toys'],
      ['cat-books', 'Books'],
    ]);

    mockUseCategorySPCache.mockReturnValue({
      multipliers: multiplierMap,
      categoryNames: categoryNameMap,
      loading: false,
      error: null,
      getMultiplier: (categoryId: string | null) => {
        if (!categoryId) return 1.1;
        return multiplierMap.get(categoryId) || 1.1;
      },
      getCategoryName: (categoryId: string | null) => {
        if (!categoryId) return 'Unknown';
        return categoryNameMap.get(categoryId) || categoryId;
      },
      refresh: jest.fn(),
    });
  });

  it('calculates total SP from SP-enabled included items only and highlights cash-only count', () => {
    const { getByText, getByTestId, queryByText } = render(
      <BulkSPSummaryCard
        isSubscriber
        items={[
          {
            category_id: 'cat-sports',
            price: 30,
            includeInPublish: true,
            accepts_swap_points: false,
          },
          {
            category_id: 'cat-toys',
            price: 30,
            includeInPublish: true,
            accepts_swap_points: true,
          },
          {
            category_id: 'cat-books',
            price: 40,
            includeInPublish: true,
            accepts_swap_points: true,
          },
          {
            category_id: 'cat-toys',
            price: 10,
            includeInPublish: false,
            accepts_swap_points: true,
          },
        ]}
      />
    );

    expect(getByText('Included items:')).toBeTruthy();
    expect(getByText('SP-enabled items:')).toBeTruthy();

    // Included items: 3 (excluded item is not counted)
    expect(getByText('3')).toBeTruthy();
    // SP-enabled items: 2
    expect(getByText('2')).toBeTruthy();

    // Total should exclude sports item because it does not accept SP.
    // toys 30 * 1.2 = 36, books 40 * 1.3 = 52 => total 88
    expect(getByTestId('total-sp-subscriber')).toHaveTextContent('~88 SP');

    expect(getByTestId('non-accepting-sp-items')).toHaveTextContent('1 item is set to Cash Only');

    // Expand breakdown and verify only SP-enabled categories appear.
    fireEvent.press(getByTestId('breakdown-toggle'));

    expect(getByText(/Toys/)).toBeTruthy();
    expect(getByText(/Books/)).toBeTruthy();
    expect(queryByText(/Sports/)).toBeNull();
  });

  it('shows no-sp-enabled state when included items are cash-only', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <BulkSPSummaryCard
        isSubscriber
        items={[
          {
            category_id: 'cat-sports',
            price: 30,
            includeInPublish: true,
            accepts_swap_points: false,
          },
          {
            category_id: 'cat-books',
            price: 40,
            includeInPublish: true,
            accepts_swap_points: false,
          },
        ]}
      />
    );

    expect(getByText('Included items:')).toBeTruthy();
    expect(getByText('SP-enabled items:')).toBeTruthy();
    expect(getByTestId('non-accepting-sp-items')).toHaveTextContent('2 items are set to Cash Only');
    expect(getByText(/Enable/)).toBeTruthy();

    expect(queryByTestId('total-sp-subscriber')).toBeNull();
  });
});
