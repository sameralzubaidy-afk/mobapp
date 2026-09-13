import { getBundleCounts, getPendingBundleCount, getPendingBundleItems } from '../bundleCount';

/**
 * FIX-Task-26 item 2 (QA Phase 0 F8): the banner counted the whole bundle while
 * the CTA counted pending items, so one render disagreed with itself. These pin
 * the single counting rule both call sites now use.
 */
describe('bundleCount', () => {
  const offer = { id: 'a', status: 'pending' };
  const accepted = { id: 'b', status: 'in_progress' };
  const completed = { id: 'c', status: 'completed' };
  const pendingSibling = { id: 'd', status: 'pending' };
  const declined = { id: 'e', status: 'cancelled' };

  it('counts the offer plus its pending siblings', () => {
    expect(getPendingBundleCount(offer, [accepted, pendingSibling, declined])).toBe(2);
  });

  it('counts pending siblings when the offer itself is no longer pending', () => {
    expect(getPendingBundleCount(accepted, [pendingSibling])).toBe(1);
    expect(getPendingBundleCount(completed, [pendingSibling])).toBe(1);
  });

  it('returns only actionable items', () => {
    expect(getPendingBundleItems(offer, [accepted, pendingSibling]).map((i) => i.id)).toEqual([
      'a',
      'd',
    ]);
  });

  it('separates accepted from otherwise-resolved items', () => {
    expect(getBundleCounts(offer, [accepted, completed, declined])).toEqual({
      total: 4,
      pending: 1,
      accepted: 2,
      resolved: 1,
    });
  });

  it('tolerates a missing offer or sibling list', () => {
    expect(getPendingBundleCount(null, [pendingSibling])).toBe(1);
    expect(getPendingBundleCount(offer, null)).toBe(1);
    expect(getBundleCounts(null, null)).toEqual({
      total: 0,
      pending: 0,
      accepted: 0,
      resolved: 0,
    });
  });
});
