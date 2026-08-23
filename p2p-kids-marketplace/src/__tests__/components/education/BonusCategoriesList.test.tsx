// FILE: p2p-kids-marketplace/src/__tests__/components/education/BonusCategoriesList.test.tsx
// QA: Group Q+S 2026-08-23 Item 3 — bonus categories must reflect an admin
// multiplier change after a focus/refresh refetch without a full remount.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { BonusCategoriesList } from '../../../components/education/BonusCategoriesList';
import * as spCalculatorService from '../../../services/spCalculatorService';

jest.mock('../../../services/spCalculatorService');

const booksAt = (multiplier: number) => [
  {
    id: 'books',
    name: 'Books',
    icon: '📚',
    icon_url: null,
    bonus_badge_icon_url: null,
    sp_earning_multiplier: multiplier,
    sp_spending_cap_percent: 70,
    item_count: 5,
  },
];

describe('BonusCategoriesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders bonus categories with their multiplier', async () => {
    (spCalculatorService.getBonusCategories as jest.Mock).mockResolvedValue(booksAt(1.3));

    const { getByText } = render(<BonusCategoriesList testID="bonus-list" />);

    await waitFor(() => {
      expect(getByText('Earn 1.30× SP')).toBeTruthy();
    });
  });

  it('reflects an updated multiplier after a focus refetch without a full remount', async () => {
    const mockGetBonusCategories = spCalculatorService.getBonusCategories as jest.Mock;
    // Set the value explicitly (a persistent mock value, not a One-queue) so
    // this test is deterministic regardless of test-ordering contamination.
    mockGetBonusCategories.mockResolvedValue(booksAt(1.3));

    const { getByText, queryByText, findByText, rerender } = render(
      <BonusCategoriesList testID="bonus-list" refreshKey={0} />
    );

    await waitFor(() => {
      expect(getByText('Earn 1.30× SP')).toBeTruthy();
    });

    // Admin bumps the multiplier; a screen-focus refetch picks it up while the
    // component stays mounted (no remount, no navigate away + back).
    mockGetBonusCategories.mockResolvedValue(booksAt(1.4));
    rerender(<BonusCategoriesList testID="bonus-list" refreshKey={1} />);

    // Wait for the fresh rate with a generous timeout — under full-suite
    // parallel load the refetch + re-render can exceed the default 1s budget.
    await findByText('Earn 1.40× SP', {}, { timeout: 5000 });
    expect(queryByText('Earn 1.30× SP')).toBeNull();
  });
});