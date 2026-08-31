/**
 * DT-63 (QA Task 7, item 2): unit tests for the checkout "Max: N SP" hint math.
 *
 * Regression: the old formula `wallet - (wallet - used) + spApplied` showed
 * "Max: 0 SP" whenever nothing was applied yet — even when the buyer had SP
 * (QA observed buyer with 4 SP seeing "Max: 0 SP"). computeMaxSpForItem fixes
 * the double-subtraction of the item's own applied amount.
 */
import { computeMaxSpForItem, getSpLimitInfo } from '@/utils/cartSpMath';

describe('computeMaxSpForItem', () => {
  it('shows the buyer wallet balance when nothing is applied (QA regression: 4 SP -> "Max: 4 SP", not 0)', () => {
    const state = {
      'listing-a': { spApplied: 0, maxAllowed: 19, catCap: 75 },
    };
    // Wallet 4, no SP applied anywhere -> Max = min(19, 4 - 0) = 4
    expect(computeMaxSpForItem(state, 4, 'listing-a')).toBe(4);
  });

  it('respects the category cap even when the wallet is larger', () => {
    const state = {
      'listing-a': { spApplied: 0, maxAllowed: 5, catCap: 50 },
    };
    // Wallet 10, cap 5 -> Max = min(5, 10 - 0) = 5
    expect(computeMaxSpForItem(state, 10, 'listing-a')).toBe(5);
  });

  it('deducts SP already applied by OTHER items but not this item', () => {
    const state = {
      'listing-a': { spApplied: 2, maxAllowed: 10, catCap: 70 },
      'listing-b': { spApplied: 0, maxAllowed: 10, catCap: 70 },
    };
    // For listing-b: other items use 2 -> Max = min(10, 4 - 2) = 2
    expect(computeMaxSpForItem(state, 4, 'listing-b')).toBe(2);
    // For listing-a: its own 2 is NOT subtracted -> Max = min(10, 4 - 0) = 4
    expect(computeMaxSpForItem(state, 4, 'listing-a')).toBe(4);
  });

  it('clamps to 0 when the wallet is fully consumed by other items', () => {
    const state = {
      'listing-a': { spApplied: 4, maxAllowed: 10, catCap: 70 },
      'listing-b': { spApplied: 0, maxAllowed: 10, catCap: 70 },
    };
    // listing-b has nothing left (other item used all 4) -> Max = 0
    expect(computeMaxSpForItem(state, 4, 'listing-b')).toBe(0);
  });

  it('returns 0 for an unknown item', () => {
    expect(computeMaxSpForItem({}, 4, 'missing')).toBe(0);
  });
});

describe('getSpLimitInfo (DEV-TASK-72 single SP ceiling)', () => {
  it('reports wallet as the binding source when the balance is the ceiling', () => {
    const state = { 'listing-a': { spApplied: 0, maxAllowed: 45, catCap: 75 } };
    // wallet 4 < cap 45 -> binding = 4, source wallet
    expect(getSpLimitInfo(state, 4, 'listing-a')).toEqual({ bindingMax: 4, source: 'wallet' });
  });

  it('reports category as the binding source when the category cap is the ceiling', () => {
    const state = { 'listing-a': { spApplied: 0, maxAllowed: 5, catCap: 50 } };
    // wallet 10 > cap 5 -> binding = 5, source category
    expect(getSpLimitInfo(state, 10, 'listing-a')).toEqual({ bindingMax: 5, source: 'category' });
  });

  it('accounts for SP applied by OTHER items when choosing the source', () => {
    const state = {
      'listing-a': { spApplied: 2, maxAllowed: 10, catCap: 70 },
      'listing-b': { spApplied: 0, maxAllowed: 10, catCap: 70 },
    };
    // listing-b: other items use 2 of wallet 4 -> binding = min(10, 4 - 2) = 2, wallet
    expect(getSpLimitInfo(state, 4, 'listing-b')).toEqual({ bindingMax: 2, source: 'wallet' });
    // listing-a: its own 2 is not subtracted -> binding = min(10, 4 - 0) = 4, wallet
    expect(getSpLimitInfo(state, 4, 'listing-a')).toEqual({ bindingMax: 4, source: 'wallet' });
  });

  it('falls back to category when wallet remaining equals the cap (same ceiling)', () => {
    const state = { 'listing-a': { spApplied: 0, maxAllowed: 4, catCap: 70 } };
    // wallet 4 == cap 4 -> binding = 4; no single smaller limit -> category
    expect(getSpLimitInfo(state, 4, 'listing-a')).toEqual({ bindingMax: 4, source: 'category' });
  });

  it('returns 0 / category for an unknown item', () => {
    expect(getSpLimitInfo({}, 4, 'missing')).toEqual({ bindingMax: 0, source: 'category' });
  });
});
