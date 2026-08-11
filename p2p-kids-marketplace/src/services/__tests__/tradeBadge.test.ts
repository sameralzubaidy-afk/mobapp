/**
 * File: p2p-kids-marketplace/src/services/__tests__/tradeBadge.test.ts
 *
 * getActiveTradeCount — Trades tab badge count source.
 * Verifies the query targets the current user (buyer OR seller) and counts
 * only NON-terminal statuses (excludes completed/cancelled) so completed and
 * cancelled trades never count toward the badge.
 */
import { getActiveTradeCount } from '../trade';

const mockFrom = jest.fn();

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function mockChain(result: { count: number | null; error: any }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe('getActiveTradeCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when no user id is provided', async () => {
    await expect(getActiveTradeCount('')).resolves.toBe(0);
  });

  it('returns the count for trades where the user is buyer OR seller', async () => {
    const chain = mockChain({ count: 3, error: null });
    const count = await getActiveTradeCount('user-1');

    expect(count).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith('trades');
    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(chain.or).toHaveBeenCalledWith('buyer_id.eq.user-1,seller_id.eq.user-1');
  });

  it('excludes completed and cancelled trades from the count', async () => {
    const chain = mockChain({ count: 1, error: null });
    await getActiveTradeCount('user-1');
    expect(chain.not).toHaveBeenCalledWith('status', 'in', '("completed","cancelled")');
  });

  it('returns 0 on query error', async () => {
    mockChain({ count: null, error: { message: 'boom' } });
    await expect(getActiveTradeCount('user-1')).resolves.toBe(0);
  });
});
