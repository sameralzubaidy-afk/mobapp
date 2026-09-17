/**
 * Unit Tests: getAdminConfig — FIX-Task-47 item 2 (2026-09-16)
 *
 * The subscription screens issue several FORCED admin_config reads at once
 * (Manage Kids Club+ 2, Upgrade Plan 3, Compare Plans 4). A forced read bypasses
 * the 5-minute TTL cache, so each one re-issued the FULL `admin_config` SELECT —
 * N concurrent reads of the same table, all racing to write the same cache slot.
 * They now share one in-flight request.
 */

import { supabase } from '../../config/supabase';
import { getAdminConfig } from '../adminConfig';

jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../devTestingService', () => ({
  getSimulatedConfigFetchFailure: jest.fn(async () => 'none'),
}));

const mockFrom = supabase.from as unknown as jest.Mock;

function stubConfigRows(rows: Array<{ key: string; value: string; data_type: string }>) {
  const eq = jest.fn(() => Promise.resolve({ data: rows, error: null }));
  const select = jest.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select });
  return { select, eq };
}

const ROWS = [{ key: 'buyer_fee_active_member_cents', value: '149', data_type: 'number' }];

describe('getAdminConfig — FIX-Task-47 item 2 (in-flight dedup)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares ONE admin_config read between concurrent forced callers', async () => {
    const { select } = stubConfigRows(ROWS);

    const [a, b, c] = await Promise.all([
      getAdminConfig(true),
      getAdminConfig(true),
      getAdminConfig(true),
    ]);

    // Before the fix this was 3 — one full SELECT per concurrent caller.
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    // All callers get the same parsed config.
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.buyer_fee_active_member_cents).toBe(149);
  });

  it('clears the slot once settled, so the next read fetches fresh', async () => {
    stubConfigRows(ROWS);

    await getAdminConfig(true);
    await getAdminConfig(true);

    // A stale in-flight slot would have frozen the config forever.
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('still returns the default config when the read fails (dedup does not swallow errors)', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      }),
    });

    const config = await getAdminConfig(true);

    // Fail-soft is unchanged; only the fee reader now reports "unavailable"
    // rather than inventing a number (FIX-Task-47 item 4).
    expect(config).toBeTruthy();
    expect(config.buyer_fee_active_member_cents).toBeUndefined();
  });
});
