/**
 * Unit Tests: adminConfig.getActiveMemberFeeCents — FIX-Task-47 item 4 (2026-09-16)
 *
 * The reader returned a hardcoded `149` when the live admin_config value could not
 * be read, and `getDefaultConfig()` supplied the same 149 — so a failed fetch was
 * indistinguishable from a real $1.49. It now returns `null`.
 *
 * These cases pin the rule at the SERVICE layer (the copy/UI half lives in
 * `utils/__tests__/memberFeeCopy.test.ts`).
 */

import { supabase } from '../../config/supabase';
import { getActiveMemberFeeCents } from '../adminConfig';

jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../devTestingService', () => ({
  getSimulatedConfigFetchFailure: jest.fn(async () => 'none'),
}));

const mockFrom = supabase.from as unknown as jest.Mock;

/** The exact read getAdminConfig performs: from().select().eq() -> { data, error }. */
function stubConfigRows(rows: Array<{ key: string; value: string; data_type: string }>) {
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
  });
}

const baseRow = (key: string, value: string) => ({ key, value, data_type: 'number' });

describe('getActiveMemberFeeCents — FIX-Task-47 item 4 (no silent 149)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the live admin_config value when it is present', async () => {
    stubConfigRows([baseRow('buyer_fee_active_member_cents', '149')]);

    await expect(getActiveMemberFeeCents(true)).resolves.toBe(149);
  });

  it('returns null — NOT 149 — when the key is absent from admin_config', async () => {
    // The exact scenario that used to render a wrong $1.49: the row is missing.
    stubConfigRows([baseRow('transaction_fee_subscriber_cents', '149')]);

    await expect(getActiveMemberFeeCents(true)).resolves.toBeNull();
  });

  it('returns null — NOT 149 — when the config read fails', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      }),
    });

    await expect(getActiveMemberFeeCents(true)).resolves.toBeNull();
  });

  it('returns null when the value is present but unparsable', async () => {
    stubConfigRows([baseRow('buyer_fee_active_member_cents', 'not-a-number')]);

    await expect(getActiveMemberFeeCents(true)).resolves.toBeNull();
  });

  it('honours a configured 0 (a real value, not an unavailable state)', async () => {
    stubConfigRows([baseRow('buyer_fee_active_member_cents', '0')]);

    await expect(getActiveMemberFeeCents(true)).resolves.toBe(0);
  });
});
